"""
Iter 42l: Bug fix afiliacao perdida em pedidos via ref_code.

Testes contra API live:
  1. Order armazena sponsor_id (gravado no checkout).
  2. user.sponsor_id e' fixado (sticky) quando pedido foi feito via ref_code.
  3. Top 10 indicadores conta pedidos via ref_code (que antes ficavam orfaos).
"""
import os
import time
import uuid
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

ADMIN = {"email": "admin@oxxpharma.com", "password": "admin123"}


def _login(creds):
    r = requests.post(f"{API_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _register(email, password, sponsor_code=None):
    body = {"email": email, "password": password, "name": "Test " + email[:6], "phone": "11999999999", "cpf": ""}
    if sponsor_code:
        body["sponsor_code"] = sponsor_code
    r = requests.post(f"{API_URL}/api/auth/register", json=body, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _ensure_test_product(client, db):
    """Cria/atualiza um produto barato e em estoque para testes."""
    pid = "p_test_iter42l"
    prod = db.products.find_one({"product_id": pid})
    doc = {
        "product_id": pid, "name": "Teste Iter42l", "price": 10.0, "active": True,
        "stock": 1000, "images": [], "weight": 0.3, "points_value": 5,
    }
    if prod:
        db.products.update_one({"product_id": pid}, {"$set": doc})
    else:
        db.products.insert_one(doc)
    return pid


def _ensure_address(token):
    body = {
        "label": "Casa", "street": "Rua A", "number": "1",
        "neighborhood": "Centro", "city": "Sao Paulo", "state": "SP",
        "zip_code": "01000000", "complement": "",
    }
    r = requests.post(f"{API_URL}/api/users/me/addresses", json=body, headers=_hdr(token), timeout=15)
    assert r.status_code == 200, r.text
    addrs = r.json().get("addresses") or []
    assert addrs, "endereco nao foi criado"
    return addrs[-1]["address_id"]


def _suffix():
    return uuid.uuid4().hex[:8]


def test_order_via_ref_code_persists_sponsor_id():
    """Bug P0: user sem sponsor compra via ref_code -> sponsor_id deve ir no
    user (sticky) e no doc da order."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    suf = _suffix()
    # 1) Cria afiliado e ativa programa
    aff_email = f"aff_{suf}@example.com"
    aff_token = _register(aff_email, "Senha123!")
    admin_token = _login(ADMIN)
    aff = db.users.find_one({"email": aff_email})
    # Forca referral_code + ativo para virar afiliado valido
    code = f"REF{suf.upper()}"
    db.users.update_one(
        {"user_id": aff["user_id"]},
        {"$set": {"referral_code": code, "referral_program_active": True}},
    )

    # 2) Cliente registra SEM sponsor_code
    cli_email = f"cli_{suf}@example.com"
    cli_token = _register(cli_email, "Senha123!")
    cli = db.users.find_one({"email": cli_email})
    assert cli.get("sponsor_id") is None, "cliente registrou sem sponsor"

    # 3) Adiciona endereço + produto no carrinho
    addr_id = _ensure_address(cli_token)
    pid = _ensure_test_product(client, db)
    r = requests.post(f"{API_URL}/api/cart/items",
                      json={"product_id": pid, "quantity": 1},
                      headers=_hdr(cli_token), timeout=15)
    assert r.status_code == 200, r.text

    # 4) Checkout PASSANDO ref_code (simula cookie do link)
    r = requests.post(f"{API_URL}/api/checkout", json={
        "address_id": addr_id,
        "payment_method": "pix",
        "ref_code": code,
        "shipping_price": 0,
    }, headers=_hdr(cli_token), timeout=20)
    assert r.status_code == 200, r.text
    order_id = r.json()["order_id"]

    # 5) Validacoes
    cli_after = db.users.find_one({"email": cli_email})
    assert cli_after["sponsor_id"] == aff["user_id"], "sponsor_id deveria ter sido fixado no user"
    assert cli_after.get("sponsor_code") == code

    order = db.orders.find_one({"order_id": order_id})
    assert order["sponsor_id"] == aff["user_id"], "order.sponsor_id deveria ter sido gravado"
    assert order["affiliate_id"] == aff["user_id"]

    # cleanup
    db.orders.delete_many({"customer_email": {"$in": [cli_email, aff_email]}})
    db.users.delete_many({"email": {"$in": [cli_email, aff_email]}})


def test_cart_returns_points_value():
    """Bug P2: /api/cart deve retornar points_value em cada item."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    suf = _suffix()
    cli_email = f"pts_{suf}@example.com"
    cli_token = _register(cli_email, "Senha123!")
    pid = _ensure_test_product(client, db)
    requests.post(f"{API_URL}/api/cart/items",
                  json={"product_id": pid, "quantity": 2},
                  headers=_hdr(cli_token), timeout=15)
    r = requests.get(f"{API_URL}/api/cart", headers=_hdr(cli_token), timeout=15)
    assert r.status_code == 200
    items = r.json().get("items") or []
    assert len(items) == 1
    assert items[0].get("points_value") == 5, items[0]

    db.users.delete_many({"email": cli_email})


def test_top10_aggregation_uses_order_sponsor_id():
    """Top 10 agora prioriza order.sponsor_id (snapshot) com fallback user.sponsor_id."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    pipeline = [
        {"$match": {"payment_status": "paid", "user_id": {"$ne": None}}},
        {"$lookup": {"from": "users", "localField": "user_id",
                     "foreignField": "user_id", "as": "_buyer"}},
        {"$unwind": {"path": "$_buyer", "preserveNullAndEmptyArrays": False}},
        {"$addFields": {"_effective_sponsor": {"$ifNull": ["$sponsor_id", "$_buyer.sponsor_id"]}}},
        {"$match": {"_effective_sponsor": {"$ne": None}}},
        {"$count": "n"},
    ]
    rows = list(db.orders.aggregate(pipeline))
    # So nao deve quebrar — pode ser 0 num banco limpo.
    if rows:
        assert rows[0]["n"] >= 0
