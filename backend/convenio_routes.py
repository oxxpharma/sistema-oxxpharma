"""
Convênio (Corporate Program) - Iter 66
Sistema de Empresa Credenciada:
- Empresas cadastradas com descontos e desconto em folha
- Funcionarios vinculados a empresas
- Propagandistas com comissao 1a e 2a geracao
- Fechamento mensal e faturamento consolidado
"""

import io
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
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
    discount_max_units: Optional[int] = None  # Iter 66.3: max unidades por pedido com desconto (opcional)
    payroll_enabled: bool = False        # habilita metodo "desconto em folha"
    payroll_limit_percent: float = 35.0  # % max do salario (lei brasileira: 35% incluindo consignados)
    # Comissoes
    propagandista_id: Optional[str] = None    # user_id do propagandista responsavel
    commission_company_percent: float = 0.0   # (legado) split - nao usado mais na nova comissao 3-gen
    representative_user_id: Optional[str] = None  # Iter 68: user_id que representa a empresa (compra da empresa)
    employee_discount_pct: float = 0.0        # Iter 68: % da comissao da empresa que vira desconto p/ funcionarios (0-15)
    # Documentos/Notas
    contract_url: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True


class PropagandistaCompanyCreate(BaseModel):
    name: str
    cnpj: str
    ie: Optional[str] = None
    status: Optional[str] = "ativa"
    slug: Optional[str] = None
    email: EmailStr
    whatsapp: Optional[str] = None
    # Endereço
    cep: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[Dict] = None
    # Representante Legal
    rep_name: Optional[str] = None
    rep_role: Optional[str] = None
    rep_cpf: Optional[str] = None
    rep_rg: Optional[str] = None
    rep_phone: Optional[str] = None
    rep_email: Optional[EmailStr] = None
    # Dados Bancários
    bank_name: Optional[str] = None
    account_type: Optional[str] = None
    agency: Optional[str] = None
    account_number: Optional[str] = None
    pix_type: Optional[str] = None
    pix_key: Optional[str] = None
    bank_favored_name: Optional[str] = None
    # Configurações Comerciais / Convênio
    password: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    employee_discount_pct: float = 0.0  # 0 a 15%
    payroll_enabled: bool = True
    payroll_limit_percent: float = 35.0


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[Dict] = None
    discount_percent: Optional[float] = None
    discount_max_units: Optional[int] = None
    payroll_enabled: Optional[bool] = None
    payroll_limit_percent: Optional[float] = None
    propagandista_id: Optional[str] = None
    commission_company_percent: Optional[float] = None
    representative_user_id: Optional[str] = None
    employee_discount_pct: Optional[float] = None
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
    payroll_limit_override: Optional[float] = None  # Iter 66.3: override manual do limite consignado
    active: bool = True


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    cpf: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    salary: Optional[float] = None
    payroll_limit_override: Optional[float] = None
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


@router.post("/admin/companies/{company_id}/contract")
async def upload_company_contract(request: Request, company_id: str, file: UploadFile = File(...),
                                  user: dict = Depends(_admin_user_lazy)):
    """Upload de contrato PDF via Emergent Object Storage.
    Aceita apenas application/pdf, max 10MB."""
    import storage_service
    db = request.app.db
    await _get_company_or_404(db, company_id)
    fname = (file.filename or "").lower()
    ct = (file.content_type or "").lower()
    if "pdf" not in ct and not fname.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser PDF")
    data = await file.read()
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo vazio ou maior que 10 MB")
    path = f"{storage_service.APP_NAME}/contracts/{company_id}.pdf"
    try:
        result = storage_service.put_object(path, data, "application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha no storage: {e}")
    url = f"/api/company-contracts/{company_id}.pdf"
    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {
            "contract_url": url,
            "contract_storage_path": result["path"],
            "contract_size_bytes": result.get("size", len(data)),
            "contract_uploaded_at": _now_iso(),
        }},
    )
    return {"contract_url": url, "size_bytes": len(data)}


@router.get("/company-contracts/{company_id}.pdf")
async def download_company_contract(request: Request, company_id: str,
                                     auth: Optional[str] = None,
                                     authorization: Optional[str] = None):
    """Baixa o PDF via storage. Aceita auth via header OU query ?auth=<token> (para <a href>)."""
    import storage_service
    db = request.app.db
    # resolucao manual do usuario (aceita ?auth= como fallback)
    if auth and "Authorization" not in request.headers:
        # simula o header pra reutilizar get_current_user
        get_user = _deps.get("get_current_user")
        if not get_user:
            raise HTTPException(status_code=500, detail="deps")
        # trick: monkey-patch headers via scope? Nao — chamamos direto:
        import jwt as _jwt
        secret = os.environ.get("JWT_SECRET")
        try:
            payload = _jwt.decode(auth, secret, algorithms=["HS256"])
            uid = payload.get("sub")
        except Exception:
            raise HTTPException(status_code=401, detail="Token invalido")
        user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario nao encontrado")
    else:
        user = await _current_user_lazy(request)
    r = user.get("role")
    if r not in ("admin", "super_admin"):
        if r != "company_admin" or user.get("company_admin_of") != company_id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    company = await _get_company_or_404(db, company_id)
    path = company.get("contract_storage_path") or f"{storage_service.APP_NAME}/contracts/{company_id}.pdf"
    try:
        content, ct = storage_service.get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado")
    return Response(content=content, media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename={company_id}.pdf"})


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
    # tenta linkar ao user existente ou cria conta na Rede 2 abaixo da empresa
    company_doc = await db.companies.find_one({"company_id": cid}, {"_id": 0})
    company_rep_id = company_doc.get("representative_user_id") if company_doc else None

    linked_user = None
    if payload["email"]:
        linked_user = await db.users.find_one({"email": payload["email"]}, {"_id": 0})
    if not linked_user and payload["cpf_digits"]:
        linked_user = await db.users.find_one({"cpf_digits": payload["cpf_digits"]}, {"_id": 0})

    if not linked_user:
        import bcrypt
        pwd_hash = bcrypt.hashpw("123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        emp_user_id = _gen_id("usr_")
        user_doc = {
            "user_id": emp_user_id,
            "name": payload["name"],
            "email": payload["email"],
            "cpf_digits": payload.get("cpf_digits"),
            "phone": payload.get("phone"),
            "password_hash": pwd_hash,
            "role": "customer",
            "networks": ["network_2"],
            "network_type": "network_2",
            "sponsor_id": company_rep_id,
            "sponsor_id_net2": company_rep_id,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await db.users.insert_one(user_doc)
        payload["user_id"] = emp_user_id
    else:
        payload["user_id"] = linked_user["user_id"]
        upd_u = {}
        if not linked_user.get("sponsor_id") and company_rep_id:
            upd_u["sponsor_id"] = company_rep_id
            upd_u["sponsor_id_net2"] = company_rep_id
        current_nets = linked_user.get("networks") or []
        if "network_2" not in current_nets:
            upd_u["networks"] = list(set(current_nets + ["network_2"]))
        if upd_u:
            await db.users.update_one({"user_id": linked_user["user_id"]}, {"$set": upd_u})

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
                # busca dados da empresa para obter representante
                company_doc = await db.companies.find_one({"company_id": cid}, {"_id": 0})
                company_rep_id = company_doc.get("representative_user_id") if company_doc else None

                linked = None
                if email:
                    linked = await db.users.find_one({"email": email}, {"_id": 0})
                if not linked and cpf_dig:
                    linked = await db.users.find_one({"cpf_digits": cpf_dig}, {"_id": 0})

                if not linked:
                    import bcrypt
                    pwd_hash = bcrypt.hashpw("123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                    emp_user_id = _gen_id("usr_")
                    user_doc = {
                        "user_id": emp_user_id,
                        "name": name,
                        "email": email,
                        "cpf_digits": cpf_dig,
                        "phone_digits": phone_dig,
                        "password_hash": pwd_hash,
                        "role": "customer",
                        "networks": ["network_2"],
                        "network_type": "network_2",
                        "sponsor_id": company_rep_id,
                        "sponsor_id_net2": company_rep_id,
                        "created_at": _now_iso(),
                        "updated_at": _now_iso(),
                    }
                    await db.users.insert_one(user_doc)
                    linked_user_id = emp_user_id
                else:
                    linked_user_id = linked["user_id"]
                    upd_u = {}
                    if not linked.get("sponsor_id") and company_rep_id:
                        upd_u["sponsor_id"] = company_rep_id
                        upd_u["sponsor_id_net2"] = company_rep_id
                    current_nets = linked.get("networks") or []
                    if "network_2" not in current_nets:
                        upd_u["networks"] = list(set(current_nets + ["network_2"]))
                    if upd_u:
                        await db.users.update_one({"user_id": linked["user_id"]}, {"$set": upd_u})

                doc = {
                    "employee_id": _gen_id("emp_"),
                    "company_id": cid,
                    "user_id": linked_user_id,
                    "name": name, "email": email,
                    "cpf": cpf_dig, "cpf_digits": cpf_dig,
                    "phone": phone_dig, "phone_digits": phone_dig,
                    "position": position, "salary": salary,
                    "active": True, "created_at": _now_iso(),
                }
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


# ==================== EMPLOYEE CONTEXT & CHECKOUT HELPERS ====================

async def get_employee_context(db, user: Optional[Dict]) -> Optional[Dict]:
    """Retorna contexto de funcionario para o usuario logado, ou None se nao for.
    Estrutura: { employee_id, employee_name, company_id, company_name, salary,
                 discount_percent, payroll_enabled, payroll_limit_percent,
                 payroll_limit_amount, open_charges_total, available_limit }
    """
    if not user:
        return None
    emp = await db.company_employees.find_one(
        {"$or": [
            {"user_id": user.get("user_id")},
            {"email": (user.get("email") or "").lower()},
        ], "active": True},
        {"_id": 0},
    )
    if not emp:
        return None
    company = await db.companies.find_one({"company_id": emp["company_id"], "active": True}, {"_id": 0})
    if not company:
        return None
    # link automatico do user_id se ainda nao setado
    if not emp.get("user_id") and user.get("user_id"):
        await db.company_employees.update_one(
            {"employee_id": emp["employee_id"]},
            {"$set": {"user_id": user["user_id"]}},
        )
        emp["user_id"] = user["user_id"]
    salary = float(emp.get("salary") or 0)
    limit_pct = float(company.get("payroll_limit_percent") or 35.0)
    # Iter 66.3: override manual do limite (por funcionario) — se setado, ignora salario
    override = emp.get("payroll_limit_override")
    if override is not None and float(override) > 0:
        limit_amount = round(float(override), 2)
    else:
        limit_amount = round(salary * limit_pct / 100, 2)
    # soma cobrancas em aberto (status: open, billed)
    charges = await db.payroll_charges.find(
        {"employee_id": emp["employee_id"], "status": {"$in": ["open", "billed"]}},
        {"_id": 0, "amount": 1},
    ).to_list(1000)
    open_total = round(sum(float(c.get("amount", 0)) for c in charges), 2)
    base_disc = float(company.get("discount_percent") or 0.0)
    extra_disc = float(company.get("employee_discount_pct") or 0.0)
    effective_disc = round(base_disc + extra_disc, 2)
    return {
        "employee_id": emp["employee_id"],
        "employee_name": emp.get("name"),
        "company_id": company["company_id"],
        "company_name": company.get("name"),
        # Iter 66.3: NAO exponho o salario ao frontend (privacidade). Fica so no admin.
        "position": emp.get("position"),
        "discount_percent": effective_disc,  # Iter 68: soma base + extra
        "base_discount_pct": base_disc,
        "employee_discount_pct": extra_disc,  # Iter 68: cedido da comissao da empresa
        "discount_max_units": company.get("discount_max_units"),
        "payroll_enabled": bool(company.get("payroll_enabled")),
        "payroll_limit_percent": limit_pct,
        "payroll_limit_amount": limit_amount,
        "payroll_limit_override": override,   # so exposto para admin/company_admin usar
        "open_charges_total": open_total,
        "available_limit": round(max(0.0, limit_amount - open_total), 2),
    }


@router.get("/me/employee-context")
async def me_employee_context(request: Request, user: dict = Depends(_current_user_lazy)):
    """Retorna contexto de funcionario do usuario logado (ou 404 se nao for)."""
    db = request.app.db
    ctx = await get_employee_context(db, user)
    if not ctx:
        raise HTTPException(status_code=404, detail="Usuario nao vinculado a nenhuma empresa credenciada")
    return ctx


class PayrollEligibilityIn(BaseModel):
    amount: float


@router.post("/checkout/payroll-eligibility")
async def checkout_payroll_eligibility(request: Request, data: PayrollEligibilityIn, user: dict = Depends(_current_user_lazy)):
    """Verifica se o usuario pode pagar `amount` via desconto em folha.
    Retorna: {eligible, reason?, limit, open_charges, available, amount, company_name}."""
    db = request.app.db
    ctx = await get_employee_context(db, user)
    if not ctx:
        return {"eligible": False, "reason": "not_employee"}
    if not ctx["payroll_enabled"]:
        return {"eligible": False, "reason": "payroll_disabled", **{k: ctx[k] for k in ["company_name", "payroll_limit_amount", "available_limit"]}}
    amt = float(data.amount or 0)
    if amt <= 0:
        return {"eligible": False, "reason": "invalid_amount"}
    if amt > ctx["available_limit"]:
        return {
            "eligible": False,
            "reason": "over_limit",
            "amount": amt,
            "limit": ctx["payroll_limit_amount"],
            "open_charges": ctx["open_charges_total"],
            "available": ctx["available_limit"],
            "company_name": ctx["company_name"],
        }
    return {
        "eligible": True,
        "amount": amt,
        "limit": ctx["payroll_limit_amount"],
        "open_charges": ctx["open_charges_total"],
        "available": ctx["available_limit"],
        "company_name": ctx["company_name"],
        "employee_id": ctx["employee_id"],
    }


async def create_payroll_charge(db, order: Dict, employee_ctx: Dict, acceptance: Dict) -> Dict:
    """Cria uma cobranca payroll (desconto em folha) para uma order.
    Registra o aceite digital (IP, UA, timestamp) para conformidade legal."""
    now = _now_iso()
    period = now[:7]  # YYYY-MM
    charge = {
        "charge_id": _gen_id("payr_"),
        "order_id": order["order_id"],
        "company_id": employee_ctx["company_id"],
        "employee_id": employee_ctx["employee_id"],
        "employee_name": employee_ctx["employee_name"],
        "user_id": order.get("user_id"),
        "amount": float(order.get("total", 0)),
        "status": "open",  # open -> billed -> paid
        "period_month": period,
        "created_at": now,
    }
    await db.payroll_charges.insert_one(charge)
    # Aceite digital (log separado para auditoria)
    await db.payroll_acceptances.insert_one({
        "acceptance_id": _gen_id("acpt_"),
        "order_id": order["order_id"],
        "employee_id": employee_ctx["employee_id"],
        "user_id": order.get("user_id"),
        "amount": charge["amount"],
        "ip": acceptance.get("ip"),
        "user_agent": acceptance.get("user_agent"),
        "terms_version": acceptance.get("terms_version") or "v1",
        "accepted_at": now,
    })
    return charge


# ==================== PROPAGANDISTA (Iter 66 - FASE 4) ====================
# Rede paralela: propagandista -> empresas -> funcionarios (gen1) -> indicacoes (gen2)
# Comissoes: sobre compras pagas (payment_status=paid) dos funcionarios (1a gen)
# e das indicacoes deles (2a gen). Empresa pode receber uma parcela que sai da comissao do propagandista.


class PropagandistaCommissionQuery(BaseModel):
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None


def _is_propagandista_user(user: dict) -> bool:
    """Iter 68: usuario e propagandista se role=propagandista, se tem network_2 nas redes ou se e admin."""
    if user.get("role") in ("propagandista", "admin", "super_admin"):
        return True
    nets = user.get("networks")
    if isinstance(nets, list) and "network_2" in nets:
        return True
    if user.get("network_type") == "network_2":
        return True
    return False


@router.get("/propagandista/me")
async def propagandista_me(request: Request, user: dict = Depends(_current_user_lazy)):
    """Retorna dados do propagandista logado + empresas vinculadas."""
    if not _is_propagandista_user(user):
        raise HTTPException(status_code=403, detail="Acesso restrito a Propagandistas")
    db = request.app.db
    companies = await db.companies.find({"propagandista_id": user["user_id"]}, {"_id": 0}).to_list(500)
    # totais rapidos
    total_employees = 0
    for c in companies:
        c["employees_count"] = await db.company_employees.count_documents({"company_id": c["company_id"], "active": True})
        total_employees += c["employees_count"]
    return {"user": {"user_id": user["user_id"], "name": user.get("name"), "email": user.get("email")},
            "companies": companies, "total_companies": len(companies), "total_employees": total_employees}


@router.get("/propagandista/commissions")
async def propagandista_commissions(request: Request, month: Optional[str] = None,
                                    user: dict = Depends(_current_user_lazy)):
    """Lista comissoes do propagandista (gen1 + gen2) para um mes YYYY-MM (default: atual)."""
    if not _is_propagandista_user(user):
        raise HTTPException(status_code=403, detail="Acesso restrito a Propagandistas")
    db = request.app.db
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    q = {"propagandista_id": user["user_id"], "period_month": month}
    items = await db.propagandista_commissions.find(q, {"_id": 0}).to_list(5000)
    gen1_total = sum(float(x["amount"]) for x in items if x.get("generation") == 1)
    gen2_total = sum(float(x["amount"]) for x in items if x.get("generation") == 2)
    return {"period": month, "commissions": items, "gen1_total": round(gen1_total, 2), "gen2_total": round(gen2_total, 2), "grand_total": round(gen1_total + gen2_total, 2)}


@router.post("/propagandista/companies")
async def propagandista_create_company(request: Request, data: PropagandistaCompanyCreate, user: dict = Depends(_current_user_lazy)):
    """Permite ao propagandista cadastrar uma nova empresa credenciada no sistema.
    A empresa entra como usuario representante na Rede 2 abaixo do propagandista.
    """
    if not _is_propagandista_user(user):
        raise HTTPException(status_code=403, detail="Acesso restrito a Propagandistas")
    db = request.app.db
    payload = data.model_dump()
    cnpj_digits = _digits(payload.get("cnpj"))
    if cnpj_digits:
        exists = await db.companies.find_one({"cnpj_digits": cnpj_digits}, {"_id": 0, "company_id": 1})
        if exists:
            raise HTTPException(status_code=409, detail="Já existe empresa cadastrada com este CNPJ")

    comp_email = (payload.get("rep_email") or payload["email"]).lower()
    rep_name = payload.get("rep_name") or payload.get("contact_name") or payload["name"]
    rep_phone = payload.get("rep_phone") or payload.get("contact_phone") or payload.get("whatsapp")
    rep_cpf = payload.get("rep_cpf")

    user_exists = await db.users.find_one({"email": comp_email}, {"_id": 0})

    plain_password = payload.get("password") or "123456"
    import bcrypt
    pwd_hash = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    propagandista_id = user["user_id"]

    if user_exists:
        rep_user_id = user_exists["user_id"]
        current_nets = user_exists.get("networks") or []
        upd_user = {
            "name": rep_name,
            "role": "company_admin",
            "networks": list(set(current_nets + ["network_2"])),
            "sponsor_id": user_exists.get("sponsor_id") or propagandista_id,
            "sponsor_id_net2": user_exists.get("sponsor_id_net2") or propagandista_id,
            "updated_at": _now_iso(),
        }
        if rep_cpf: upd_user["cpf_digits"] = _digits(rep_cpf)
        if rep_phone: upd_user["phone_digits"] = _digits(rep_phone)
        await db.users.update_one({"user_id": rep_user_id}, {"$set": upd_user})
    else:
        rep_user_id = _gen_id("usr_")
        rep_user_doc = {
            "user_id": rep_user_id,
            "name": rep_name,
            "email": comp_email,
            "cpf_digits": _digits(rep_cpf),
            "phone_digits": _digits(rep_phone),
            "password_hash": pwd_hash,
            "role": "company_admin",
            "networks": ["network_2"],
            "network_type": "network_2",
            "sponsor_id": propagandista_id,
            "sponsor_id_net2": propagandista_id,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await db.users.insert_one(rep_user_doc)

    address_doc = payload.get("address") or {
        "cep": payload.get("cep"),
        "street": payload.get("street"),
        "number": payload.get("number"),
        "complement": payload.get("complement"),
        "neighborhood": payload.get("neighborhood"),
        "city": payload.get("city"),
        "state": payload.get("state"),
    }

    company_id = _gen_id("cmp_")
    company_doc = {
        "company_id": company_id,
        "name": payload["name"],
        "cnpj": payload["cnpj"],
        "cnpj_digits": cnpj_digits,
        "ie": payload.get("ie"),
        "status": payload.get("status") or "ativa",
        "slug": payload.get("slug"),
        "email": payload["email"].lower(),
        "whatsapp": payload.get("whatsapp") or payload.get("contact_phone"),
        "address": address_doc,
        # Representante Legal
        "rep_name": rep_name,
        "rep_role": payload.get("rep_role"),
        "rep_cpf": rep_cpf,
        "rep_rg": payload.get("rep_rg"),
        "rep_phone": rep_phone,
        "rep_email": comp_email,
        # Dados Bancários
        "bank_name": payload.get("bank_name"),
        "account_type": payload.get("account_type"),
        "agency": payload.get("agency"),
        "account_number": payload.get("account_number"),
        "pix_type": payload.get("pix_type"),
        "pix_key": payload.get("pix_key"),
        "bank_favored_name": payload.get("bank_favored_name"),
        # Regras Comerciais
        "discount_percent": 0.0,
        "employee_discount_pct": float(payload.get("employee_discount_pct") or 0.0),
        "payroll_enabled": bool(payload.get("payroll_enabled", True)),
        "payroll_limit_percent": float(payload.get("payroll_limit_percent") or 35.0),
        "propagandista_id": propagandista_id,
        "representative_user_id": rep_user_id,
        "active": True,
        "created_at": _now_iso(),
    }
    await db.companies.insert_one(company_doc)

    await db.users.update_one(
        {"user_id": rep_user_id},
        {"$set": {"company_admin_of": company_id}}
    )

    res = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    res["representative_credentials"] = {"email": comp_email, "password": plain_password}
    return res


@router.get("/company/billings")
async def company_list_billings(request: Request, user: dict = Depends(_company_admin_lazy)):
    """Retorna os faturamentos consolidados da empresa do usuario logado."""
    db = request.app.db
    c = await _get_user_company(db, user)
    items = await db.company_billings.find({"company_id": c["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"billings": items}


@router.post("/company/billings/{billing_id}/pay")
async def company_billing_create_payment(request: Request, billing_id: str, user: dict = Depends(_company_admin_lazy)):
    """Gera cobrança MercadoPago (PIX / Boleto / Cartão) para a fatura consolidada da empresa."""
    import payments_service
    db = request.app.db
    c = await _get_user_company(db, user)
    billing = await db.company_billings.find_one({"billing_id": billing_id, "company_id": c["company_id"]}, {"_id": 0})
    if not billing:
        raise HTTPException(status_code=404, detail="Faturamento não encontrado para a sua empresa")
    if billing.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Faturamento já se encontra pago")

    frontend = os.environ.get("FRONTEND_URL") or os.environ.get("APP_URL") or ""
    backend = os.environ.get("BACKEND_URL") or ""
    if not frontend:
        frontend = str(request.base_url).rstrip("/").replace("/api", "")
    if not backend:
        backend = str(request.base_url).rstrip("/")

    try:
        pref = await payments_service.create_billing_preference(db, billing, frontend, backend)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao gerar cobrança MercadoPago: {e}")

    init_point = pref.get("init_point") if pref.get("environment") == "prod" else (pref.get("sandbox_init_point") or pref.get("init_point"))
    await db.company_billings.update_one(
        {"billing_id": billing_id},
        {"$set": {"payment_preference_id": pref["preference_id"], "payment_url": init_point, "status": "awaiting_payment"}},
    )
    return {"preference_id": pref["preference_id"], "payment_url": init_point, "environment": pref["environment"]}


async def create_propagandista_commissions_for_order(db, order: Dict):
    """Iter 68: Cria comissoes do Convenio para uma order paga.

    Regra multinivel (3 geracoes):
      - Compra do FUNCIONARIO   -> Empresa 15%, Propagandista 5%, Lider 1%
      - Compra da EMPRESA (usuario representante) -> Propagandista 15%, Lider 5%

    Se a empresa nao tem propagandista configurado: nao emite nada (fica retido).
    Se a empresa optou por conceder desconto ao funcionario (`employee_discount_pct`),
    esse valor JA foi aplicado como desconto no checkout e a comissao da empresa
    fica reduzida pelo mesmo %.

    Chamado a partir de mark_order_paid. Idempotente por order_id.
    """
    order_id = order.get("order_id")
    user_id = order.get("user_id")
    if not order_id or not user_id:
        return
    # idempotencia
    exists = await db.propagandista_commissions.count_documents({"order_id": order_id})
    if exists:
        return

    # 1) usuario e representante de alguma empresa? (compra da empresa)
    company_by_rep = await db.companies.find_one(
        {"representative_user_id": user_id, "active": True}, {"_id": 0}
    )
    if company_by_rep:
        await _emit_convenio_commissions(db, order, company_by_rep, actor="company")
        return

    # 2) usuario e funcionario de alguma empresa? (compra do funcionario)
    emp = await db.company_employees.find_one({"user_id": user_id, "active": True}, {"_id": 0})
    if emp:
        company = await db.companies.find_one({"company_id": emp["company_id"], "active": True}, {"_id": 0})
        if not company or not company.get("propagandista_id"):
            return
        await _emit_convenio_commissions(db, order, company, actor="employee", employee_id=emp["employee_id"])


async def _get_network_top_leader_id(db) -> Optional[str]:
    """Retorna o user_id do topo da Rede 2 (propagandistas), ou None."""
    doc = await db.platform_settings.find_one({"key": "network_top_leaders"}, {"_id": 0})
    leaders = (doc or {}).get("value") or {}
    return leaders.get("network_2")


# Novos rates configuraveis (com defaults conforme conversa com o usuario)
_DEFAULT_RATES = {
    "employee_purchase": {"empresa": 15.0, "propagandista": 5.0, "leader": 1.0},
    "company_purchase": {"propagandista": 15.0, "leader": 5.0},
}


async def _emit_convenio_commissions(db, order: Dict, company: Dict, actor: str, employee_id: Optional[str] = None):
    """Emite as comissoes multinivel de acordo com quem comprou.

    actor='employee' -> gen1=Empresa (15%), gen2=Propagandista (5%), gen3=Lider (1%)
    actor='company'  -> gen1=Propagandista (15%), gen2=Lider (5%)
    """
    base = float(order.get("subtotal") or 0)
    if base <= 0:
        return
    settings = await db.settings.find_one({}, {"_id": 0}) or {}
    rates_cfg = settings.get("convenio_rates") or _DEFAULT_RATES

    propagandista_id = company.get("propagandista_id")
    leader_id = await _get_network_top_leader_id(db)
    now = _now_iso()
    period_month = (order.get("paid_at") or now)[:7]
    company_id = company["company_id"]
    company_name = company.get("name")

    docs = []

    if actor == "employee":
        r = rates_cfg.get("employee_purchase", _DEFAULT_RATES["employee_purchase"])
        # Desconto ao funcionario reduz a comissao da empresa
        employee_disc_pct = float(company.get("employee_discount_pct") or 0)
        empresa_pct = max(0.0, float(r.get("empresa", 15.0)) - employee_disc_pct)
        prop_pct = float(r.get("propagandista", 5.0))
        leader_pct = float(r.get("leader", 1.0))

        docs.append({
            "beneficiary_role": "empresa",
            "beneficiary_id": company_id,
            "generation": 1,
            "rate_percent": empresa_pct,
            "amount": round(base * empresa_pct / 100, 2),
        })
        if propagandista_id:
            docs.append({
                "beneficiary_role": "propagandista",
                "beneficiary_id": propagandista_id,
                "generation": 2,
                "rate_percent": prop_pct,
                "amount": round(base * prop_pct / 100, 2),
            })
        if leader_id:
            docs.append({
                "beneficiary_role": "leader",
                "beneficiary_id": leader_id,
                "generation": 3,
                "rate_percent": leader_pct,
                "amount": round(base * leader_pct / 100, 2),
            })
    elif actor == "company":
        r = rates_cfg.get("company_purchase", _DEFAULT_RATES["company_purchase"])
        prop_pct = float(r.get("propagandista", 15.0))
        leader_pct = float(r.get("leader", 5.0))
        if propagandista_id:
            docs.append({
                "beneficiary_role": "propagandista",
                "beneficiary_id": propagandista_id,
                "generation": 1,
                "rate_percent": prop_pct,
                "amount": round(base * prop_pct / 100, 2),
            })
        if leader_id:
            docs.append({
                "beneficiary_role": "leader",
                "beneficiary_id": leader_id,
                "generation": 2,
                "rate_percent": leader_pct,
                "amount": round(base * leader_pct / 100, 2),
            })

    if not docs:
        return

    for d in docs:
        d.update({
            "commission_id": _gen_id("comm_"),
            "order_id": order["order_id"],
            "user_id": order.get("user_id"),
            "actor": actor,
            "company_id": company_id,
            "company_name": company_name,
            "employee_id": employee_id,
            "propagandista_id": propagandista_id,
            "leader_id": leader_id,
            "base_amount": base,
            # legado (retrocompat com consultas antigas):
            "amount": d["amount"],
            "status": "pending",
            "period_month": period_month,
            "created_at": now,
        })
        await db.propagandista_commissions.insert_one(d)


async def _emit_commission(db, order: Dict, company: Dict, generation: int, employee_id: str):
    """(Deprecated) Mantido apenas p/ chamadas legadas — nao usar em codigo novo."""
    actor = "employee" if generation == 1 else "company"
    await _emit_convenio_commissions(db, order, company, actor=actor, employee_id=employee_id)


# ==================== FECHAMENTO MENSAL + FATURAMENTO CONSOLIDADO ====================

async def process_monthly_closing(db, period: str) -> Dict:
    """Fecha o periodo YYYY-MM para todas as empresas ativas:
    - Agrupa payroll_charges do periodo com status=open
    - Marca charges como 'billed'
    - Cria/atualiza documento consolidado por empresa (company_billings)
    Retorna: {closed_companies, total_amount}"""
    now = _now_iso()
    companies = await db.companies.find({"active": True}, {"_id": 0}).to_list(1000)
    result = {"closed_companies": 0, "total_amount": 0.0, "billings": []}
    for c in companies:
        charges = await db.payroll_charges.find(
            {"company_id": c["company_id"], "period_month": period, "status": "open"},
            {"_id": 0},
        ).to_list(5000)
        if not charges:
            continue
        total = round(sum(float(x.get("amount", 0)) for x in charges), 2)
        billing = {
            "billing_id": _gen_id("bill_"),
            "company_id": c["company_id"],
            "company_name": c.get("name"),
            "company_email": c.get("email"),
            "period_month": period,
            "total_amount": total,
            "charges_count": len(charges),
            "employees": _group_charges_by_employee(charges),
            "status": "issued",       # issued -> paid
            "payment_method": "pix",  # sugerido; ajustavel via /api/admin/company-billings/{id}
            "created_at": now,
        }
        await db.company_billings.insert_one(billing)
        # marca charges como billed
        charge_ids = [x["charge_id"] for x in charges]
        await db.payroll_charges.update_many(
            {"charge_id": {"$in": charge_ids}},
            {"$set": {"status": "billed", "billing_id": billing["billing_id"], "billed_at": now}},
        )
        result["closed_companies"] += 1
        result["total_amount"] += total
        result["billings"].append({"company_id": c["company_id"], "total": total, "billing_id": billing["billing_id"]})
    result["total_amount"] = round(result["total_amount"], 2)
    return result


def _group_charges_by_employee(charges: List[Dict]) -> List[Dict]:
    by = {}
    for ch in charges:
        eid = ch.get("employee_id")
        if eid not in by:
            by[eid] = {"employee_id": eid, "employee_name": ch.get("employee_name"), "total": 0.0, "orders": []}
        by[eid]["total"] += float(ch.get("amount", 0))
        by[eid]["orders"].append({"order_id": ch.get("order_id"), "amount": ch.get("amount")})
    for v in by.values():
        v["total"] = round(v["total"], 2)
    return list(by.values())


@router.post("/admin/convenio/run-monthly-closing")
async def admin_run_closing(request: Request, body: Optional[Dict] = None, user: dict = Depends(_admin_user_lazy)):
    """Fecha manualmente um periodo. Body: {period: 'YYYY-MM'} (default: mes anterior)."""
    db = request.app.db
    period = (body or {}).get("period")
    if not period:
        # mes anterior
        now = datetime.now(timezone.utc)
        prev = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
        period = prev
    result = await process_monthly_closing(db, period)
    return {"period": period, **result}


@router.get("/admin/company-billings")
async def admin_list_billings(request: Request, period: Optional[str] = None, company_id: Optional[str] = None,
                              user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    q = {}
    if period: q["period_month"] = period
    if company_id: q["company_id"] = company_id
    items = await db.company_billings.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"billings": items}


@router.post("/admin/company-billings/{billing_id}/mark-paid")
async def admin_mark_billing_paid(request: Request, billing_id: str, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    b = await db.company_billings.find_one({"billing_id": billing_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Faturamento nao encontrado")
    await db.company_billings.update_one({"billing_id": billing_id}, {"$set": {"status": "paid", "paid_at": _now_iso()}})
    await db.payroll_charges.update_many({"billing_id": billing_id}, {"$set": {"status": "paid", "paid_at": _now_iso()}})
    return {"ok": True}


@router.post("/admin/company-billings/{billing_id}/create-payment")
async def admin_billing_create_payment(request: Request, billing_id: str, user: dict = Depends(_admin_user_lazy)):
    """Gera preferencia MP para faturamento consolidado (PIX/boleto/cartao).
    Retorna init_point/sandbox_init_point que a empresa acessa para pagar."""
    import payments_service
    db = request.app.db
    billing = await db.company_billings.find_one({"billing_id": billing_id}, {"_id": 0})
    if not billing:
        raise HTTPException(status_code=404, detail="Faturamento nao encontrado")
    if billing.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Faturamento ja foi pago")
    frontend = os.environ.get("FRONTEND_URL") or os.environ.get("APP_URL") or ""
    backend = os.environ.get("BACKEND_URL") or ""
    # fallback: usa origin do request
    if not frontend:
        frontend = str(request.base_url).rstrip("/").replace("/api", "")
    if not backend:
        backend = str(request.base_url).rstrip("/")
    try:
        pref = await payments_service.create_billing_preference(db, billing, frontend, backend)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha MP: {e}")
    init_point = pref.get("init_point") if pref.get("environment") == "prod" else (pref.get("sandbox_init_point") or pref.get("init_point"))
    await db.company_billings.update_one(
        {"billing_id": billing_id},
        {"$set": {"payment_preference_id": pref["preference_id"], "payment_url": init_point, "status": "awaiting_payment"}},
    )
    return {"preference_id": pref["preference_id"], "payment_url": init_point, "environment": pref["environment"]}


@router.post("/admin/company-billings/{billing_id}/resend-email")
async def admin_billing_resend_email(request: Request, billing_id: str, user: dict = Depends(_admin_user_lazy)):
    """Reenvia email de fechamento com detalhamento por funcionario e link de pagamento."""
    import email_service
    db = request.app.db
    b = await db.company_billings.find_one({"billing_id": billing_id}, {"_id": 0})
    if not b or not b.get("company_email"):
        raise HTTPException(status_code=404, detail="Faturamento ou email nao encontrado")
    rows = "".join(
        f"<tr><td style='padding:6px;border:1px solid #ddd'>{e['employee_name']}</td>"
        f"<td style='padding:6px;border:1px solid #ddd'>{len(e.get('orders', []))}</td>"
        f"<td style='padding:6px;border:1px solid #ddd;text-align:right'>R$ {e['total']:.2f}</td></tr>"
        for e in b.get("employees", [])
    )
    pay_link = b.get("payment_url")
    pay_html = f"<p><a href='{pay_link}' style='background:#ea580c;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px'>Pagar via Mercado Pago</a></p>" if pay_link else ""
    subject = f"Fechamento Convenio {b['period_month']} · R$ {b['total_amount']:.2f}"
    html = f"""<h2>Fechamento mensal — {b['period_month']}</h2>
<p>Empresa: <b>{b['company_name']}</b></p>
<p>Total: <b>R$ {b['total_amount']:.2f}</b> em {b['charges_count']} cobranças.</p>
{pay_html}
<table style='border-collapse:collapse;margin-top:8px'>
<thead><tr><th style='padding:6px;background:#f4f4f5;border:1px solid #ddd'>Funcionário</th><th style='padding:6px;background:#f4f4f5;border:1px solid #ddd'>Pedidos</th><th style='padding:6px;background:#f4f4f5;border:1px solid #ddd'>Total</th></tr></thead>
<tbody>{rows}</tbody></table>"""
    await email_service.send_email(db, b["company_email"], subject, html)
    return {"ok": True, "to": b["company_email"]}


@router.put("/company/employees/{employee_id}/limit")
async def company_update_employee_limit(request: Request, employee_id: str, body: Dict,
                                       user: dict = Depends(_company_admin_lazy)):
    """Iter 66.3: empresa altera limite consignado manual do funcionario.
    body: {payroll_limit_override: float|null} — null remove o override (volta ao calculo por salario)."""
    db = request.app.db
    emp = await db.company_employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionario nao encontrado")
    if user.get("role") == "company_admin" and user.get("company_admin_of") != emp["company_id"]:
        raise HTTPException(status_code=403, detail="Fora do escopo da sua empresa")
    override = body.get("payroll_limit_override")
    if override is not None:
        try:
            override = float(override)
            if override < 0:
                raise ValueError("Limite nao pode ser negativo")
        except Exception:
            raise HTTPException(status_code=400, detail="payroll_limit_override invalido")
    await db.company_employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"payroll_limit_override": override, "updated_at": _now_iso()}},
    )
    return await db.company_employees.find_one({"employee_id": employee_id}, {"_id": 0})


# ==================== WIRE-UP ====================

def register_convenio_routes(app, deps: Dict[str, Any]):
    """Wire das dependencias auth vindas do server.py principal."""
    _deps["require_admin"] = deps["require_admin"]
    _deps["get_current_user"] = deps["get_current_user"]
    app.include_router(router)
