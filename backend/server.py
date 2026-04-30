"""
OxxPharma - E-commerce MVP (Fase 1)
Backend API: Auth, Products, Categories, Cart, Checkout, Orders, Addresses, Admin
"""

import os
import uuid
import asyncio
import bcrypt
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends, Request, Response, Query, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
import jwt

import email_service
import card_service
import payments_service
import correios_service
import maxx_service
import store_extras

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"

# ==================== HELPERS ====================

def gen_id(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:12]}"

def gen_referral_code() -> str:
    return uuid.uuid4().hex[:8].upper()

# Comissao por afiliado sobre vendas via link de indicacao (default - pode ser sobrescrito via settings)
AFFILIATE_COMMISSION_RATE = 0.08

# Tipos de rede MMN
NETWORK_CUSTOMER = "customer"      # Cliente comum - so 8% afiliado, sem MMN
NETWORK_1 = "network_1"            # Rede 1: importada do sistema externo
NETWORK_2 = "network_2"            # Rede 2: Propagandista promovido organicamente

DEFAULT_SETTINGS = {
    "affiliate_commission_rate": 0.08,
    # Percentuais por geracao em % (ex: 5.0 = 5%)
    "network1_generations": [5.0, 3.0, 2.0, 1.0, 1.0, 0.5],
    "network2_generations": [5.0, 3.0, 2.0, 1.0, 1.0, 0.5],
    "propaganda_threshold_referrals": 5,       # minimo de indicacoes/mes para virar "em alta"
    "propaganda_threshold_period_days": 30,     # janela de analise
    "withdrawal_enabled": False,                # saques ativos/desativados
    "withdrawal_min_amount": 50.0,              # valor minimo de saque
    "withdrawal_release_days": 15,              # dias apos pagamento do pedido para liberar para saque
    # Dados da empresa (para notas de faturamento)
    "company_name": "OxxPharma Farmacia Ltda",
    "company_cnpj": "",
    "company_address": "",
    "company_city": "",
    "company_state": "",
    "company_zip": "",
    "company_phone": "",
    "company_email": "contato@oxxpharma.com",
    "invoice_prefix": "OXX",
    "invoice_counter": 0,                       # incrementado a cada emissao
    # Email (Resend)
    "email_enabled": False,
    "resend_api_key": "",
    "email_from": "OxxPharma <onboarding@resend.dev>",
    "email_admin_recipients": "",               # lista de emails (virgula) que recebem alertas admin
    # Gatilhos on/off (admin controla granularmente)
    "email_trigger_order_created": True,
    "email_trigger_order_paid": True,
    "email_trigger_order_shipped": True,
    "email_trigger_order_delivered": True,
    "email_trigger_commission_earned": True,
    "email_trigger_admin_new_candidate": True,
    "email_trigger_admin_new_order": True,
    "email_trigger_welcome": True,
    # Webhook inbound Rede 1
    "external_webhook_token": "",               # gerado no seed
}

async def get_settings(db):
    s = await db.settings.find_one({"_id": "global"})
    if not s:
        s = {"_id": "global", **DEFAULT_SETTINGS, "updated_at": now_iso()}
        await db.settings.insert_one(s)
    # Garantir campos novos (merge com defaults)
    merged = {**DEFAULT_SETTINGS, **{k: v for k, v in s.items() if k != "_id"}}
    return merged


def get_app_url():
    """URL pública do app (usado em emails, links, redirects)."""
    url = os.environ.get("APP_URL") or os.environ.get("BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:3000"
    return url.rstrip("/")


def order_ctx(order: dict, user: dict):
    oid = order.get("order_id", "")
    app_url = get_app_url()
    return {
        "order": order,
        "user": user,
        "order_short_id": (oid[-8:].upper() if oid else ""),
        "order_link": f"{app_url}/pedido/{oid}",
        "referral_link": f"{app_url}/?ref={user.get('referral_code', '')}" if user.get('referral_code') else app_url,
    }


async def admin_recipients(db) -> List[str]:
    settings = await get_settings(db)
    raw = (settings.get("email_admin_recipients") or "").strip()
    if not raw:
        # Fallback: todos os usuarios com role=admin
        admins = await db.users.find({"role": "admin"}, {"_id": 0, "email": 1}).to_list(20)
        return [a.get("email") for a in admins if a.get("email")]
    return [x.strip() for x in raw.split(",") if x.strip()]

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_pw(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_id: str, email: str, role: str = "customer") -> str:
    return jwt.encode({
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

def now_iso():
    return datetime.now(timezone.utc).isoformat()

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nao autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await request.app.db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario nao encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")

async def get_optional_user(request: Request):
    try:
        return await get_current_user(request)
    except Exception:
        return None

def require_admin():
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("role") != "admin" and user.get("access_level", 99) > 1:
            raise HTTPException(status_code=403, detail="Acesso negado")
        return user
    return dep

def set_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=False, samesite="lax", max_age=7*24*60*60, path="/")

# ==================== MODELS ====================

class AuthRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    sponsor_code: Optional[str] = None  # Codigo de indicacao (referral do afiliado)

class AuthLogin(BaseModel):
    email: EmailStr
    password: str

class AddressCreate(BaseModel):
    label: Optional[str] = "Casa"
    street: str
    number: str
    complement: Optional[str] = None
    neighborhood: str
    city: str
    state: str
    zip_code: str
    is_default: bool = False

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    discount_price: Optional[float] = None
    category: str
    subcategory: Optional[str] = None
    images: List[str] = []
    stock: int = 0
    active: bool = True
    featured: bool = False
    brand: Optional[str] = None
    weight: Optional[float] = None
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    points_value: float = 0  # Pontos atribuidos por unidade comprada (manual pelo admin)
    pricing_tiers: List[Dict] = []  # [{type:'guest'|'logged'|'category', user_category_id?, price, label?}]

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    parent: Optional[str] = None
    order: int = 0
    active: bool = True

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = 1

class CheckoutData(BaseModel):
    address_id: str
    payment_method: str = "pix"  # pix | credit_card | boleto (MVP: mock)
    notes: Optional[str] = None
    ref_code: Optional[str] = None  # Codigo de indicacao do afiliado (URL ?ref=XXX)
    coupon_code: Optional[str] = None  # Cupom aplicado no checkout

class WithdrawalCreate(BaseModel):
    amount: float
    pix_key: str
    pix_key_type: str  # cpf | email | phone | random
    pix_name: str
    pix_cpf: str
    notes: Optional[str] = None

# ==================== LIFESPAN ====================

async def seed_admin(db):
    email = os.environ.get("ADMIN_EMAIL", "admin@oxxpharma.com")
    pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "user_id": gen_id("user_"), "email": email, "password_hash": hash_pw(pw),
            "name": "Administrador OxxPharma", "phone": None, "role": "admin",
            "access_level": 0, "status": "active", "addresses": [],
            "referral_code": gen_referral_code(),
            "sponsor_id": None, "sponsor_code": None,
            "network_type": NETWORK_CUSTOMER,
            "network_sponsor_id": None,
            "external_id": None,
            "created_at": now_iso(),
        })
        logger.info(f"Admin criado: {email}")
    else:
        update = {}
        if not verify_pw(pw, existing.get("password_hash", "")):
            update["password_hash"] = hash_pw(pw)
        if not existing.get("referral_code"):
            update["referral_code"] = gen_referral_code()
        if existing.get("role") != "admin":
            update["role"] = "admin"
        if update:
            await db.users.update_one({"email": email}, {"$set": update})

async def seed_categories(db):
    count = await db.categories.count_documents({})
    if count == 0:
        cats = [
            {"category_id": gen_id("cat_"), "name": "Medicamentos", "description": "Medicamentos em geral", "image_url": "", "parent": None, "order": 1, "active": True, "created_at": now_iso()},
            {"category_id": gen_id("cat_"), "name": "Dermocosmeticos", "description": "Cuidados com a pele", "image_url": "", "parent": None, "order": 2, "active": True, "created_at": now_iso()},
            {"category_id": gen_id("cat_"), "name": "Vitaminas e Suplementos", "description": "Vitaminas e suplementos alimentares", "image_url": "", "parent": None, "order": 3, "active": True, "created_at": now_iso()},
            {"category_id": gen_id("cat_"), "name": "Higiene Pessoal", "description": "Produtos de higiene", "image_url": "", "parent": None, "order": 4, "active": True, "created_at": now_iso()},
            {"category_id": gen_id("cat_"), "name": "Infantil", "description": "Produtos infantis", "image_url": "", "parent": None, "order": 5, "active": True, "created_at": now_iso()},
            {"category_id": gen_id("cat_"), "name": "Bem-estar", "description": "Produtos para bem-estar", "image_url": "", "parent": None, "order": 6, "active": True, "created_at": now_iso()},
        ]
        await db.categories.insert_many(cats)
        logger.info("Categorias padrao criadas")

async def seed_products(db):
    count = await db.products.count_documents({})
    if count == 0:
        prods = [
            {"product_id": gen_id("prod_"), "name": "Vitamina C 1000mg", "description": "Vitamina C efervescente com 10 comprimidos. Reforco para imunidade.", "price": 29.90, "discount_price": 22.90, "category": "Vitaminas e Suplementos", "images": ["https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400"], "stock": 150, "active": True, "featured": True, "brand": "OxxVita", "created_at": now_iso()},
            {"product_id": gen_id("prod_"), "name": "Protetor Solar FPS 50", "description": "Protetor solar facial e corporal com alta protecao. Textura leve.", "price": 89.90, "discount_price": 69.90, "category": "Dermocosmeticos", "images": ["https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400"], "stock": 80, "active": True, "featured": True, "brand": "OxxDerm", "created_at": now_iso()},
            {"product_id": gen_id("prod_"), "name": "Omega 3 EPA DHA", "description": "Oleo de peixe concentrado com 60 capsulas. Saude cardiovascular.", "price": 59.90, "discount_price": 44.90, "category": "Vitaminas e Suplementos", "images": ["https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400"], "stock": 200, "active": True, "featured": True, "brand": "OxxVita", "created_at": now_iso()},
            {"product_id": gen_id("prod_"), "name": "Shampoo Anticaspa 200ml", "description": "Shampoo anticaspa de uso diario. Controle eficaz.", "price": 34.90, "discount_price": None, "category": "Higiene Pessoal", "images": ["https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=400"], "stock": 120, "active": True, "featured": False, "brand": "OxxCare", "created_at": now_iso()},
            {"product_id": gen_id("prod_"), "name": "Creme Hidratante Corporal", "description": "Hidratante corporal com vitamina E. Pele macia e sedosa.", "price": 45.90, "discount_price": 35.90, "category": "Dermocosmeticos", "images": ["https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400"], "stock": 90, "active": True, "featured": True, "brand": "OxxDerm", "created_at": now_iso()},
            {"product_id": gen_id("prod_"), "name": "Multivitaminico A-Z", "description": "Complexo multivitaminico completo com 30 comprimidos.", "price": 39.90, "discount_price": 29.90, "category": "Vitaminas e Suplementos", "images": ["https://images.unsplash.com/photo-1559757175-7cb057fba93c?w=400"], "stock": 250, "active": True, "featured": False, "brand": "OxxVita", "created_at": now_iso()},
            {"product_id": gen_id("prod_"), "name": "Fralda Infantil P c/40", "description": "Fraldas descartaveis tamanho P com 40 unidades.", "price": 49.90, "discount_price": 39.90, "category": "Infantil", "images": ["https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400"], "stock": 60, "active": True, "featured": False, "brand": "OxxBaby", "created_at": now_iso()},
            {"product_id": gen_id("prod_"), "name": "Colageno Hidrolisado", "description": "Colageno em po com 300g. Pele, cabelos e unhas.", "price": 79.90, "discount_price": 59.90, "category": "Bem-estar", "images": ["https://images.unsplash.com/photo-1556228724-4e756cee32a3?w=400"], "stock": 100, "active": True, "featured": True, "brand": "OxxVita", "created_at": now_iso()},
        ]
        await db.products.insert_many(prods)
        logger.info("Produtos demo criados")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.mongodb_client = AsyncIOMotorClient(MONGO_URL)
    app.db = app.mongodb_client[DB_NAME]
    logger.info("Conectado ao MongoDB")
    await app.db.users.create_index("email", unique=True)
    await app.db.users.create_index("user_id", unique=True)
    await app.db.users.create_index("referral_code", unique=True, partialFilterExpression={"referral_code": {"$type": "string"}})
    await app.db.products.create_index("product_id", unique=True)
    await app.db.products.create_index("category")
    await app.db.orders.create_index("order_id", unique=True)
    await app.db.orders.create_index("user_id")
    await app.db.orders.create_index("invoice_number", unique=True, sparse=True)
    await app.db.categories.create_index("category_id", unique=True)
    await app.db.carts.create_index("user_id", unique=True)
    await app.db.commissions.create_index("commission_id", unique=True)
    await app.db.commissions.create_index("user_id")
    await app.db.commissions.create_index([("user_id", 1), ("status", 1)])
    await app.db.commissions.create_index("withdrawal_id")
    await app.db.users.create_index("network_type")
    await app.db.users.create_index("network_sponsor_id")
    await app.db.users.create_index("external_id", sparse=True)
    await app.db.withdrawals.create_index("withdrawal_id", unique=True)
    await app.db.withdrawals.create_index("user_id")
    await app.db.withdrawals.create_index([("status", 1), ("created_at", -1)])
    await app.db.email_templates.create_index("slug", unique=True)
    await app.db.email_templates.create_index("template_id", unique=True)
    await app.db.email_logs.create_index("log_id", unique=True)
    await app.db.email_logs.create_index("created_at")
    await app.db.webhook_logs.create_index("log_id", unique=True)
    await app.db.webhook_logs.create_index("created_at")
    await email_service.seed_default_templates(app.db)
    await app.db.card_batches.create_index("batch_id", unique=True)
    await app.db.card_batches.create_index("created_at")
    await app.db.card_api_logs.create_index("log_id", unique=True)
    await app.db.card_api_logs.create_index("created_at")
    # Migracao: se ainda nao rodou, reseta referral_codes -> None e marca referral_program_active=False
    migration = await app.db.migrations.find_one({"_id": "reset_referrals_for_card_program"})
    if not migration:
        await app.db.users.update_many(
            {"role": {"$ne": "admin"}},
            {
                "$unset": {"referral_code": ""},
                "$set": {
                    "referral_program_active": False,
                    "referral_enrollment": None,
                    "referral_enrolled_at": None,
                },
            },
        )
        # Admin continua com codigo (pode indicar normal)
        await app.db.users.update_many(
            {"role": "admin", "referral_program_active": {"$exists": False}},
            {"$set": {"referral_program_active": True}},
        )
        await app.db.migrations.insert_one({"_id": "reset_referrals_for_card_program", "ran_at": now_iso()})
        logger.info("Migracao reset_referrals_for_card_program aplicada")
    # Inicia scheduler do cartao
    card_service.start_scheduler(lambda: app.db)
    # Garantir token de webhook
    settings_doc = await app.db.settings.find_one({"_id": "global"}) or {}
    if not settings_doc.get("external_webhook_token"):
        await app.db.settings.update_one(
            {"_id": "global"},
            {"$set": {"external_webhook_token": gen_referral_code() + gen_referral_code()}},
            upsert=True,
        )
    await seed_admin(app.db)
    await seed_categories(app.db)
    await seed_products(app.db)
    yield
    app.mongodb_client.close()

app = FastAPI(title="OxxPharma E-commerce API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ==================== AUTH ====================

@app.post("/api/auth/register")
async def register(request: Request, response: Response, data: AuthRegister):
    db = request.app.db
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(status_code=400, detail="Email ja cadastrado")

    # Processar sponsor_code (indicacao) se fornecido
    sponsor_id = None
    sponsor_code_norm = None
    if data.sponsor_code:
        code = data.sponsor_code.strip().upper()
        sponsor = await db.users.find_one({"referral_code": code}, {"_id": 0})
        if sponsor:
            sponsor_id = sponsor["user_id"]
            sponsor_code_norm = code

    # referral_code so eh gerado quando usuario adere ao programa (nao mais no cadastro)
    user = {
        "user_id": gen_id("user_"), "email": data.email.lower(),
        "password_hash": hash_pw(data.password), "name": data.name,
        "phone": data.phone, "role": "customer", "access_level": 99,
        "status": "active", "addresses": [],
        "referral_code": None,
        "referral_program_active": False,
        "referral_enrollment": None,
        "referral_enrolled_at": None,
        "sponsor_id": sponsor_id, "sponsor_code": sponsor_code_norm,
        "network_type": NETWORK_CUSTOMER,
        "network_sponsor_id": None,
        "external_id": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["user_id"], user["email"], "customer")
    set_cookie(response, token)
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    # Email de boas-vindas (async, nao bloqueia)
    app_url = get_app_url()
    asyncio.create_task(email_service.trigger(db, "welcome", u["email"], {
        "user": u,
        "referral_link": f"{app_url}/?ref={u.get('referral_code','')}",
    }))
    # Se tem sponsor customer, checa se virou candidato a Propagandista
    if sponsor_id:
        sponsor = await db.users.find_one({"user_id": sponsor_id}, {"_id": 0, "password_hash": 0})
        if sponsor and sponsor.get("network_type") == NETWORK_CUSTOMER:
            settings = await get_settings(db)
            threshold = int(settings.get("propaganda_threshold_referrals") or 5)
            period_days = int(settings.get("propaganda_threshold_period_days") or 30)
            since = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()
            count = await db.users.count_documents({"sponsor_id": sponsor_id, "created_at": {"$gte": since}})
            # Notificar apenas no momento em que CRUZA o threshold (evita spam)
            if count == threshold:
                admins = await admin_recipients(db)
                if admins:
                    url = f"{app_url}/backoffice/candidatos"
                    asyncio.create_task(email_service.trigger(db, "admin_new_candidate", admins, {
                        "candidate": {**sponsor, "referrals_in_period": count},
                        "period_days": period_days,
                        "admin_link": url,
                    }))
    return {"token": token, "user": u}

@app.post("/api/auth/login")
async def login(request: Request, response: Response, data: AuthLogin):
    db = request.app.db
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not verify_pw(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")
    if user.get("status") in ("cancelled", "inactive", "deleted"):
        raise HTTPException(status_code=401, detail="Conta desativada")
    role = user.get("role", "customer")
    if user.get("access_level", 99) <= 1:
        role = "admin"
    token = create_token(user["user_id"], user["email"], role)
    set_cookie(response, token)
    user.pop("password_hash", None)
    return {"token": token, "user": user}

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    u = dict(user)
    u.pop("password_hash", None)
    return u

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Deslogado"}

# ==================== USER PROFILE & ADDRESSES ====================

@app.put("/api/users/me")
async def update_profile(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    body = await request.json()
    update = {}
    for field in ["name", "phone", "cpf", "pix_key", "pix_key_type"]:
        if field in body:
            update[field] = body[field]
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return u

@app.get("/api/users/me/addresses")
async def list_addresses(user: dict = Depends(get_current_user)):
    return {"addresses": user.get("addresses", [])}

@app.post("/api/users/me/addresses")
async def add_address(request: Request, data: AddressCreate, user: dict = Depends(get_current_user)):
    db = request.app.db
    addr = data.model_dump()
    addr["address_id"] = gen_id("addr_")
    addrs = user.get("addresses", [])
    if data.is_default:
        for a in addrs:
            a["is_default"] = False
    addrs.append(addr)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"addresses": addrs}})
    return {"addresses": addrs}

@app.put("/api/users/me/addresses/{address_id}")
async def update_address(request: Request, address_id: str, data: AddressCreate, user: dict = Depends(get_current_user)):
    db = request.app.db
    addrs = user.get("addresses", [])
    found = False
    for i, a in enumerate(addrs):
        if a.get("address_id") == address_id:
            new_addr = data.model_dump()
            new_addr["address_id"] = address_id
            if data.is_default:
                for x in addrs:
                    x["is_default"] = False
            addrs[i] = new_addr
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Endereco nao encontrado")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"addresses": addrs}})
    return {"addresses": addrs}

@app.delete("/api/users/me/addresses/{address_id}")
async def delete_address(request: Request, address_id: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    addrs = [a for a in user.get("addresses", []) if a.get("address_id") != address_id]
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"addresses": addrs}})
    return {"addresses": addrs}

# ==================== CATEGORIES ====================

@app.get("/api/categories")
async def list_categories(request: Request):
    db = request.app.db
    cats = await db.categories.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    return {"categories": cats}

@app.post("/api/admin/categories")
async def create_category(request: Request, data: CategoryCreate, user: dict = Depends(require_admin())):
    db = request.app.db
    cat = {"category_id": gen_id("cat_"), **data.model_dump(), "created_at": now_iso()}
    await db.categories.insert_one(cat)
    return await db.categories.find_one({"category_id": cat["category_id"]}, {"_id": 0})

@app.put("/api/admin/categories/{category_id}")
async def update_category(request: Request, category_id: str, data: CategoryCreate, user: dict = Depends(require_admin())):
    db = request.app.db
    update = data.model_dump()
    update["updated_at"] = now_iso()
    r = await db.categories.update_one({"category_id": category_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    return await db.categories.find_one({"category_id": category_id}, {"_id": 0})

@app.delete("/api/admin/categories/{category_id}")
async def delete_category(request: Request, category_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    r = await db.categories.delete_one({"category_id": category_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada")
    return {"message": "Categoria removida"}

# ==================== PRODUCTS (PUBLIC) ====================

@app.get("/api/products")
async def list_products(request: Request, category: Optional[str] = None, search: Optional[str] = None, featured: Optional[bool] = None, page: int = 1, limit: int = 20):
    db = request.app.db
    q = {"active": True}
    if category:
        q["category"] = {"$regex": f"^{category}$", "$options": "i"}
    if featured:
        q["featured"] = True
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"description": {"$regex": search, "$options": "i"}}, {"brand": {"$regex": search, "$options": "i"}}]
    total = await db.products.count_documents(q)
    products = await db.products.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    user = await get_optional_user(request)
    products = [store_extras.apply_pricing_to_product(p, user) for p in products]
    return {"products": products, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.get("/api/products/featured")
async def featured_products(request: Request, limit: int = 8):
    db = request.app.db
    prods = await db.products.find({"active": True, "featured": True}, {"_id": 0}).limit(limit).to_list(limit)
    if len(prods) < limit:
        more = await db.products.find({"active": True, "featured": {"$ne": True}}, {"_id": 0}).limit(limit - len(prods)).to_list(limit - len(prods))
        prods.extend(more)
    user = await get_optional_user(request)
    prods = [store_extras.apply_pricing_to_product(p, user) for p in prods]
    return {"products": prods}

@app.get("/api/products/{product_id}")
async def get_product(request: Request, product_id: str):
    db = request.app.db
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    related = await db.products.find({"category": p.get("category"), "product_id": {"$ne": product_id}, "active": True}, {"_id": 0}).limit(4).to_list(4)
    user = await get_optional_user(request)
    p = store_extras.apply_pricing_to_product(p, user)
    related = [store_extras.apply_pricing_to_product(r, user) for r in related]
    return {"product": p, "related": related}

# ==================== PRODUCTS (ADMIN) ====================

@app.get("/api/admin/products")
async def admin_list_products(request: Request, category: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 20, user: dict = Depends(require_admin())):
    db = request.app.db
    q = {}
    if category:
        q["category"] = category
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"description": {"$regex": search, "$options": "i"}}]
    total = await db.products.count_documents(q)
    products = await db.products.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"products": products, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.post("/api/admin/products")
async def create_product(request: Request, data: ProductCreate, user: dict = Depends(require_admin())):
    db = request.app.db
    prod = {"product_id": gen_id("prod_"), **data.model_dump(), "created_at": now_iso()}
    await db.products.insert_one(prod)
    return await db.products.find_one({"product_id": prod["product_id"]}, {"_id": 0})

@app.put("/api/admin/products/{product_id}")
async def update_product(request: Request, product_id: str, data: ProductCreate, user: dict = Depends(require_admin())):
    db = request.app.db
    update = data.model_dump()
    update["updated_at"] = now_iso()
    r = await db.products.update_one({"product_id": product_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    return await db.products.find_one({"product_id": product_id}, {"_id": 0})

@app.delete("/api/admin/products/{product_id}")
async def delete_product(request: Request, product_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    r = await db.products.delete_one({"product_id": product_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    return {"message": "Produto removido"}

# ==================== CART ====================

@app.get("/api/cart")
async def get_cart(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cart:
        return {"items": [], "subtotal": 0, "count": 0}
    items = cart.get("items", [])
    subtotal = 0
    enriched = []
    for item in items:
        prod = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if prod:
            price_info = store_extras.effective_price(prod, user)
            price = float(price_info["price"])
            original = float(price_info["original_price"])
            total = price * item["quantity"]
            subtotal += total
            enriched.append({**item, "name": prod["name"], "price": price, "original_price": original, "tier_applied": price_info.get("applied_tier"), "image": (prod.get("images") or [None])[0], "total": total, "stock": prod.get("stock", 0)})
    return {"items": enriched, "subtotal": round(subtotal, 2), "count": len(enriched)}

@app.post("/api/cart/items")
async def add_to_cart(request: Request, data: CartItemAdd, user: dict = Depends(get_current_user)):
    db = request.app.db
    prod = await db.products.find_one({"product_id": data.product_id, "active": True}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    if prod.get("stock", 0) < data.quantity:
        raise HTTPException(status_code=400, detail="Estoque insuficiente")
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    if not cart:
        await db.carts.insert_one({"user_id": user["user_id"], "items": [{"product_id": data.product_id, "quantity": data.quantity}], "updated_at": now_iso()})
    else:
        items = cart.get("items", [])
        found = False
        for i in items:
            if i["product_id"] == data.product_id:
                i["quantity"] += data.quantity
                found = True
                break
        if not found:
            items.append({"product_id": data.product_id, "quantity": data.quantity})
        await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": items, "updated_at": now_iso()}})
    return await get_cart(request, user)

@app.put("/api/cart/items/{product_id}")
async def update_cart_item(request: Request, product_id: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    body = await request.json()
    qty = body.get("quantity", 1)
    if qty <= 0:
        return await remove_from_cart(request, product_id, user)
    prod = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if prod and qty > prod.get("stock", 0):
        raise HTTPException(status_code=400, detail="Estoque insuficiente")
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    if cart:
        items = cart.get("items", [])
        for i in items:
            if i["product_id"] == product_id:
                i["quantity"] = qty
                break
        await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": items, "updated_at": now_iso()}})
    return await get_cart(request, user)

@app.delete("/api/cart/items/{product_id}")
async def remove_from_cart(request: Request, product_id: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    if cart:
        items = [i for i in cart.get("items", []) if i["product_id"] != product_id]
        await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": items, "updated_at": now_iso()}})
    return await get_cart(request, user)

# ==================== CHECKOUT & ORDERS ====================

@app.post("/api/checkout")
async def checkout(request: Request, data: CheckoutData, user: dict = Depends(get_current_user)):
    db = request.app.db
    # Get cart
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Carrinho vazio")
    # Get address
    addrs = user.get("addresses", [])
    addr = next((a for a in addrs if a.get("address_id") == data.address_id), None)
    if not addr:
        raise HTTPException(status_code=400, detail="Endereco nao encontrado")
    # Build order items
    items = []
    subtotal = 0
    for ci in cart["items"]:
        prod = await db.products.find_one({"product_id": ci["product_id"], "active": True}, {"_id": 0})
        if not prod:
            continue
        if prod.get("stock", 0) < ci["quantity"]:
            raise HTTPException(status_code=400, detail=f"Estoque insuficiente: {prod['name']}")
        # preco efetivo considerando pricing_tiers do usuario
        price_info = store_extras.effective_price(prod, user)
        price = float(price_info["price"])
        total = round(price * ci["quantity"], 2)
        subtotal += total
        items.append({"product_id": prod["product_id"], "name": prod["name"], "price": price, "quantity": ci["quantity"], "total": total, "image": (prod.get("images") or [None])[0], "points_value": float(prod.get("points_value") or 0), "tier_applied": price_info.get("applied_tier")})
        # Decrement stock
        await db.products.update_one({"product_id": prod["product_id"]}, {"$inc": {"stock": -ci["quantity"]}})
    if not items:
        raise HTTPException(status_code=400, detail="Nenhum produto valido")
    shipping = 15.90  # Frete fixo MVP

    # Cupom (opcional)
    discount_amount = 0.0
    coupon_code_applied = None
    coupon_id_applied = None
    if getattr(data, "coupon_code", None):
        result = await store_extras.validate_coupon(db, data.coupon_code, round(subtotal, 2), user)
        if not result.get("valid"):
            raise HTTPException(status_code=400, detail=result.get("reason") or "Cupom inválido")
        discount_amount = float(result.get("discount") or 0)
        coupon_code_applied = result["coupon"]["code"]
        coupon_id_applied = result["coupon"]["coupon_id"]

    settings = await get_settings(db)
    affiliate_rate = settings["affiliate_commission_rate"]

    # Identificar afiliado (prioridade: sponsor_id do usuario, senao ref_code do checkout)
    affiliate_id = None
    affiliate_code = None
    if user.get("sponsor_id"):
        aff = await db.users.find_one({"user_id": user["sponsor_id"]}, {"_id": 0})
        if aff:
            affiliate_id = aff["user_id"]
            affiliate_code = aff.get("referral_code")
    elif data.ref_code:
        code = data.ref_code.strip().upper()
        aff = await db.users.find_one({"referral_code": code}, {"_id": 0})
        if aff and aff["user_id"] != user["user_id"]:
            affiliate_id = aff["user_id"]
            affiliate_code = code

    commission_amount = round(subtotal * affiliate_rate, 2) if affiliate_id else 0

    order = {
        "order_id": gen_id("ord_"), "user_id": user["user_id"],
        "customer_name": user.get("name"), "customer_email": user.get("email"),
        "items": items, "subtotal": round(subtotal, 2),
        "shipping_cost": shipping,
        "discount_amount": round(discount_amount, 2),
        "coupon_code": coupon_code_applied,
        "total": round(subtotal + shipping - discount_amount, 2),
        "shipping_address": addr, "payment_method": data.payment_method,
        "payment_status": "pending", "order_status": "pending",
        "payment_provider": "mock",  # Sera "mercadopago" quando integrado
        "payment_id": None, "payment_url": None,
        "affiliate_id": affiliate_id, "affiliate_code": affiliate_code,
        "affiliate_commission": commission_amount,
        "notes": data.notes, "created_at": now_iso(),
    }
    await db.orders.insert_one(order)

    # Atualiza usage_count do cupom (apos criar a ordem)
    if coupon_id_applied:
        await store_extras.increment_coupon_usage(db, coupon_id_applied)

    # ============ COMISSOES ============
    commissions_to_insert = []

    # 1) Comissao de afiliado (8% configuravel) - pago a quem indicou via link
    if affiliate_id and commission_amount > 0:
        commissions_to_insert.append({
            "commission_id": gen_id("com_"),
            "user_id": affiliate_id,
            "order_id": order["order_id"],
            "customer_id": user["user_id"],
            "customer_name": user.get("name"),
            "type": "affiliate",
            "network_type": None,
            "generation": 0,
            "amount": commission_amount,
            "rate": affiliate_rate,
            "order_subtotal": round(subtotal, 2),
            "status": "pending",
            "created_at": now_iso(),
        })

    # 2) Comissoes de rede MMN (ate 6 geracoes)
    # Regra: cadeia MMN so existe se o sponsor direto estiver em uma das redes (network_1 ou network_2).
    # Se sponsor eh 'customer', a cadeia para ali (regra 2A).
    sponsor = None
    if user.get("sponsor_id"):
        sponsor = await db.users.find_one({"user_id": user["sponsor_id"]}, {"_id": 0})
    if sponsor and sponsor.get("network_type") in (NETWORK_1, NETWORK_2):
        network_type = sponsor["network_type"]
        gens_pct = settings.get(f"{'network1' if network_type == NETWORK_1 else 'network2'}_generations", [])
        current = sponsor
        generation = 1
        while generation <= 6 and current:
            pct = gens_pct[generation - 1] if generation <= len(gens_pct) else 0
            if pct > 0:
                amt = round(subtotal * pct / 100, 2)
                if amt > 0:
                    commissions_to_insert.append({
                        "commission_id": gen_id("com_"),
                        "user_id": current["user_id"],
                        "order_id": order["order_id"],
                        "customer_id": user["user_id"],
                        "customer_name": user.get("name"),
                        "type": "network_gen",
                        "network_type": network_type,
                        "generation": generation,
                        "amount": amt,
                        "rate": pct / 100,
                        "order_subtotal": round(subtotal, 2),
                        "status": "pending",
                        "created_at": now_iso(),
                    })
            # Subir na rede: so sobe se proximo for da mesma rede (senao para)
            next_id = current.get("network_sponsor_id")
            if not next_id:
                break
            nxt = await db.users.find_one({"user_id": next_id}, {"_id": 0})
            if not nxt or nxt.get("network_type") != network_type:
                break
            current = nxt
            generation += 1

    if commissions_to_insert:
        await db.commissions.insert_many(commissions_to_insert)

    # Clear cart
    await db.carts.delete_one({"user_id": user["user_id"]})
    final_order = await db.orders.find_one({"order_id": order["order_id"]}, {"_id": 0})

    # === EMAILS (async, nao bloqueia a response) ===
    ctx = order_ctx(final_order, user)
    # Pedido criado -> cliente
    asyncio.create_task(email_service.trigger(db, "order_created", user["email"], ctx))
    # Novo pedido -> admins
    admins = await admin_recipients(db)
    if admins:
        app_url = get_app_url()
        asyncio.create_task(email_service.trigger(db, "admin_new_order", admins, {
            **ctx, "items_count": len(items),
            "admin_link": f"{app_url}/backoffice/pedidos",
        }))
    # Comissoes de afiliado -> cada beneficiario
    for comm in commissions_to_insert:
        if comm.get("type") != "affiliate":
            continue
        receiver = await db.users.find_one({"user_id": comm["user_id"]}, {"_id": 0, "password_hash": 0})
        if not receiver or not receiver.get("email"):
            continue
        asyncio.create_task(email_service.trigger(db, "commission_earned", receiver["email"], {
            **order_ctx(final_order, receiver),
            "customer_name": user.get("name"),
            "commission": {
                "amount": f"{comm['amount']:.2f}",
                "rate_pct": f"{comm.get('rate', 0) * 100:.1f}",
            },
        }))

    return final_order

@app.get("/api/orders")
async def list_user_orders(request: Request, page: int = 1, limit: int = 10, user: dict = Depends(get_current_user)):
    db = request.app.db
    q = {"user_id": user["user_id"]}
    total = await db.orders.count_documents(q)
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"orders": orders, "total": total, "page": page}

@app.get("/api/orders/{order_id}")
async def get_order(request: Request, order_id: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    is_admin = user.get("role") == "admin" or user.get("access_level", 99) <= 1
    if not is_admin and o.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return o

# ==================== ADMIN ORDERS ====================

@app.get("/api/admin/orders")
async def admin_list_orders(request: Request, status: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 20, user: dict = Depends(require_admin())):
    db = request.app.db
    q = {}
    if status:
        q["order_status"] = status
    if search:
        q["$or"] = [{"order_id": {"$regex": search, "$options": "i"}}, {"customer_name": {"$regex": search, "$options": "i"}}, {"customer_email": {"$regex": search, "$options": "i"}}]
    total = await db.orders.count_documents(q)
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"orders": orders, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.put("/api/admin/orders/{order_id}/status")
async def admin_update_order_status(request: Request, order_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    body = await request.json()
    status = body.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="Status obrigatorio")
    o = await db.orders.find_one({"order_id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    update = {"order_status": status, "updated_at": now_iso()}
    if status == "paid":
        update["payment_status"] = "paid"
        update["paid_at"] = now_iso()
        # Auto-emitir nota de faturamento na 1a vez que pedido for marcado como pago
        if not o.get("invoice_number"):
            inv = await issue_invoice(db, o)
            update["invoice_number"] = inv["number"]
            update["invoice_issued_at"] = inv["issued_at"]
    elif status == "shipped":
        update["shipped_at"] = now_iso()
    elif status == "delivered":
        update["delivered_at"] = now_iso()
    elif status == "cancelled":
        update["cancelled_at"] = now_iso()
        # Restore stock
        for item in o.get("items", []):
            await db.products.update_one({"product_id": item["product_id"]}, {"$inc": {"stock": item["quantity"]}})
    await db.orders.update_one({"order_id": order_id}, {"$set": update})
    # Sincronizar status das comissoes do afiliado
    if status == "paid":
        await db.commissions.update_many(
            {"order_id": order_id, "status": "pending"},
            {"$set": {"status": "paid", "paid_at": now_iso()}},
        )
        # Registrar pontos
        await register_points_from_order(db, order_id)
    elif status == "cancelled":
        await db.commissions.update_many(
            {"order_id": order_id, "status": {"$in": ["pending", "paid"]}},
            {"$set": {"status": "cancelled"}},
        )
    final = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    # Gatilhos de email
    order_user = await db.users.find_one({"user_id": final.get("user_id")}, {"_id": 0, "password_hash": 0}) if final else None
    if final and order_user and order_user.get("email"):
        ctx = order_ctx(final, order_user)
        slug_map = {"paid": "order_paid", "shipped": "order_shipped", "delivered": "order_delivered"}
        slug = slug_map.get(status)
        if slug:
            asyncio.create_task(email_service.trigger(db, slug, order_user["email"], ctx))
    return final

# ==================== ADMIN USERS ====================

@app.get("/api/admin/users")
async def admin_list_users(request: Request, search: Optional[str] = None, role: Optional[str] = None, page: int = 1, limit: int = 20, user: dict = Depends(require_admin())):
    db = request.app.db
    q = {}
    if role:
        q["role"] = role
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    total = await db.users.count_documents(q)
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"users": users, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.get("/api/admin/users/{user_id}")
async def admin_get_user(request: Request, user_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    order_count = await db.orders.count_documents({"user_id": user_id})
    u["total_orders"] = order_count
    return u

# ==================== ADMIN DASHBOARD ====================

@app.get("/api/admin/dashboard")
async def admin_dashboard(request: Request, user: dict = Depends(require_admin())):
    db = request.app.db
    n = datetime.now(timezone.utc)
    month_start = n.replace(day=1, hour=0, minute=0, second=0).isoformat()
    total_users = await db.users.count_documents({"role": "customer"})
    total_orders = await db.orders.count_documents({})
    month_orders = await db.orders.count_documents({"created_at": {"$gte": month_start}})
    revenue_agg = await db.orders.aggregate([{"$match": {"payment_status": "paid"}}, {"$group": {"_id": None, "total": {"$sum": "$total"}}}]).to_list(1)
    total_revenue = revenue_agg[0]["total"] if revenue_agg else 0
    month_rev_agg = await db.orders.aggregate([{"$match": {"payment_status": "paid", "created_at": {"$gte": month_start}}}, {"$group": {"_id": None, "total": {"$sum": "$total"}}}]).to_list(1)
    month_revenue = month_rev_agg[0]["total"] if month_rev_agg else 0
    pending_orders = await db.orders.count_documents({"order_status": "pending"})
    total_products = await db.products.count_documents({"active": True})
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    # Orders by status
    status_agg = await db.orders.aggregate([{"$group": {"_id": "$order_status", "count": {"$sum": 1}}}]).to_list(20)
    by_status = {s["_id"]: s["count"] for s in status_agg}
    return {
        "total_users": total_users, "total_orders": total_orders, "month_orders": month_orders,
        "total_revenue": total_revenue, "month_revenue": month_revenue,
        "pending_orders": pending_orders, "total_products": total_products,
        "recent_orders": recent_orders, "orders_by_status": by_status,
    }

# ==================== AFFILIATE / REFERRALS ====================

@app.get("/api/referrals/validate/{code}")
async def validate_referral_code(request: Request, code: str):
    """Valida codigo de indicacao publico - usado pela loja antes do checkout."""
    db = request.app.db
    code_norm = code.strip().upper()
    u = await db.users.find_one({"referral_code": code_norm, "status": "active"}, {"_id": 0, "password_hash": 0})
    if not u:
        return {"valid": False}
    return {"valid": True, "code": code_norm, "affiliate_name": u.get("name")}

@app.get("/api/users/me/referral")
async def my_referral(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    # referral_code agora so eh gerado quando usuario adere ao programa (via /referral-enrollment)
    has_program = bool(user.get("referral_program_active") and user.get("referral_code"))
    # Estatisticas
    total_comm = await db.commissions.aggregate([
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(10)
    stats = {"pending": 0, "paid": 0, "cancelled": 0, "total_count": 0, "total_earned": 0}
    for s in total_comm:
        k = s["_id"] or "pending"
        stats[k] = round(s["total"], 2)
        stats["total_count"] += s["count"]
    stats["total_earned"] = round(stats.get("paid", 0), 2)
    # Total de pessoas indicadas
    referrals_count = await db.users.count_documents({"sponsor_id": user["user_id"]})
    # Saldos do novo modelo (cartao)
    account_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user["user_id"], "status": "paid", "sent_to_card": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    sent_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user["user_id"], "sent_to_card": True}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    return {
        "has_referral_program": has_program,
        "referral_code": user.get("referral_code") if has_program else None,
        "commission_rate": AFFILIATE_COMMISSION_RATE,
        "referrals_count": referrals_count,
        "stats": stats,
        "account_balance": round((account_agg[0]["total"] if account_agg else 0), 2),
        "sent_to_card_total": round((sent_agg[0]["total"] if sent_agg else 0), 2),
        "referral_enrollment": user.get("referral_enrollment"),
    }

@app.get("/api/users/me/commissions")
async def my_commissions(request: Request, page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    db = request.app.db
    q = {"user_id": user["user_id"]}
    total = await db.commissions.count_documents(q)
    comms = await db.commissions.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"commissions": comms, "total": total, "page": page}

# ==================== PAYMENT - MERCADO PAGO ====================

@app.get("/api/payments/config")
async def payments_config(request: Request):
    """Config publica do MP (env + public_key)."""
    return await payments_service.get_public_config(request.app.db)


@app.post("/api/payments/create/{order_id}")
async def create_payment(request: Request, order_id: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    if order["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Pedido ja pago")

    if not await payments_service.is_mp_configured(db):
        # Sem MP configurado: continua mock (auto-aprovavel via /mock/confirm)
        payment_id = f"mock_{uuid.uuid4().hex[:12]}"
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {"payment_provider": "mock", "payment_id": payment_id, "payment_url": None}},
        )
        return {"order_id": order_id, "payment_id": payment_id, "payment_url": None, "provider": "mock"}

    items_full = order.get("items", []) + [{"product_id": "shipping", "name": "Frete", "price": float(order.get("shipping_cost") or 0), "quantity": 1}]
    items_full = [it for it in items_full if (it.get("price") or 0) > 0]

    frontend_url = get_app_url()
    backend_url = os.environ.get("BACKEND_URL") or frontend_url

    try:
        pref = await payments_service.create_preference(db, order, user, items_full, frontend_url, backend_url)
    except Exception as e:
        logger.exception(f"Falha criando preferencia MP para {order_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Erro MercadoPago: {e}")

    # Escolhe init_point: se environment=test, usa sandbox_init_point
    env = pref.get("environment")
    init_point = pref.get("sandbox_init_point") if env == "test" else pref.get("init_point")
    init_point = init_point or pref.get("init_point")

    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "payment_provider": "mercadopago",
            "payment_id": pref["preference_id"],
            "payment_url": init_point,
            "mp_environment": env,
        }},
    )
    return {
        "order_id": order_id,
        "payment_id": pref["preference_id"],
        "payment_url": init_point,
        "provider": "mercadopago",
        "environment": env,
    }

@app.post("/api/payments/mock/confirm/{order_id}")
async def mock_confirm_payment(request: Request, order_id: str, user: dict = Depends(get_current_user)):
    """Confirma pagamento manualmente (mock). Disponivel em ambiente test ou quando MP nao configurado."""
    db = request.app.db
    env = await payments_service.get_mp_environment(db)
    if env == "production" and await payments_service.is_mp_configured(db):
        raise HTTPException(status_code=403, detail="Mock indisponivel em producao")
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    if order["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return await mark_order_paid(db, order_id, payment_id=order.get("payment_id") or f"mock_{uuid.uuid4().hex[:8]}", source="mock")


async def mark_order_paid(db, order_id: str, payment_id: Optional[str] = None, source: str = "mp"):
    """Helper centralizado: marca pedido como pago, cria nota, paga commissions, registra pontos, dispara email."""
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        return None
    if order.get("payment_status") == "paid":
        return order  # idempotente
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "paid", "order_status": "paid", "paid_at": now_iso(), "payment_id": payment_id, "paid_via": source}},
    )
    # Nota fiscal
    fresh = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if fresh and not fresh.get("invoice_number"):
        inv = await issue_invoice(db, fresh)
        await db.orders.update_one(
            {"order_id": order_id},
            {"$set": {"invoice_number": inv["number"], "invoice_issued_at": inv["issued_at"]}},
        )
    # Commissions -> paid
    await db.commissions.update_many(
        {"order_id": order_id, "status": "pending"},
        {"$set": {"status": "paid", "paid_at": now_iso()}},
    )
    # Pontos
    await register_points_from_order(db, order_id)
    # Email
    final = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    order_user = await db.users.find_one({"user_id": final.get("user_id")}, {"_id": 0, "password_hash": 0}) if final else None
    if final and order_user and order_user.get("email"):
        asyncio.create_task(email_service.trigger(db, "order_paid", order_user["email"], order_ctx(final, order_user)))
    return final


async def register_points_from_order(db, order_id: str):
    """Registra logs de pontos para cada item com points_value > 0."""
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        return
    # Idempotencia: se ja registrou, ignora
    existing = await db.points_log.find_one({"order_id": order_id})
    if existing:
        return
    user = await db.users.find_one({"user_id": o["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        return
    logs = []
    for it in o.get("items", []):
        pv = float(it.get("points_value") or 0)
        if pv <= 0:
            continue
        qty = int(it.get("quantity") or 1)
        total_points = round(pv * qty, 2)
        logs.append({
            "log_id": gen_id("pts_"),
            "user_id": user["user_id"],
            "user_name": user.get("name"),
            "user_email": user.get("email"),
            "user_external_id": user.get("external_id"),
            "order_id": order_id,
            "product_id": it.get("product_id"),
            "product_name": it.get("name"),
            "quantity": qty,
            "points_per_unit": pv,
            "points_total": total_points,
            "registered_at": now_iso(),
            "applied_externally": False,
        })
    if logs:
        await db.points_log.insert_many(logs)
        # Realtime sync para Maxx (best-effort, nao bloqueia)
        try:
            await maxx_service.trigger_realtime(db, [l["log_id"] for l in logs])
        except Exception as e:
            logger.warning(f"trigger_realtime maxx falhou: {e}")

@app.post("/api/payments/webhook/mercadopago")
async def mp_webhook(request: Request):
    """Webhook MercadoPago: valida assinatura, busca payment, marca pedido como pago."""
    db = request.app.db
    raw = await request.body()
    x_signature = request.headers.get("x-signature")
    x_request_id = request.headers.get("x-request-id")
    try:
        body = await request.json()
    except Exception:
        body = {}
    data_id = (body.get("data") or {}).get("id") or request.query_params.get("data.id") or request.query_params.get("id")

    valid = await payments_service.verify_webhook_signature(db, raw, x_signature, x_request_id, str(data_id) if data_id else None)
    log_entry = {
        "log_id": gen_id("mphook_"),
        "received_at": now_iso(),
        "type": body.get("type") or body.get("topic") or request.query_params.get("topic"),
        "data_id": data_id,
        "valid_signature": valid,
        "raw_body": body,
        "query": dict(request.query_params),
    }
    if not valid:
        log_entry["error"] = "invalid_signature"
        await db.payment_webhook_logs.insert_one(log_entry)
        raise HTTPException(status_code=401, detail="Invalid signature")

    notif_type = body.get("type") or body.get("topic") or request.query_params.get("topic")
    if notif_type == "payment" and data_id:
        details = await payments_service.get_payment_details(db, str(data_id))
        log_entry["payment_details"] = {
            "id": details.get("id") if details else None,
            "status": details.get("status") if details else None,
            "external_reference": details.get("external_reference") if details else None,
        }
        if details:
            order_id = details.get("external_reference")
            status_mp = details.get("status")
            if order_id and status_mp == "approved":
                await mark_order_paid(db, order_id, payment_id=str(details.get("id")), source="mercadopago")
                log_entry["action"] = "marked_paid"
            elif order_id and status_mp in ("rejected", "cancelled"):
                await db.orders.update_one({"order_id": order_id}, {"$set": {"payment_status": status_mp}})
                log_entry["action"] = f"set_{status_mp}"

    await db.payment_webhook_logs.insert_one(log_entry)
    return {"received": True}

# ==================== SETTINGS (ADMIN) ====================

@app.get("/api/admin/settings")
async def get_admin_settings(request: Request, user: dict = Depends(require_admin())):
    return await get_settings(request.app.db)

@app.put("/api/admin/settings")
async def update_admin_settings(request: Request, user: dict = Depends(require_admin())):
    db = request.app.db
    body = await request.json()
    allowed_keys = {
        "affiliate_commission_rate",
        "network1_generations", "network2_generations",
        "propaganda_threshold_referrals", "propaganda_threshold_period_days",
        "withdrawal_enabled", "withdrawal_min_amount", "withdrawal_release_days",
        "company_name", "company_cnpj", "company_address", "company_city",
        "company_state", "company_zip", "company_phone", "company_email",
        "invoice_prefix",
        "email_enabled", "resend_api_key", "email_from", "email_admin_recipients",
        "email_trigger_order_created", "email_trigger_order_paid",
        "email_trigger_order_shipped", "email_trigger_order_delivered",
        "email_trigger_commission_earned", "email_trigger_admin_new_candidate",
        "email_trigger_admin_new_order", "email_trigger_welcome",
    }
    update = {k: v for k, v in body.items() if k in allowed_keys}
    # Sanitizar generations (garantir lista de 6 floats)
    for key in ("network1_generations", "network2_generations"):
        if key in update:
            arr = update[key]
            if not isinstance(arr, list):
                raise HTTPException(status_code=400, detail=f"{key} deve ser uma lista")
            arr = [float(x or 0) for x in arr[:6]]
            while len(arr) < 6:
                arr.append(0.0)
            update[key] = arr
    update["updated_at"] = now_iso()
    await db.settings.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    return await get_settings(db)

# ==================== MY NETWORK (USER) ====================

@app.get("/api/users/me/network")
async def my_network(request: Request, user: dict = Depends(get_current_user)):
    """Retorna a rede MMN do usuario (ate 6 geracoes abaixo) com stats."""
    db = request.app.db
    settings = await get_settings(db)
    network_type = user.get("network_type", NETWORK_CUSTOMER)
    gens_pct = settings.get(f"{'network1' if network_type == NETWORK_1 else 'network2'}_generations", []) if network_type in (NETWORK_1, NETWORK_2) else []

    generations = []
    if network_type in (NETWORK_1, NETWORK_2):
        current_ids = [user["user_id"]]
        for gen in range(1, 7):
            # Buscar todos abaixo deste nivel que pertencem a mesma rede
            level_users = await db.users.find(
                {"network_sponsor_id": {"$in": current_ids}, "network_type": network_type},
                {"_id": 0, "password_hash": 0}
            ).to_list(1000)
            # Stats de comissao da geracao
            level_user_ids = [u["user_id"] for u in level_users]
            comm_agg = await db.commissions.aggregate([
                {"$match": {"user_id": user["user_id"], "generation": gen, "network_type": network_type}},
                {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
            ]).to_list(10)
            stats = {"pending": 0, "paid": 0, "count": 0}
            for s in comm_agg:
                stats[s["_id"] or "pending"] = round(s["total"], 2)
                stats["count"] += s["count"]
            generations.append({
                "generation": gen,
                "rate_pct": gens_pct[gen - 1] if gen - 1 < len(gens_pct) else 0,
                "members_count": len(level_users),
                "pending": stats.get("pending", 0),
                "paid": stats.get("paid", 0),
                "total_commissions": stats.get("count", 0),
            })
            current_ids = level_user_ids
            if not current_ids:
                # Sem mais descendentes - preencher zeros ate 6
                for g in range(gen + 1, 7):
                    generations.append({
                        "generation": g, "rate_pct": gens_pct[g - 1] if g - 1 < len(gens_pct) else 0,
                        "members_count": 0, "pending": 0, "paid": 0, "total_commissions": 0,
                    })
                break

    # Totais gerais do usuario (afiliado + MMN)
    totals_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user["user_id"]}},
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}}}
    ]).to_list(10)
    totals = {"pending": 0, "paid": 0, "cancelled": 0}
    for s in totals_agg:
        totals[s["_id"] or "pending"] = round(s["total"], 2)

    return {
        "network_type": network_type,
        "referral_code": user.get("referral_code"),
        "generations": generations,
        "totals": totals,
        "commission_rate_affiliate": settings["affiliate_commission_rate"],
    }

# ==================== ADMIN: USERS BY NETWORK ====================

@app.get("/api/admin/users-by-network")
async def admin_users_by_network(request: Request, network_type: str, search: Optional[str] = None, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    if network_type not in (NETWORK_CUSTOMER, NETWORK_1, NETWORK_2):
        raise HTTPException(status_code=400, detail="network_type invalido")
    q = {"network_type": network_type}
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}, {"external_id": search}]
    total = await db.users.count_documents(q)
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"users": users, "total": total, "page": page}

@app.get("/api/admin/users/{user_id}/tree")
async def admin_user_tree(request: Request, user_id: str, user: dict = Depends(require_admin())):
    """Retorna ate 6 geracoes abaixo do usuario, respeitando sua rede."""
    db = request.app.db
    root = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not root:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    network_type = root.get("network_type", NETWORK_CUSTOMER)
    generations = []
    current_ids = [user_id]
    for gen in range(1, 7):
        level = await db.users.find(
            {"network_sponsor_id": {"$in": current_ids}, "network_type": network_type},
            {"_id": 0, "password_hash": 0}
        ).to_list(2000)
        generations.append({"generation": gen, "users": level})
        current_ids = [u["user_id"] for u in level]
        if not current_ids:
            break
    return {"root": root, "generations": generations}

# ==================== ADMIN: PROMOTE TO PROPAGANDISTA (NETWORK_2) ====================

@app.post("/api/admin/users/{user_id}/promote-to-propagandista")
async def promote_to_propagandista(request: Request, user_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    if target.get("network_type") != NETWORK_CUSTOMER:
        raise HTTPException(status_code=400, detail="Somente clientes podem ser promovidos a Propagandista")
    # network_sponsor_id = sponsor_id atual (se existir E for da rede ou for outro Propagandista)
    network_sponsor_id = None
    if target.get("sponsor_id"):
        sp = await db.users.find_one({"user_id": target["sponsor_id"]}, {"_id": 0})
        if sp and sp.get("network_type") == NETWORK_2:
            network_sponsor_id = sp["user_id"]
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "network_type": NETWORK_2,
            "network_sponsor_id": network_sponsor_id,
            "promoted_at": now_iso(),
        }},
    )
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

@app.post("/api/admin/users/{user_id}/revoke-network")
async def revoke_network(request: Request, user_id: str, user: dict = Depends(require_admin())):
    """Reverte usuario network_2 para customer (so permite em network_2)."""
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    if target.get("network_type") != NETWORK_2:
        raise HTTPException(status_code=400, detail="So eh possivel reverter Propagandistas (network_2)")
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"network_type": NETWORK_CUSTOMER, "network_sponsor_id": None, "revoked_at": now_iso()}},
    )
    return {"message": "Rede removida"}

# ==================== ADMIN: CANDIDATES "EM ALTA" PARA PROPAGANDISTA ====================

@app.get("/api/admin/propaganda-candidates")
async def propaganda_candidates(request: Request, user: dict = Depends(require_admin())):
    """Lista clientes (network_type=customer) com volume de indicacoes acima do threshold configurado."""
    db = request.app.db
    settings = await get_settings(db)
    threshold = settings.get("propaganda_threshold_referrals", 5)
    days = settings.get("propaganda_threshold_period_days", 30)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Contar indicados criados na janela por sponsor_id
    pipeline = [
        {"$match": {"created_at": {"$gte": since}, "sponsor_id": {"$ne": None}}},
        {"$group": {"_id": "$sponsor_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": threshold}}},
        {"$sort": {"count": -1}},
        {"$limit": 100},
    ]
    agg = await db.users.aggregate(pipeline).to_list(100)
    candidate_ids = [a["_id"] for a in agg]
    candidates = await db.users.find(
        {"user_id": {"$in": candidate_ids}, "network_type": NETWORK_CUSTOMER},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    # Enriquecer com count
    counts = {a["_id"]: a["count"] for a in agg}
    for c in candidates:
        c["referrals_in_period"] = counts.get(c["user_id"], 0)
    candidates.sort(key=lambda x: x["referrals_in_period"], reverse=True)
    return {"candidates": candidates, "threshold": threshold, "period_days": days}

# ==================== ADMIN: IMPORT NETWORK 1 (EXCEL/CSV) ====================

class Network1ImportRow(BaseModel):
    external_id: str
    name: str
    email: EmailStr
    leader_external_id: Optional[str] = None
    phone: Optional[str] = None

class Network1ImportPayload(BaseModel):
    rows: List[Network1ImportRow]
    default_password: Optional[str] = "oxx@pharma"

@app.post("/api/admin/network1/import")
async def import_network1(request: Request, data: Network1ImportPayload, user: dict = Depends(require_admin())):
    """Importa/atualiza usuarios da Rede 1 a partir de uma lista (vinda de upload Excel/CSV).

    Passo 1: upsert de todos os usuarios (sem network_sponsor_id ainda).
    Passo 2: mapeia external_id -> user_id e define network_sponsor_id.
    """
    db = request.app.db
    default_password = data.default_password or "oxx@pharma"
    pw_hash = hash_pw(default_password)

    # Passo 1: upsert usuarios
    stats = {"created": 0, "updated": 0, "total": len(data.rows), "errors": []}
    id_map = {}  # external_id -> user_id
    for row in data.rows:
        try:
            existing = await db.users.find_one({"external_id": row.external_id}) or await db.users.find_one({"email": row.email.lower()})
            if existing:
                await db.users.update_one(
                    {"user_id": existing["user_id"]},
                    {"$set": {
                        "external_id": row.external_id, "name": row.name,
                        "phone": row.phone, "network_type": NETWORK_1,
                    }},
                )
                id_map[row.external_id] = existing["user_id"]
                stats["updated"] += 1
            else:
                uid = gen_id("user_")
                await db.users.insert_one({
                    "user_id": uid, "email": row.email.lower(),
                    "password_hash": pw_hash, "name": row.name,
                    "phone": row.phone, "role": "customer", "access_level": 99,
                    "status": "active", "addresses": [],
                    "sponsor_id": None, "sponsor_code": None,
                    "network_type": NETWORK_1,
                    "network_sponsor_id": None,
                    "external_id": row.external_id,
                    "must_set_password": True,
                    "referral_program_active": False,
                    "created_at": now_iso(),
                })
                id_map[row.external_id] = uid
                stats["created"] += 1
        except Exception as e:
            stats["errors"].append({"external_id": row.external_id, "error": str(e)})

    # Passo 2: resolver lideres
    sponsors_set = 0
    for row in data.rows:
        if row.leader_external_id and row.external_id in id_map:
            leader_uid = id_map.get(row.leader_external_id)
            if not leader_uid:
                # Tentar buscar no banco
                leader_doc = await db.users.find_one({"external_id": row.leader_external_id}, {"_id": 0})
                if leader_doc:
                    leader_uid = leader_doc["user_id"]
            if leader_uid:
                await db.users.update_one(
                    {"user_id": id_map[row.external_id]},
                    {"$set": {"network_sponsor_id": leader_uid}},
                )
                sponsors_set += 1
    stats["sponsors_mapped"] = sponsors_set
    return stats

# ==================== ADMIN: COMMISSIONS REPORT (BENEFIT CARD) ====================

@app.get("/api/admin/commissions-report")
async def admin_commissions_report(request: Request, status: str = "paid", start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(require_admin())):
    """Relatorio agregado por usuario para envio a empresa de cartao de beneficios."""
    db = request.app.db
    match = {"status": status}
    if start:
        match.setdefault("created_at", {})["$gte"] = start
    if end:
        match.setdefault("created_at", {})["$lte"] = end
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    agg = await db.commissions.aggregate(pipeline).to_list(10000)
    # Enriquecer com dados do usuario
    uids = [a["_id"] for a in agg]
    users = await db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "password_hash": 0}).to_list(len(uids))
    umap = {u["user_id"]: u for u in users}
    rows = []
    for a in agg:
        u = umap.get(a["_id"], {})
        rows.append({
            "user_id": a["_id"],
            "cpf": u.get("cpf"),
            "name": u.get("name"),
            "email": u.get("email"),
            "pix_key": u.get("pix_key"),
            "amount": round(a["total"], 2),
            "commissions_count": a["count"],
        })
    return {"rows": rows, "status": status, "period": {"start": start, "end": end}}

# ==================== INVOICES (FATURAMENTO INTERNO) ====================

async def issue_invoice(db, order: dict):
    """Incrementa contador de notas e retorna {number, issued_at}. Nao persiste no order aqui."""
    settings = await get_settings(db)
    prefix = settings.get("invoice_prefix") or "OXX"
    # Atomico: incrementar contador
    result = await db.settings.find_one_and_update(
        {"_id": "global"},
        {"$inc": {"invoice_counter": 1}},
        return_document=True,
        upsert=True,
    )
    counter = (result or {}).get("invoice_counter", 1)
    number = f"{prefix}-{str(counter).zfill(6)}"
    return {"number": number, "issued_at": now_iso(), "counter": counter}

async def build_invoice_data(db, order: dict):
    """Monta o objeto completo de nota (empresa + pedido) para exibicao/impressao."""
    settings = await get_settings(db)
    company = {
        "name": settings.get("company_name"),
        "cnpj": settings.get("company_cnpj"),
        "address": settings.get("company_address"),
        "city": settings.get("company_city"),
        "state": settings.get("company_state"),
        "zip": settings.get("company_zip"),
        "phone": settings.get("company_phone"),
        "email": settings.get("company_email"),
    }
    # Busca CPF do usuario se existir
    buyer = await db.users.find_one({"user_id": order.get("user_id")}, {"_id": 0, "password_hash": 0}) or {}
    return {
        "invoice_number": order.get("invoice_number"),
        "invoice_issued_at": order.get("invoice_issued_at"),
        "order": order,
        "company": company,
        "buyer": {
            "name": order.get("customer_name") or buyer.get("name"),
            "email": order.get("customer_email") or buyer.get("email"),
            "cpf": buyer.get("cpf"),
            "phone": buyer.get("phone"),
        },
    }

@app.get("/api/orders/{order_id}/invoice")
async def get_invoice(request: Request, order_id: str, user: dict = Depends(get_current_user)):
    """Usuario/admin consulta dados da nota do pedido."""
    db = request.app.db
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    is_admin = user.get("role") == "admin" or user.get("access_level", 99) <= 1
    if not is_admin and o.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if not o.get("invoice_number"):
        raise HTTPException(status_code=404, detail="Nota ainda nao emitida. Pedido precisa estar pago.")
    return await build_invoice_data(db, o)

@app.post("/api/admin/orders/{order_id}/issue-invoice")
async def admin_issue_invoice(request: Request, order_id: str, user: dict = Depends(require_admin())):
    """Admin emite manualmente (caso pedido ja esteja pago sem nota, ou precise re-emitir)."""
    db = request.app.db
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    if o.get("order_status") not in ("paid", "shipped", "delivered"):
        raise HTTPException(status_code=400, detail="Pedido precisa estar pago para emitir nota")
    if o.get("invoice_number"):
        raise HTTPException(status_code=400, detail=f"Nota ja emitida: {o['invoice_number']}")
    inv = await issue_invoice(db, o)
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"invoice_number": inv["number"], "invoice_issued_at": inv["issued_at"]}},
    )
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return await build_invoice_data(db, o)

@app.get("/api/admin/invoices")
async def admin_list_invoices(request: Request, search: Optional[str] = None, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    """Lista pedidos com nota emitida (faturamento interno)."""
    db = request.app.db
    q = {"invoice_number": {"$ne": None}}
    if search:
        q["$or"] = [
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_email": {"$regex": search, "$options": "i"}},
        ]
    total = await db.orders.count_documents(q)
    orders = await db.orders.find(q, {"_id": 0}).sort("invoice_issued_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    # Agregado faturado
    agg = await db.orders.aggregate([
        {"$match": {"invoice_number": {"$ne": None}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "subtotal": {"$sum": "$subtotal"}}},
    ]).to_list(1)
    totals = {"total": round((agg[0]["total"] if agg else 0), 2), "subtotal": round((agg[0]["subtotal"] if agg else 0), 2), "count": total}
    return {"invoices": orders, "total": total, "page": page, "totals": totals}

# ==================== WITHDRAWALS (SAQUES) ====================

async def compute_balance(db, user_id: str):
    """Calcula saldo disponivel, em quarentena, total pago, total sacado."""
    settings = await get_settings(db)
    release_days = int(settings.get("withdrawal_release_days") or 0)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=release_days)).isoformat()

    # Comissoes pagas (status=paid) ainda nao vinculadas a saque
    # Considerar quarentena: paid_at <= cutoff => available; > cutoff => quarentine
    available_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user_id, "status": "paid", "withdrawal_id": {"$in": [None, ""]}, "paid_at": {"$lte": cutoff}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    quarantine_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user_id, "status": "paid", "withdrawal_id": {"$in": [None, ""]}, "paid_at": {"$gt": cutoff}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    # Saques
    withdrawn_agg = await db.withdrawals.aggregate([
        {"$match": {"user_id": user_id, "status": "paid_out"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    reserved_agg = await db.withdrawals.aggregate([
        {"$match": {"user_id": user_id, "status": {"$in": ["pending", "approved"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    pending_commissions_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user_id, "status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)

    return {
        "available": round((available_agg[0]["total"] if available_agg else 0), 2),
        "quarantine": round((quarantine_agg[0]["total"] if quarantine_agg else 0), 2),
        "pending_commissions": round((pending_commissions_agg[0]["total"] if pending_commissions_agg else 0), 2),
        "reserved_in_withdrawals": round((reserved_agg[0]["total"] if reserved_agg else 0), 2),
        "total_withdrawn": round((withdrawn_agg[0]["total"] if withdrawn_agg else 0), 2),
        "withdrawal_enabled": bool(settings.get("withdrawal_enabled")),
        "withdrawal_min_amount": float(settings.get("withdrawal_min_amount") or 0),
        "withdrawal_release_days": release_days,
    }

@app.get("/api/users/me/balance")
async def my_balance(request: Request, user: dict = Depends(get_current_user)):
    return await compute_balance(request.app.db, user["user_id"])

@app.post("/api/withdrawals")
async def create_withdrawal(request: Request, data: WithdrawalCreate, user: dict = Depends(get_current_user)):
    db = request.app.db
    settings = await get_settings(db)
    if not settings.get("withdrawal_enabled"):
        raise HTTPException(status_code=400, detail="Saques estao desativados no momento")

    min_amt = float(settings.get("withdrawal_min_amount") or 0)
    if data.amount < min_amt:
        raise HTTPException(status_code=400, detail=f"Valor minimo de saque: R$ {min_amt:.2f}")

    balance = await compute_balance(db, user["user_id"])
    if data.amount > balance["available"]:
        raise HTTPException(status_code=400, detail=f"Saldo disponivel insuficiente (R$ {balance['available']:.2f})")

    # Selecionar comissoes elegiveis (FIFO pelo paid_at) ate cobrir o valor
    release_days = int(settings.get("withdrawal_release_days") or 0)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=release_days)).isoformat()
    candidates = await db.commissions.find(
        {"user_id": user["user_id"], "status": "paid", "withdrawal_id": {"$in": [None, ""]}, "paid_at": {"$lte": cutoff}},
        {"_id": 0}
    ).sort("paid_at", 1).to_list(10000)
    selected = []
    accum = 0
    for c in candidates:
        if accum >= data.amount:
            break
        selected.append(c["commission_id"])
        accum += c["amount"]
    if accum < data.amount:
        raise HTTPException(status_code=400, detail=f"Saldo disponivel insuficiente (R$ {balance['available']:.2f})")

    wid = gen_id("wd_")
    withdrawal = {
        "withdrawal_id": wid,
        "user_id": user["user_id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "amount": round(float(data.amount), 2),
        "selected_amount": round(accum, 2),
        "commission_ids": selected,
        "pix_key": data.pix_key,
        "pix_key_type": data.pix_key_type,
        "pix_name": data.pix_name,
        "pix_cpf": data.pix_cpf,
        "notes": data.notes,
        "status": "pending",  # pending -> approved -> paid_out; ou rejected
        "created_at": now_iso(),
        "decided_at": None,
        "decided_by": None,
        "admin_notes": None,
        "paid_at": None,
    }
    await db.withdrawals.insert_one(withdrawal)
    # Marca comissoes como reservadas via withdrawal_id
    await db.commissions.update_many(
        {"commission_id": {"$in": selected}},
        {"$set": {"withdrawal_id": wid}},
    )
    # Atualiza perfil do usuario com dados PIX (conveniencia)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "pix_key": data.pix_key, "pix_key_type": data.pix_key_type,
            "cpf": data.pix_cpf,
        }},
    )
    return await db.withdrawals.find_one({"withdrawal_id": wid}, {"_id": 0})

@app.get("/api/users/me/withdrawals")
async def my_withdrawals(request: Request, page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    db = request.app.db
    q = {"user_id": user["user_id"]}
    total = await db.withdrawals.count_documents(q)
    items = await db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"withdrawals": items, "total": total, "page": page}

@app.post("/api/users/me/withdrawals/{wid}/cancel")
async def cancel_withdrawal(request: Request, wid: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    w = await db.withdrawals.find_one({"withdrawal_id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Solicitacao nao encontrada")
    if w["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if w["status"] != "pending":
        raise HTTPException(status_code=400, detail="Apenas solicitacoes pendentes podem ser canceladas")
    await db.withdrawals.update_one({"withdrawal_id": wid}, {"$set": {"status": "cancelled", "decided_at": now_iso()}})
    await db.commissions.update_many({"withdrawal_id": wid}, {"$set": {"withdrawal_id": None}})
    return {"message": "Solicitacao cancelada"}

# === ADMIN WITHDRAWALS ===

@app.get("/api/admin/withdrawals")
async def admin_list_withdrawals(request: Request, status: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    q = {}
    if status:
        q["status"] = status
    if search:
        q["$or"] = [{"user_name": {"$regex": search, "$options": "i"}}, {"user_email": {"$regex": search, "$options": "i"}}, {"pix_cpf": search}]
    total = await db.withdrawals.count_documents(q)
    items = await db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    # Agregados
    agg = await db.withdrawals.aggregate([{"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}]).to_list(10)
    summary = {s["_id"]: {"total": round(s["total"], 2), "count": s["count"]} for s in agg}
    return {"withdrawals": items, "total": total, "page": page, "summary": summary}

@app.put("/api/admin/withdrawals/{wid}/approve")
async def admin_approve_withdrawal(request: Request, wid: str, user: dict = Depends(require_admin())):
    db = request.app.db
    w = await db.withdrawals.find_one({"withdrawal_id": wid})
    if not w:
        raise HTTPException(status_code=404, detail="Nao encontrado")
    if w["status"] != "pending":
        raise HTTPException(status_code=400, detail="Status atual nao permite aprovacao")
    await db.withdrawals.update_one(
        {"withdrawal_id": wid},
        {"$set": {"status": "approved", "decided_at": now_iso(), "decided_by": user["user_id"]}},
    )
    return await db.withdrawals.find_one({"withdrawal_id": wid}, {"_id": 0})

@app.put("/api/admin/withdrawals/{wid}/reject")
async def admin_reject_withdrawal(request: Request, wid: str, user: dict = Depends(require_admin())):
    db = request.app.db
    body = await request.json()
    reason = (body or {}).get("reason", "")
    w = await db.withdrawals.find_one({"withdrawal_id": wid})
    if not w:
        raise HTTPException(status_code=404, detail="Nao encontrado")
    if w["status"] not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail="Status atual nao permite rejeicao")
    await db.withdrawals.update_one(
        {"withdrawal_id": wid},
        {"$set": {"status": "rejected", "decided_at": now_iso(), "decided_by": user["user_id"], "admin_notes": reason}},
    )
    # Devolve comissoes
    await db.commissions.update_many({"withdrawal_id": wid}, {"$set": {"withdrawal_id": None}})
    return await db.withdrawals.find_one({"withdrawal_id": wid}, {"_id": 0})

@app.put("/api/admin/withdrawals/{wid}/mark-paid")
async def admin_mark_paid(request: Request, wid: str, user: dict = Depends(require_admin())):
    db = request.app.db
    w = await db.withdrawals.find_one({"withdrawal_id": wid})
    if not w:
        raise HTTPException(status_code=404, detail="Nao encontrado")
    if w["status"] not in ("approved", "pending"):
        raise HTTPException(status_code=400, detail="Status atual nao permite pagamento")
    now = now_iso()
    await db.withdrawals.update_one(
        {"withdrawal_id": wid},
        {"$set": {"status": "paid_out", "paid_at": now, "decided_by": user["user_id"], "decided_at": now}},
    )
    # Marcar comissoes vinculadas como paid_out
    await db.commissions.update_many(
        {"withdrawal_id": wid},
        {"$set": {"status": "paid_out", "paid_out_at": now}},
    )
    return await db.withdrawals.find_one({"withdrawal_id": wid}, {"_id": 0})

@app.get("/api/admin/withdrawals/export")
async def admin_export_withdrawals(request: Request, status: str = "approved", user: dict = Depends(require_admin())):
    """Exporta solicitacoes de saque (formato pronto para empresa de cartao de beneficios)."""
    db = request.app.db
    items = await db.withdrawals.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    rows = [{
        "withdrawal_id": w["withdrawal_id"],
        "cpf": w.get("pix_cpf"),
        "name": w.get("pix_name") or w.get("user_name"),
        "email": w.get("user_email"),
        "pix_key_type": w.get("pix_key_type"),
        "pix_key": w.get("pix_key"),
        "amount": w["amount"],
        "created_at": w["created_at"],
    } for w in items]
    return {"rows": rows, "status": status, "count": len(rows)}

# ==================== EMAIL TEMPLATES (ADMIN) ====================

class EmailTemplateIn(BaseModel):
    slug: str
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = ""
    active: bool = True

class EmailBroadcast(BaseModel):
    subject: str
    body_html: str
    body_text: Optional[str] = ""
    # target: "all" | "network_1" | "network_2" | "customer" | "admin" | "user_ids"
    target: str = "all"
    user_ids: Optional[List[str]] = None
    emails: Optional[List[EmailStr]] = None  # envio direto para emails especificos

class EmailTestIn(BaseModel):
    to: EmailStr
    subject: str = "Teste de envio - OxxPharma"
    body_html: str = "<p>Este e um teste de envio via Resend.</p>"

@app.get("/api/admin/email-templates")
async def list_email_templates(request: Request, user: dict = Depends(require_admin())):
    db = request.app.db
    items = await db.email_templates.find({}, {"_id": 0}).sort("slug", 1).to_list(200)
    return {"templates": items}

@app.post("/api/admin/email-templates")
async def create_email_template(request: Request, data: EmailTemplateIn, user: dict = Depends(require_admin())):
    db = request.app.db
    if await db.email_templates.find_one({"slug": data.slug}):
        raise HTTPException(status_code=400, detail="slug ja existe")
    doc = {
        "template_id": gen_id("tpl_"),
        **data.model_dump(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.email_templates.insert_one(doc)
    return await db.email_templates.find_one({"template_id": doc["template_id"]}, {"_id": 0})

@app.put("/api/admin/email-templates/{template_id}")
async def update_email_template(request: Request, template_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    body = await request.json()
    allowed = {"name", "subject", "body_html", "body_text", "active", "slug"}
    update = {k: v for k, v in body.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.email_templates.update_one({"template_id": template_id}, {"$set": update})
    return await db.email_templates.find_one({"template_id": template_id}, {"_id": 0})

@app.delete("/api/admin/email-templates/{template_id}")
async def delete_email_template(request: Request, template_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    await db.email_templates.delete_one({"template_id": template_id})
    return {"message": "Removido"}

@app.post("/api/admin/email-templates/{template_id}/reset")
async def reset_email_template(request: Request, template_id: str, user: dict = Depends(require_admin())):
    """Restaura template padrao se for um gatilho default."""
    db = request.app.db
    doc = await db.email_templates.find_one({"template_id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Template nao encontrado")
    default = next((t for t in email_service.DEFAULT_TEMPLATES if t["slug"] == doc["slug"]), None)
    if not default:
        raise HTTPException(status_code=400, detail="Este template nao possui versao padrao")
    await db.email_templates.update_one(
        {"template_id": template_id},
        {"$set": {**default, "updated_at": now_iso()}},
    )
    return await db.email_templates.find_one({"template_id": template_id}, {"_id": 0})

@app.post("/api/admin/email-test")
async def send_test_email(request: Request, data: EmailTestIn, user: dict = Depends(require_admin())):
    db = request.app.db
    result = await email_service.send_email(db, data.to, data.subject, data.body_html, meta={"type": "test", "by": user["user_id"]})
    return result

@app.post("/api/admin/email-broadcast")
async def email_broadcast(request: Request, data: EmailBroadcast, user: dict = Depends(require_admin())):
    db = request.app.db
    # Resolver destinatarios
    emails: List[str] = []
    if data.emails:
        emails.extend([str(e) for e in data.emails])
    if data.target == "user_ids" and data.user_ids:
        users = await db.users.find({"user_id": {"$in": data.user_ids}}, {"_id": 0, "email": 1}).to_list(len(data.user_ids))
        emails.extend([u.get("email") for u in users if u.get("email")])
    elif data.target in ("customer", "network_1", "network_2"):
        users = await db.users.find({"network_type": data.target}, {"_id": 0, "email": 1}).to_list(10000)
        emails.extend([u.get("email") for u in users if u.get("email")])
    elif data.target == "admin":
        users = await db.users.find({"role": "admin"}, {"_id": 0, "email": 1}).to_list(100)
        emails.extend([u.get("email") for u in users if u.get("email")])
    elif data.target == "all":
        users = await db.users.find({"status": "active"}, {"_id": 0, "email": 1}).to_list(50000)
        emails.extend([u.get("email") for u in users if u.get("email")])
    # Dedup
    emails = list({e.lower() for e in emails if e})
    if not emails:
        raise HTTPException(status_code=400, detail="Nenhum destinatario encontrado")

    # Dispara em lote (sequencial para nao saturar; Resend limita a ~10 req/s com key free)
    sent = 0
    failed = 0
    for em in emails:
        r = await email_service.send_email(db, em, data.subject, data.body_html, text=data.body_text, meta={"type": "broadcast", "target": data.target, "by": user["user_id"]})
        if r.get("sent"):
            sent += 1
        else:
            failed += 1
    return {"sent": sent, "failed": failed, "total": len(emails)}

@app.get("/api/admin/email-logs")
async def list_email_logs(request: Request, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    total = await db.email_logs.count_documents({})
    logs = await db.email_logs.find({}, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"logs": logs, "total": total, "page": page}

# ==================== EXTERNAL SYNC WEBHOOK (REDE 1) ====================

class ExternalSyncUser(BaseModel):
    external_id: str
    name: str
    email: EmailStr
    leader_external_id: Optional[str] = None
    phone: Optional[str] = None

class ExternalSyncPayload(BaseModel):
    action: str = "upsert"   # "upsert" | "delete"
    users: List[ExternalSyncUser]
    default_password: Optional[str] = "oxx@pharma"

@app.post("/api/external/network1/sync")
async def external_network1_sync(request: Request, data: ExternalSyncPayload, x_webhook_token: Optional[str] = Header(None)):
    """Webhook inbound para o sistema externo sincronizar usuarios da Rede 1.

    Autenticacao: header X-Webhook-Token deve coincidir com settings.external_webhook_token.
    Actions: 'upsert' cria/atualiza, 'delete' remove network (nao apaga user).
    """
    db = request.app.db
    settings = await get_settings(db)
    expected = (settings.get("external_webhook_token") or "").strip()
    if not expected or not x_webhook_token or x_webhook_token != expected:
        # Log tentativa
        await db.webhook_logs.insert_one({
            "log_id": gen_id("whk_"), "source": "network1_sync",
            "authorized": False, "action": data.action,
            "users_count": len(data.users), "created_at": now_iso(),
        })
        raise HTTPException(status_code=401, detail="Token invalido")

    stats = {"created": 0, "updated": 0, "deleted": 0, "errors": []}
    id_map = {}
    if data.action == "upsert":
        pw_hash = hash_pw(data.default_password or "oxx@pharma")
        for row in data.users:
            try:
                existing = await db.users.find_one({"external_id": row.external_id}) or await db.users.find_one({"email": row.email.lower()})
                if existing:
                    await db.users.update_one(
                        {"user_id": existing["user_id"]},
                        {"$set": {
                            "external_id": row.external_id, "name": row.name,
                            "phone": row.phone, "network_type": NETWORK_1,
                        }},
                    )
                    id_map[row.external_id] = existing["user_id"]
                    stats["updated"] += 1
                else:
                    uid = gen_id("user_")
                    await db.users.insert_one({
                        "user_id": uid, "email": row.email.lower(),
                        "password_hash": pw_hash, "name": row.name,
                        "phone": row.phone, "role": "customer", "access_level": 99,
                        "status": "active", "addresses": [],
                        "sponsor_id": None, "sponsor_code": None,
                        "network_type": NETWORK_1,
                        "network_sponsor_id": None,
                        "external_id": row.external_id,
                        "must_set_password": True,  # primeiro acesso obriga a definir senha
                        "referral_program_active": False,
                        "created_at": now_iso(),
                    })
                    id_map[row.external_id] = uid
                    stats["created"] += 1
            except Exception as e:
                stats["errors"].append({"external_id": row.external_id, "error": str(e)})
        # Resolver lideres
        for row in data.users:
            if row.leader_external_id and row.external_id in id_map:
                leader_uid = id_map.get(row.leader_external_id)
                if not leader_uid:
                    leader_doc = await db.users.find_one({"external_id": row.leader_external_id}, {"_id": 0})
                    if leader_doc:
                        leader_uid = leader_doc["user_id"]
                if leader_uid:
                    await db.users.update_one(
                        {"user_id": id_map[row.external_id]},
                        {"$set": {"network_sponsor_id": leader_uid}},
                    )
    elif data.action == "delete":
        for row in data.users:
            existing = await db.users.find_one({"external_id": row.external_id})
            if existing:
                await db.users.update_one(
                    {"user_id": existing["user_id"]},
                    {"$set": {"network_type": NETWORK_CUSTOMER, "network_sponsor_id": None, "revoked_at": now_iso()}},
                )
                stats["deleted"] += 1
    else:
        raise HTTPException(status_code=400, detail=f"action '{data.action}' invalida")

    await db.webhook_logs.insert_one({
        "log_id": gen_id("whk_"), "source": "network1_sync",
        "authorized": True, "action": data.action,
        "users_count": len(data.users), "stats": stats, "created_at": now_iso(),
    })
    return stats

@app.get("/api/admin/webhook-logs")
async def list_webhook_logs(request: Request, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    total = await db.webhook_logs.count_documents({})
    logs = await db.webhook_logs.find({}, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"logs": logs, "total": total, "page": page}

@app.post("/api/admin/webhook-token/regenerate")
async def regenerate_webhook_token(request: Request, user: dict = Depends(require_admin())):
    db = request.app.db
    token = gen_referral_code() + gen_referral_code()
    await db.settings.update_one({"_id": "global"}, {"$set": {"external_webhook_token": token, "updated_at": now_iso()}})
    return {"external_webhook_token": token}

@app.get("/api/admin/points-report/export.xlsx")
async def admin_points_report_xlsx(request: Request, start: Optional[str] = None, end: Optional[str] = None,
                                    user_id: Optional[str] = None, user: dict = Depends(require_admin())):
    """Exporta relatorio de pontos em XLSX (Data/Hora, ID, Nome, Pontos totais)."""
    from fastapi.responses import Response as FastAPIResponse
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    import io
    db = request.app.db
    q = {}
    if start:
        q.setdefault("registered_at", {})["$gte"] = start
    if end:
        q.setdefault("registered_at", {})["$lte"] = end
    if user_id:
        q["user_id"] = user_id
    logs = await db.points_log.find(q, {"_id": 0}).sort("registered_at", -1).to_list(100000)

    # Agrupa por user (Data/Hora=ultimo registro do user, ID, Nome, Pontos totais)
    # Conforme pedido: layout simples com colunas Data/Hora, ID, Nome, Pontos totais
    wb = Workbook()
    ws = wb.active
    ws.title = "Relatorio de Pontos"

    # Estilos
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="E8731A", end_color="E8731A", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    thin = Side(border_style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    headers = ["Data/Hora", "ID", "Nome", "Pontos totais"]
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = border

    # Dados (1 linha por registro de ponto)
    for row_idx, l in enumerate(logs, start=2):
        # Formata Data/Hora pt-BR
        dt = l.get("registered_at", "")
        try:
            dt_obj = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            dt_fmt = dt_obj.strftime("%d/%m/%Y %H:%M:%S")
        except Exception:
            dt_fmt = dt
        ws.cell(row=row_idx, column=1, value=dt_fmt).border = border
        ws.cell(row=row_idx, column=2, value=l.get("user_external_id") or l.get("user_id") or "").border = border
        ws.cell(row=row_idx, column=3, value=l.get("user_name") or "").border = border
        c4 = ws.cell(row=row_idx, column=4, value=float(l.get("points_total") or 0))
        c4.number_format = "#,##0.00"
        c4.border = border

    # Auto-ajusta largura
    widths = [22, 28, 32, 16]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i)].width = w
    ws.freeze_panes = "A2"
    # Filtro auto
    if logs:
        ws.auto_filter.ref = f"A1:D{len(logs) + 1}"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return FastAPIResponse(
        content=buf.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="relatorio-pontos.xlsx"'},
    )


# ==================== CORREIOS / FRETE ====================

@app.get("/api/admin/correios-config")
async def admin_correios_config(request: Request, user: dict = Depends(require_admin())):
    return await correios_service.get_config(request.app.db)


@app.put("/api/admin/correios-config")
async def admin_update_correios_config(request: Request, user: dict = Depends(require_admin())):
    body = await request.json() or {}
    try:
        cfg = await correios_service.update_config(request.app.db, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cfg


@app.get("/api/admin/correios-logs")
async def admin_correios_logs(request: Request, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    total = await db.correios_logs.count_documents({})
    logs = await db.correios_logs.find({}, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"logs": logs, "total": total, "page": page}


@app.post("/api/shipping/calculate")
async def public_calculate_shipping(request: Request):
    """Endpoint publico para calcular frete: {cep_destination, items:[{product_id,quantity}]}.

    Para usuarios autenticados, podemos buscar o carrinho automaticamente.
    """
    db = request.app.db
    body = await request.json() or {}
    cep = body.get("cep_destination") or body.get("cep") or ""
    items_in = body.get("items") or []
    declared_value = float(body.get("declared_value") or 0)

    full_items = []
    for it in items_in:
        pid = it.get("product_id")
        qty = int(it.get("quantity") or 1)
        if pid:
            prod = await db.products.find_one({"product_id": pid}, {"_id": 0})
            if prod:
                full_items.append({
                    "weight": prod.get("weight") or 0.3,
                    "length_cm": prod.get("length_cm"),
                    "width_cm": prod.get("width_cm"),
                    "height_cm": prod.get("height_cm"),
                    "quantity": qty,
                })
        else:
            full_items.append({
                "weight": float(it.get("weight") or 0.3),
                "length_cm": it.get("length_cm"),
                "width_cm": it.get("width_cm"),
                "height_cm": it.get("height_cm"),
                "quantity": qty,
            })

    # Se nao veio items, tenta usar carrinho do usuario logado
    if not full_items:
        token = request.headers.get("authorization", "").replace("Bearer ", "")
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                uid = payload.get("sub")
                cart = await db.carts.find_one({"user_id": uid}, {"_id": 0})
                if cart:
                    for ci in cart.get("items", []):
                        prod = await db.products.find_one({"product_id": ci["product_id"]}, {"_id": 0})
                        if prod:
                            full_items.append({
                                "weight": prod.get("weight") or 0.3,
                                "length_cm": prod.get("length_cm"),
                                "width_cm": prod.get("width_cm"),
                                "height_cm": prod.get("height_cm"),
                                "quantity": ci["quantity"],
                            })
            except Exception:
                pass

    result = await correios_service.calculate_freight(db, cep, full_items, declared_value)
    return result


@app.post("/api/admin/correios-test")
async def admin_correios_test(request: Request, user: dict = Depends(require_admin())):
    """Testa configuracao atual com CEP + peso fornecido."""
    body = await request.json() or {}
    cep = body.get("cep_destination") or "01310100"
    weight = float(body.get("weight") or 0.5)
    items = [{"weight": weight, "quantity": 1}]
    result = await correios_service.calculate_freight(request.app.db, cep, items, 0)
    return result


@app.post("/api/admin/correios-test-auth")
async def admin_correios_test_auth(request: Request, user: dict = Depends(require_admin())):
    """Testa apenas autenticacao com Correios CWS (sem calcular frete)."""
    return await correios_service.test_credentials(request.app.db)


# ==================== MAXX MMN INTEGRATION ====================

@app.get("/api/admin/maxx-config")
async def admin_maxx_config(request: Request, user: dict = Depends(require_admin())):
    return await maxx_service.get_config(request.app.db)


@app.put("/api/admin/maxx-config")
async def admin_update_maxx_config(request: Request, user: dict = Depends(require_admin())):
    body = await request.json() or {}
    try:
        cfg = await maxx_service.update_config(request.app.db, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cfg


@app.post("/api/admin/maxx-sync-points")
async def admin_maxx_sync(request: Request, user: dict = Depends(require_admin())):
    """Dispara envio manual de TODOS os pontos pendentes para o Maxx."""
    return await maxx_service.send_pending_batch(request.app.db, kind="manual")


@app.post("/api/admin/maxx-sync-points/{log_id}")
async def admin_maxx_sync_one(request: Request, log_id: str, user: dict = Depends(require_admin())):
    """Reenviar um registro especifico."""
    db = request.app.db
    p = await db.points_log.find_one({"log_id": log_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Log nao encontrado")
    return await maxx_service.send_points(db, [p], kind="manual")


@app.get("/api/admin/maxx-logs")
async def admin_maxx_logs(request: Request, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    total = await db.maxx_logs.count_documents({})
    logs = await db.maxx_logs.find({}, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"logs": logs, "total": total, "page": page}


# ==================== SITE SETTINGS (APARENCIA DA LOJA) ====================

DEFAULT_SITE_SETTINGS = {
    "store_name": "OxxPharma",
    "tagline": "Sua farmácia online de confiança",
    "logo_url": "",
    "logo_dark_url": "",
    "favicon_url": "",
    "brand_primary_color": "#E8731A",
    "brand_secondary_color": "#1F2937",
    "hero_title": "Saúde e bem-estar em sua casa",
    "hero_subtitle": "Os melhores produtos farmacêuticos com entrega rápida.",
    "hero_image_url": "",
    "hero_cta_label": "Comprar agora",
    "hero_cta_link": "/produtos",
    "hero_overlay_opacity": 0.4,
    "social_instagram": "",
    "social_facebook": "",
    "social_youtube": "",
    "social_whatsapp": "",
    "footer_about": "Cuidando da sua saúde com qualidade desde 2026.",
    "footer_contact_email": "contato@oxxpharma.com",
    "footer_contact_phone": "(11) 9 9999-9999",
    "footer_address": "Av Paulista, 1000 - São Paulo/SP",
    "footer_pages": [
        {"label": "Sobre nós", "slug": "sobre"},
        {"label": "Política de Privacidade", "slug": "politica-de-privacidade"},
        {"label": "Termos de Uso", "slug": "termos"},
    ],
    "announcement_bar_enabled": False,
    "announcement_bar_text": "",
    "announcement_bar_link": "",
    "announcement_bar_bg_color": "#E8731A",
    "logo_sizes": {
        "store_header":  {"height": 40, "max_width": 180},
        "store_footer":  {"height": 36, "max_width": 160},
        "admin_sidebar": {"height": 36, "max_width": 160},
        "admin_topbar":  {"height": 28, "max_width": 140},
        "auth_pages":    {"height": 48, "max_width": 200},
        "invoice":       {"height": 56, "max_width": 220},
        "email_header":  {"height": 48, "max_width": 200},
        "email_footer":  {"height": 32, "max_width": 140},
    },
}


async def _get_site_settings(db) -> dict:
    s = await db.settings.find_one({"_id": "site"}) or {}
    out = {**DEFAULT_SITE_SETTINGS}
    for k, v in s.items():
        if k != "_id":
            out[k] = v
    return out


@app.get("/api/site-settings")
async def public_site_settings(request: Request):
    return await _get_site_settings(request.app.db)


@app.put("/api/admin/site-settings")
async def admin_site_settings(request: Request, user: dict = Depends(require_admin())):
    body = await request.json() or {}
    body["updated_at"] = now_iso()
    db = request.app.db
    await db.settings.update_one({"_id": "site"}, {"$set": body}, upsert=True)
    return await _get_site_settings(db)


@app.post("/api/admin/upload-image")
async def admin_upload_image(request: Request, user: dict = Depends(require_admin())):
    """Upload simples de imagem (base64). Retorna URL data:."""
    body = await request.json() or {}
    data_url = body.get("data") or ""
    if not data_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="Formato invalido (use data URL)")
    # Persiste em coleção uploads para poder referenciar depois (opcional)
    db = request.app.db
    upload_id = "img_" + os.urandom(8).hex()
    await db.uploads.insert_one({
        "upload_id": upload_id,
        "data": data_url,
        "name": body.get("name") or upload_id,
        "uploaded_by": user["user_id"],
        "created_at": now_iso(),
    })
    return {"upload_id": upload_id, "url": data_url}


# ==================== CMS PAGES (Editor visual) ====================

@app.get("/api/pages/{slug}")
async def public_get_page(request: Request, slug: str):
    db = request.app.db
    p = await db.cms_pages.find_one({"slug": slug, "published": True}, {"_id": 0, "components_json": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pagina nao encontrada")
    return p


@app.get("/api/admin/pages")
async def admin_list_pages(request: Request, user: dict = Depends(require_admin())):
    db = request.app.db
    pages = await db.cms_pages.find({}, {"_id": 0, "html": 0, "css": 0, "components_json": 0}).sort("updated_at", -1).to_list(200)
    return {"pages": pages}


@app.get("/api/admin/pages/{page_id}")
async def admin_get_page(request: Request, page_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    p = await db.cms_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Pagina nao encontrada")
    return p


@app.post("/api/admin/pages")
async def admin_create_page(request: Request, user: dict = Depends(require_admin())):
    body = await request.json() or {}
    slug = (body.get("slug") or "").strip().lower().replace(" ", "-")
    title = body.get("title") or slug
    if not slug:
        raise HTTPException(status_code=400, detail="slug obrigatorio")
    db = request.app.db
    if await db.cms_pages.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="slug ja existe")
    page_id = "page_" + os.urandom(6).hex()
    doc = {
        "page_id": page_id, "slug": slug, "title": title,
        "html": body.get("html") or "<div><h1>Nova Página</h1><p>Comece a editar...</p></div>",
        "css": body.get("css") or "",
        "components_json": body.get("components_json"),
        "published": bool(body.get("published", True)),
        "meta_description": body.get("meta_description") or "",
        "created_at": now_iso(), "updated_at": now_iso(),
        "created_by": user["user_id"],
    }
    await db.cms_pages.insert_one(doc)
    return await db.cms_pages.find_one({"page_id": page_id}, {"_id": 0})


@app.put("/api/admin/pages/{page_id}")
async def admin_update_page(request: Request, page_id: str, user: dict = Depends(require_admin())):
    body = await request.json() or {}
    db = request.app.db
    target = await db.cms_pages.find_one({"page_id": page_id})
    if not target:
        raise HTTPException(status_code=404, detail="Pagina nao encontrada")
    update = {k: v for k, v in body.items() if k in {"title", "html", "css", "components_json", "published", "meta_description"}}
    # Slug pode mudar mas valida unicidade
    if body.get("slug"):
        new_slug = body["slug"].strip().lower().replace(" ", "-")
        if new_slug != target.get("slug"):
            if await db.cms_pages.find_one({"slug": new_slug, "page_id": {"$ne": page_id}}):
                raise HTTPException(status_code=400, detail="slug ja existe")
            update["slug"] = new_slug
    update["updated_at"] = now_iso()
    await db.cms_pages.update_one({"page_id": page_id}, {"$set": update})
    return await db.cms_pages.find_one({"page_id": page_id}, {"_id": 0})


@app.delete("/api/admin/pages/{page_id}")
async def admin_delete_page(request: Request, page_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    res = await db.cms_pages.delete_one({"page_id": page_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pagina nao encontrada")
    return {"ok": True}


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "OxxPharma"}

# ==================== ADMIN USERS - GESTAO COMPLETA ====================

@app.put("/api/admin/users/{user_id}")
async def admin_update_user(request: Request, user_id: str, user: dict = Depends(require_admin())):
    """Atualiza qualquer campo do usuario (exceto password e id)."""
    db = request.app.db
    body = await request.json() or {}
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    # Campos editaveis
    allowed = {
        "name", "email", "phone", "cpf", "status", "role", "access_level",
        "network_type", "network_sponsor_id", "sponsor_id", "sponsor_code",
        "external_id", "addresses", "pix_key", "pix_key_type",
        "referral_program_active", "must_set_password",
    }
    update = {}
    for k, v in body.items():
        if k in allowed:
            update[k] = v
    # Validar email unico
    if "email" in update and update["email"]:
        update["email"] = update["email"].lower()
        existing = await db.users.find_one({"email": update["email"], "user_id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email ja em uso")
    # Sponsor code -> sponsor_id
    if "sponsor_code" in update and update["sponsor_code"]:
        sp = await db.users.find_one({"referral_code": update["sponsor_code"].strip().upper()})
        if sp:
            update["sponsor_id"] = sp["user_id"]
            update["sponsor_code"] = sp.get("referral_code")
    update["updated_at"] = now_iso()
    await db.users.update_one({"user_id": user_id}, {"$set": update})
    fresh = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return fresh


@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(request: Request, user_id: str, user: dict = Depends(require_admin())):
    """Hard delete: remove user + commissions + carrinho. Pedidos sao mantidos por integridade fiscal."""
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    if target.get("role") == "admin" and target.get("user_id") == user["user_id"]:
        raise HTTPException(status_code=400, detail="Voce nao pode deletar a propria conta")
    # Restaurar dependentes downstream (descendentes na rede)
    await db.users.update_many({"network_sponsor_id": user_id}, {"$set": {"network_sponsor_id": None}})
    await db.users.update_many({"sponsor_id": user_id}, {"$set": {"sponsor_id": None, "sponsor_code": None}})
    # Deletar dados
    await db.users.delete_one({"user_id": user_id})
    await db.carts.delete_many({"user_id": user_id})
    await db.commissions.delete_many({"user_id": user_id})
    return {"ok": True, "deleted_user_id": user_id}


@app.post("/api/admin/users/{user_id}/toggle-status")
async def admin_toggle_user_status(request: Request, user_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    new_status = "inactive" if target.get("status") == "active" else "active"
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": new_status, "updated_at": now_iso()}})
    return {"ok": True, "status": new_status}


@app.post("/api/admin/users/{user_id}/send-password-reset")
async def admin_send_password_reset(request: Request, user_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    token = uuid.uuid4().hex + uuid.uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat()
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": user_id, "email": target.get("email"),
        "expires_at": expires, "used": False, "type": "reset",
        "created_at": now_iso(), "created_by_admin": user["user_id"],
    })
    app_url = get_app_url()
    reset_link = f"{app_url}/redefinir-senha?token={token}"
    asyncio.create_task(email_service.trigger(db, "password_reset", target["email"], {"user": target, "reset_link": reset_link}))
    return {"ok": True, "reset_link": reset_link}


@app.post("/api/admin/users/{user_id}/send-first-access")
async def admin_send_first_access(request: Request, user_id: str, user: dict = Depends(require_admin())):
    """Marca user como must_set_password e envia email com link."""
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    token = uuid.uuid4().hex + uuid.uuid4().hex
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": user_id, "email": target.get("email"),
        "expires_at": expires, "used": False, "type": "first_access",
        "created_at": now_iso(), "created_by_admin": user["user_id"],
    })
    await db.users.update_one({"user_id": user_id}, {"$set": {"must_set_password": True}})
    app_url = get_app_url()
    reset_link = f"{app_url}/primeiro-acesso?token={token}"
    asyncio.create_task(email_service.trigger(db, "first_access", target["email"], {"user": target, "reset_link": reset_link}))
    return {"ok": True, "reset_link": reset_link}


# ==================== AUTH - PASSWORD RESET (PUBLIC) ====================

@app.post("/api/auth/password-reset/request")
async def password_reset_request(request: Request):
    """Usuario solicita reset por email. Sempre retorna sucesso para nao vazar quais emails existem."""
    body = await request.json() or {}
    email = (body.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email obrigatorio")
    db = request.app.db
    target = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    if target:
        token = uuid.uuid4().hex + uuid.uuid4().hex
        expires = (datetime.now(timezone.utc) + timedelta(minutes=60)).isoformat()
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": target["user_id"], "email": email,
            "expires_at": expires, "used": False, "type": "reset",
            "created_at": now_iso(),
        })
        app_url = get_app_url()
        reset_link = f"{app_url}/redefinir-senha?token={token}"
        asyncio.create_task(email_service.trigger(db, "password_reset", email, {"user": target, "reset_link": reset_link}))
    return {"ok": True}


@app.get("/api/auth/password-reset/validate")
async def password_reset_validate(request: Request, token: str):
    db = request.app.db
    t = await db.password_reset_tokens.find_one({"token": token, "used": False}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=400, detail="Token invalido ou ja utilizado")
    if t.get("expires_at", "") < now_iso():
        raise HTTPException(status_code=400, detail="Token expirado")
    u = await db.users.find_one({"user_id": t["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "email": t["email"], "name": u.get("name") if u else None, "type": t.get("type", "reset")}


@app.post("/api/auth/password-reset/confirm")
async def password_reset_confirm(request: Request):
    body = await request.json() or {}
    token = body.get("token")
    new_password = body.get("password")
    if not token or not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Token e senha (>=6) obrigatorios")
    db = request.app.db
    t = await db.password_reset_tokens.find_one({"token": token, "used": False})
    if not t:
        raise HTTPException(status_code=400, detail="Token invalido")
    if t.get("expires_at", "") < now_iso():
        raise HTTPException(status_code=400, detail="Token expirado")
    pw_hash = hash_pw(new_password)
    await db.users.update_one(
        {"user_id": t["user_id"]},
        {"$set": {"password_hash": pw_hash, "must_set_password": False, "password_changed_at": now_iso()}},
    )
    await db.password_reset_tokens.update_one({"token": token}, {"$set": {"used": True, "used_at": now_iso()}})
    return {"ok": True}


@app.post("/api/auth/first-access/request")
async def first_access_request(request: Request):
    """Usuario importado solicita link de primeiro acesso por email."""
    body = await request.json() or {}
    email = (body.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email obrigatorio")
    db = request.app.db
    target = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    if target:
        token = uuid.uuid4().hex + uuid.uuid4().hex
        expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": target["user_id"], "email": email,
            "expires_at": expires, "used": False, "type": "first_access",
            "created_at": now_iso(),
        })
        app_url = get_app_url()
        reset_link = f"{app_url}/primeiro-acesso?token={token}"
        asyncio.create_task(email_service.trigger(db, "first_access", email, {"user": target, "reset_link": reset_link}))
    return {"ok": True}


# ==================== POINTS REPORT ====================

@app.get("/api/admin/points-report")
async def admin_points_report(request: Request, start: Optional[str] = None, end: Optional[str] = None,
                              user_id: Optional[str] = None, applied: Optional[bool] = None,
                              page: int = 1, limit: int = 100, user: dict = Depends(require_admin())):
    db = request.app.db
    q = {}
    if start:
        q.setdefault("registered_at", {})["$gte"] = start
    if end:
        q.setdefault("registered_at", {})["$lte"] = end
    if user_id:
        q["user_id"] = user_id
    if applied is not None:
        q["applied_externally"] = applied
    total = await db.points_log.count_documents(q)
    logs = await db.points_log.find(q, {"_id": 0}).sort("registered_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    summary = await db.points_log.aggregate([
        {"$match": q},
        {"$group": {"_id": None, "total_points": {"$sum": "$points_total"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "summary": {
            "total_points": round((summary[0]["total_points"] if summary else 0), 2),
            "count": summary[0]["count"] if summary else 0,
        },
    }


@app.get("/api/admin/points-report/export.csv")
async def admin_points_report_csv(request: Request, start: Optional[str] = None, end: Optional[str] = None,
                                   user_id: Optional[str] = None, user: dict = Depends(require_admin())):
    from fastapi.responses import Response as FastAPIResponse
    import io, csv
    db = request.app.db
    q = {}
    if start:
        q.setdefault("registered_at", {})["$gte"] = start
    if end:
        q.setdefault("registered_at", {})["$lte"] = end
    if user_id:
        q["user_id"] = user_id
    logs = await db.points_log.find(q, {"_id": 0}).sort("registered_at", -1).to_list(100000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["data_hora", "user_id", "external_id", "nome", "email", "produto", "qtd", "pontos_unidade", "pontos_total", "pedido", "aplicado_externamente"])
    for l in logs:
        w.writerow([
            l.get("registered_at"), l.get("user_id"), l.get("user_external_id") or "",
            l.get("user_name"), l.get("user_email"), l.get("product_name"),
            l.get("quantity"), l.get("points_per_unit"), l.get("points_total"),
            l.get("order_id"), "Sim" if l.get("applied_externally") else "Nao",
        ])
    return FastAPIResponse(
        content=buf.getvalue().encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="relatorio-pontos.csv"'},
    )


@app.post("/api/admin/points-report/mark-applied")
async def admin_points_mark_applied(request: Request, user: dict = Depends(require_admin())):
    """Marca um conjunto de pontos como aplicado externamente (admin clicou apos aplicar)."""
    body = await request.json() or {}
    log_ids = body.get("log_ids") or []
    if not log_ids:
        raise HTTPException(status_code=400, detail="log_ids obrigatorio")
    db = request.app.db
    res = await db.points_log.update_many(
        {"log_id": {"$in": log_ids}},
        {"$set": {"applied_externally": True, "applied_at": now_iso(), "applied_by": user["user_id"]}},
    )
    return {"ok": True, "modified": res.modified_count}


# ==================== PAYMENTS - ADMIN ====================

@app.get("/api/admin/payments-config")
async def admin_payments_config(request: Request, user: dict = Depends(require_admin())):
    return await payments_service.get_admin_config(request.app.db)


@app.put("/api/admin/payments-config")
async def admin_set_payments_config(request: Request, user: dict = Depends(require_admin())):
    body = await request.json() or {}
    try:
        cfg = await payments_service.update_credentials(request.app.db, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cfg


@app.get("/api/admin/payments-webhook-logs")
async def admin_payments_webhook_logs(request: Request, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    total = await db.payment_webhook_logs.count_documents({})
    logs = await db.payment_webhook_logs.find({}, {"_id": 0}).sort("received_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"logs": logs, "total": total, "page": page}


# ==================== CARTAO DE BENEFICIOS / GIFT CARD ====================

def _validate_enrollment_payload(fields: List[Dict], data: Dict) -> Dict:
    """Valida dados submetidos contra os campos configurados. Retorna dict sanitizado."""
    clean = {}
    for f in fields or []:
        key = f.get("key")
        if not key:
            continue
        val = data.get(key)
        if f.get("required") and (val is None or str(val).strip() == ""):
            raise HTTPException(status_code=400, detail=f"Campo obrigatorio: {f.get('label') or key}")
        if val is not None:
            clean[key] = val
    return clean


@app.get("/api/admin/card-config")
async def get_admin_card_config(request: Request, user: dict = Depends(require_admin())):
    return await card_service.get_card_config(request.app.db)


@app.put("/api/admin/card-config")
async def update_admin_card_config(request: Request, user: dict = Depends(require_admin())):
    body = await request.json()
    cfg = await card_service.update_card_config(request.app.db, body or {})
    return cfg


@app.get("/api/public/card-enrollment-fields")
async def public_card_fields(request: Request):
    """Campos publicos (apenas meta) para montar o formulario no frontend do usuario."""
    cfg = await card_service.get_card_config(request.app.db)
    return {"fields": cfg.get("enrollment_fields", [])}


@app.post("/api/users/me/referral-enrollment")
async def submit_referral_enrollment(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    if user.get("referral_program_active") and user.get("referral_code"):
        raise HTTPException(status_code=400, detail="Usuario ja esta no programa de indicacao")
    body = await request.json()
    cfg = await card_service.get_card_config(db)
    clean = _validate_enrollment_payload(cfg.get("enrollment_fields", []), body or {})
    # Gera referral_code unico
    code = gen_referral_code()
    while await db.users.find_one({"referral_code": code}):
        code = gen_referral_code()
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "referral_code": code,
            "referral_program_active": True,
            "referral_enrollment": clean,
            "referral_enrolled_at": now_iso(),
        }},
    )
    # Tenta cadastrar beneficiario na API do cartao (best-effort)
    try:
        await card_service.send_enrollment_to_card_api(db, {**user, "referral_code": code}, clean)
    except Exception as e:
        logger.warning(f"Falha enviando enrollment para API cartao: {e}")
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    app_url = get_app_url()
    return {
        "ok": True,
        "referral_code": code,
        "referral_link": f"{app_url}/?ref={code}",
        "enrollment": clean,
        "user": u,
    }


@app.post("/api/admin/users/{user_id}/activate-referral")
async def admin_activate_referral(request: Request, user_id: str, user: dict = Depends(require_admin())):
    """Admin ativa manualmente o programa de indicacao para um usuario, sem formulario."""
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    if target.get("referral_program_active") and target.get("referral_code"):
        return {"ok": True, "already_active": True, "referral_code": target.get("referral_code")}
    code = gen_referral_code()
    while await db.users.find_one({"referral_code": code}):
        code = gen_referral_code()
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "referral_code": code,
            "referral_program_active": True,
            "referral_enrolled_at": now_iso(),
            "referral_activated_by_admin": user["user_id"],
        }},
    )
    return {"ok": True, "referral_code": code}


@app.post("/api/admin/users/{user_id}/deactivate-referral")
async def admin_deactivate_referral(request: Request, user_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"referral_program_active": False}, "$unset": {"referral_code": ""}},
    )
    return {"ok": True}


@app.post("/api/admin/reset-all-referrals")
async def admin_reset_all_referrals(request: Request, user: dict = Depends(require_admin())):
    """Reseta TODOS os referral_codes (exceto admin), desativando o programa para todos."""
    db = request.app.db
    res = await db.users.update_many(
        {"role": {"$ne": "admin"}},
        {"$set": {"referral_program_active": False}, "$unset": {"referral_code": ""}},
    )
    return {"ok": True, "updated": res.modified_count}


@app.get("/api/admin/card-batches")
async def admin_list_card_batches(request: Request, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    q = {"is_lock": {"$ne": True}}
    total = await db.card_batches.count_documents(q)
    batches = await db.card_batches.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"batches": batches, "total": total, "page": page}


@app.get("/api/admin/card-batches/{batch_id}")
async def admin_get_card_batch(request: Request, batch_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    b = await db.card_batches.find_one({"batch_id": batch_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Batch nao encontrado")
    return b


@app.post("/api/admin/card-batches/run")
async def admin_run_card_batch(request: Request, user: dict = Depends(require_admin())):
    """Dispara manualmente a transferencia do dia."""
    db = request.app.db
    result = await card_service.run_daily_transfer(db, mode="manual", triggered_by=user["user_id"])
    return result


@app.post("/api/admin/card-batches/{batch_id}/mark-exported")
async def admin_mark_batch_exported(request: Request, batch_id: str, user: dict = Depends(require_admin())):
    db = request.app.db
    b = await card_service.mark_batch_exported(db, batch_id, mode="manual")
    if not b:
        raise HTTPException(status_code=404, detail="Batch nao encontrado")
    return b


@app.get("/api/admin/card-batches/{batch_id}/export.csv")
async def admin_export_batch_csv(request: Request, batch_id: str, user: dict = Depends(require_admin())):
    from fastapi.responses import Response as FastAPIResponse
    db = request.app.db
    b = await db.card_batches.find_one({"batch_id": batch_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Batch nao encontrado")
    csv_bytes = card_service.batch_to_csv(b)
    return FastAPIResponse(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{batch_id}.csv"'},
    )


@app.get("/api/admin/card-logs")
async def admin_list_card_logs(request: Request, page: int = 1, limit: int = 50, user: dict = Depends(require_admin())):
    db = request.app.db
    total = await db.card_api_logs.count_documents({})
    logs = await db.card_api_logs.find({}, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"logs": logs, "total": total, "page": page}


@app.get("/api/users/me/card-balance")
async def my_card_balance(request: Request, user: dict = Depends(get_current_user)):
    """Saldo 'na conta' (paid ainda nao enviado) + 'enviado para cartao' (historico)."""
    db = request.app.db
    account_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user["user_id"], "status": "paid", "sent_to_card": {"$ne": True}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    sent_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user["user_id"], "sent_to_card": True}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    pending_agg = await db.commissions.aggregate([
        {"$match": {"user_id": user["user_id"], "status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    return {
        "account_balance": round((account_agg[0]["total"] if account_agg else 0), 2),
        "sent_to_card_total": round((sent_agg[0]["total"] if sent_agg else 0), 2),
        "pending_commissions": round((pending_agg[0]["total"] if pending_agg else 0), 2),
    }



# ==================== USER CATEGORIES (admin) ====================

@app.get("/api/admin/user-categories")
async def admin_list_user_categories(request: Request, user: dict = Depends(require_admin())):
    return {"categories": await store_extras.list_user_categories(request.app.db)}


@app.post("/api/admin/user-categories")
async def admin_create_user_category(request: Request, payload: store_extras.UserCategoryIn, user: dict = Depends(require_admin())):
    return await store_extras.create_user_category(request.app.db, payload)


@app.put("/api/admin/user-categories/{category_id}")
async def admin_update_user_category(request: Request, category_id: str, payload: store_extras.UserCategoryIn, user: dict = Depends(require_admin())):
    return await store_extras.update_user_category(request.app.db, category_id, payload)


@app.delete("/api/admin/user-categories/{category_id}")
async def admin_delete_user_category(request: Request, category_id: str, user: dict = Depends(require_admin())):
    return await store_extras.delete_user_category(request.app.db, category_id)


class _UserCatsBody(BaseModel):
    category_ids: List[str] = []


@app.put("/api/admin/users/{user_id}/categories")
async def admin_set_user_categories(request: Request, user_id: str, body: _UserCatsBody, user: dict = Depends(require_admin())):
    return await store_extras.set_user_categories(request.app.db, user_id, body.category_ids)


# ==================== COUPONS ====================

@app.get("/api/admin/coupons")
async def admin_list_coupons(request: Request, user: dict = Depends(require_admin())):
    return {"coupons": await store_extras.list_coupons(request.app.db)}


@app.post("/api/admin/coupons")
async def admin_create_coupon(request: Request, payload: store_extras.CouponIn, user: dict = Depends(require_admin())):
    return await store_extras.create_coupon(request.app.db, payload)


@app.put("/api/admin/coupons/{coupon_id}")
async def admin_update_coupon(request: Request, coupon_id: str, payload: store_extras.CouponIn, user: dict = Depends(require_admin())):
    return await store_extras.update_coupon(request.app.db, coupon_id, payload)


@app.delete("/api/admin/coupons/{coupon_id}")
async def admin_delete_coupon(request: Request, coupon_id: str, user: dict = Depends(require_admin())):
    return await store_extras.delete_coupon(request.app.db, coupon_id)


class _CouponValidateBody(BaseModel):
    code: str
    subtotal: float


@app.post("/api/coupons/validate")
async def public_validate_coupon(request: Request, body: _CouponValidateBody):
    db = request.app.db
    user = await get_optional_user(request)
    return await store_extras.validate_coupon(db, body.code, body.subtotal, user)
