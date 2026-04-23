"""
OxxPharma - E-commerce MVP (Fase 1)
Backend API: Auth, Products, Categories, Cart, Checkout, Orders, Addresses, Admin
"""

import os
import uuid
import bcrypt
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Depends, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
import jwt

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
}

async def get_settings(db):
    s = await db.settings.find_one({"_id": "global"})
    if not s:
        s = {"_id": "global", **DEFAULT_SETTINGS, "updated_at": now_iso()}
        await db.settings.insert_one(s)
    # Garantir campos novos (merge com defaults)
    merged = {**DEFAULT_SETTINGS, **{k: v for k, v in s.items() if k != "_id"}}
    return merged

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
    await app.db.users.create_index("referral_code", unique=True)
    await app.db.products.create_index("product_id", unique=True)
    await app.db.products.create_index("category")
    await app.db.orders.create_index("order_id", unique=True)
    await app.db.orders.create_index("user_id")
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

    # Gerar referral_code unico
    referral_code = gen_referral_code()
    while await db.users.find_one({"referral_code": referral_code}):
        referral_code = gen_referral_code()

    user = {
        "user_id": gen_id("user_"), "email": data.email.lower(),
        "password_hash": hash_pw(data.password), "name": data.name,
        "phone": data.phone, "role": "customer", "access_level": 99,
        "status": "active", "addresses": [],
        "referral_code": referral_code,
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
    return {"token": token, "user": u}

@app.post("/api/auth/login")
async def login(request: Request, response: Response, data: AuthLogin):
    db = request.app.db
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not verify_pw(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")
    if user.get("status") == "cancelled":
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
    return {"products": products, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.get("/api/products/featured")
async def featured_products(request: Request, limit: int = 8):
    db = request.app.db
    prods = await db.products.find({"active": True, "featured": True}, {"_id": 0}).limit(limit).to_list(limit)
    if len(prods) < limit:
        more = await db.products.find({"active": True, "featured": {"$ne": True}}, {"_id": 0}).limit(limit - len(prods)).to_list(limit - len(prods))
        prods.extend(more)
    return {"products": prods}

@app.get("/api/products/{product_id}")
async def get_product(request: Request, product_id: str):
    db = request.app.db
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    related = await db.products.find({"category": p.get("category"), "product_id": {"$ne": product_id}, "active": True}, {"_id": 0}).limit(4).to_list(4)
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
            price = prod.get("discount_price") or prod["price"]
            total = price * item["quantity"]
            subtotal += total
            enriched.append({**item, "name": prod["name"], "price": price, "original_price": prod["price"], "image": (prod.get("images") or [None])[0], "total": total, "stock": prod.get("stock", 0)})
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
        price = prod.get("discount_price") or prod["price"]
        total = round(price * ci["quantity"], 2)
        subtotal += total
        items.append({"product_id": prod["product_id"], "name": prod["name"], "price": price, "quantity": ci["quantity"], "total": total, "image": (prod.get("images") or [None])[0]})
        # Decrement stock
        await db.products.update_one({"product_id": prod["product_id"]}, {"$inc": {"stock": -ci["quantity"]}})
    if not items:
        raise HTTPException(status_code=400, detail="Nenhum produto valido")
    shipping = 15.90  # Frete fixo MVP

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
        "shipping_cost": shipping, "total": round(subtotal + shipping, 2),
        "shipping_address": addr, "payment_method": data.payment_method,
        "payment_status": "pending", "order_status": "pending",
        "payment_provider": "mock",  # Sera "mercadopago" quando integrado
        "payment_id": None, "payment_url": None,
        "affiliate_id": affiliate_id, "affiliate_code": affiliate_code,
        "affiliate_commission": commission_amount,
        "notes": data.notes, "created_at": now_iso(),
    }
    await db.orders.insert_one(order)

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
    return await db.orders.find_one({"order_id": order["order_id"]}, {"_id": 0})

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
    elif status == "cancelled":
        await db.commissions.update_many(
            {"order_id": order_id, "status": {"$in": ["pending", "paid"]}},
            {"$set": {"status": "cancelled"}},
        )
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})

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
    # Garantir que o usuario tem referral_code (caso tenha sido criado antes)
    if not user.get("referral_code"):
        code = gen_referral_code()
        while await db.users.find_one({"referral_code": code}):
            code = gen_referral_code()
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"referral_code": code}})
        user["referral_code"] = code
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
    return {
        "referral_code": user["referral_code"],
        "commission_rate": AFFILIATE_COMMISSION_RATE,
        "referrals_count": referrals_count,
        "stats": stats,
    }

@app.get("/api/users/me/commissions")
async def my_commissions(request: Request, page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    db = request.app.db
    q = {"user_id": user["user_id"]}
    total = await db.commissions.count_documents(q)
    comms = await db.commissions.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"commissions": comms, "total": total, "page": page}

# ==================== PAYMENT - MERCADO PAGO (STUB) ====================
# Placeholder para integracao futura com Mercado Pago.
# Quando usuario fornecer as credenciais (MERCADO_PAGO_ACCESS_TOKEN), este
# endpoint criara uma preferencia de pagamento real. Por ora, retorna mock.

@app.post("/api/payments/create/{order_id}")
async def create_payment(request: Request, order_id: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    if order["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    mp_token = os.environ.get("MERCADO_PAGO_ACCESS_TOKEN")
    if mp_token:
        # TODO: integracao real com Mercado Pago SDK
        # import mercadopago
        # sdk = mercadopago.SDK(mp_token)
        # preference = sdk.preference().create({...})
        # payment_url = preference["response"]["init_point"]
        payment_url = None  # placeholder
        payment_id = None
        provider = "mercadopago"
    else:
        # MOCK: auto-aprova pagamento em ambiente de desenvolvimento
        payment_url = None
        payment_id = f"mock_{uuid.uuid4().hex[:12]}"
        provider = "mock"

    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"payment_provider": provider, "payment_id": payment_id, "payment_url": payment_url}},
    )
    return {"order_id": order_id, "payment_id": payment_id, "payment_url": payment_url, "provider": provider}

@app.post("/api/payments/mock/confirm/{order_id}")
async def mock_confirm_payment(request: Request, order_id: str, user: dict = Depends(get_current_user)):
    """MVP: confirma pagamento manualmente (mock). Remover quando Mercado Pago estiver ativo."""
    db = request.app.db
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    if order["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"payment_status": "paid", "order_status": "paid", "paid_at": now_iso()}},
    )
    await db.commissions.update_many(
        {"order_id": order_id, "status": "pending"},
        {"$set": {"status": "paid", "paid_at": now_iso()}},
    )
    return await db.orders.find_one({"order_id": order_id}, {"_id": 0})

@app.post("/api/payments/webhook/mercadopago")
async def mp_webhook(request: Request):
    """Webhook Mercado Pago (placeholder). Sera implementado quando credenciais forem fornecidas."""
    body = await request.json()
    logger.info(f"MP webhook received: {body}")
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
                rc = gen_referral_code()
                while await db.users.find_one({"referral_code": rc}):
                    rc = gen_referral_code()
                await db.users.insert_one({
                    "user_id": uid, "email": row.email.lower(),
                    "password_hash": pw_hash, "name": row.name,
                    "phone": row.phone, "role": "customer", "access_level": 99,
                    "status": "active", "addresses": [],
                    "referral_code": rc, "sponsor_id": None, "sponsor_code": None,
                    "network_type": NETWORK_1,
                    "network_sponsor_id": None,
                    "external_id": row.external_id,
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
        raise HTTPException(status_code=400, detail="Nao foi possivel compor o saque com comissoes elegiveis")

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

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "OxxPharma"}
