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
    "maxx_auth_type": "none",          # none | bearer | apikey | basic
    "maxx_auth_value": "",
    "maxx_auth_header_name": "X-API-Key",
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
    if "maxx_auth_type" in set_doc and set_doc["maxx_auth_type"] not in ("none", "bearer", "apikey", "basic"):
        raise ValueError("maxx_auth_type invalido")
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
    elif auth == "apikey" and val:
        hk = (cfg.get("maxx_auth_header_name") or "X-API-Key").strip() or "X-API-Key"
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
    """Monta payload com a lista de pontos.

    Default: {"points": [{user_id, external_id, name, email, points, registered_at, order_id, product_name, quantity}]}
    Custom: usa maxx_payload_template substituindo {{batch_json}} pelos points serializados.
    """
    items = []
    for p in points:
        items.append({
            "user_id": p.get("user_id"),
            "external_id": p.get("user_external_id"),
            "name": p.get("user_name"),
            "email": p.get("user_email"),
            "points": float(p.get("points_total") or 0),
            "registered_at": p.get("registered_at"),
            "order_id": p.get("order_id"),
            "product_name": p.get("product_name"),
            "quantity": int(p.get("quantity") or 1),
        })
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
