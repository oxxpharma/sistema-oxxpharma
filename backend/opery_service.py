"""
Opery Solutions Integration - Iter 67
Integracao com o sistema interno da OxxPharma (ERP loja fisica).

DUAS DIRECOES:
  1. INBOUND (Opery -> OxxPharma):
     Recebe pedidos/vendas presenciais registrados no ERP via webhook.
     Autenticado por header X-Opery-Api-Key (OPERY_WEBHOOK_SECRET).
     Armazena em `opery_sales` (idempotente via `opery_order_id`).
     Alimenta o Dashboard aba "Vendas Presenciais" e "Total Consolidado".

  2. OUTBOUND (OxxPharma -> Opery):
     Sempre que um pedido online e marcado como PAGO, dispara POST
     para o endpoint da Opery (OPERY_OUTBOUND_URL + OPERY_OUTBOUND_TOKEN).
     A Opery emite a nota fiscal e (opcionalmente) retorna dados dela.
     Toda tentativa e registrada em `opery_dispatch_log` para auditoria
     e reprocessamento.
"""

import os
import uuid
import hmac
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

import httpx

logger = logging.getLogger(__name__)

# ==================== CONSTANTES ====================

STATUS_PAID = "paid"
STATUS_PENDING = "pending"
STATUS_CANCELLED = "cancelled"

DISPATCH_MAX_RETRIES = 5
DISPATCH_TIMEOUT_SEC = 20

# ==================== HELPERS ====================


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id(prefix: str = "opery_") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def verify_webhook_key(provided: Optional[str]) -> bool:
    """Compara chave enviada pela Opery no header com a config (DB > env)."""
    expected = _CONFIG_CACHE.get("webhook_secret") or os.environ.get("OPERY_WEBHOOK_SECRET") or ""
    if not expected or not provided:
        return False
    return hmac.compare_digest(provided.strip(), expected.strip())


# ==================== CONFIG (DB) ====================

_CONFIG_CACHE: Dict[str, Any] = {}
_CONFIG_DOC_KEY = "opery_config"


def _config_from_env() -> Dict[str, Any]:
    # Retrocompat: se so tem OPERY_OUTBOUND_URL, usa como sandbox
    legacy_url = os.environ.get("OPERY_OUTBOUND_URL") or ""
    return {
        "webhook_secret": os.environ.get("OPERY_WEBHOOK_SECRET") or "",
        "outbound_url_sandbox": os.environ.get("OPERY_OUTBOUND_URL_SANDBOX") or legacy_url,
        "outbound_url_production": os.environ.get("OPERY_OUTBOUND_URL_PRODUCTION") or "",
        "outbound_token": os.environ.get("OPERY_OUTBOUND_TOKEN") or "",
        "active_env": os.environ.get("OPERY_ACTIVE_ENV") or "sandbox",
        "docs_url": "/docs/opery",
        "source": "env",
    }


async def load_config(db) -> Dict[str, Any]:
    """Carrega config do DB (fallback env). Popula cache."""
    doc = await db.opery_settings.find_one({"key": _CONFIG_DOC_KEY}, {"_id": 0})
    if doc:
        # Retrocompat: campo antigo `outbound_url` = sandbox
        sandbox_url = doc.get("outbound_url_sandbox") or doc.get("outbound_url") or os.environ.get("OPERY_OUTBOUND_URL_SANDBOX") or os.environ.get("OPERY_OUTBOUND_URL") or ""
        prod_url = doc.get("outbound_url_production") or os.environ.get("OPERY_OUTBOUND_URL_PRODUCTION") or ""
        cfg = {
            "webhook_secret": doc.get("webhook_secret") or os.environ.get("OPERY_WEBHOOK_SECRET") or "",
            "outbound_url_sandbox": sandbox_url,
            "outbound_url_production": prod_url,
            "outbound_token": doc.get("outbound_token") or os.environ.get("OPERY_OUTBOUND_TOKEN") or "",
            "active_env": doc.get("active_env") or "sandbox",
            "docs_url": doc.get("docs_url") or "/docs/opery",
            "source": "db",
            "updated_at": doc.get("updated_at"),
            "updated_by": doc.get("updated_by"),
        }
    else:
        cfg = _config_from_env()
    # Deriva outbound_url atual conforme active_env
    cfg["outbound_url"] = cfg.get("outbound_url_production") if cfg.get("active_env") == "production" else cfg.get("outbound_url_sandbox")
    _CONFIG_CACHE.clear()
    _CONFIG_CACHE.update(cfg)
    return cfg


async def save_config(db, updates: Dict[str, Any], actor: Optional[str] = None) -> Dict[str, Any]:
    """Salva config no DB. Somente atualiza campos presentes em `updates`."""
    allowed = {"webhook_secret", "outbound_url_sandbox", "outbound_url_production",
               "outbound_token", "active_env", "docs_url"}
    payload = {k: v for k, v in updates.items() if k in allowed and v is not None}
    if "active_env" in payload and payload["active_env"] not in {"sandbox", "production"}:
        raise ValueError("active_env deve ser 'sandbox' ou 'production'")
    payload["updated_at"] = _now_iso()
    payload["updated_by"] = actor
    await db.opery_settings.update_one(
        {"key": _CONFIG_DOC_KEY},
        {"$set": payload, "$setOnInsert": {"key": _CONFIG_DOC_KEY, "created_at": _now_iso()}},
        upsert=True,
    )
    _CONFIG_CACHE.clear()
    return await load_config(db)


def get_cached_config() -> Dict[str, Any]:
    return dict(_CONFIG_CACHE) if _CONFIG_CACHE else _config_from_env()


# ==================== INDICES ====================


async def ensure_indexes(db):
    try:
        await db.opery_sales.create_index("opery_order_id", unique=True)
        await db.opery_sales.create_index("order_date")
        await db.opery_sales.create_index("status")
        await db.opery_revenue_snapshots.create_index("date", unique=True)
        await db.opery_dispatch_log.create_index("order_id")
        await db.opery_dispatch_log.create_index("created_at")
        await db.opery_dispatch_log.create_index([("status", 1), ("next_retry_at", 1)])
        await db.opery_settings.create_index("key", unique=True)
        await db.opery_inbound_log.create_index("created_at")
    except Exception as e:
        logger.warning(f"opery_service.ensure_indexes falhou: {e}")
    # popula cache de config na inicializacao
    try:
        await load_config(db)
    except Exception as e:
        logger.warning(f"opery_service.load_config falhou: {e}")


async def log_inbound(db, kind: str, ok: bool, headers_sample: Dict[str, Any], body: Any, response: Any, error: Optional[str] = None):
    """Grava log de requisicao inbound (auditoria). kind='sales'|'health'|'nf_callback'."""
    try:
        doc = {
            "log_id": _gen_id("opin_"),
            "kind": kind,
            "ok": ok,
            "headers": headers_sample,
            "body": body,
            "response": response,
            "error": error,
            "created_at": _now_iso(),
        }
        await db.opery_inbound_log.insert_one(doc)
    except Exception as e:
        logger.warning(f"opery.log_inbound falhou: {e}")


# ==================== INBOUND (Opery -> OxxPharma) ====================


def _normalize_status(raw: Optional[str]) -> str:
    if not raw:
        return STATUS_PENDING
    r = str(raw).strip().lower()
    if r in {"paid", "pago", "faturado", "quitado", "confirmado"}:
        return STATUS_PAID
    if r in {"cancelled", "canceled", "cancelado", "estornado"}:
        return STATUS_CANCELLED
    return STATUS_PENDING


def _to_float(v: Any, default: float = 0.0) -> float:
    if v is None:
        return default
    try:
        # aceita "R$ 1.234,56" ou "1234.56"
        if isinstance(v, str):
            s = v.replace("R$", "").replace(" ", "").strip()
            # se tem virgula e ponto, ponto e milhar
            if "," in s and "." in s:
                s = s.replace(".", "").replace(",", ".")
            elif "," in s:
                s = s.replace(",", ".")
            return float(s)
        return float(v)
    except Exception:
        return default


def _parse_date(raw: Any) -> str:
    """Aceita ISO-8601, 'YYYY-MM-DD' ou 'DD/MM/YYYY [HH:MM:SS]'. Retorna ISO UTC."""
    if not raw:
        return _now_iso()
    if isinstance(raw, datetime):
        d = raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
        return d.isoformat()
    s = str(raw).strip()
    # tenta ISO
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if not d.tzinfo:
            d = d.replace(tzinfo=timezone.utc)
        return d.isoformat()
    except Exception:
        pass
    # tenta DD/MM/YYYY
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            d = datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
            return d.isoformat()
        except Exception:
            continue
    logger.warning(f"opery: nao consegui parsear data '{raw}' — usando now()")
    return _now_iso()


async def upsert_sale(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    """(Deprecated) Grava/atualiza uma venda presencial (pedido individual).

    Mantido apenas para retrocompatibilidade. O modelo agora usa snapshots
    diarios agregados via `upsert_revenue_snapshot`.
    """
    opery_order_id = str(payload.get("opery_order_id") or payload.get("order_id") or "").strip()
    if not opery_order_id:
        raise ValueError("opery_order_id obrigatorio")

    doc = {
        "opery_order_id": opery_order_id,
        "order_date": _parse_date(payload.get("order_date") or payload.get("date")),
        "total": round(_to_float(payload.get("total") or payload.get("valor_total")), 2),
        "status": _normalize_status(payload.get("status") or payload.get("payment_status")),
        "customer_name": payload.get("customer_name") or payload.get("cliente"),
        "customer_cpf": (payload.get("customer_cpf") or payload.get("cpf") or "").strip() or None,
        "customer_email": (payload.get("customer_email") or payload.get("email") or "").strip().lower() or None,
        "items": payload.get("items") or [],
        "payment_method": payload.get("payment_method") or payload.get("forma_pagamento"),
        "branch": payload.get("branch") or payload.get("filial"),
        "operator": payload.get("operator") or payload.get("vendedor"),
        "metadata": payload.get("metadata") or {},
        "tenant": "oxxpharma",
        "source": "opery",
        "updated_at": _now_iso(),
    }
    existing = await db.opery_sales.find_one({"opery_order_id": opery_order_id}, {"_id": 0})
    if existing:
        await db.opery_sales.update_one({"opery_order_id": opery_order_id}, {"$set": doc})
        return {"created": False, "opery_order_id": opery_order_id}
    doc["sale_id"] = _gen_id("opsale_")
    doc["created_at"] = _now_iso()
    await db.opery_sales.insert_one(doc)
    return {"created": True, "opery_order_id": opery_order_id, "sale_id": doc["sale_id"]}


# ==================== SNAPSHOTS DIARIOS (modelo novo) ====================


def _parse_iso_date(raw: Any) -> Optional[str]:
    """Aceita 'YYYY-MM-DD', ISO ou 'DD/MM/YYYY' e retorna sempre 'YYYY-MM-DD'."""
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw.date().isoformat()
    s = str(raw).strip()
    # ja ta no formato certo
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    # DD/MM/YYYY
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except Exception:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return None


async def upsert_revenue_snapshot(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Grava/atualiza 1 snapshot diario de faturamento vindo da Opery.

    Payload aceito:
      - date (str, obrigatorio) — 'YYYY-MM-DD' (chave de idempotencia)
      - total_revenue (num) — faturamento (somente pedidos PAGOS)
      - total_orders_value (num) — valor total dos pedidos (pagos + pendentes)
      - orders_count (int) — quantidade total de pedidos no dia
      - paid_orders_count (int, opcional) — quantos foram pagos (pra calcular ticket medio)
    """
    date = _parse_iso_date(payload.get("date") or payload.get("data"))
    if not date:
        raise ValueError("date obrigatorio no formato YYYY-MM-DD")

    total_revenue = round(_to_float(payload.get("total_revenue") or payload.get("faturamento")), 2)
    total_orders_value = round(_to_float(payload.get("total_orders_value") or payload.get("valor_total_pedidos")), 2)
    orders_count = int(_to_float(payload.get("orders_count") or payload.get("qtd_pedidos") or 0))
    paid_orders_count_raw = payload.get("paid_orders_count")
    paid_orders_count = int(_to_float(paid_orders_count_raw)) if paid_orders_count_raw is not None else None

    doc = {
        "date": date,
        "total_revenue": total_revenue,
        "total_orders_value": total_orders_value,
        "orders_count": orders_count,
        "paid_orders_count": paid_orders_count,
        "tenant": "oxxpharma",
        "source": "opery",
        "updated_at": _now_iso(),
    }
    existing = await db.opery_revenue_snapshots.find_one({"date": date}, {"_id": 0})
    if existing:
        await db.opery_revenue_snapshots.update_one({"date": date}, {"$set": doc})
        return {"created": False, "date": date}
    doc["snapshot_id"] = _gen_id("opsnap_")
    doc["created_at"] = _now_iso()
    await db.opery_revenue_snapshots.insert_one(doc)
    return {"created": True, "date": date, "snapshot_id": doc["snapshot_id"]}


# ==================== DASHBOARD STATS ====================


async def aggregate_stats(db, start: Optional[str] = None, end: Optional[str] = None) -> Dict[str, Any]:
    """Calcula KPIs de vendas presenciais somando os snapshots diarios da Opery.

    Retorna:
      - total_orders_value: soma de total_orders_value no periodo
      - total_revenue: soma de total_revenue (faturamento pago) no periodo
      - orders_count: soma de orders_count no periodo
      - paid_orders_count: soma de paid_orders_count (fallback orders_count)
      - avg_ticket: total_revenue / paid_orders_count
      - revenue_by_day: 30 dias (usa snapshots quando existem)
      - by_status: [] (nao ha mais status individual — modelo agregado)
    """
    from datetime import timedelta

    start_date = _parse_iso_date(start) if start else None
    end_date = _parse_iso_date(end) if end else None
    match: Dict[str, Any] = {}
    if start_date:
        match.setdefault("date", {})["$gte"] = start_date
    if end_date:
        match.setdefault("date", {})["$lte"] = end_date

    agg = await db.opery_revenue_snapshots.aggregate([
        {"$match": match},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$total_revenue"},
            "total_orders_value": {"$sum": "$total_orders_value"},
            "orders_count": {"$sum": "$orders_count"},
            "paid_orders_count": {"$sum": {"$ifNull": ["$paid_orders_count", "$orders_count"]}},
        }},
    ]).to_list(1)

    if agg:
        row = agg[0]
        total_revenue = round(row.get("total_revenue") or 0, 2)
        total_orders_value = round(row.get("total_orders_value") or 0, 2)
        orders_count = int(row.get("orders_count") or 0)
        paid_orders_count = int(row.get("paid_orders_count") or 0)
    else:
        total_revenue = total_orders_value = 0.0
        orders_count = paid_orders_count = 0

    avg_ticket = round(total_revenue / paid_orders_count, 2) if paid_orders_count else 0.0

    # Serie diaria dos ultimos 30 dias (sempre fixo, independente do filtro)
    n = datetime.now(timezone.utc)
    today = n.replace(hour=0, minute=0, second=0, microsecond=0).date()
    last_30_start = (today - timedelta(days=29)).isoformat()
    daily = await db.opery_revenue_snapshots.find(
        {"date": {"$gte": last_30_start}},
        {"_id": 0, "date": 1, "total_revenue": 1, "orders_count": 1},
    ).sort("date", 1).to_list(60)
    daily_map = {d["date"]: {"revenue": round(d.get("total_revenue") or 0, 2), "orders": int(d.get("orders_count") or 0)} for d in daily}
    revenue_by_day = []
    for i in range(30):
        day = (today - timedelta(days=29 - i)).isoformat()
        d = daily_map.get(day, {"revenue": 0, "orders": 0})
        revenue_by_day.append({"date": day, "revenue": d["revenue"], "orders": d["orders"]})

    return {
        "total_orders_value": total_orders_value,
        "total_revenue": total_revenue,
        "orders_count": orders_count,
        "paid_orders_count": paid_orders_count,
        "avg_ticket": avg_ticket,
        "revenue_by_day": revenue_by_day,
        "by_status": [],  # nao aplicavel no modelo de snapshot
    }


# ==================== OUTBOUND (OxxPharma -> Opery) ====================


def _build_outbound_payload(order: Dict[str, Any], user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Constroi o payload no formato que a Opery ira consumir para emissao de NF-e.

    Documentado em /app/memory/OPERY_INTEGRATION_SPEC.md
    """
    user = user or {}
    address = order.get("shipping_address") or {}
    items = []
    for it in order.get("items", []):
        items.append({
            "sku": it.get("sku") or it.get("product_id"),
            "product_id": it.get("product_id"),
            "name": it.get("name") or it.get("product_name"),
            "quantity": it.get("quantity") or it.get("qty") or 1,
            "unit_price": round(float(it.get("price") or it.get("unit_price") or 0), 2),
            "total": round(float(it.get("subtotal") or it.get("total") or 0), 2),
            "ncm": it.get("ncm"),
            "cfop": it.get("cfop"),
        })

    return {
        "source": "oxxpharma",
        "order_id": order.get("order_id"),
        "invoice_number": order.get("invoice_number"),
        "order_date": order.get("created_at"),
        "paid_at": order.get("paid_at"),
        "payment_method": order.get("payment_method"),
        "payment_id": order.get("payment_id"),
        "customer": {
            "user_id": order.get("user_id"),
            "name": order.get("customer_name") or user.get("name"),
            "email": order.get("customer_email") or user.get("email"),
            "cpf": user.get("cpf") or user.get("cpf_digits") or order.get("customer_cpf"),
            "cnpj": user.get("cnpj"),
            "phone": user.get("phone") or order.get("customer_phone"),
        },
        "shipping_address": {
            "street": address.get("street"),
            "number": address.get("number"),
            "complement": address.get("complement"),
            "neighborhood": address.get("neighborhood"),
            "city": address.get("city"),
            "state": address.get("state"),
            "zip": address.get("zip") or address.get("cep"),
            "country": address.get("country") or "BR",
        },
        "items": items,
        "totals": {
            "subtotal": round(float(order.get("subtotal") or 0), 2),
            "discount": round(float(order.get("discount") or 0), 2),
            "shipping": round(float(order.get("shipping_cost") or 0), 2),
            "total": round(float(order.get("total") or 0), 2),
        },
        "shipping_method": order.get("shipping_method"),
        "tracking_code": order.get("tracking_code"),
        "notes": order.get("notes"),
    }


async def _post_to_opery(url: str, token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "X-OxxPharma-Source": "oxxpharma-app",
    }
    async with httpx.AsyncClient(timeout=DISPATCH_TIMEOUT_SEC) as client:
        resp = await client.post(url, json=body, headers=headers)
        raw_text = resp.text or ""
        rjson = None
        try:
            if "application/json" in (resp.headers.get("content-type") or ""):
                rjson = resp.json()
        except Exception:
            rjson = None
        return {
            "status_code": resp.status_code,
            "response_text": raw_text[:20000],  # aumentado p/ suportar XML da NF
            "response_headers": dict(resp.headers),
            "response_json": rjson,
        }


async def dispatch_paid_order(db, order: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Dispara pedido pago para a Opery. Cria log de dispatch (idempotente por order_id).

    Se OPERY_OUTBOUND_URL nao estiver configurado, apenas registra o log como 'pending_config'
    para que possa ser reprocessado depois quando a Opery entregar a documentacao.
    """
    if not order or not order.get("order_id"):
        return None
    order_id = order["order_id"]

    # idempotencia: nunca dispara o mesmo pedido 2x com sucesso
    existing = await db.opery_dispatch_log.find_one(
        {"order_id": order_id, "status": {"$in": ["success", "pending_config"]}},
        {"_id": 0},
    )
    if existing and existing.get("status") == "success":
        return existing

    user = await db.users.find_one({"user_id": order.get("user_id")}, {"_id": 0, "password_hash": 0}) if order.get("user_id") else None
    payload = _build_outbound_payload(order, user)

    cfg = await load_config(db)
    outbound_url = cfg.get("outbound_url")
    outbound_token = cfg.get("outbound_token") or ""

    if not outbound_url:
        # armazena payload para reprocessamento futuro
        doc = {
            "log_id": _gen_id("opdisp_"),
            "order_id": order_id,
            "status": "pending_config",
            "attempts": 0,
            "payload": payload,
            "error": "OPERY_OUTBOUND_URL nao configurado",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        if existing:
            await db.opery_dispatch_log.update_one({"order_id": order_id, "status": "pending_config"}, {"$set": {**doc, "log_id": existing["log_id"]}})
            return doc
        await db.opery_dispatch_log.insert_one(doc)
        logger.info(f"opery.dispatch_paid_order: order {order_id} enfileirado (pending_config)")
        return doc

    return await _do_dispatch(db, order_id, outbound_url, outbound_token, payload)


async def _do_dispatch(db, order_id: str, url: str, token: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Executa o POST HTTP e grava o log de dispatch."""
    log_id = _gen_id("opdisp_")
    attempts = 1
    prev = await db.opery_dispatch_log.find_one({"order_id": order_id}, {"_id": 0})
    if prev:
        log_id = prev.get("log_id") or log_id
        attempts = int(prev.get("attempts") or 0) + 1

    try:
        result = await _post_to_opery(url, token, payload)
        ok = 200 <= result["status_code"] < 300
        doc = {
            "log_id": log_id,
            "order_id": order_id,
            "status": "success" if ok else "failed",
            "attempts": attempts,
            "payload": payload,
            "response_status": result["status_code"],
            "response_body": result["response_text"],
            "response_json": result.get("response_json"),
            "error": None if ok else f"HTTP {result['status_code']}",
            "created_at": prev.get("created_at") if prev else _now_iso(),
            "updated_at": _now_iso(),
        }
        if prev:
            await db.opery_dispatch_log.update_one({"log_id": log_id}, {"$set": doc})
        else:
            await db.opery_dispatch_log.insert_one(doc)

        # se a Opery devolveu numero de NF, guardamos no pedido
        rjson = result.get("response_json") or {}
        # Extrai possiveis campos comuns
        nf = rjson.get("nf_number") or rjson.get("invoice_number") or rjson.get("numero_nf") or rjson.get("nfe_number")
        nf_pdf_url = rjson.get("nf_url") or rjson.get("pdf_url") or rjson.get("danfe_url")
        nf_xml = rjson.get("nf_xml") or rjson.get("xml") or rjson.get("nfe_xml")
        nf_chave = rjson.get("chave") or rjson.get("access_key") or rjson.get("nf_chave")

        # Se retornou XML na resposta (texto ou base64), tenta detectar tambem no response_body plain-text
        if not nf_xml and result.get("response_text") and result["response_text"].strip().startswith("<?xml"):
            nf_xml = result["response_text"]

        if ok and (nf or nf_xml or nf_pdf_url):
            update: Dict[str, Any] = {"opery_nf_issued_at": _now_iso()}
            if nf: update["opery_nf_number"] = str(nf)
            if nf_pdf_url: update["opery_nf_pdf_url"] = nf_pdf_url
            if nf_xml: update["opery_nf_xml"] = nf_xml
            if nf_chave: update["opery_nf_chave"] = str(nf_chave)
            try:
                await db.orders.update_one({"order_id": order_id}, {"$set": update})
            except Exception as e:
                logger.warning(f"opery: nao consegui gravar nf_* no order {order_id}: {e}")

        logger.info(f"opery.dispatch order={order_id} status={doc['status']} http={result['status_code']}")
        return doc
    except Exception as e:
        doc = {
            "log_id": log_id,
            "order_id": order_id,
            "status": "failed",
            "attempts": attempts,
            "payload": payload,
            "response_status": None,
            "response_body": None,
            "error": str(e)[:1000],
            "created_at": prev.get("created_at") if prev else _now_iso(),
            "updated_at": _now_iso(),
        }
        if prev:
            await db.opery_dispatch_log.update_one({"log_id": log_id}, {"$set": doc})
        else:
            await db.opery_dispatch_log.insert_one(doc)
        logger.error(f"opery.dispatch order={order_id} EXCEPTION: {e}")
        return doc


async def retry_failed_dispatches(db, limit: int = 20) -> Dict[str, Any]:
    """Reprocessa logs 'failed' ou 'pending_config'. Retorna contadores."""
    cfg = await load_config(db)
    outbound_url = cfg.get("outbound_url")
    outbound_token = cfg.get("outbound_token") or ""
    if not outbound_url:
        return {"success": 0, "failed": 0, "skipped": 0, "reason": "outbound_url nao configurado"}

    cursor = db.opery_dispatch_log.find(
        {"status": {"$in": ["failed", "pending_config"]}, "attempts": {"$lt": DISPATCH_MAX_RETRIES}},
        {"_id": 0},
    ).sort("created_at", 1).limit(limit)

    success = 0
    failed = 0
    async for log in cursor:
        result = await _do_dispatch(db, log["order_id"], outbound_url, outbound_token, log["payload"])
        if result.get("status") == "success":
            success += 1
        else:
            failed += 1
    return {"success": success, "failed": failed, "skipped": 0}


def schedule_outbound(db, order: Dict[str, Any]):
    """Dispara em background (nao bloqueia o fluxo de pagamento)."""
    try:
        asyncio.create_task(dispatch_paid_order(db, order))
    except Exception as e:
        logger.error(f"opery.schedule_outbound falhou: {e}")
