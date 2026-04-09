"""
OxxPharma - Sistema de Marketing Multinivel Farmaceutico
Estrutura de Franquias: Nacional > Estadual > Regional (DDD) > Cidade
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
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
import jwt

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"

# Access Levels
ACCESS_LEVELS = {
    0: "admin",
    1: "nacional",
    2: "estadual",
    3: "regional",
    4: "cidade",
    5: "indicador",
    6: "unidade_indicadora",
}

LEVEL_NAMES = {
    0: "Administrador",
    1: "Nacional",
    2: "Estadual",
    3: "Regional",
    4: "Cidade",
    5: "Indicador",
    6: "Unidade Indicadora",
}

# ==================== HELPERS ====================

def generate_id(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:12]}"

def generate_referral_code():
    return uuid.uuid4().hex[:8].upper()

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        user = await request.app.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_level(max_level: int):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("access_level", 99) > max_level:
            raise HTTPException(status_code=403, detail="Acesso negado")
        return user
    return dep

def set_auth_cookies(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token,
        httponly=True, secure=False, samesite="lax",
        max_age=7*24*60*60, path="/"
    )

# ==================== MODELS ====================

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    cpf: Optional[str] = None
    access_level: int = 5
    sponsor_code: Optional[str] = None
    state: Optional[str] = None
    ddd: Optional[str] = None
    city: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cpf: Optional[str] = None
    password: Optional[str] = None
    access_level: Optional[int] = None
    status: Optional[str] = None
    state: Optional[str] = None
    ddd: Optional[str] = None
    city: Optional[str] = None
    address: Optional[dict] = None
    bank_info: Optional[dict] = None
    available_balance: Optional[float] = None
    blocked_balance: Optional[float] = None
    franchise_value: Optional[float] = None
    annual_revenue: Optional[float] = None

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    discount_price: Optional[float] = None
    category: str
    images: List[str] = []
    stock: int = 0
    active: bool = True

class OrderCreate(BaseModel):
    items: List[dict]
    shipping_address: Optional[dict] = None
    payment_method: str = "internal"
    referral_code: Optional[str] = None

class SettingsUpdate(BaseModel):
    key: str
    value: str

class WithdrawalRequest(BaseModel):
    amount: float

# ==================== LIFESPAN ====================

async def seed_admin(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@oxxpharma.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        admin_user = {
            "user_id": generate_id("user_"),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrador OxxPharma",
            "phone": None,
            "cpf": None,
            "access_level": 0,
            "status": "active",
            "referral_code": generate_referral_code(),
            "sponsor_id": None,
            "state": None,
            "ddd": None,
            "city": None,
            "franchise_value": 0,
            "annual_revenue": 0,
            "available_balance": 0,
            "blocked_balance": 0,
            "address": None,
            "bank_info": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin_user)
        logger.info(f"Admin criado: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

    # Seed Nacional user
    nacional = await db.users.find_one({"access_level": 1})
    if not nacional:
        nacional_user = {
            "user_id": generate_id("user_"),
            "email": "nacional@oxxpharma.com",
            "password_hash": hash_password("nacional123"),
            "name": "Conta Nacional OxxPharma",
            "phone": None,
            "cpf": None,
            "access_level": 1,
            "status": "active",
            "referral_code": generate_referral_code(),
            "sponsor_id": None,
            "state": None,
            "ddd": None,
            "city": None,
            "franchise_value": 0,
            "annual_revenue": 0,
            "available_balance": 0,
            "blocked_balance": 0,
            "address": None,
            "bank_info": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(nacional_user)
        logger.info("Conta Nacional criada: nacional@oxxpharma.com")

async def seed_settings(db):
    existing = await db.settings.find_one({"settings_id": "global"})
    if not existing:
        settings = {
            "settings_id": "global",
            "commission_gen_1": 10,
            "commission_gen_2": 7,
            "commission_gen_3": 5,
            "commission_gen_4": 3,
            "commission_gen_5": 2,
            "commission_gen_6": 1,
            "nacional_commission": 2,
            "min_withdrawal": 50,
            "withdrawal_fee_percent": 5,
            "commission_block_days": 7,
            "cross_state_split": 50,
            "indicador_min_referrals_upgrade": 20,
            "unidade_indicadora_investment": 500,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.settings.insert_one(settings)
        logger.info("Configuracoes padrao criadas")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.mongodb_client = AsyncIOMotorClient(MONGO_URL)
    app.db = app.mongodb_client[DB_NAME]
    logger.info("Conectado ao MongoDB")

    await app.db.users.create_index("email", unique=True)
    await app.db.users.create_index("user_id", unique=True)
    await app.db.users.create_index("referral_code", unique=True)
    await app.db.users.create_index("access_level")
    await app.db.products.create_index("product_id", unique=True)
    await app.db.orders.create_index("order_id", unique=True)
    await app.db.commissions.create_index("commission_id", unique=True)

    await seed_admin(app.db)
    await seed_settings(app.db)

    yield

    app.mongodb_client.close()
    logger.info("Desconectado do MongoDB")

app = FastAPI(title="OxxPharma MLM API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== AUTH ====================

@app.post("/api/auth/register")
async def register(request: Request, response: Response, data: UserRegister):
    db = request.app.db
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ja cadastrado")

    sponsor_id = None
    if data.sponsor_code:
        sponsor = await db.users.find_one({"referral_code": data.sponsor_code}, {"_id": 0})
        if not sponsor:
            raise HTTPException(status_code=400, detail="Codigo de indicacao invalido")
        sponsor_id = sponsor["user_id"]

    user = {
        "user_id": generate_id("user_"),
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "cpf": data.cpf,
        "access_level": data.access_level,
        "status": "active",
        "referral_code": generate_referral_code(),
        "sponsor_id": sponsor_id,
        "state": data.state,
        "ddd": data.ddd,
        "city": data.city,
        "franchise_value": 0,
        "annual_revenue": 0,
        "available_balance": 0,
        "blocked_balance": 0,
        "address": None,
        "bank_info": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)

    token = create_access_token(user["user_id"], user["email"])
    set_auth_cookies(response, token)

    user_resp = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"token": token, "user": user_resp}

@app.post("/api/auth/login")
async def login(request: Request, response: Response, data: UserLogin):
    db = request.app.db
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")
    if user.get("status") == "cancelled":
        raise HTTPException(status_code=401, detail="Conta cancelada")

    token = create_access_token(user["user_id"], user["email"])
    set_auth_cookies(response, token)

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

# ==================== USERS ====================

@app.get("/api/users")
async def list_users(
    request: Request,
    access_level: Optional[int] = None,
    status: Optional[str] = None,
    state: Optional[str] = None,
    ddd: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(require_level(4))
):
    db = request.app.db
    query = {}
    if access_level is not None:
        query["access_level"] = access_level
    if status:
        query["status"] = status
    if state:
        query["state"] = state
    if ddd:
        query["ddd"] = ddd
    if city:
        query["city"] = city
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    # Level-based filtering
    ul = user.get("access_level", 99)
    if ul == 2:  # Estadual sees regional+cidade in their state
        query["state"] = user.get("state")
        if "access_level" not in query:
            query["access_level"] = {"$gte": 3}
    elif ul == 3:  # Regional sees cidade in their DDD
        query["ddd"] = user.get("ddd")
        if "access_level" not in query:
            query["access_level"] = {"$gte": 4}
    elif ul == 4:  # Cidade sees indicadores
        query["sponsor_id"] = user["user_id"]

    total = await db.users.count_documents(query)
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"users": users, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.get("/api/users/{user_id}")
async def get_user(request: Request, user_id: str, user: dict = Depends(get_current_user)):
    db = request.app.db
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    return target

@app.put("/api/users/{user_id}")
async def update_user(request: Request, user_id: str, data: UserUpdate, current_user: dict = Depends(get_current_user)):
    db = request.app.db
    is_admin = current_user.get("access_level", 99) <= 1
    is_self = current_user["user_id"] == user_id
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Acesso negado")

    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")

    update_data = {}
    # Self-editable fields
    if data.name is not None:
        update_data["name"] = data.name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.cpf is not None:
        update_data["cpf"] = data.cpf
    if data.address is not None:
        update_data["address"] = data.address
    if data.bank_info is not None:
        update_data["bank_info"] = data.bank_info

    # Admin-only fields
    if is_admin:
        if data.email is not None:
            ex = await db.users.find_one({"email": data.email.lower(), "user_id": {"$ne": user_id}})
            if ex:
                raise HTTPException(status_code=400, detail="Email ja em uso")
            update_data["email"] = data.email.lower()
        if data.password:
            update_data["password_hash"] = hash_password(data.password)
        if data.access_level is not None:
            update_data["access_level"] = data.access_level
        if data.status is not None:
            update_data["status"] = data.status
        if data.state is not None:
            update_data["state"] = data.state
        if data.ddd is not None:
            update_data["ddd"] = data.ddd
        if data.city is not None:
            update_data["city"] = data.city
        if data.available_balance is not None:
            update_data["available_balance"] = data.available_balance
        if data.blocked_balance is not None:
            update_data["blocked_balance"] = data.blocked_balance
        if data.franchise_value is not None:
            update_data["franchise_value"] = data.franchise_value
        if data.annual_revenue is not None:
            update_data["annual_revenue"] = data.annual_revenue

    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user_id}, {"$set": update_data})

    updated = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return updated

@app.delete("/api/users/{user_id}")
async def delete_user(request: Request, user_id: str, user: dict = Depends(require_level(0))):
    db = request.app.db
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Nao pode excluir sua propria conta")
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "cancelled"}})
    return {"message": "Usuario desativado"}

@app.post("/api/users/create")
async def create_user_admin(request: Request, response: Response, data: UserRegister, user: dict = Depends(require_level(2))):
    """Admin/Estadual can create users at lower levels"""
    db = request.app.db
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ja cadastrado")

    # Estadual can only create regional/cidade
    ul = user.get("access_level", 99)
    if ul == 2 and data.access_level < 3:
        raise HTTPException(status_code=403, detail="Voce so pode criar Regional ou Cidade")

    sponsor_id = user["user_id"] if data.access_level > user.get("access_level", 0) else None

    new_user = {
        "user_id": generate_id("user_"),
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "cpf": data.cpf,
        "access_level": data.access_level,
        "status": "active",
        "referral_code": generate_referral_code(),
        "sponsor_id": sponsor_id,
        "state": data.state or user.get("state"),
        "ddd": data.ddd,
        "city": data.city,
        "franchise_value": 0,
        "annual_revenue": 0,
        "available_balance": 0,
        "blocked_balance": 0,
        "address": None,
        "bank_info": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(new_user)

    user_resp = await db.users.find_one({"user_id": new_user["user_id"]}, {"_id": 0, "password_hash": 0})
    return user_resp

# ==================== PRODUCTS ====================

@app.get("/api/products")
async def list_products(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    active: Optional[bool] = True,
    page: int = 1,
    limit: int = 20,
):
    db = request.app.db
    query = {}
    if active is not None:
        query["active"] = active
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    total = await db.products.count_documents(query)
    products = await db.products.find(query, {"_id": 0}).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"products": products, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.get("/api/products/{product_id}")
async def get_product(request: Request, product_id: str):
    db = request.app.db
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    return p

@app.post("/api/products")
async def create_product(request: Request, data: ProductCreate, user: dict = Depends(require_level(1))):
    db = request.app.db
    product = {
        "product_id": generate_id("prod_"),
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
    }
    await db.products.insert_one(product)
    return await db.products.find_one({"product_id": product["product_id"]}, {"_id": 0})

@app.put("/api/products/{product_id}")
async def update_product(request: Request, product_id: str, data: ProductCreate, user: dict = Depends(require_level(1))):
    db = request.app.db
    existing = await db.products.find_one({"product_id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    update = data.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"product_id": product_id}, {"$set": update})
    return await db.products.find_one({"product_id": product_id}, {"_id": 0})

@app.delete("/api/products/{product_id}")
async def delete_product(request: Request, product_id: str, user: dict = Depends(require_level(1))):
    db = request.app.db
    result = await db.products.delete_one({"product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    return {"message": "Produto excluido"}

@app.get("/api/categories")
async def list_categories(request: Request):
    db = request.app.db
    cats = await db.products.distinct("category")
    return {"categories": cats}

# ==================== ORDERS ====================

@app.post("/api/orders")
async def create_order(request: Request, data: OrderCreate, user: dict = Depends(get_current_user)):
    db = request.app.db
    settings = await db.settings.find_one({"settings_id": "global"}, {"_id": 0})

    subtotal = 0
    order_items = []
    for item in data.items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Produto {item['product_id']} nao encontrado")
        price = product.get("discount_price") or product["price"]
        item_total = price * item["quantity"]
        subtotal += item_total
        order_items.append({
            "product_id": product["product_id"],
            "name": product["name"],
            "price": price,
            "quantity": item["quantity"],
            "total": item_total,
        })

    referrer_id = None
    if data.referral_code:
        referrer = await db.users.find_one({"referral_code": data.referral_code}, {"_id": 0})
        if referrer:
            referrer_id = referrer["user_id"]

    order = {
        "order_id": generate_id("ord_"),
        "user_id": user["user_id"],
        "items": order_items,
        "subtotal": subtotal,
        "total": subtotal,
        "shipping_address": data.shipping_address,
        "payment_method": data.payment_method,
        "payment_status": "pending",
        "order_status": "pending",
        "referrer_id": referrer_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order)
    return await db.orders.find_one({"order_id": order["order_id"]}, {"_id": 0})

@app.get("/api/orders")
async def list_orders(
    request: Request,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    db = request.app.db
    query = {}
    if user.get("access_level") > 1:
        query["user_id"] = user["user_id"]
    if status:
        query["order_status"] = status

    total = await db.orders.count_documents(query)
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"orders": orders, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}

@app.put("/api/orders/{order_id}/status")
async def update_order_status(
    request: Request, order_id: str,
    status: str = Query(...),
    user: dict = Depends(require_level(1)),
):
    db = request.app.db
    settings = await db.settings.find_one({"settings_id": "global"}, {"_id": 0})
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")

    update_data = {"order_status": status}
    now = datetime.now(timezone.utc).isoformat()

    if status == "paid":
        update_data["paid_at"] = now
        update_data["payment_status"] = "paid"
        await process_commissions(db, order, settings)
    elif status == "shipped":
        update_data["shipped_at"] = now
    elif status == "delivered":
        update_data["delivered_at"] = now
    elif status == "cancelled":
        update_data["cancelled_at"] = now

    await db.orders.update_one({"order_id": order_id}, {"$set": update_data})
    return {"message": "Status do pedido atualizado"}

# ==================== COMMISSIONS (6 GENERATIONS) ====================

async def process_commissions(db, order, settings):
    """Process MLM commissions up to 6th generation"""
    commission_base = order.get("subtotal", 0)
    referrer_id = order.get("referrer_id")
    if not referrer_id or commission_base <= 0:
        return

    block_days = settings.get("commission_block_days", 7)
    release_at = (datetime.now(timezone.utc) + timedelta(days=block_days)).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # Nacional always gets a cut
    nacional_rate = settings.get("nacional_commission", 2) / 100
    nacional_user = await db.users.find_one({"access_level": 1}, {"_id": 0})
    if nacional_user:
        nac_amount = commission_base * nacional_rate
        await db.commissions.insert_one({
            "commission_id": generate_id("comm_"),
            "order_id": order["order_id"],
            "user_id": nacional_user["user_id"],
            "generation": 0,
            "rate": nacional_rate * 100,
            "base_amount": commission_base,
            "amount": round(nac_amount, 2),
            "status": "blocked",
            "release_at": release_at,
            "created_at": now,
        })
        await db.users.update_one(
            {"user_id": nacional_user["user_id"]},
            {"$inc": {"blocked_balance": round(nac_amount, 2)}}
        )

    # Walk upline for 6 generations
    gen_rates = [
        settings.get("commission_gen_1", 10) / 100,
        settings.get("commission_gen_2", 7) / 100,
        settings.get("commission_gen_3", 5) / 100,
        settings.get("commission_gen_4", 3) / 100,
        settings.get("commission_gen_5", 2) / 100,
        settings.get("commission_gen_6", 1) / 100,
    ]

    current_id = referrer_id
    for gen in range(6):
        if not current_id:
            break
        current = await db.users.find_one({"user_id": current_id}, {"_id": 0})
        if not current or current.get("status") != "active":
            current_id = current.get("sponsor_id") if current else None
            continue

        rate = gen_rates[gen]
        amount = round(commission_base * rate, 2)

        await db.commissions.insert_one({
            "commission_id": generate_id("comm_"),
            "order_id": order["order_id"],
            "user_id": current_id,
            "generation": gen + 1,
            "rate": rate * 100,
            "base_amount": commission_base,
            "amount": amount,
            "status": "blocked",
            "release_at": release_at,
            "created_at": now,
        })
        await db.users.update_one(
            {"user_id": current_id},
            {"$inc": {"blocked_balance": amount}}
        )

        current_id = current.get("sponsor_id")

@app.get("/api/commissions")
async def list_commissions(
    request: Request,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    db = request.app.db
    query = {"user_id": user["user_id"]}
    if user.get("access_level") <= 1:
        query = {}
    if status:
        query["status"] = status

    total = await db.commissions.count_documents(query)
    comms = await db.commissions.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"commissions": comms, "total": total, "page": page}

@app.get("/api/commissions/summary")
async def commission_summary(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    uid = user["user_id"]

    pipeline = [
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    by_status = {}
    async for doc in db.commissions.aggregate(pipeline):
        by_status[doc["_id"]] = {"total": doc["total"], "count": doc["count"]}

    pipeline2 = [
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$generation", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    by_gen = {}
    async for doc in db.commissions.aggregate(pipeline2):
        by_gen[str(doc["_id"])] = {"total": doc["total"], "count": doc["count"]}

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
    this_month_agg = await db.commissions.aggregate([
        {"$match": {"user_id": uid, "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)

    return {
        "by_status": by_status,
        "by_generation": by_gen,
        "this_month": this_month_agg[0]["total"] if this_month_agg else 0,
        "available_balance": user.get("available_balance", 0),
        "blocked_balance": user.get("blocked_balance", 0),
    }

@app.post("/api/commissions/release")
async def release_blocked_commissions(request: Request, user: dict = Depends(require_level(0))):
    """Manually release blocked commissions past their release date"""
    db = request.app.db
    now = datetime.now(timezone.utc).isoformat()
    blocked = await db.commissions.find({"status": "blocked", "release_at": {"$lte": now}}, {"_id": 0}).to_list(10000)
    count = 0
    for c in blocked:
        await db.commissions.update_one(
            {"commission_id": c["commission_id"]},
            {"$set": {"status": "available", "released_at": now}}
        )
        await db.users.update_one(
            {"user_id": c["user_id"]},
            {"$inc": {"blocked_balance": -c["amount"], "available_balance": c["amount"]}}
        )
        count += 1
    return {"message": f"{count} comissoes liberadas"}

# ==================== NETWORK ====================

@app.get("/api/network/tree")
async def get_network_tree(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db

    async def build_tree(uid, depth=0, max_depth=4):
        if depth >= max_depth:
            return []
        children = await db.users.find(
            {"sponsor_id": uid, "status": {"$ne": "cancelled"}},
            {"_id": 0, "password_hash": 0}
        ).to_list(100)
        for child in children:
            child["children"] = await build_tree(child["user_id"], depth + 1, max_depth)
        return children

    if user.get("access_level") <= 1:
        # Admin/Nacional: show from estadual down
        roots = await db.users.find(
            {"access_level": 2, "status": {"$ne": "cancelled"}},
            {"_id": 0, "password_hash": 0}
        ).to_list(100)
        for root in roots:
            root["children"] = await build_tree(root["user_id"])
        return {"tree": roots}

    user_data = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    user_data["children"] = await build_tree(user["user_id"])
    return {"tree": [user_data]}

@app.get("/api/network/stats")
async def get_network_stats(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    uid = user["user_id"]

    direct = await db.users.count_documents({"sponsor_id": uid, "status": "active"})
    l1_ids = [u["user_id"] for u in await db.users.find({"sponsor_id": uid}, {"user_id": 1}).to_list(200)]
    indirect = 0
    if l1_ids:
        indirect = await db.users.count_documents({"sponsor_id": {"$in": l1_ids}, "status": "active"})

    by_level = {}
    for lvl in range(2, 7):
        q = {"access_level": lvl, "status": "active"}
        if user.get("access_level") == 2:
            q["state"] = user.get("state")
        elif user.get("access_level") == 3:
            q["ddd"] = user.get("ddd")
        elif user.get("access_level") >= 4:
            q["sponsor_id"] = uid
        by_level[LEVEL_NAMES.get(lvl, str(lvl))] = await db.users.count_documents(q)

    return {
        "direct": direct,
        "indirect": indirect,
        "total": direct + indirect,
        "by_level": by_level,
    }

# ==================== FRANCHISES ====================

@app.get("/api/franchises")
async def list_franchises(request: Request, user: dict = Depends(require_level(1))):
    """List franchise slots"""
    db = request.app.db
    pipeline = [
        {"$match": {"access_level": {"$in": [2, 3, 4]}, "status": "active"}},
        {"$group": {
            "_id": {"level": "$access_level", "state": "$state"},
            "count": {"$sum": 1},
            "total_revenue": {"$sum": "$annual_revenue"},
            "total_franchise_value": {"$sum": "$franchise_value"},
        }},
        {"$sort": {"_id.level": 1}}
    ]
    result = await db.users.aggregate(pipeline).to_list(1000)
    franchises = []
    for r in result:
        franchises.append({
            "level": r["_id"]["level"],
            "level_name": LEVEL_NAMES.get(r["_id"]["level"], ""),
            "state": r["_id"].get("state", ""),
            "count": r["count"],
            "total_revenue": r["total_revenue"],
            "total_franchise_value": r["total_franchise_value"],
        })
    return {"franchises": franchises}

@app.post("/api/franchises/sell")
async def sell_franchise(request: Request, user: dict = Depends(require_level(2))):
    """Record a franchise sale (cross-state referral)"""
    db = request.app.db
    body = await request.json()
    buyer_id = body.get("buyer_id")
    franchise_value = body.get("franchise_value", 0)
    referred_by = body.get("referred_by")

    buyer = await db.users.find_one({"user_id": buyer_id}, {"_id": 0})
    if not buyer:
        raise HTTPException(status_code=404, detail="Comprador nao encontrado")

    settings = await db.settings.find_one({"settings_id": "global"}, {"_id": 0})
    split = settings.get("cross_state_split", 50) / 100

    await db.users.update_one(
        {"user_id": buyer_id},
        {"$set": {"franchise_value": franchise_value}}
    )

    sale = {
        "sale_id": generate_id("fsale_"),
        "buyer_id": buyer_id,
        "franchise_value": franchise_value,
        "seller_id": user["user_id"],
        "referred_by": referred_by,
        "seller_share": round(franchise_value * split, 2) if referred_by else franchise_value,
        "referrer_share": round(franchise_value * (1 - split), 2) if referred_by else 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.franchise_sales.insert_one(sale)

    # Credit seller
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"available_balance": sale["seller_share"]}}
    )
    if referred_by:
        await db.users.update_one(
            {"user_id": referred_by},
            {"$inc": {"available_balance": sale["referrer_share"]}}
        )

    return {"message": "Franquia vendida", "sale": {k: v for k, v in sale.items() if k != "_id"}}

# ==================== WALLET ====================

@app.get("/api/wallet")
async def get_wallet(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    txs = await db.transactions.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    return {
        "available_balance": user.get("available_balance", 0),
        "blocked_balance": user.get("blocked_balance", 0),
        "transactions": txs,
    }

@app.post("/api/wallet/withdraw")
async def request_withdrawal(request: Request, data: WithdrawalRequest, user: dict = Depends(get_current_user)):
    db = request.app.db
    settings = await db.settings.find_one({"settings_id": "global"}, {"_id": 0})
    min_amount = settings.get("min_withdrawal", 50)
    fee_pct = settings.get("withdrawal_fee_percent", 5)

    if data.amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Saque minimo: R$ {min_amount}")
    if data.amount > user.get("available_balance", 0):
        raise HTTPException(status_code=400, detail="Saldo insuficiente")

    fee = round(data.amount * fee_pct / 100, 2)
    net = round(data.amount - fee, 2)

    wd = {
        "withdrawal_id": generate_id("wd_"),
        "user_id": user["user_id"],
        "amount": data.amount,
        "fee": fee,
        "net_amount": net,
        "status": "pending",
        "bank_info": user.get("bank_info"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.withdrawals.insert_one(wd)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"available_balance": -data.amount}}
    )
    await db.transactions.insert_one({
        "transaction_id": generate_id("tx_"),
        "user_id": user["user_id"],
        "type": "withdrawal",
        "amount": -data.amount,
        "description": f"Saque solicitado - R$ {data.amount:.2f}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return await db.withdrawals.find_one({"withdrawal_id": wd["withdrawal_id"]}, {"_id": 0})

@app.get("/api/withdrawals")
async def list_withdrawals(
    request: Request,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    db = request.app.db
    query = {}
    if user.get("access_level") > 1:
        query["user_id"] = user["user_id"]
    if status:
        query["status"] = status

    total = await db.withdrawals.count_documents(query)
    wds = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"withdrawals": wds, "total": total, "page": page}

@app.put("/api/withdrawals/{withdrawal_id}")
async def update_withdrawal(request: Request, withdrawal_id: str, status: str = Query(...), user: dict = Depends(require_level(1))):
    db = request.app.db
    wd = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id}, {"_id": 0})
    if not wd:
        raise HTTPException(status_code=404, detail="Saque nao encontrado")

    update = {"status": status}
    now = datetime.now(timezone.utc).isoformat()
    if status == "approved":
        update["approved_at"] = now
    elif status == "paid":
        update["paid_at"] = now
    elif status == "rejected":
        await db.users.update_one(
            {"user_id": wd["user_id"]},
            {"$inc": {"available_balance": wd["amount"]}}
        )
    await db.withdrawals.update_one({"withdrawal_id": withdrawal_id}, {"$set": update})
    return {"message": "Saque atualizado"}

# ==================== SETTINGS ====================

@app.get("/api/settings")
async def get_settings(request: Request, user: dict = Depends(require_level(0))):
    db = request.app.db
    s = await db.settings.find_one({"settings_id": "global"}, {"_id": 0})
    return s or {}

@app.put("/api/settings")
async def update_settings(request: Request, data: SettingsUpdate, user: dict = Depends(require_level(0))):
    db = request.app.db
    val = data.value
    # Try to convert numeric values
    try:
        val = float(val)
        if val == int(val):
            val = int(val)
    except (ValueError, TypeError):
        pass

    await db.settings.update_one(
        {"settings_id": "global"},
        {"$set": {data.key: val, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    s = await db.settings.find_one({"settings_id": "global"}, {"_id": 0})
    return s

# ==================== DASHBOARD ====================

@app.get("/api/dashboard/admin")
async def admin_dashboard(request: Request, user: dict = Depends(require_level(1))):
    db = request.app.db
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0).isoformat()

    total_users = await db.users.count_documents({"status": "active"})
    users_by_level = {}
    for lvl in range(7):
        users_by_level[LEVEL_NAMES.get(lvl, str(lvl))] = await db.users.count_documents({"access_level": lvl, "status": "active"})

    total_orders = await db.orders.count_documents({})
    month_orders = await db.orders.count_documents({"created_at": {"$gte": month_start}})

    revenue_agg = await db.orders.aggregate([
        {"$match": {"payment_status": "paid", "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]).to_list(1)
    month_revenue = revenue_agg[0]["total"] if revenue_agg else 0

    pending_comms = await db.commissions.aggregate([
        {"$match": {"status": "blocked"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)

    pending_wds = await db.withdrawals.count_documents({"status": "pending"})

    top_sellers = await db.commissions.aggregate([
        {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 5}
    ]).to_list(5)

    top_list = []
    for ts in top_sellers:
        u = await db.users.find_one({"user_id": ts["_id"]}, {"_id": 0, "name": 1, "access_level": 1})
        if u:
            top_list.append({"name": u["name"], "level": LEVEL_NAMES.get(u.get("access_level"), ""), "total": ts["total"]})

    return {
        "total_users": total_users,
        "users_by_level": users_by_level,
        "total_orders": total_orders,
        "month_orders": month_orders,
        "month_revenue": month_revenue,
        "pending_commissions": pending_comms[0]["total"] if pending_comms else 0,
        "pending_withdrawals": pending_wds,
        "top_sellers": top_list,
    }

@app.get("/api/dashboard/user")
async def user_dashboard(request: Request, user: dict = Depends(get_current_user)):
    db = request.app.db
    uid = user["user_id"]
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()

    month_comms = await db.commissions.aggregate([
        {"$match": {"user_id": uid, "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)

    direct_count = await db.users.count_documents({"sponsor_id": uid, "status": "active"})
    my_orders = await db.orders.count_documents({"user_id": uid})

    return {
        "available_balance": user.get("available_balance", 0),
        "blocked_balance": user.get("blocked_balance", 0),
        "month_commissions": month_comms[0]["total"] if month_comms else 0,
        "direct_referrals": direct_count,
        "total_orders": my_orders,
        "referral_code": user.get("referral_code", ""),
    }

# ==================== STATES/DDD REFERENCE ====================

BRAZILIAN_STATES = [
    {"uf": "AC", "name": "Acre"}, {"uf": "AL", "name": "Alagoas"},
    {"uf": "AP", "name": "Amapa"}, {"uf": "AM", "name": "Amazonas"},
    {"uf": "BA", "name": "Bahia"}, {"uf": "CE", "name": "Ceara"},
    {"uf": "DF", "name": "Distrito Federal"}, {"uf": "ES", "name": "Espirito Santo"},
    {"uf": "GO", "name": "Goias"}, {"uf": "MA", "name": "Maranhao"},
    {"uf": "MT", "name": "Mato Grosso"}, {"uf": "MS", "name": "Mato Grosso do Sul"},
    {"uf": "MG", "name": "Minas Gerais"}, {"uf": "PA", "name": "Para"},
    {"uf": "PB", "name": "Paraiba"}, {"uf": "PR", "name": "Parana"},
    {"uf": "PE", "name": "Pernambuco"}, {"uf": "PI", "name": "Piaui"},
    {"uf": "RJ", "name": "Rio de Janeiro"}, {"uf": "RN", "name": "Rio Grande do Norte"},
    {"uf": "RS", "name": "Rio Grande do Sul"}, {"uf": "RO", "name": "Rondonia"},
    {"uf": "RR", "name": "Roraima"}, {"uf": "SC", "name": "Santa Catarina"},
    {"uf": "SP", "name": "Sao Paulo"}, {"uf": "SE", "name": "Sergipe"},
    {"uf": "TO", "name": "Tocantins"},
]

DDD_BY_STATE = {
    "SP": ["11","12","13","14","15","16","17","18","19"],
    "RJ": ["21","22","24"],
    "ES": ["27","28"],
    "MG": ["31","32","33","34","35","37","38"],
    "PR": ["41","42","43","44","45","46"],
    "SC": ["47","48","49"],
    "RS": ["51","53","54","55"],
    "DF": ["61"],
    "GO": ["62","64"],
    "MT": ["65","66"],
    "MS": ["67"],
    "AC": ["68"],
    "RO": ["69"],
    "PA": ["91","93","94"],
    "AM": ["92","97"],
    "RR": ["95"],
    "AP": ["96"],
    "MA": ["98","99"],
    "PI": ["86","89"],
    "CE": ["85","88"],
    "RN": ["84"],
    "PB": ["83"],
    "PE": ["81","87"],
    "AL": ["82"],
    "SE": ["79"],
    "BA": ["71","73","74","75","77"],
    "TO": ["63"],
}

@app.get("/api/reference/states")
async def get_states():
    return {"states": BRAZILIAN_STATES}

@app.get("/api/reference/ddds")
async def get_ddds(state: Optional[str] = None):
    if state:
        return {"ddds": DDD_BY_STATE.get(state.upper(), [])}
    return {"ddds": DDD_BY_STATE}

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "OxxPharma"}
