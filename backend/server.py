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
    payment_method: str = "pix"
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
            "created_at": now_iso(),
        })
        logger.info(f"Admin criado: {email}")
    elif not verify_pw(pw, existing.get("password_hash", "")):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_pw(pw)}})

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
    await app.db.products.create_index("product_id", unique=True)
    await app.db.products.create_index("category")
    await app.db.orders.create_index("order_id", unique=True)
    await app.db.orders.create_index("user_id")
    await app.db.categories.create_index("category_id", unique=True)
    await app.db.carts.create_index("user_id", unique=True)
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
    user = {
        "user_id": gen_id("user_"), "email": data.email.lower(),
        "password_hash": hash_pw(data.password), "name": data.name,
        "phone": data.phone, "role": "customer", "access_level": 99,
        "status": "active", "addresses": [], "created_at": now_iso(),
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
    for field in ["name", "phone", "cpf"]:
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
    order = {
        "order_id": gen_id("ord_"), "user_id": user["user_id"],
        "customer_name": user.get("name"), "customer_email": user.get("email"),
        "items": items, "subtotal": round(subtotal, 2),
        "shipping_cost": shipping, "total": round(subtotal + shipping, 2),
        "shipping_address": addr, "payment_method": data.payment_method,
        "payment_status": "pending", "order_status": "pending",
        "notes": data.notes, "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
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

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "OxxPharma"}
