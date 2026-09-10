"""
Opery Solutions - HTTP Routes (Iter 67)

Rotas expostas:
  Publicas (autenticadas por header X-Opery-Api-Key):
    POST /api/opery/webhook/sales           -> recebe 1 ou N vendas do ERP
    POST /api/opery/webhook/health          -> ping/health check
    POST /api/opery/webhook/nf-issued       -> callback assincrono da NF emitida

  Publicas (sem auth):
    GET  /api/opery/docs-spec               -> retorna a documentacao MD publica

  Admin (backoffice):
    GET  /api/admin/opery/dashboard         -> stats das vendas presenciais
    GET  /api/admin/opery/sales             -> listagem paginada
    GET  /api/admin/opery/dispatch-log      -> logs outbound
    GET  /api/admin/opery/dispatch-log/{order_id} -> log especifico (com payload)
    GET  /api/admin/opery/inbound-log       -> logs inbound (auditoria)
    POST /api/admin/opery/dispatch/retry    -> reprocessa dispatches falhados
    POST /api/admin/opery/dispatch/{order_id} -> dispara manualmente 1 pedido
    GET  /api/admin/opery/config            -> retorna config (mascarada)
    PUT  /api/admin/opery/config            -> atualiza config
    GET  /api/admin/opery/order/{order_id}/nf-status -> status da NF
    GET  /api/admin/opery/order/{order_id}/nf.pdf  -> baixa DANFE (PDF)
    GET  /api/admin/opery/order/{order_id}/nf.xml  -> baixa XML NF-e
"""

import os
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Header, Depends, Query
from fastapi.responses import Response, PlainTextResponse
from pydantic import BaseModel

import opery_service
import opery_nf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["opery"])

_deps: Dict[str, Any] = {}


def _mask(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    if len(v) <= 6:
        return "***"
    return f"{v[:3]}***{v[-2:]}"


def _sample_headers(request: Request) -> Dict[str, str]:
    """Coleta headers seguros p/ auditoria (nunca guarda a chave completa)."""
    out = {}
    for h in ("host", "user-agent", "content-type", "x-forwarded-for", "x-real-ip"):
        v = request.headers.get(h)
        if v: out[h] = v
    key = request.headers.get("x-opery-api-key")
    if key:
        out["x-opery-api-key"] = _mask(key)
    return out


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
    sale: Optional[SaleIn] = None
    sales: Optional[List[SaleIn]] = None


@router.post("/opery/webhook/sales")
async def receive_sales(
    body: WebhookIn,
    request: Request,
    x_opery_api_key: Optional[str] = Header(None, alias="X-Opery-Api-Key"),
):
    db = request.app.db
    if not opery_service.verify_webhook_key(x_opery_api_key):
        await opery_service.log_inbound(
            db, "sales", ok=False,
            headers_sample=_sample_headers(request),
            body=body.model_dump(exclude_none=True),
            response={"status": 401}, error="chave invalida",
        )
        raise HTTPException(status_code=401, detail="Chave invalida (X-Opery-Api-Key)")

    items: List[SaleIn] = []
    if body.sales: items.extend(body.sales)
    if body.sale: items.append(body.sale)
    if not items:
        await opery_service.log_inbound(db, "sales", ok=False, headers_sample=_sample_headers(request),
                                        body=body.model_dump(exclude_none=True), response={"status": 400},
                                        error="payload vazio")
        raise HTTPException(status_code=400, detail="Envie 'sale' ou 'sales' no body")

    created = 0; updated = 0; errors: List[Dict[str, Any]] = []
    for s in items:
        try:
            r = await opery_service.upsert_sale(db, s.model_dump(exclude_none=True))
            if r.get("created"): created += 1
            else: updated += 1
        except Exception as e:
            logger.error(f"opery.webhook: erro no item {s.opery_order_id}: {e}")
            errors.append({"opery_order_id": s.opery_order_id, "error": str(e)})

    resp = {"received": len(items), "created": created, "updated": updated, "errors": errors}
    await opery_service.log_inbound(db, "sales", ok=True, headers_sample=_sample_headers(request),
                                    body=body.model_dump(exclude_none=True), response=resp)
    return resp


@router.post("/opery/webhook/health")
async def webhook_health(
    request: Request,
    x_opery_api_key: Optional[str] = Header(None, alias="X-Opery-Api-Key"),
):
    db = request.app.db
    if not opery_service.verify_webhook_key(x_opery_api_key):
        await opery_service.log_inbound(db, "health", ok=False, headers_sample=_sample_headers(request),
                                        body=None, response={"status": 401}, error="chave invalida")
        raise HTTPException(status_code=401, detail="Chave invalida (X-Opery-Api-Key)")
    resp = {"ok": True, "message": "Autenticado. Endpoint de vendas: POST /api/opery/webhook/sales"}
    await opery_service.log_inbound(db, "health", ok=True, headers_sample=_sample_headers(request),
                                    body=None, response=resp)
    return resp


class NFIssuedIn(BaseModel):
    order_id: str
    nf_number: Optional[str] = None
    nf_chave: Optional[str] = None
    nf_xml: Optional[str] = None
    nf_pdf_url: Optional[str] = None


@router.post("/opery/webhook/nf-issued")
async def nf_issued_callback(
    body: NFIssuedIn,
    request: Request,
    x_opery_api_key: Optional[str] = Header(None, alias="X-Opery-Api-Key"),
):
    """Callback opcional: Opery avisa que a NF de um pedido nosso foi emitida."""
    db = request.app.db
    if not opery_service.verify_webhook_key(x_opery_api_key):
        await opery_service.log_inbound(db, "nf_callback", ok=False, headers_sample=_sample_headers(request),
                                        body=body.model_dump(exclude_none=True), response={"status": 401},
                                        error="chave invalida")
        raise HTTPException(status_code=401, detail="Chave invalida")
    update: Dict[str, Any] = {"opery_nf_issued_at": opery_service._now_iso()}
    if body.nf_number: update["opery_nf_number"] = body.nf_number
    if body.nf_chave: update["opery_nf_chave"] = body.nf_chave
    if body.nf_xml: update["opery_nf_xml"] = body.nf_xml
    if body.nf_pdf_url: update["opery_nf_pdf_url"] = body.nf_pdf_url
    r = await db.orders.update_one({"order_id": body.order_id}, {"$set": update})
    resp = {"ok": True, "matched": r.matched_count, "modified": r.modified_count}
    await opery_service.log_inbound(db, "nf_callback", ok=True, headers_sample=_sample_headers(request),
                                    body=body.model_dump(exclude_none=True), response=resp)
    return resp


# ==================== DOCS PUBLICAS ====================


@router.get("/opery/docs-spec")
async def opery_docs_spec():
    """Retorna o conteudo Markdown da spec publica."""
    path = "/app/memory/OPERY_INTEGRATION_SPEC.md"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Documentacao nao encontrada")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    return {"content": content, "path": path}


# ==================== ADMIN ROUTES ====================


def _require_admin_dep():
    """Chamado como Depends(admin_dep) — cria e resolve a dep de admin.
    Precisa retornar diretamente a dep function (nao a factory)."""
    from fastapi import Request
    async def _resolver(request: Request):
        # busca dep configurada em register_opery_routes
        admin_factory = _deps.get("require_admin")
        if admin_factory is None:
            raise HTTPException(status_code=500, detail="require_admin nao configurado")
        dep_fn = admin_factory()
        # dep_fn depende de get_current_user, precisamos resolver manualmente
        # padrao usado no proj: obtem user via request
        get_user = _deps.get("get_current_user")
        if get_user is None:
            raise HTTPException(status_code=500, detail="get_current_user nao configurado")
        user = await get_user(request)
        # aplica a verificacao de admin igual require_admin
        if not _deps.get("is_admin_level", lambda u: True)(user):
            raise HTTPException(status_code=403, detail="Acesso negado")
        return user
    return _resolver()


# Cria a dependencia como callable (nao factory) — FastAPI espera assim
async def admin_dep(request: Request):
    get_user = _deps.get("get_current_user")
    is_admin = _deps.get("is_admin_level")
    if get_user is None or is_admin is None:
        raise HTTPException(status_code=500, detail="opery deps nao configuradas")
    user = await get_user(request)
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return user


@router.get("/admin/opery/dashboard")
async def opery_dashboard(request: Request, start: Optional[str] = None, end: Optional[str] = None,
                         user: dict = Depends(admin_dep)):
    db = request.app.db
    return await opery_service.aggregate_stats(db, start=start, end=end)


@router.get("/admin/opery/sales")
async def list_sales(
    request: Request,
    start: Optional[str] = None, end: Optional[str] = None,
    status: Optional[str] = None, q: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_dep),
):
    db = request.app.db
    match: Dict[str, Any] = {}
    if start: match.setdefault("order_date", {})["$gte"] = start + "T00:00:00"
    if end: match.setdefault("order_date", {})["$lte"] = end + "T23:59:59"
    if status: match["status"] = status
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
    request: Request, status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_dep),
):
    db = request.app.db
    match: Dict[str, Any] = {}
    if status: match["status"] = status
    total = await db.opery_dispatch_log.count_documents(match)
    # payload cortado na listagem
    cursor = db.opery_dispatch_log.find(match, {"_id": 0, "payload": 0}).sort("updated_at", -1).skip((page - 1) * per_page).limit(per_page)
    items = await cursor.to_list(per_page)
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.get("/admin/opery/dispatch-log/{order_id}")
async def get_dispatch_log_detail(order_id: str, request: Request, user: dict = Depends(admin_dep)):
    """Retorna log completo (com payload) de um pedido especifico."""
    db = request.app.db
    log = await db.opery_dispatch_log.find_one({"order_id": order_id}, {"_id": 0})
    return log or {"order_id": order_id, "status": "never_dispatched"}


@router.get("/admin/opery/inbound-log")
async def list_inbound_log(
    request: Request, kind: Optional[str] = None, ok: Optional[bool] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(admin_dep),
):
    db = request.app.db
    match: Dict[str, Any] = {}
    if kind: match["kind"] = kind
    if ok is not None: match["ok"] = ok
    total = await db.opery_inbound_log.count_documents(match)
    cursor = db.opery_inbound_log.find(match, {"_id": 0}).sort("created_at", -1).skip((page - 1) * per_page).limit(per_page)
    items = await cursor.to_list(per_page)
    return {"total": total, "page": page, "per_page": per_page, "items": items}


@router.post("/admin/opery/dispatch/retry")
async def retry_dispatches(request: Request, limit: int = Query(20, ge=1, le=200),
                           user: dict = Depends(admin_dep)):
    db = request.app.db
    return await opery_service.retry_failed_dispatches(db, limit=limit)


@router.post("/admin/opery/dispatch/{order_id}")
async def dispatch_specific_order(order_id: str, request: Request, user: dict = Depends(admin_dep)):
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Pedido precisa estar pago para dispatch")
    result = await opery_service.dispatch_paid_order(db, order)
    return result or {"status": "unknown"}


# ==================== CONFIG ====================


@router.get("/admin/opery/config")
async def opery_config(request: Request, user: dict = Depends(admin_dep)):
    """Retorna config atual (mascarada) + endpoints publicos."""
    db = request.app.db
    cfg = await opery_service.load_config(db)
    return {
        "source": cfg.get("source"),
        "webhook_secret_configured": bool(cfg.get("webhook_secret")),
        "webhook_secret_masked": _mask(cfg.get("webhook_secret")),
        "outbound_url": cfg.get("outbound_url") or None,
        "outbound_token_configured": bool(cfg.get("outbound_token")),
        "outbound_token_masked": _mask(cfg.get("outbound_token")),
        "docs_url": cfg.get("docs_url") or "/docs/opery",
        "updated_at": cfg.get("updated_at"),
        "updated_by": cfg.get("updated_by"),
        "webhook_endpoint": "/api/opery/webhook/sales",
        "health_endpoint": "/api/opery/webhook/health",
        "nf_callback_endpoint": "/api/opery/webhook/nf-issued",
    }


class ConfigUpdate(BaseModel):
    webhook_secret: Optional[str] = None
    outbound_url: Optional[str] = None
    outbound_token: Optional[str] = None
    docs_url: Optional[str] = None


@router.put("/admin/opery/config")
async def update_opery_config(body: ConfigUpdate, request: Request, user: dict = Depends(admin_dep)):
    db = request.app.db
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items() if v is not None}
    # Trata strings vazias como "manter" (permite mask nao sobrescrever)
    updates = {k: v for k, v in updates.items() if not (isinstance(v, str) and v.startswith("***"))}
    if not updates:
        raise HTTPException(status_code=400, detail="Nada a atualizar")
    actor = user.get("email") or user.get("user_id")
    cfg = await opery_service.save_config(db, updates, actor=actor)
    return {
        "ok": True,
        "webhook_secret_configured": bool(cfg.get("webhook_secret")),
        "outbound_url": cfg.get("outbound_url"),
        "outbound_token_configured": bool(cfg.get("outbound_token")),
        "updated_at": cfg.get("updated_at"),
    }


# ==================== NF (XML/PDF) ====================


@router.get("/admin/opery/order/{order_id}/nf-status")
async def order_nf_status(order_id: str, request: Request, user: dict = Depends(admin_dep)):
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "order_id": 1, "opery_nf_number": 1,
                                                              "opery_nf_chave": 1, "opery_nf_xml": 1,
                                                              "opery_nf_pdf_url": 1, "opery_nf_issued_at": 1,
                                                              "payment_status": 1})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    log = await db.opery_dispatch_log.find_one({"order_id": order_id}, {"_id": 0})
    has_xml = bool(order.get("opery_nf_xml"))
    pdf_available = False
    if has_xml:
        pdf_available = opery_nf.render_danfe_pdf(order.get("opery_nf_xml") or "") is not None
    return {
        "order_id": order_id,
        "payment_status": order.get("payment_status"),
        "nf_number": order.get("opery_nf_number"),
        "nf_chave": order.get("opery_nf_chave"),
        "nf_pdf_url": order.get("opery_nf_pdf_url"),
        "nf_issued_at": order.get("opery_nf_issued_at"),
        "has_xml": has_xml,
        "pdf_available": pdf_available,
        "dispatch": log or {"status": "never_dispatched"},
    }


@router.get("/admin/opery/order/{order_id}/nf.pdf")
async def order_nf_pdf(order_id: str, request: Request, user: dict = Depends(admin_dep)):
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "opery_nf_xml": 1, "opery_nf_number": 1})
    if not order or not order.get("opery_nf_xml"):
        raise HTTPException(status_code=404, detail="XML da NF nao encontrado")
    pdf_bytes = opery_nf.render_danfe_pdf(order["opery_nf_xml"])
    if not pdf_bytes:
        raise HTTPException(status_code=422, detail="Nao foi possivel gerar o PDF a partir do XML. Baixe o XML bruto.")
    fname = f"NF-{order.get('opery_nf_number') or order_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{fname}\""},
    )


@router.get("/admin/opery/order/{order_id}/nf.xml")
async def order_nf_xml(order_id: str, request: Request, user: dict = Depends(admin_dep)):
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "opery_nf_xml": 1, "opery_nf_number": 1})
    if not order or not order.get("opery_nf_xml"):
        raise HTTPException(status_code=404, detail="XML da NF nao encontrado")
    fname = f"NF-{order.get('opery_nf_number') or order_id}.xml"
    return Response(
        content=order["opery_nf_xml"],
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=\"{fname}\""},
    )


# ==================== REGISTER ====================


def register_opery_routes(app, deps: Dict[str, Any]):
    _deps["require_admin"] = deps["require_admin"]
    _deps["get_current_user"] = deps["get_current_user"]
    _deps["is_admin_level"] = deps["is_admin_level"]
    app.include_router(router)
