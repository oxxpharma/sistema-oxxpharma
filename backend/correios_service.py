"""Correios shipping calculation service - CWS API (Bearer Token).

Auth: POST /token/v1/autentica/contrato
  Basic Auth: user:api_code
  Body: { "numero": contract_number }
  Returns: { token, expiraEm (ISO datetime) }

Price: POST /preco/v1/nacional - parametrosProduto array
Deadline: POST /prazo/v1/nacional - parametrosPrazo array

Environments:
  homologacao -> https://apihom.correios.com.br
  producao    -> https://api.correios.com.br

Config no DB (settings doc _id=global):
  correios_enabled: bool
  correios_environment: "homologacao" | "producao"
  correios_user: str (login Meu Correios)
  correios_api_code: str (codigo de acesso CWS)
  correios_contract: str (numero do contrato)
  correios_origin_cep: str
  correios_services: list[{code, label}]
  correios_pickup_*
  correios_default_dimensions
  correios_min_weight_kg
  correios_cache_minutes
"""
import os
import logging
import hashlib
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

API_HOM = "https://apihom.correios.com.br"
API_PROD = "https://api.correios.com.br"

# Codigos comuns CWS (com contrato)
DEFAULT_SERVICES = [
    {"code": "03298", "label": "PAC"},
    {"code": "03220", "label": "SEDEX"},
]

DEFAULT_CONFIG = {
    "correios_enabled": False,
    "correios_environment": "homologacao",
    "correios_user": "",
    "correios_api_code": "",
    "correios_contract": "",
    "correios_dr": "",  # Superintendencia Estadual - opcional, obrigatorio para alguns contratos
    "correios_origin_cep": "",
    "correios_services": DEFAULT_SERVICES,
    "correios_pickup_enabled": False,
    "correios_pickup_label": "Retirada no Local",
    "correios_pickup_address": "",
    "correios_pickup_price": 0.0,
    # Iter 47: campos do toggle dedicado de Retirada no Local (independente do provider de frete)
    "pickup_enabled": False,
    "pickup_address": "",
    "pickup_phone": "",
    "pickup_hours": "",
    "pickup_instructions": "",
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
    # Validar environment
    if "correios_environment" in set_doc and set_doc["correios_environment"] not in ("homologacao", "producao"):
        raise ValueError("correios_environment deve ser 'homologacao' ou 'producao'")
    if set_doc:
        set_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"_id": "global"}, {"$set": set_doc}, upsert=True)
        # Invalida tokens cacheados ao mudar credenciais
        for k in ("correios_user", "correios_api_code", "correios_contract", "correios_environment"):
            if k in set_doc:
                await db.correios_tokens.delete_many({})
                break
    return await get_config(db)


def _api_base(env: str) -> str:
    return API_PROD if env == "producao" else API_HOM


def _normalize_cep(cep: str) -> str:
    return "".join(c for c in (cep or "") if c.isdigit())


# ============================ AUTH ============================

async def _get_token(db, cfg: Dict) -> str:
    """Retorna Bearer token, usando cache (50min) e renovando quando expirar."""
    user = (cfg.get("correios_user") or "").strip()
    code = (cfg.get("correios_api_code") or "").strip()
    contract = (cfg.get("correios_contract") or "").strip()
    env = cfg.get("correios_environment") or "homologacao"
    if not (user and code and contract):
        raise RuntimeError("Credenciais Correios incompletas (user/api_code/contract)")

    cache_id = f"{env}:{user}:{contract}"
    cached = await db.correios_tokens.find_one({"_id": cache_id})
    if cached and cached.get("expires_at"):
        try:
            exp = datetime.fromisoformat(cached["expires_at"])
            if exp > datetime.now(timezone.utc) + timedelta(seconds=60):
                return cached["token"]
        except Exception:
            pass

    base = _api_base(env)
    url = f"{base}/token/v1/autentica/contrato"
    auth = httpx.BasicAuth(user, code)
    # Payload suporta "dr" opcional (Superintendencia Estadual) - documentacao Correios nov/2025
    payload: Dict = {"numero": contract}
    dr = (cfg.get("correios_dr") or "").strip()
    if dr:
        try:
            payload["dr"] = int(dr)
        except (TypeError, ValueError):
            pass

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(url, json=payload, auth=auth)
        if r.status_code == 429:
            await _log(db, "auth", url, payload, r.status_code, "rate_limit", None, env)
            raise RuntimeError(
                "Correios CWS: limite de requisições atingido (HTTP 429). "
                "Aguarde alguns minutos antes de tentar novamente."
            )
        if r.status_code >= 400:
            await _log(db, "auth", url, payload, r.status_code, r.text[:500], None, env)
            raise RuntimeError(f"Falha autenticacao Correios CWS {r.status_code}: {r.text[:200]}")
        data = r.json()

    token = data.get("token") or ""
    expira = data.get("expiraEm")
    try:
        # Correios retorna em formato ISO sem timezone (assume horario de Brasilia)
        if expira:
            if "+" not in expira and "Z" not in expira:
                expira_dt = datetime.fromisoformat(expira).replace(tzinfo=timezone.utc) - timedelta(hours=3)
                expira_dt = expira_dt.astimezone(timezone.utc)
            else:
                expira_dt = datetime.fromisoformat(expira.replace("Z", "+00:00"))
        else:
            expira_dt = datetime.now(timezone.utc) + timedelta(minutes=55)
    except Exception:
        expira_dt = datetime.now(timezone.utc) + timedelta(minutes=55)

    await db.correios_tokens.update_one(
        {"_id": cache_id},
        {"$set": {"_id": cache_id, "token": token, "expires_at": expira_dt.isoformat(),
                  "obtained_at": datetime.now(timezone.utc).isoformat(),
                  "env": env, "user": user, "contract": contract}},
        upsert=True,
    )
    await _log(db, "auth", url, payload, r.status_code, "token_ok", None, env)
    return token


# ============================ LOGS ============================

async def _log(db, kind: str, url: str, request_body, status_code, response_body, error, env: str):
    try:
        await db.correios_logs.insert_one({
            "log_id": "clog_" + os.urandom(6).hex(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "kind": kind,
            "env": env,
            "url": url,
            "request_body": request_body,
            "status_code": status_code,
            "response_body": str(response_body)[:1500] if response_body else None,
            "error": str(error)[:500] if error else None,
        })
    except Exception:
        pass


# ============================ PRICE + DEADLINE ============================

def _calc_package(items: List[Dict], cfg: Dict) -> Dict:
    total_w = 0.0
    max_l = cfg.get("correios_default_length_cm") or 16
    max_w = cfg.get("correios_default_width_cm") or 11
    max_h = cfg.get("correios_default_height_cm") or 6
    for it in items:
        qty = int(it.get("quantity") or 1)
        w = float(it.get("weight") or 0) or 0.3
        total_w += w * qty
        L = float(it.get("length_cm") or 0) or max_l
        W = float(it.get("width_cm") or 0) or max_w
        H = float(it.get("height_cm") or 0) or max_h
        max_l = max(max_l, L)
        max_w = max(max_w, W)
        max_h = max(max_h, H)
    total_w = max(total_w, float(cfg.get("correios_min_weight_kg") or 0.3))
    return {
        "weight_kg": round(total_w, 3),
        "length_cm": max(int(max_l), 16),
        "width_cm": max(int(max_w), 11),
        "height_cm": max(int(max_h), 2),
    }


def _cache_key(env: str, contract: str, cep_dest: str, pkg: Dict, services: List[str]) -> str:
    raw = json.dumps({
        "e": env, "c": contract, "cep": cep_dest, "pkg": pkg, "svc": sorted(services)
    }, sort_keys=True)
    return "freight_" + hashlib.md5(raw.encode()).hexdigest()


async def _get_cached(db, key: str, max_age_minutes: int) -> Optional[List[Dict]]:
    rec = await db.freight_cache.find_one({"cache_key": key}, {"_id": 0})
    if not rec:
        return None
    age = datetime.now(timezone.utc) - datetime.fromisoformat(rec["cached_at"])
    if age > timedelta(minutes=max_age_minutes):
        return None
    return rec.get("result")


async def _set_cached(db, key: str, result):
    await db.freight_cache.update_one(
        {"cache_key": key},
        {"$set": {"cache_key": key, "result": result, "cached_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def _post_with_token(db, cfg, path: str, body: Dict) -> Tuple[int, Dict]:
    env = cfg.get("correios_environment") or "homologacao"
    base = _api_base(env)
    url = base + path
    token = await _get_token(db, cfg)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=body, headers=headers)
        # Token expirado: limpa cache e tenta uma vez
        if r.status_code == 401:
            await db.correios_tokens.delete_many({})
            token = await _get_token(db, cfg)
            headers["Authorization"] = f"Bearer {token}"
            r = await client.post(url, json=body, headers=headers)
        await _log(db, path, url, body, r.status_code, r.text[:1500], None, env)
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
    return r.status_code, data


async def _calculate_prices(db, cfg: Dict, cep_orig: str, cep_dest: str, pkg: Dict,
                              services: List[Dict], declared_value: float = 0) -> Dict[str, Dict]:
    """Retorna {service_code: {price, base_price}} ou {service_code: {error}}."""
    out: Dict[str, Dict] = {}
    weight_grams = int(round(pkg["weight_kg"] * 1000))
    products = []
    for idx, s in enumerate(services):
        body = {
            "coProduto": s["code"],
            "nuRequisicao": f"{idx+1:04d}",
            "cepOrigem": cep_orig,
            "cepDestino": cep_dest,
            "psObjeto": str(weight_grams),
            "tpObjeto": "2",
            "comprimento": str(pkg["length_cm"]),
            "largura": str(pkg["width_cm"]),
            "altura": str(pkg["height_cm"]),
            "diametro": "0",
            "nuContrato": cfg.get("correios_contract") or "",
        }
        if declared_value and declared_value > 0:
            body["vlDeclarado"] = f"{declared_value:.2f}"
        products.append(body)

    payload = {"idLote": f"lote_{int(datetime.now(timezone.utc).timestamp())}", "parametrosProduto": products}
    status, data = await _post_with_token(db, cfg, "/preco/v1/nacional", payload)
    if status >= 400:
        for s in services:
            out[s["code"]] = {"error": f"HTTP {status}: {str(data)[:120]}"}
        return out

    items = data if isinstance(data, list) else data.get("parametrosProduto") or [data]
    for item in items:
        code = item.get("coProduto") or item.get("nuRequisicao") or ""
        if item.get("txErro") or item.get("msgErro") or item.get("erro"):
            out[code] = {"error": str(item.get("txErro") or item.get("msgErro") or item.get("erro"))[:200]}
            continue
        # Valor pode vir como "12,34" ou numero
        v = item.get("pcFinal") or item.get("vlCobrado") or item.get("pcBase") or 0
        try:
            if isinstance(v, str):
                v = float(v.replace(".", "").replace(",", "."))
            price = float(v)
        except Exception:
            price = 0.0
        out[code] = {"price": price}
    return out


async def _calculate_deadlines(db, cfg: Dict, cep_orig: str, cep_dest: str,
                                services: List[Dict]) -> Dict[str, Dict]:
    out: Dict[str, Dict] = {}
    posting = datetime.now(timezone.utc).strftime("%d-%m-%Y")
    params = []
    for idx, s in enumerate(services):
        params.append({
            "coProduto": s["code"],
            "nuRequisicao": f"{idx+1:04d}",
            "cepOrigem": cep_orig,
            "cepDestino": cep_dest,
            "dtEvento": posting,
        })
    payload = {"idLote": f"lote_{int(datetime.now(timezone.utc).timestamp())}", "parametrosPrazo": params}
    status, data = await _post_with_token(db, cfg, "/prazo/v1/nacional", payload)
    if status >= 400:
        for s in services:
            out[s["code"]] = {"deadline_days": 0, "error": f"HTTP {status}"}
        return out
    items = data if isinstance(data, list) else data.get("parametrosPrazo") or [data]
    for item in items:
        code = item.get("coProduto") or ""
        if item.get("txErro") or item.get("msgErro"):
            out[code] = {"deadline_days": 0, "error": str(item.get("txErro") or item.get("msgErro"))[:200]}
            continue
        try:
            d = int(item.get("prazoEntrega") or 0)
        except Exception:
            d = 0
        out[code] = {"deadline_days": d}
    return out


# ============================ PUBLIC ENTRYPOINT ============================

async def calculate_freight(db, cep_destination: str, items: List[Dict],
                             declared_value: float = 0.0) -> Dict:
    cep_dest = _normalize_cep(cep_destination)
    if len(cep_dest) != 8:
        return {"options": [], "package": None, "error": "CEP destino invalido"}

    cfg = await get_config(db)
    pkg = _calc_package(items, cfg)
    options: List[Dict] = []
    cache_used = False

    # Iter 47: pickup nao aparece mais nas opcoes de frete (vira toggle dedicado
    # no carrinho/checkout). Mantido o setting `correios_pickup_enabled` apenas
    # como flag legacy; o uso atual eh `pickup_enabled` em get_config.

    if not cfg.get("correios_enabled"):
        return {"options": options, "package": pkg, "cache": False}

    cep_orig = _normalize_cep(cfg.get("correios_origin_cep"))
    if len(cep_orig) != 8:
        return {"options": options, "package": pkg, "error": "CEP de origem nao configurado"}

    services = cfg.get("correios_services") or DEFAULT_SERVICES
    if not services:
        return {"options": options, "package": pkg}
    code_to_label = {s["code"]: s.get("label") or s["code"] for s in services}
    codes = [s["code"] for s in services]

    # Cache
    env = cfg.get("correios_environment") or "homologacao"
    contract = cfg.get("correios_contract") or ""
    key = _cache_key(env, contract, cep_dest, pkg, codes)
    cached = await _get_cached(db, key, cfg.get("correios_cache_minutes") or 60)
    if cached:
        cache_used = True
        for c in cached:
            options.append({**c, "label": code_to_label.get(c["code"], c["code"])})
        return {"options": options, "package": pkg, "cache": cache_used}

    # Chamadas reais (preco + prazo em paralelo)
    try:
        prices_task = _calculate_prices(db, cfg, cep_orig, cep_dest, pkg, services, declared_value)
        deadlines_task = _calculate_deadlines(db, cfg, cep_orig, cep_dest, services)
        prices, deadlines = await asyncio.gather(prices_task, deadlines_task)
    except Exception as e:
        logger.exception(f"Erro CWS Correios: {e}")
        await _log(db, "error", "cws", {"cep_orig": cep_orig, "cep_dest": cep_dest}, None, None, str(e), env)
        for c in codes:
            options.append({"code": c, "label": code_to_label.get(c, c), "price": 0,
                             "deadline_days": 0, "error": str(e)[:120]})
        return {"options": options, "package": pkg, "cache": False}

    cacheable = []
    for s in services:
        c = s["code"]
        p = prices.get(c, {})
        d = deadlines.get(c, {})
        item = {
            "code": c,
            "label": code_to_label.get(c, c),
            "price": float(p.get("price") or 0),
            "deadline_days": int(d.get("deadline_days") or 0),
        }
        err = p.get("error") or d.get("error")
        if err:
            item["error"] = err
        else:
            cacheable.append({"code": c, "price": item["price"], "deadline_days": item["deadline_days"]})
        options.append(item)
    if cacheable:
        await _set_cached(db, key, cacheable)
    return {"options": options, "package": pkg, "cache": False}


async def test_credentials(db) -> Dict:
    """Testa autenticacao com Correios CWS. Retorna {ok, env, expires_at?, error?}."""
    cfg = await get_config(db)
    try:
        token = await _get_token(db, cfg)
        cache_id = f"{cfg.get('correios_environment')}:{cfg.get('correios_user')}:{cfg.get('correios_contract')}"
        rec = await db.correios_tokens.find_one({"_id": cache_id})
        return {
            "ok": True,
            "environment": cfg.get("correios_environment"),
            "expires_at": rec.get("expires_at") if rec else None,
            "token_preview": token[:24] + "..." if token else None,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}
