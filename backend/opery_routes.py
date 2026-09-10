"""
Opery Solutions - HTTP Routes (Iter 67)

Rotas expostas:
  Publicas (autenticadas por header X-Opery-Api-Key = OPERY_WEBHOOK_SECRET):
    POST /api/opery/webhook/sales           -> recebe 1 ou N vendas do ERP
    POST /api/opery/webhook/health           -> ping/health check para a Opery testar

  Admin (backoffice):
    GET  /api/admin/opery/dashboard          -> stats das vendas presenciais (com filtros)
    GET  /api/admin/opery/sales              -> listagem paginada
    GET  /api/admin/opery/dispatch-log       -> logs de envio p/ Opery
    POST /api/admin/opery/dispatch/retry     -> reprocessa dispatches falhados
    POST /api/admin/opery/dispatch/{order_id} -> dispara manualmente 1 pedido
    GET  /api/admin/opery/config             -> retorna config (mascarada)
"""

import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Header, Depends, Query
from pydantic import BaseModel

import opery_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["opery"])

_deps: Dict[str, Any] = {}


# ==================== INBOUND WEBHOOK ====================


class SaleIn(BaseModel):
    opery_order_id: str
    order_date: Optional[str] = None
    total: Optional[float] = None
    status: Optional[str] = None
    customer_name: Optional[str] = None
    customer_cpf: Optional[str] = None
    customer_email: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    payment_method: Optional[str] = None
    branch: Optional[str] = None
    operator: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class WebhookIn(BaseModel):
    # Aceita 1 venda OU lote
    sale: Optional[SaleIn] = None
    sales: Optional[List[SaleIn]] = None


@router.post("/opery/webhook/sales")
async def receive_sales(
    body: WebhookIn,
    request: Request,
    x_opery_api_key: Optional[str] = Header(None, alias="X-Opery-Api-Key"),
):
    """Recebe vendas presenciais da Opery. Autenticado por X-Opery-Api-Key."""
    if not opery_service.verify_webhook_key(x_opery_api_key):
        raise HTTPException(status_code=401, detail="Chave invalida (X-Opery-Api-Key)")

    db = request.app.db
    items: List[SaleIn] = []
    if body.sales:
        items.extend(body.sales)
    if body.sale:
        items.append(body.sale)
    if not items:
        raise HTTPException(status_code=400, detail="Envie 'sale' ou 'sales' no body")

    created = 0
    updated = 0
    errors: List[Dict[str, Any]] = []
    for s in items:
        try:
            r = await opery_service.upsert_sale(db, s.model_dump(exclude_none=True))
            if r.get("created"):
                created += 1
            else:
                updated += 1
        except Exception as e:
            logger.error(f"opery.webhook: erro no item {s.opery_order_id}: {e}")
            errors.append({"opery_order_id": s.opery_order_id, "error": str(e)})

    return {"received": len(items), "created": created, "updated": updated, "errors": errors}


@router.post("/opery/webhook/health")
async def webhook_health(
    x_opery_api_key: Optional[str] = Header(None, alias="X-Opery-Api-Key"),
):
    """Endpoint para a Opery testar autenticacao/conectividade."""
    if not opery_service.verify_webhook_key(x_opery_api_key):
        raise HTTPException(status_code=401, detail="Chave invalida (X-Opery-Api-Key)")
    return {"ok": True, "message": "Autenticado. Endpoint de vendas: POST /api/opery/webhook/sales"}


# ==================== ADMIN ROUTES ====================


def _require_admin_dep():
    return _deps["require_admin"]()


@router.get("/admin/opery/dashboard")
async def opery_dashboard(
    request: Request,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user: dict = Depends(_require_admin_dep),
):
    """KPIs das vendas presenciais (Opery). Mesmos filtros do dashboard online."""
    db = request.app.db
    return await opery_service.aggregate_stats(db, start=start, end=end)


@router.get("/admin/opery/sales")
async def list_sales(
    request: Request,
    start: Optional[str] = None,
    end: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(_require_admin_dep),
):
    db = request.app.db
    match: Dict[str, Any] = {}
    if start:
        match.setdefault("order_date", {})["$gte"] = start + "T00:00:00"
    if end:
        match.setdefault("order_date", {})["$lte"] = end + "T23:59:59"
    if status:
        match["status"] = status
    if q:
        match["$or"] = [
            {"opery_order_id": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"customer_cpf": {"$regex": q, "$options": "i"}},
        ]
    total = await db.opery_sales.count_documents(match)
    cursor = db.opery_sales.find(match, {"_id": 0}).sort("order_date", -1).skip((page - 1) * per_page).limit(per_page)
    items = await cursor.to_list(per_page)
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/admin/opery/dispatch-log")
async def list_dispatch_log(
    request: Request,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(_require_admin_dep),
):
    db = request.app.db
    match: Dict[str, Any] = {}
    if status:
        match["status"] = status
    total = await db.opery_dispatch_log.count_documents(match)
    cursor = db.opery_dispatch_log.find(match, {"_id": 0, "payload": 0}).sort("updated_at", -1).skip((page - 1) * per_page).limit(per_page)
    items = await cursor.to_list(per_page)
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("/admin/opery/dispatch/retry")
async def retry_dispatches(
    request: Request,
    limit: int = Query(20, ge=1, le=200),
    user: dict = Depends(_require_admin_dep),
):
    db = request.app.db
    return await opery_service.retry_failed_dispatches(db, limit=limit)


@router.post("/admin/opery/dispatch/{order_id}")
async def dispatch_specific_order(
    order_id: str,
    request: Request,
    user: dict = Depends(_require_admin_dep),
):
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Pedido precisa estar pago para dispatch")
    result = await opery_service.dispatch_paid_order(db, order)
    return result or {"status": "unknown"}


@router.get("/admin/opery/config")
async def opery_config(user: dict = Depends(_require_admin_dep)):
    """Retorna se as chaves estao configuradas (nao expoe segredos)."""
    import os
    def _mask(v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        if len(v) <= 6:
            return "***"
        return f"{v[:3]}***{v[-2:]}"
    return {
        "webhook_secret_configured": bool(os.environ.get("OPERY_WEBHOOK_SECRET")),
        "webhook_secret_masked": _mask(os.environ.get("OPERY_WEBHOOK_SECRET")),
        "outbound_url": os.environ.get("OPERY_OUTBOUND_URL") or None,
        "outbound_token_configured": bool(os.environ.get("OPERY_OUTBOUND_TOKEN")),
        "outbound_token_masked": _mask(os.environ.get("OPERY_OUTBOUND_TOKEN")),
        "webhook_endpoint": "/api/opery/webhook/sales",
        "health_endpoint": "/api/opery/webhook/health",
    }


# ==================== REGISTER ====================


def register_opery_routes(app, deps: Dict[str, Any]):
    _deps["require_admin"] = deps["require_admin"]
    app.include_router(router)
