"""
Convênio (Corporate Program) - Iter 66
Sistema de Empresa Credenciada:
- Empresas cadastradas com descontos e desconto em folha
- Funcionarios vinculados a empresas
- Propagandistas com comissao 1a e 2a geracao
- Fechamento mensal e faturamento consolidado
"""

import io
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query, Response
from pydantic import BaseModel, EmailStr, Field
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["convenio"])

# ==================== HELPERS ====================

def _gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _digits(s: Optional[str]) -> str:
    if not s: return ""
    return "".join(ch for ch in s if ch.isdigit())

# ==================== MODELS ====================

class CompanyCreate(BaseModel):
    name: str
    cnpj: str
    email: EmailStr  # email para receber relatorios de fechamento
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[Dict] = None  # {street, number, complement, neighborhood, city, state, zip}
    # Regras comerciais
    discount_percent: float = 0.0        # 0-100 - desconto aplicado nos produtos p/ funcionarios
    payroll_enabled: bool = False        # habilita metodo "desconto em folha"
    payroll_limit_percent: float = 35.0  # % max do salario (lei brasileira: 35% incluindo consignados)
    # Comissoes
    propagandista_id: Optional[str] = None    # user_id do propagandista responsavel
    commission_company_percent: float = 0.0   # % que a empresa recebe (deduzida do propagandista)
    # Documentos/Notas
    contract_url: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[Dict] = None
    discount_percent: Optional[float] = None
    payroll_enabled: Optional[bool] = None
    payroll_limit_percent: Optional[float] = None
    propagandista_id: Optional[str] = None
    commission_company_percent: Optional[float] = None
    contract_url: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class EmployeeCreate(BaseModel):
    name: str
    email: EmailStr
    cpf: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    salary: float = 0.0
    active: bool = True


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    cpf: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    salary: Optional[float] = None
    active: Optional[bool] = None


class PayrollAcceptance(BaseModel):
    order_id: str
    accepted: bool
    terms_version: str = "v1"


# ==================== AUTH DEPS LAZY (resolvidas em runtime pelo server.py) ====================

_deps: Dict[str, Any] = {}


async def _current_user_lazy(request: Request):
    fn = _deps.get("get_current_user")
    if not fn:
        raise HTTPException(status_code=500, detail="Convenio deps nao inicializadas")
    return await fn(request)


async def _admin_user_lazy(request: Request):
    user = await _current_user_lazy(request)
    role = user.get("role")
    ADMIN_ROLES = {"admin", "super_admin", "financeiro", "comercial", "estoque"}
    if role not in ADMIN_ROLES and user.get("access_level", 99) > 1:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return user


async def _company_admin_lazy(request: Request):
    user = await _current_user_lazy(request)
    r = user.get("role")
    if r not in ("company_admin", "admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Acesso restrito a Empresas")
    return user


# ==================== HELPERS DE ACESSO ====================

async def _get_company_or_404(db, company_id: str) -> Dict:
    c = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Empresa nao encontrada")
    return c


async def _get_user_company(db, user: Dict) -> Dict:
    """Retorna a empresa do usuario logado (se ele for company_admin)."""
    cid = user.get("company_admin_of")
    if not cid:
        raise HTTPException(status_code=403, detail="Usuario nao e admin de nenhuma empresa")
    return await _get_company_or_404(db, cid)


# ==================== ADMIN: EMPRESAS ====================

@router.get("/admin/companies")
async def list_companies(request: Request, search: Optional[str] = None, active: Optional[bool] = None, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    q: Dict[str, Any] = {}
    if active is not None:
        q["active"] = active
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [{"name": rx}, {"cnpj": rx}, {"email": rx}]
    items = await db.companies.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # anexa contagem de funcionarios
    for c in items:
        c["employees_count"] = await db.company_employees.count_documents({"company_id": c["company_id"]})
    return {"companies": items}


@router.post("/admin/companies")
async def create_company(request: Request, data: CompanyCreate, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    payload = data.model_dump()
    payload["cnpj_digits"] = _digits(payload.get("cnpj"))
    # dedupe por CNPJ
    if payload["cnpj_digits"]:
        exists = await db.companies.find_one({"cnpj_digits": payload["cnpj_digits"]}, {"_id": 0, "company_id": 1})
        if exists:
            raise HTTPException(status_code=409, detail="Ja existe empresa com este CNPJ")
    doc = {"company_id": _gen_id("cmp_"), **payload, "created_at": _now_iso()}
    await db.companies.insert_one(doc)
    return await db.companies.find_one({"company_id": doc["company_id"]}, {"_id": 0})


@router.get("/admin/companies/{company_id}")
async def get_company(request: Request, company_id: str, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    c = await _get_company_or_404(db, company_id)
    c["employees_count"] = await db.company_employees.count_documents({"company_id": company_id})
    # dados do propagandista se houver
    if c.get("propagandista_id"):
        prop = await db.users.find_one({"user_id": c["propagandista_id"]}, {"_id": 0, "user_id": 1, "name": 1, "email": 1})
        c["propagandista"] = prop
    return c


@router.put("/admin/companies/{company_id}")
async def update_company(request: Request, company_id: str, data: CompanyUpdate, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    await _get_company_or_404(db, company_id)
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if "cnpj" in upd:
        upd["cnpj_digits"] = _digits(upd["cnpj"])
    upd["updated_at"] = _now_iso()
    await db.companies.update_one({"company_id": company_id}, {"$set": upd})
    return await db.companies.find_one({"company_id": company_id}, {"_id": 0})


@router.delete("/admin/companies/{company_id}")
async def delete_company(request: Request, company_id: str, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    n_emp = await db.company_employees.count_documents({"company_id": company_id})
    if n_emp > 0:
        raise HTTPException(status_code=400, detail=f"Empresa possui {n_emp} funcionario(s). Desative em vez de excluir.")
    r = await db.companies.delete_one({"company_id": company_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Empresa nao encontrada")
    return {"message": "Empresa removida"}


@router.post("/admin/companies/{company_id}/assign-admin")
async def assign_company_admin(request: Request, company_id: str, body: Dict, user: dict = Depends(_admin_user_lazy)):
    """Vincula um usuario existente como admin (RH) da empresa. Body: {user_id}."""
    db = request.app.db
    await _get_company_or_404(db, company_id)
    target_user_id = body.get("user_id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="user_id obrigatorio")
    u = await db.users.find_one({"user_id": target_user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    await db.users.update_one(
        {"user_id": target_user_id},
        {"$set": {"role": "company_admin", "company_admin_of": company_id, "updated_at": _now_iso()}},
    )
    return {"message": "Usuario vinculado como admin da empresa"}


# ==================== ADMIN + COMPANY: FUNCIONARIOS ====================

async def _resolve_company_scope(request: Request, user: Dict, company_id_param: Optional[str]) -> str:
    """Determina qual empresa acessar. Company_admin sempre no proprio escopo; admin usa param."""
    db = request.app.db
    if user.get("role") == "company_admin":
        cid = user.get("company_admin_of")
        if not cid:
            raise HTTPException(status_code=403, detail="Usuario nao vinculado a empresa")
        return cid
    # admin/super_admin usa param
    if not company_id_param:
        raise HTTPException(status_code=400, detail="company_id obrigatorio")
    await _get_company_or_404(db, company_id_param)
    return company_id_param


@router.get("/company/me")
async def company_me(request: Request, user: dict = Depends(_company_admin_lazy)):
    db = request.app.db
    if user.get("role") in ("admin", "super_admin") and not user.get("company_admin_of"):
        raise HTTPException(status_code=400, detail="Admin nao tem empresa vinculada; use /api/admin/companies")
    c = await _get_user_company(db, user)
    c["employees_count"] = await db.company_employees.count_documents({"company_id": c["company_id"]})
    return c


@router.get("/company/employees")
async def list_employees(request: Request, company_id: Optional[str] = None, search: Optional[str] = None,
                         active: Optional[bool] = None, user: dict = Depends(_company_admin_lazy)):
    db = request.app.db
    cid = await _resolve_company_scope(request, user, company_id)
    q: Dict[str, Any] = {"company_id": cid}
    if active is not None:
        q["active"] = active
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [{"name": rx}, {"email": rx}, {"cpf_digits": rx}]
    items = await db.company_employees.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"employees": items, "company_id": cid}


@router.post("/company/employees")
async def create_employee(request: Request, data: EmployeeCreate, company_id: Optional[str] = None,
                          user: dict = Depends(_company_admin_lazy)):
    db = request.app.db
    cid = await _resolve_company_scope(request, user, company_id)
    payload = data.model_dump()
    payload["cpf_digits"] = _digits(payload.get("cpf"))
    payload["phone_digits"] = _digits(payload.get("phone"))
    # dedupe por email dentro da empresa
    dup = await db.company_employees.find_one({"company_id": cid, "email": payload["email"].lower()})
    if dup:
        raise HTTPException(status_code=409, detail="Funcionario com este email ja existe na empresa")
    payload["email"] = payload["email"].lower()
    payload["company_id"] = cid
    # tenta linkar ao user existente (por email/cpf) — best-effort
    linked_user = None
    if payload["email"]:
        linked_user = await db.users.find_one({"email": payload["email"]}, {"_id": 0, "user_id": 1})
    if not linked_user and payload["cpf_digits"]:
        linked_user = await db.users.find_one({"cpf_digits": payload["cpf_digits"]}, {"_id": 0, "user_id": 1})
    if linked_user:
        payload["user_id"] = linked_user["user_id"]
    doc = {"employee_id": _gen_id("emp_"), **payload, "created_at": _now_iso()}
    await db.company_employees.insert_one(doc)
    return await db.company_employees.find_one({"employee_id": doc["employee_id"]}, {"_id": 0})


@router.put("/company/employees/{employee_id}")
async def update_employee(request: Request, employee_id: str, data: EmployeeUpdate,
                          user: dict = Depends(_company_admin_lazy)):
    db = request.app.db
    emp = await db.company_employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionario nao encontrado")
    # escopo
    if user.get("role") == "company_admin" and user.get("company_admin_of") != emp["company_id"]:
        raise HTTPException(status_code=403, detail="Fora do escopo da sua empresa")
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if "cpf" in upd:
        upd["cpf_digits"] = _digits(upd["cpf"])
    if "phone" in upd:
        upd["phone_digits"] = _digits(upd["phone"])
    if "email" in upd:
        upd["email"] = upd["email"].lower()
    upd["updated_at"] = _now_iso()
    await db.company_employees.update_one({"employee_id": employee_id}, {"$set": upd})
    return await db.company_employees.find_one({"employee_id": employee_id}, {"_id": 0})


@router.delete("/company/employees/{employee_id}")
async def delete_employee(request: Request, employee_id: str, user: dict = Depends(_company_admin_lazy)):
    db = request.app.db
    emp = await db.company_employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionario nao encontrado")
    if user.get("role") == "company_admin" and user.get("company_admin_of") != emp["company_id"]:
        raise HTTPException(status_code=403, detail="Fora do escopo da sua empresa")
    # Verificar se ha cargas em aberto
    open_charges = await db.payroll_charges.count_documents({"employee_id": employee_id, "status": {"$in": ["open", "billed"]}})
    if open_charges > 0:
        raise HTTPException(status_code=400, detail=f"Funcionario tem {open_charges} cobranca(s) em aberto. Desative em vez de excluir.")
    await db.company_employees.delete_one({"employee_id": employee_id})
    return {"message": "Funcionario removido"}


# ==================== XLSX: TEMPLATE + IMPORT ====================

@router.get("/company/employees/template.xlsx")
async def employees_template_xlsx(request: Request, user: dict = Depends(_company_admin_lazy)):
    """Retorna um XLSX modelo para importacao de funcionarios."""
    output = io.BytesIO()
    df = pd.DataFrame([
        {"nome": "Joao da Silva", "email": "joao@empresa.com", "cpf": "12345678900", "telefone": "(11) 91234-5678", "cargo": "Analista", "salario": 3500.00},
        {"nome": "Maria Souza", "email": "maria@empresa.com", "cpf": "98765432100", "telefone": "(11) 99876-5432", "cargo": "Gerente", "salario": 8000.00},
    ])
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Funcionarios", index=False)
    output.seek(0)
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=modelo_funcionarios.xlsx"},
    )


@router.post("/company/employees/import-xlsx")
async def import_employees_xlsx(request: Request, file: UploadFile = File(...),
                                company_id: Optional[str] = Query(None),
                                dry_run: bool = Query(False),
                                user: dict = Depends(_company_admin_lazy)):
    """Importa funcionarios de uma planilha XLSX/XLS.
    Colunas aceitas (case-insensitive): nome, email, cpf, telefone, cargo, salario.
    Se dry_run=true, apenas retorna preview sem inserir."""
    db = request.app.db
    cid = await _resolve_company_scope(request, user, company_id)
    raw = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(raw), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Falha ao ler XLSX: {e}")
    df.columns = [str(c).strip().lower() for c in df.columns]
    aliases = {
        "nome": "name", "name": "name",
        "email": "email", "e-mail": "email",
        "cpf": "cpf",
        "telefone": "phone", "phone": "phone", "celular": "phone",
        "cargo": "position", "position": "position", "funcao": "position",
        "salario": "salary", "salary": "salary", "salário": "salary",
    }
    normalized = {}
    for orig in df.columns:
        key = aliases.get(orig)
        if key:
            normalized[orig] = key
    df = df.rename(columns=normalized)
    required = {"name", "email"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Colunas obrigatorias ausentes: {', '.join(missing)}")

    preview: List[Dict] = []
    inserted = 0
    skipped = 0
    errors: List[str] = []

    for idx, row in df.iterrows():
        try:
            name = str(row.get("name", "")).strip()
            email = str(row.get("email", "")).strip().lower()
            if not name or not email or email == "nan":
                skipped += 1
                continue
            cpf_dig = _digits(str(row.get("cpf", "")) if "cpf" in df.columns else "")
            phone_dig = _digits(str(row.get("phone", "")) if "phone" in df.columns else "")
            salary_raw = row.get("salary", 0) if "salary" in df.columns else 0
            try:
                salary = float(str(salary_raw).replace(",", ".")) if salary_raw is not None and str(salary_raw).lower() != "nan" else 0.0
            except Exception:
                salary = 0.0
            position = str(row.get("position", "") or "").strip() if "position" in df.columns else ""

            dup = await db.company_employees.find_one({"company_id": cid, "email": email}, {"_id": 0, "employee_id": 1})
            row_status = "duplicate" if dup else "ready"
            item = {"name": name, "email": email, "cpf": cpf_dig, "phone": phone_dig, "position": position, "salary": salary, "status": row_status}
            preview.append(item)
            if row_status == "ready" and not dry_run:
                # link com user existente (best-effort)
                linked = None
                if email:
                    linked = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1})
                if not linked and cpf_dig:
                    linked = await db.users.find_one({"cpf_digits": cpf_dig}, {"_id": 0, "user_id": 1})
                doc = {
                    "employee_id": _gen_id("emp_"),
                    "company_id": cid,
                    "name": name, "email": email,
                    "cpf": cpf_dig, "cpf_digits": cpf_dig,
                    "phone": phone_dig, "phone_digits": phone_dig,
                    "position": position, "salary": salary,
                    "active": True, "created_at": _now_iso(),
                }
                if linked:
                    doc["user_id"] = linked["user_id"]
                await db.company_employees.insert_one(doc)
                inserted += 1
        except Exception as e:
            errors.append(f"linha {int(idx) + 2}: {e}")

    return {
        "company_id": cid,
        "dry_run": dry_run,
        "total": len(df),
        "inserted": inserted,
        "skipped": skipped,
        "errors": errors,
        "preview": preview[:200],
    }


# ==================== COMPANY: CONTRATO + RELATORIOS ====================

@router.get("/company/contract")
async def get_company_contract(request: Request, user: dict = Depends(_company_admin_lazy)):
    db = request.app.db
    c = await _get_user_company(db, user)
    if not c.get("contract_url"):
        raise HTTPException(status_code=404, detail="Contrato nao disponivel")
    return {"contract_url": c["contract_url"], "company_name": c.get("name")}


@router.get("/company/reports/open-charges")
async def report_open_charges(request: Request, employee_id: Optional[str] = None,
                              user: dict = Depends(_company_admin_lazy)):
    """Retorna cobrancas em aberto (opcional filtrar por funcionario)."""
    db = request.app.db
    c = await _get_user_company(db, user)
    q: Dict[str, Any] = {"company_id": c["company_id"], "status": {"$in": ["open", "billed"]}}
    if employee_id:
        q["employee_id"] = employee_id
    items = await db.payroll_charges.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    total = sum(float(x.get("amount", 0)) for x in items)
    return {"charges": items, "total": total, "count": len(items)}


@router.get("/company/reports/monthly")
async def report_monthly(request: Request, month: str = Query(..., description="YYYY-MM"),
                         user: dict = Depends(_company_admin_lazy)):
    db = request.app.db
    c = await _get_user_company(db, user)
    q = {"company_id": c["company_id"], "period_month": month}
    items = await db.payroll_charges.find(q, {"_id": 0}).sort("employee_id", 1).to_list(5000)
    by_employee: Dict[str, Dict] = {}
    for it in items:
        eid = it.get("employee_id", "?")
        if eid not in by_employee:
            by_employee[eid] = {"employee_id": eid, "employee_name": it.get("employee_name"),
                                "total": 0.0, "count": 0, "items": []}
        by_employee[eid]["total"] += float(it.get("amount", 0))
        by_employee[eid]["count"] += 1
        by_employee[eid]["items"].append(it)
    grand_total = sum(v["total"] for v in by_employee.values())
    return {"period": month, "employees": list(by_employee.values()), "grand_total": grand_total, "count": len(items)}


# ==================== ADMIN: DASHBOARD GLOBAL ====================

@router.get("/admin/convenio/dashboard")
async def convenio_dashboard(request: Request, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"active": True})
    total_employees = await db.company_employees.count_documents({})
    active_employees = await db.company_employees.count_documents({"active": True})
    open_charges = await db.payroll_charges.count_documents({"status": "open"})
    return {
        "companies": {"total": total_companies, "active": active_companies},
        "employees": {"total": total_employees, "active": active_employees},
        "open_charges": open_charges,
    }


# ==================== WIRE-UP ====================

def register_convenio_routes(app, deps: Dict[str, Any]):
    """Wire das dependencias auth vindas do server.py principal."""
    _deps["require_admin"] = deps["require_admin"]
    _deps["get_current_user"] = deps["get_current_user"]
    app.include_router(router)
