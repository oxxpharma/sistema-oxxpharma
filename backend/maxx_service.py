"""Maxx MMN integration service.

Outbound: envia pontos do OxxPharma para o sistema Maxx MMN.

Config no DB (settings doc _id=global):
  maxx_enabled: bool
  maxx_api_url: str          (URL do endpoint deles que recebe pontos)
  maxx_api_method: str       (POST default)
  maxx_auth_type: str        (none|bearer|apikey|basic)
  maxx_auth_value: str       (token/key/user:pass)
  maxx_auth_header_name: str (default X-API-Key, usado quando apikey)
  maxx_extra_headers: str    (JSON string)
  maxx_payload_template: str (template Jinja-like com {{batch_json}})
  maxx_mode: str             ("realtime" | "batch" | "manual")
  maxx_batch_hour: int       (default 23)
  maxx_batch_minute: int     (default 50)
  maxx_timeout_seconds: int  (default 30)
"""
import os
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

DEFAULT_CONFIG = {
    "maxx_enabled": False,
    "maxx_api_url": "",
    "maxx_api_method": "POST",
    # webhook_token (Ozoxx/Maxx) | none | bearer | apikey | basic
    "maxx_auth_type": "webhook_token",
    "maxx_auth_value": "",
    "maxx_auth_header_name": "X-Webhook-Token",
    "maxx_extra_headers": "",          # JSON
    "maxx_payload_template": "",       # se vazio, usa default {points: [...]}
    "maxx_mode": "manual",             # realtime | batch | manual
    "maxx_batch_hour": 23,
    "maxx_batch_minute": 50,
    "maxx_timeout_seconds": 30,
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
    if "maxx_mode" in set_doc and set_doc["maxx_mode"] not in ("realtime", "batch", "manual"):
        raise ValueError("maxx_mode deve ser 'realtime', 'batch' ou 'manual'")
    if "maxx_auth_type" in set_doc and set_doc["maxx_auth_type"] not in ("none", "bearer", "apikey", "basic", "webhook_token"):
        raise ValueError("maxx_auth_type invalido")
    # PROTECAO: nunca sobrescrever token com valor mascarado vindo do frontend
    # (o GET mascara o token para nao vazar em screenshots; se o admin salvar sem
    # redigitar, o PUT chegaria com mascara e apagaria o segredo real)
    av = set_doc.get("maxx_auth_value")
    if isinstance(av, str):
        stripped = av.strip()
        if (not stripped) or all(ch in "•*·. " for ch in stripped):
            set_doc.pop("maxx_auth_value", None)
    if set_doc:
        set_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"_id": "global"}, {"$set": set_doc}, upsert=True)
    return await get_config(db)


def _build_headers(cfg: Dict) -> Dict[str, str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    auth = (cfg.get("maxx_auth_type") or "none").lower()
    val = (cfg.get("maxx_auth_value") or "").strip()
    if auth == "bearer" and val:
        headers["Authorization"] = f"Bearer {val}"
    elif auth in ("apikey", "webhook_token") and val:
        default_hk = "X-Webhook-Token" if auth == "webhook_token" else "X-API-Key"
        hk = (cfg.get("maxx_auth_header_name") or default_hk).strip() or default_hk
        headers[hk] = val
    elif auth == "basic" and val:
        import base64
        encoded = base64.b64encode(val.encode()).decode()
        headers["Authorization"] = f"Basic {encoded}"
    extra = (cfg.get("maxx_extra_headers") or "").strip()
    if extra:
        try:
            parsed = json.loads(extra)
            if isinstance(parsed, dict):
                headers.update({str(k): str(v) for k, v in parsed.items()})
        except Exception:
            logger.warning(f"maxx_extra_headers JSON invalido, ignorando")
    return headers


def _build_payload(cfg: Dict, points: List[Dict]) -> Dict:
    """Monta payload AGREGANDO pontos por (user_id + order_id).

    Iter 38: Antes enviavamos 1 item por produto -> a Maxx criava 1 log por linha.
    Agora consolidamos por pedido: 1 entrada por (usuario, pedido), com soma dos
    pontos, lista de produtos comprados e quantidade total.

    Default: {"points": [{user_id, external_id, name, email, points, registered_at,
                          order_id, products: [...], product_name (resumo), quantity (total)}]}
    Custom: usa maxx_payload_template substituindo {{batch_json}} pelos points serializados.
    """
    grouped: Dict[tuple, Dict] = {}
    order_index: List[tuple] = []  # preserva ordem de chegada
    for p in points:
        uid = p.get("user_id")
        oid = p.get("order_id")
        key = (uid, oid)
        if key not in grouped:
            order_index.append(key)
            grouped[key] = {
                "user_id": uid,
                "external_id": p.get("user_external_id"),
                "name": p.get("user_name"),
                "email": p.get("user_email"),
                "points": 0.0,
                "registered_at": p.get("registered_at"),
                "order_id": oid,
                "products": [],
                "quantity": 0,
            }
        agg = grouped[key]
        # Mantem a ultima identificacao do user (pode ter sido atualizada entre logs)
        agg["external_id"] = p.get("user_external_id") or agg.get("external_id")
        agg["name"] = p.get("user_name") or agg.get("name")
        agg["email"] = p.get("user_email") or agg.get("email")
        # Mantem o registered_at mais antigo (data do pedido)
        if p.get("registered_at") and (not agg.get("registered_at") or p["registered_at"] < agg["registered_at"]):
            agg["registered_at"] = p["registered_at"]
        qty = int(p.get("quantity") or 1)
        agg["points"] = round(agg["points"] + float(p.get("points_total") or 0), 4)
        agg["quantity"] += qty
        agg["products"].append({
            "product_id": p.get("product_id"),
            "product_name": p.get("product_name"),
            "quantity": qty,
            "points": float(p.get("points_total") or 0),
        })

    items = []
    for key in order_index:
        agg = grouped[key]
        # Resumo textual dos produtos para sistemas que so leem product_name
        names = [f"{prod.get('product_name') or '?'} x{prod.get('quantity') or 1}" for prod in agg["products"]]
        agg["product_name"] = "; ".join(names) if names else None
        items.append(agg)
    template = (cfg.get("maxx_payload_template") or "").strip()
    if template:
        try:
            rendered = template.replace("{{batch_json}}", json.dumps(items, ensure_ascii=False))
            return json.loads(rendered)
        except Exception as e:
            logger.exception(f"Template Maxx invalido: {e}, usando default")
    return {
        "source": "oxxpharma",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "points": items,
    }


async def _log(db, kind: str, url: str, request_body, status_code, response_body, error, point_ids: List[str], success: bool):
    try:
        await db.maxx_logs.insert_one({
            "log_id": "mxlog_" + os.urandom(6).hex(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "kind": kind,
            "url": url,
            "request_body": request_body,
            "status_code": status_code,
            "response_body": str(response_body)[:1500] if response_body else None,
            "error": str(error)[:500] if error else None,
            "point_log_ids": point_ids,
            "success": success,
        })
    except Exception:
        pass


async def send_points(db, points: List[Dict], kind: str = "manual") -> Dict:
    """Envia uma lista de points_log para o Maxx. Retorna {success, sent_count, error?, status_code?}."""
    cfg = await get_config(db)
    if not points:
        return {"success": True, "sent_count": 0, "skipped": True}
    if not cfg.get("maxx_enabled"):
        return {"success": False, "error": "Integracao Maxx desabilitada", "skipped": True}
    url = (cfg.get("maxx_api_url") or "").strip()
    if not url:
        return {"success": False, "error": "maxx_api_url nao configurada", "skipped": True}

    headers = _build_headers(cfg)
    payload = _build_payload(cfg, points)
    method = (cfg.get("maxx_api_method") or "POST").upper()
    timeout = int(cfg.get("maxx_timeout_seconds") or 30)
    point_ids = [p.get("log_id") for p in points if p.get("log_id")]

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method == "PUT":
                r = await client.put(url, json=payload, headers=headers)
            else:
                r = await client.post(url, json=payload, headers=headers)
        success = 200 <= r.status_code < 300
        await _log(db, kind, url, payload, r.status_code, r.text[:1500], None, point_ids, success)
        if success and point_ids:
            await db.points_log.update_many(
                {"log_id": {"$in": point_ids}},
                {"$set": {"sent_to_maxx": True, "sent_to_maxx_at": datetime.now(timezone.utc).isoformat(),
                          "applied_externally": True, "applied_at": datetime.now(timezone.utc).isoformat()}},
            )
        return {"success": success, "status_code": r.status_code, "sent_count": len(points), "response": r.text[:300]}
    except Exception as e:
        logger.exception(f"Erro enviando pontos para Maxx: {e}")
        await _log(db, kind, url, payload, None, None, str(e), point_ids, False)
        return {"success": False, "error": str(e)[:300], "sent_count": 0}


async def trigger_realtime(db, point_log_ids: List[str]):
    """Best-effort: dispara envio em tempo real apos registro de pontos. NAO bloqueia."""
    cfg = await get_config(db)
    if not cfg.get("maxx_enabled") or cfg.get("maxx_mode") != "realtime":
        return
    points = await db.points_log.find(
        {"log_id": {"$in": point_log_ids}, "sent_to_maxx": {"$ne": True}},
        {"_id": 0},
    ).to_list(1000)
    if not points:
        return
    asyncio.create_task(send_points(db, points, kind="realtime"))


async def send_pending_batch(db, kind: str = "batch") -> Dict:
    """Envia todos os pontos ainda nao enviados para o Maxx."""
    cfg = await get_config(db)
    if not cfg.get("maxx_enabled"):
        return {"success": False, "skipped": True, "reason": "disabled"}
    pending = await db.points_log.find(
        {"sent_to_maxx": {"$ne": True}, "applied_externally": {"$ne": True}},
        {"_id": 0},
    ).to_list(50000)
    if not pending:
        return {"success": True, "sent_count": 0, "skipped": True, "reason": "no_pending"}
    return await send_points(db, pending, kind=kind)


async def send_test_for_user(db, user_id: str, points_value: float = 1.0, product_name: str = "[TESTE] Integração API") -> Dict:
    """Envia um payload de TESTE para o Maxx referenciando um usuario real,
    mas SEM persistir nada no points_log (nao polui historico).

    Util para validar credenciais e mapeamento de external_id antes de enviar
    pontos reais.
    """
    cfg = await get_config(db)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return {"success": False, "error": "Usuario nao encontrado"}

    url = (cfg.get("maxx_api_url") or "").strip()
    if not url:
        return {"success": False, "error": "maxx_api_url nao configurada"}

    test_log = {
        "log_id": "test_" + os.urandom(4).hex(),
        "user_id": user.get("user_id"),
        "user_external_id": user.get("external_id"),
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "points_total": float(points_value),
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "order_id": "test_order_" + os.urandom(3).hex(),
        "product_name": product_name,
        "quantity": 1,
    }

    headers = _build_headers(cfg)
    payload = _build_payload(cfg, [test_log])
    # Marca o payload como teste para nao confundir o lado deles
    payload["test_mode"] = True
    method = (cfg.get("maxx_api_method") or "POST").upper()
    timeout = int(cfg.get("maxx_timeout_seconds") or 30)

    response_status = None
    response_text = None
    error = None
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method == "PUT":
                r = await client.put(url, json=payload, headers=headers)
            else:
                r = await client.post(url, json=payload, headers=headers)
        response_status = r.status_code
        response_text = r.text[:1500]
    except Exception as e:
        error = str(e)[:300]
        logger.exception(f"Erro no teste de envio Maxx: {e}")

    success = bool(response_status and 200 <= response_status < 300)
    # Detectar falha no CORPO mesmo com HTTP 200 (ex: Maxx retorna {"error":"1","error_msg":"Token Invalido"})
    body_error = None
    if success and response_text:
        try:
            import json as _json
            parsed = _json.loads(response_text)
            if isinstance(parsed, dict):
                # Maxx usa error:"1" como string, nao boolean
                err_flag = parsed.get("error")
                if err_flag in (True, 1, "1", "true"):
                    body_error = parsed.get("error_msg") or parsed.get("message") or "Erro retornado pela API"
                    success = False
        except Exception:
            pass
    # Logamos mas SEM mexer no points_log
    await _log(db, "test", url, payload, response_status, response_text, error or body_error, [], success)

    # Helper local para mascarar token no retorno (preserva tamanho para diagnostico)
    def _mask(v):
        if not v: return ""
        s = str(v)
        if len(s) <= 6: return "•" * len(s)
        return f"{s[:3]}{'•' * (len(s) - 6)}{s[-3:]}"
    masked_headers = {}
    for k, v in headers.items():
        if k.lower() in ("authorization", "x-webhook-token", "x-api-key"):
            # Se Authorization: Bearer XXX, mascara so o XXX
            parts = str(v).split(" ", 1)
            if len(parts) == 2:
                masked_headers[k] = f"{parts[0]} {_mask(parts[1])}"
            else:
                masked_headers[k] = _mask(v)
        else:
            masked_headers[k] = v
    return {
        "success": success,
        "status_code": response_status,
        "response": response_text,
        "error": error or body_error,
        "request_url": url,
        "request_headers": masked_headers,
        "request_payload": payload,
        "user": {
            "user_id": user.get("user_id"),
            "name": user.get("name"),
            "email": user.get("email"),
            "external_id": user.get("external_id"),
            "has_external_id": bool(user.get("external_id")),
        },
    }
