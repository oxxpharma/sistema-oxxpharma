"""
System-wide Audit Logging Service for OxxPharma Backoffice.
Captures created, updated, deleted, and executed admin actions.
"""

import io
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Request, HTTPException, Depends, Query, Response
from pydantic import BaseModel
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["audit"])

def _gen_id(prefix: str = "log_aud_") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def get_client_ip(request: Request) -> str:
    """Extract real client IP address considering proxy headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

async def log_audit_event(
    db,
    user: Optional[Dict[str, Any]],
    action: str,            # "CREATE", "UPDATE", "DELETE", "EXECUTE", "LOGIN", "OTHER"
    entity_type: str,       # "product", "company", "user", "order", "billing", "setting", "coupon", "role", etc.
    entity_id: Optional[str],
    description: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    method: Optional[str] = None,
    path: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Records an audit entry in the admin_audit_logs collection."""
    try:
        now = _now_iso()
        u_id = user.get("user_id") if user else "system"
        u_name = user.get("name") if user else (user.get("email") if user else "Sistema / Anônimo")
        u_email = user.get("email") if user else "system"
        u_role = user.get("role") if user else "system"

        log_doc = {
            "log_id": _gen_id(),
            "created_at": now,
            "user_id": u_id,
            "user_name": u_name,
            "user_email": u_email,
            "user_role": u_role,
            "ip": ip or "127.0.0.1",
            "user_agent": user_agent or "N/A",
            "action": action.upper(),
            "entity_type": entity_type.lower(),
            "entity_id": str(entity_id) if entity_id is not None else None,
            "description": description,
            "method": method or "N/A",
            "path": path or "N/A",
            "payload": payload or {}
        }

        await db.admin_audit_logs.insert_one(log_doc)
        # Clean mongo _id before returning
        log_doc.pop("_id", None)
        return log_doc
    except Exception as e:
        logger.error(f"Failed to record audit log: {e}")
        return {}

def infer_entity_and_action(method: str, path: str) -> tuple[str, str, str]:
    """Infers action, entity_type and description from request method and path."""
    m = method.upper()
    parts = [p for p in path.split("/") if p]
    
    # Defaults
    action = "OTHER"
    if m == "POST": action = "CREATE"
    elif m in ("PUT", "PATCH"): action = "UPDATE"
    elif m == "DELETE": action = "DELETE"

    entity_type = "sistema"
    if len(parts) >= 3 and parts[0] == "api" and parts[1] == "admin":
        entity_type = parts[2]
    elif len(parts) >= 2 and parts[0] == "api":
        entity_type = parts[1]

    entity_id = parts[-1] if len(parts) > 3 and not parts[-1].startswith("api") else None

    # Descriptions in Portuguese
    action_desc = {
        "CREATE": "Criou",
        "UPDATE": "Atualizou / Editou",
        "DELETE": "Excluiu / Deletou",
        "OTHER": "Executou ação em"
    }.get(action, "Modificou")

    entity_names = {
        "products": "produto",
        "categories": "categoria",
        "companies": "empresa",
        "users": "usuário",
        "orders": "pedido",
        "billings": "faturamento",
        "company-billings": "fatura de empresa",
        "coupons": "cupom",
        "settings": "configuração",
        "roles": "perfil",
        "networks": "rede",
        "withdrawals": "saque",
        "emails": "email",
        "tenants": "marca",
    }
    pretty_entity = entity_names.get(entity_type, entity_type)

    desc = f"{action_desc} {pretty_entity}"
    if entity_id:
        desc += f" ({entity_id})"

    return action, entity_type, desc

# Audit Dependencies Lazy Resolution
_deps: Dict[str, Any] = {}

async def _admin_user_lazy(request: Request):
    fn = _deps.get("get_current_user")
    if not fn:
        raise HTTPException(status_code=500, detail="Audit deps não inicializadas")
    user = await fn(request)
    role = user.get("role")
    ADMIN_ROLES = {"admin", "super_admin", "financeiro", "comercial", "estoque"}
    if role not in ADMIN_ROLES and user.get("access_level", 99) > 1:
        raise HTTPException(status_code=403, detail="Acesso restrito ao Painel Admin")
    return user

# ==================== ENDPOINTS DE CONSULTA E EXPORTAÇÃO ====================

@router.get("/audit-logs")
async def list_audit_logs(
    request: Request,
    search: Optional[str] = Query(None, description="Busca por nome, email, IP ou descrição"),
    action: Optional[str] = Query(None, description="CREATE, UPDATE, DELETE, EXECUTE"),
    entity_type: Optional[str] = Query(None, description="product, company, user, etc."),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    user: dict = Depends(_admin_user_lazy)
):
    """Retorna listagem paginada dos logs de auditoria com estatísticas de resumo."""
    db = request.app.db
    q: Dict[str, Any] = {}

    if action:
        q["action"] = action.upper()
    if entity_type:
        q["entity_type"] = entity_type.lower()
    
    if start_date or end_date:
        q["created_at"] = {}
        if start_date:
            q["created_at"]["$gte"] = f"{start_date}T00:00:00"
        if end_date:
            q["created_at"]["$lte"] = f"{end_date}T23:59:59"

    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [
            {"user_name": rx},
            {"user_email": rx},
            {"description": rx},
            {"ip": rx},
            {"entity_id": rx},
            {"entity_type": rx}
        ]

    total = await db.admin_audit_logs.count_documents(q)
    skip = (page - 1) * limit
    items = await db.admin_audit_logs.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Estatísticas de resumo gerais
    total_creates = await db.admin_audit_logs.count_documents({"action": "CREATE"})
    total_updates = await db.admin_audit_logs.count_documents({"action": "UPDATE"})
    total_deletes = await db.admin_audit_logs.count_documents({"action": "DELETE"})
    
    # Admins distintos ativas nos últimos logs
    distinct_users = len(await db.admin_audit_logs.distinct("user_email"))

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 1,
        "stats": {
            "total_all": await db.admin_audit_logs.count_documents({}),
            "total_creates": total_creates,
            "total_updates": total_updates,
            "total_deletes": total_deletes,
            "active_admins": distinct_users
        }
    }


@router.get("/audit-logs/export")
async def export_audit_logs(
    request: Request,
    search: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: dict = Depends(_admin_user_lazy)
):
    """Exporta relatórios de auditoria em planilha XLSX."""
    db = request.app.db
    q: Dict[str, Any] = {}

    if action: q["action"] = action.upper()
    if entity_type: q["entity_type"] = entity_type.lower()
    if start_date or end_date:
        q["created_at"] = {}
        if start_date: q["created_at"]["$gte"] = f"{start_date}T00:00:00"
        if end_date: q["created_at"]["$lte"] = f"{end_date}T23:59:59"
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [
            {"user_name": rx}, {"user_email": rx}, {"description": rx},
            {"ip": rx}, {"entity_id": rx}, {"entity_type": rx}
        ]

    logs = await db.admin_audit_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)

    formatted = []
    for l in logs:
        formatted.append({
            "Data e Hora": l.get("created_at", "")[:19].replace("T", " "),
            "Usuário": l.get("user_name", ""),
            "E-mail": l.get("user_email", ""),
            "Cargo": l.get("user_role", ""),
            "Ação": l.get("action", ""),
            "Entidade": l.get("entity_type", ""),
            "ID Recurso": l.get("entity_id") or "N/A",
            "Descrição": l.get("description", ""),
            "IP": l.get("ip", ""),
            "Método": l.get("method", ""),
            "Rota": l.get("path", "")
        })

    df = pd.DataFrame(formatted)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Auditoria", index=False)
    output.seek(0)

    filename = f"auditoria_oxxpharma_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/audit-logs/{log_id}")
async def get_audit_log_detail(
    request: Request,
    log_id: str,
    user: dict = Depends(_admin_user_lazy)
):
    """Retorna detalhes técnicos de um log de auditoria específico."""
    db = request.app.db
    log = await db.admin_audit_logs.find_one({"log_id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Log de auditoria não encontrado")
    return log


def register_audit_routes(app, deps: Dict[str, Any]):
    """Registra as dependências auth e rotas de auditoria."""
    _deps["get_current_user"] = deps.get("get_current_user")
    app.include_router(router)
