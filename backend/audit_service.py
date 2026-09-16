"""
System-wide Audit Logging Service for OxxPharma Backoffice.
Captures created, updated, deleted, and executed admin actions with rich target entity details.
"""

import io
import json
import uuid
import re
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Request, HTTPException, Depends, Query, Response
from pydantic import BaseModel
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["audit"])

# Known action verbs / suffixes at the end of API paths
SUBPATH_VERBS = {
    "status", "nf", "issue-invoice", "resend-invoice", "fix-missing",
    "impersonate", "assign-admin", "contract", "limit", "mark-paid",
    "create-payment", "resend-email", "reset-password", "reset-to-default",
    "backfill-missing-data", "import-xlsx", "import", "toggle",
    "retry-pending", "run-monthly-closing", "ending", "download"
}

STATUS_LABELS = {
    "pending": "Aguardando Pagamento",
    "paid": "Pago",
    "separating": "Em Separação",
    "shipped": "Enviado",
    "available_for_pickup": "Disponível para Retirada",
    "delivered": "Entregue",
    "cancelled": "Cancelado"
}

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


def parse_path_and_action(method: str, path: str) -> tuple[str, str, Optional[str], Optional[str]]:
    """
    Parses request path and method into:
    (action, entity_type, entity_id, action_subpath)
    """
    m = method.upper()
    parts = [p for p in path.split("/") if p]

    # Action base
    action = "OTHER"
    if m == "POST": action = "CREATE"
    elif m in ("PUT", "PATCH"): action = "UPDATE"
    elif m == "DELETE": action = "DELETE"

    entity_type = "sistema"
    if len(parts) >= 3 and parts[0] == "api" and parts[1] == "admin":
        entity_type = parts[2]
    elif len(parts) >= 2 and parts[0] == "api":
        entity_type = parts[1]

    action_subpath = None
    entity_id = None

    if len(parts) >= 3:
        last_part = parts[-1].lower()
        if last_part in SUBPATH_VERBS or any(verb in last_part for verb in ("invoice", "password", "closing", "pending", "import")):
            action_subpath = last_part
            if len(parts) >= 4:
                entity_id = parts[-2]
                entity_type = parts[-3] if parts[-3] not in ("api", "admin") else entity_type
        else:
            if len(parts) >= 4 and parts[-1] not in ("api", "admin"):
                entity_id = parts[-1]
                entity_type = parts[-2]

    # Normalize entity_type
    if entity_type in ("company-billings", "convenio"):
        entity_type = "companies" if "billing" not in path else "company-billings"

    return action, entity_type, entity_id, action_subpath


async def enrich_audit_details(
    db,
    method: str,
    path: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str],
    action_subpath: Optional[str],
    payload: Dict[str, Any]
) -> tuple[str, Optional[str], str]:
    """
    Looks up MongoDB for target entity names and generates detailed Portuguese description
    and changes summary.
    Returns (description, entity_name, changes_summary)
    """
    entity_name = None
    changes_list = []
    desc = ""

    m = method.upper()
    sub = action_subpath or ""

    # 1. ORDERS / PEDIDOS
    if entity_type in ("orders", "pedidos", "pedido"):
        short_id = entity_id.replace("ord_", "")[-8:].upper() if entity_id else "NOVO"
        target_order = None
        if entity_id:
            try:
                target_order = await db.orders.find_one({"order_id": entity_id}, {"_id": 0, "customer_name": 1, "customer_email": 1, "total": 1})
            except Exception:
                pass

        cust_name = (target_order.get("customer_name") if target_order else None) or payload.get("customer_name") or payload.get("customer_email") or ""
        cust_str = f" ({cust_name})" if cust_name else ""
        entity_name = f"Pedido #{short_id}{cust_str}"

        if sub == "status":
            new_st = payload.get("status") or payload.get("order_status") or ""
            st_label = STATUS_LABELS.get(new_st, new_st)
            tracking = payload.get("tracking_code")
            desc = f"Atualizou status do pedido #{short_id}{cust_str} para '{st_label}'"
            if tracking:
                desc += f" · Rastreio: {tracking}"
                changes_list.append(f"Código de Rastreamento: {tracking}")
            changes_list.append(f"Novo Status: {st_label}")
        elif sub == "nf":
            if m == "DELETE":
                desc = f"Removeu a Nota Fiscal (PDF/XML) do pedido #{short_id}{cust_str}"
            else:
                desc = f"Anexou Nota Fiscal ao pedido #{short_id}{cust_str}"
        elif sub == "issue-invoice":
            desc = f"Emitiu nota de faturamento do pedido #{short_id}{cust_str}"
        elif sub == "resend-invoice":
            to = payload.get("to") or "e-mail cadastrado"
            desc = f"Reenviou fatura por e-mail do pedido #{short_id}{cust_str} para {to}"
        elif sub == "fix-missing":
            desc = f"Corrigiu dados fiscais (CPF/CEP) do pedido #{short_id}{cust_str}"
        elif sub == "backfill-missing-data":
            desc = "Executou correção automática em lote de CPF/CEP faltantes nos pedidos"
        elif m == "DELETE":
            desc = f"Excluiu permanentemente o pedido #{short_id}{cust_str}"
        elif m == "POST":
            total_val = payload.get("total") or (target_order.get("total") if target_order else 0)
            desc = f"Criou novo pedido #{short_id}{cust_str} · Valor Total: R$ {float(total_val or 0):.2f}"
        else:
            desc = f"Atualizou informações do pedido #{short_id}{cust_str}"

    # 2. USERS / USUÁRIOS
    elif entity_type in ("users", "usuarios", "usuario"):
        target_user = None
        if entity_id:
            try:
                target_user = await db.users.find_one({"user_id": entity_id}, {"_id": 0, "name": 1, "email": 1, "role": 1})
            except Exception:
                pass

        u_name = (target_user.get("name") if target_user else None) or payload.get("name") or payload.get("contact_name") or ""
        u_email = (target_user.get("email") if target_user else None) or payload.get("email") or ""
        entity_name = f"{u_name} ({u_email})" if u_name and u_email else (u_name or u_email or entity_id or "Usuário")

        if sub == "impersonate":
            desc = f"Iniciou impersonação (acesso como cliente) do usuário {entity_name}"
            action = "EXECUTE"
        elif sub in ("reset-password", "redefinir-senha"):
            desc = f"Redefiniu a senha de acesso do usuário {entity_name}"
        elif m == "DELETE":
            desc = f"Excluiu o usuário {entity_name}"
        elif m == "POST":
            role_val = payload.get("role") or "customer"
            desc = f"Cadastrou novo usuário {entity_name} (Perfil: {role_val})"
        else:
            desc = f"Atualizou cadastro do usuário {entity_name}"

        if "role" in payload: changes_list.append(f"Perfil de Acesso: {payload['role']}")
        if "active" in payload: changes_list.append(f"Ativo: {'Sim' if payload['active'] else 'Não'}")

    # 3. PRODUCTS / PRODUTOS
    elif entity_type in ("products", "produtos", "produto"):
        target_prod = None
        if entity_id:
            try:
                target_prod = await db.products.find_one({"product_id": entity_id}, {"_id": 0, "name": 1, "price": 1, "stock": 1})
            except Exception:
                pass

        p_name = (target_prod.get("name") if target_prod else None) or payload.get("name") or entity_id or "Produto"
        entity_name = p_name

        price = payload.get("price") or (target_prod.get("price") if target_prod else None)
        stock = payload.get("stock") or (target_prod.get("stock") if target_prod else None)

        details_str = []
        if price is not None: details_str.append(f"Preço: R$ {float(price):.2f}")
        if stock is not None: details_str.append(f"Estoque: {stock}")
        extra = f" ({', '.join(details_str)})" if details_str else ""

        if m == "DELETE":
            desc = f"Excluiu o produto '{p_name}'"
        elif m == "POST":
            desc = f"Cadastrou novo produto '{p_name}'{extra}"
        else:
            desc = f"Atualizou dados do produto '{p_name}'{extra}"

        for k, v in payload.items():
            if k in ("name", "price", "stock", "active", "category", "brand"):
                changes_list.append(f"{k}: {v}")

    # 4. COMPANIES / EMPRESAS CONVÊNIO
    elif entity_type in ("companies", "empresa", "empresas"):
        target_comp = None
        if entity_id:
            try:
                target_comp = await db.companies.find_one({"company_id": entity_id}, {"_id": 0, "name": 1, "cnpj": 1})
            except Exception:
                pass

        c_name = (target_comp.get("name") if target_comp else None) or payload.get("name") or "Empresa"
        cnpj = (target_comp.get("cnpj") if target_comp else None) or payload.get("cnpj") or ""
        cnpj_str = f" (CNPJ: {cnpj})" if cnpj else ""
        entity_name = f"{c_name}{cnpj_str}"

        if sub == "assign-admin":
            desc = f"Vinculou representante legal como administrador da empresa '{c_name}'"
        elif sub == "contract":
            desc = f"Fez upload do contrato PDF da empresa '{c_name}'"
        elif m == "DELETE":
            desc = f"Excluiu a empresa convênio '{c_name}'"
        elif m == "POST":
            desc = f"Cadastrou nova empresa convênio '{c_name}'{cnpj_str}"
        else:
            desc = f"Atualizou informações da empresa convênio '{c_name}'"

    # 5. COMPANY BILLINGS / FATURAMENTO CONVÊNIO
    elif entity_type in ("company-billings", "billings", "faturamento"):
        short_bill = entity_id.replace("bill_", "") if entity_id else ""
        entity_name = f"Fatura #{short_bill}"
        if sub == "mark-paid":
            desc = f"Marcou a fatura de convênio #{short_bill} como PAGA"
        elif sub == "create-payment":
            desc = f"Gerou cobrança MercadoPago para a fatura #{short_bill}"
        elif sub == "resend-email":
            desc = f"Reenviou e-mail de fechamento da fatura #{short_bill}"
        elif sub == "run-monthly-closing":
            period = payload.get("period") or "mês anterior"
            desc = f"Executou fechamento mensal do convênio para o período {period}"
        else:
            desc = f"Atualizou a fatura de convênio #{short_bill}"

    # 6. ROLE PROFILES / PERFIS
    elif entity_type in ("role-profiles", "roles", "perfis"):
        if sub == "reset-to-default":
            desc = "Resetou todos os perfis de acesso para o padrão do sistema"
        else:
            entity_name = entity_id or payload.get("role_id") or "Perfil"
            desc = f"Atualizou permissões do perfil de acesso '{entity_name}'"

    # 7. IGVD VOUCHERS
    elif entity_type in ("igvd", "vouchers"):
        desc = "Processou e encerrou lote de vouchers IGVD pendentes"

    # 8. GENERAL FALLBACK
    if not desc:
        pretty_entity = {
            "categories": "categoria",
            "coupons": "cupom",
            "settings": "configuração",
            "withdrawals": "saque",
            "emails": "modelo de email",
            "tenants": "marca",
            "page-builder": "página builder",
            "webhook": "integração webhook"
        }.get(entity_type, entity_type)

        act_word = "Criou" if m == "POST" else ("Atualizou" if m in ("PUT", "PATCH") else ("Excluiu" if m == "DELETE" else "Modificou"))
        item_str = f" '{entity_id}'" if entity_id else ""
        desc = f"{act_word} {pretty_entity}{item_str}"

    # Summarize payload changes if list is empty
    if not changes_list and payload:
        for k, v in payload.items():
            if k not in ("password", "password_hash", "_id") and not isinstance(v, (dict, list)):
                changes_list.append(f"{k}: {v}")

    changes_summary = " · ".join(changes_list[:6]) if changes_list else ""
    return desc, entity_name, changes_summary


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
    payload: Optional[Dict[str, Any]] = None,
    action_subpath: Optional[str] = None,
    entity_name: Optional[str] = None,
    changes_summary: Optional[str] = None
) -> Dict[str, Any]:
    """Records an audit entry in the admin_audit_logs collection with enriched metadata."""
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
            "entity_name": entity_name,
            "action_subpath": action_subpath,
            "description": description,
            "changes_summary": changes_summary or "",
            "method": method or "N/A",
            "path": path or "N/A",
            "payload": payload or {}
        }

        await db.admin_audit_logs.insert_one(log_doc)
        log_doc.pop("_id", None)
        return log_doc
    except Exception as e:
        logger.error(f"Failed to record audit log: {e}")
        return {}


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
            {"entity_name": rx},
            {"changes_summary": rx},
            {"ip": rx},
            {"entity_id": rx},
            {"entity_type": rx}
        ]

    total = await db.admin_audit_logs.count_documents(q)
    skip = (page - 1) * limit
    items = await db.admin_audit_logs.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total_creates = await db.admin_audit_logs.count_documents({"action": "CREATE"})
    total_updates = await db.admin_audit_logs.count_documents({"action": "UPDATE"})
    total_deletes = await db.admin_audit_logs.count_documents({"action": "DELETE"})
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
            {"entity_name": rx}, {"changes_summary": rx},
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
            "Nome/Recurso": l.get("entity_name") or l.get("entity_id") or "N/A",
            "Descrição Detalhada": l.get("description", ""),
            "Resumo das Alterações": l.get("changes_summary", ""),
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
