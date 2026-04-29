"""Correios shipping calculation service.

Estrategia pragmatica:
- Usa o endpoint legacy CalcPrecoPrazo (XML por GET) que funciona sem contrato
  para servicos publicos (PAC 04510, SEDEX 04014). Com contrato (sCdEmpresa+sDsSenha)
  retorna preco contratual.
- Cache 1h por (cep_destino, peso_total, dimensoes, servicos).
- "Retirada Local" gerenciado aqui (preco e flag configuraveis).

Config no DB (settings doc _id=global):
  correios_enabled: bool
  correios_origin_cep: str (CEP origem da empresa)
  correios_contract: str (sCdEmpresa, opcional)
  correios_password: str (sDsSenha, opcional)
  correios_services: list[{code, label}] - default PAC e SEDEX
  correios_pickup_enabled: bool
  correios_pickup_label: str ("Retirada no Local")
  correios_pickup_address: str
  correios_pickup_price: float (default 0)
  correios_default_dimensions: {length,width,height} (cm)
"""
import os
import logging
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
import httpx
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

CORREIOS_ENDPOINT = "http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx"

DEFAULT_SERVICES = [
    {"code": "04510", "label": "PAC"},
    {"code": "04014", "label": "SEDEX"},
]

DEFAULT_CONFIG = {
    "correios_enabled": False,
    "correios_origin_cep": "",
    "correios_contract": "",
    "correios_password": "",
    "correios_services": DEFAULT_SERVICES,
    "correios_pickup_enabled": False,
    "correios_pickup_label": "Retirada no Local",
    "correios_pickup_address": "",
    "correios_pickup_price": 0.0,
    "correios_default_length_cm": 16,
    "correios_default_width_cm": 11,
    "correios_default_height_cm": 6,
    "correios_min_weight_kg": 0.3,
    "correios_cache_minutes": 60,
}


async def get_config(db) -> Dict:
    s = await db.settings.find_one({"_id": "global"}) or {}
    out = {**DEFAULT_CONFIG}
    for k in DEFAULT_CONFIG:
        if k in s:
            out[k] = s[k]
    return out


async def update_config(db, updates: Dict) -> Dict:
    allowed = set(DEFAULT_CONFIG.keys())
    set_doc = {k: v for k, v in updates.items() if k in allowed}
    if set_doc:
        set_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"_id": "global"}, {"$set": set_doc}, upsert=True)
    return await get_config(db)


def _normalize_cep(cep: str) -> str:
    return "".join(c for c in (cep or "") if c.isdigit())


def _calc_package(items: List[Dict], cfg: Dict) -> Dict:
    """Calcula peso total (kg), dimensoes max (cm). Items sao do carrinho com quantity."""
    total_w = 0.0
    max_l = cfg.get("correios_default_length_cm") or 16
    max_w = cfg.get("correios_default_width_cm") or 11
    max_h = cfg.get("correios_default_height_cm") or 6
    for it in items:
        qty = int(it.get("quantity") or 1)
        w = float(it.get("weight") or 0) or 0.3  # default 300g
        total_w += w * qty
        L = float(it.get("length_cm") or 0) or max_l
        W = float(it.get("width_cm") or 0) or max_w
        H = float(it.get("height_cm") or 0) or max_h
        max_l = max(max_l, L)
        max_w = max(max_w, W)
        max_h = max(max_h, H)
    total_w = max(total_w, float(cfg.get("correios_min_weight_kg") or 0.3))
    # Correios minimos: comprimento >=16, largura >=11, altura >=2
    return {
        "weight_kg": round(total_w, 3),
        "length_cm": max(int(max_l), 16),
        "width_cm": max(int(max_w), 11),
        "height_cm": max(int(max_h), 2),
    }


def _cache_key(cep_dest: str, pkg: Dict, services: List[str]) -> str:
    raw = json.dumps({"cep": cep_dest, "pkg": pkg, "svc": sorted(services)}, sort_keys=True)
    return "freight_" + hashlib.md5(raw.encode()).hexdigest()


async def _get_cached(db, key: str, max_age_minutes: int) -> Optional[Dict]:
    rec = await db.freight_cache.find_one({"cache_key": key}, {"_id": 0})
    if not rec:
        return None
    age = datetime.now(timezone.utc) - datetime.fromisoformat(rec["cached_at"])
    if age > timedelta(minutes=max_age_minutes):
        return None
    return rec.get("result")


async def _set_cached(db, key: str, result: Dict):
    await db.freight_cache.update_one(
        {"cache_key": key},
        {"$set": {"cache_key": key, "result": result, "cached_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def _call_correios(cep_origin: str, cep_dest: str, pkg: Dict, codes_csv: str,
                          contract: str = "", password: str = "", declared_value: float = 0.0) -> List[Dict]:
    params = {
        "nCdEmpresa": contract or "",
        "sDsSenha": password or "",
        "nCdServico": codes_csv,
        "sCepOrigem": cep_origin,
        "sCepDestino": cep_dest,
        "nVlPeso": str(pkg["weight_kg"]),
        "nCdFormato": "1",  # caixa/pacote
        "nVlComprimento": str(pkg["length_cm"]),
        "nVlAltura": str(pkg["height_cm"]),
        "nVlLargura": str(pkg["width_cm"]),
        "nVlDiametro": "0",
        "sCdMaoPropria": "N",
        "nVlValorDeclarado": f"{declared_value:.2f}" if declared_value > 0 else "0",
        "sCdAvisoRecebimento": "N",
        "StrRetorno": "xml",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(CORREIOS_ENDPOINT, params=params)
        r.raise_for_status()
        text = r.text
    out = []
    try:
        root = ET.fromstring(text)
        for serv in root.findall(".//cServico"):
            def gt(tag):
                el = serv.find(tag)
                return (el.text or "").strip() if el is not None else ""
            erro = gt("Erro")
            if erro and erro != "0":
                out.append({"code": gt("Codigo"), "error_code": erro, "error_msg": gt("MsgErro")})
                continue
            try:
                price = float((gt("Valor") or "0").replace(".", "").replace(",", "."))
            except Exception:
                price = 0.0
            try:
                deadline = int(gt("PrazoEntrega") or 0)
            except Exception:
                deadline = 0
            out.append({"code": gt("Codigo"), "price": price, "deadline_days": deadline})
    except Exception as e:
        logger.exception(f"Falha parsing XML correios: {e} | body={text[:500]}")
        raise
    return out


async def calculate_freight(db, cep_destination: str, items: List[Dict],
                             declared_value: float = 0.0) -> Dict:
    """Calcula frete. items=[{weight, length_cm, width_cm, height_cm, quantity}].

    Retorna {options:[{code,label,price,deadline_days,error?}], package:{...}, cache:bool}
    """
    cep_dest = _normalize_cep(cep_destination)
    if len(cep_dest) != 8:
        return {"options": [], "package": None, "error": "CEP destino invalido"}

    cfg = await get_config(db)
    pkg = _calc_package(items, cfg)

    options: List[Dict] = []
    cache_used = False

    # Pickup local
    if cfg.get("correios_pickup_enabled"):
        options.append({
            "code": "PICKUP",
            "label": cfg.get("correios_pickup_label") or "Retirada no Local",
            "price": float(cfg.get("correios_pickup_price") or 0),
            "deadline_days": 0,
            "address": cfg.get("correios_pickup_address") or "",
            "pickup": True,
        })

    if not cfg.get("correios_enabled"):
        return {"options": options, "package": pkg, "cache": False}

    cep_origin = _normalize_cep(cfg.get("correios_origin_cep"))
    if len(cep_origin) != 8:
        return {"options": options, "package": pkg, "error": "CEP de origem nao configurado"}

    services = cfg.get("correios_services") or DEFAULT_SERVICES
    if not services:
        return {"options": options, "package": pkg}
    codes = [s["code"] for s in services]
    code_to_label = {s["code"]: s.get("label") or s["code"] for s in services}

    # Cache
    key = _cache_key(cep_dest, pkg, codes)
    cached = await _get_cached(db, key, cfg.get("correios_cache_minutes") or 60)
    if cached:
        cache_used = True
        for c in cached:
            options.append({
                **c,
                "label": code_to_label.get(c.get("code"), c.get("code")),
            })
        return {"options": options, "package": pkg, "cache": cache_used}

    # Chamada real
    try:
        results = await _call_correios(
            cep_origin=cep_origin, cep_dest=cep_dest, pkg=pkg,
            codes_csv=",".join(codes),
            contract=cfg.get("correios_contract") or "",
            password=cfg.get("correios_password") or "",
            declared_value=declared_value,
        )
    except Exception as e:
        logger.exception(f"Erro Correios: {e}")
        for c in codes:
            options.append({
                "code": c, "label": code_to_label.get(c, c), "price": 0,
                "deadline_days": 0, "error": "Servico indisponivel temporariamente",
            })
        await db.correios_logs.insert_one({
            "log_id": "clog_" + os.urandom(6).hex(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "cep_origin": cep_origin, "cep_dest": cep_dest, "pkg": pkg,
            "error": str(e)[:300],
        })
        return {"options": options, "package": pkg, "cache": False}

    cacheable = []
    for r in results:
        item = {
            "code": r.get("code"),
            "label": code_to_label.get(r.get("code"), r.get("code")),
            "price": float(r.get("price") or 0),
            "deadline_days": int(r.get("deadline_days") or 0),
        }
        if r.get("error_code"):
            item["error"] = f"[{r['error_code']}] {r.get('error_msg', '')}"
        else:
            cacheable.append({"code": item["code"], "price": item["price"], "deadline_days": item["deadline_days"]})
        options.append(item)
    if cacheable:
        await _set_cached(db, key, cacheable)

    await db.correios_logs.insert_one({
        "log_id": "clog_" + os.urandom(6).hex(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "cep_origin": cep_origin, "cep_dest": cep_dest, "pkg": pkg,
        "results": results,
    })
    return {"options": options, "package": pkg, "cache": False}
