"""Iter 53 — PDV/Frente de caixa: POST /api/admin/orders/manual.

Covers:
- Guest customer snapshot (name/email/cpf formatted/phone) + address (CEP + state upper).
- Existing user_id → user_id/sponsor_id inheritance + fallback fields.
- Price resolution: base / tier:N / explicit unit_price override.
- Shipping modes: pickup / free / value.
- Payment methods + installments (card=1, card_installments capped 2..12, pix=1).
- skip_points → no points_log documents for order.
- mark_paid=false → payment_status pending, no commissions/points.
- Stock decrement + insufficient stock 400.
- Validation: empty items, unknown user_id, invalid payment.method.
- Auth: 401 sem token, 403 non-admin.
"""
import os
import re
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

API_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

PDV_URL = f"{API_URL}/api/admin/orders/manual"

# --- setup/fixtures ---------------------------------------------------------

@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": "admin@oxxpharma.com", "password": "admin123"},
                      timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]

@pytest.fixture(scope="module")
def customer_token():
    # any non-admin - use maria (network_1 customer)
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": "maria@rede1.com.br", "password": "oxx@pharma"},
                      timeout=15)
    if r.status_code == 200:
        return r.json()["token"]
    return None

@pytest.fixture(scope="module")
def maria_user_id(db):
    u = db.users.find_one({"email": "maria@rede1.com.br"})
    assert u, "maria seed user missing"
    return u["user_id"]

@pytest.fixture(scope="module")
def test_product(db):
    """Create a fresh product with pricing_tiers + stock to isolate tests."""
    pid = "TESTIT53_PROD_1"
    db.products.delete_many({"product_id": pid})
    doc = {
        "product_id": pid,
        "name": "TESTIT53 Vitamina PDV",
        "slug": "testit53-vit-pdv",
        "sku": "TESTIT53SKU",
        "ean": "0000000000000",
        "price": 100.0,
        "stock": 50,
        "active": True,
        "images": ["https://example.com/x.jpg"],
        "points_value": 0.0,
        "pricing_tiers": [
            {"type": "network", "label": "Rede", "network_type": "network_1", "price": 80.0},
            {"type": "affiliate", "label": "Afiliado", "network_type": "affiliate", "price": 70.0},
        ],
        "created_at": "2026-01-01T00:00:00Z",
    }
    db.products.insert_one(doc)
    yield doc
    # cleanup — remove any test orders that referenced this product & restore
    orders = list(db.orders.find({"items.product_id": pid, "manual": True}))
    for o in orders:
        db.points_log.delete_many({"order_id": o["order_id"]})
        db.commissions.delete_many({"order_id": o["order_id"]})
    db.orders.delete_many({"items.product_id": pid, "manual": True})
    db.products.delete_many({"product_id": pid})

@pytest.fixture
def hdr(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _basic_body(product_id, **over):
    body = {
        "customer": {"name": "TESTIT53 Guest", "email": "TESTIT53@x.com",
                     "cpf": "12345678909", "phone": "11999998888",
                     "address": {"street": "Rua A", "number": "10",
                                 "neighborhood": "Centro", "city": "SP",
                                 "state": "sp", "zip_code": "01001000"}},
        "items": [{"product_id": product_id, "quantity": 1, "tier_key": "base"}],
        "shipping": {"mode": "value", "value": 10.0},
        "payment": {"method": "card"},
        "mark_paid": True,
    }
    body.update(over)
    return body


# --- 1. Guest snapshot ------------------------------------------------------

def test_guest_customer_creates_order_with_snapshot(db, hdr, test_product):
    body = _basic_body(test_product["product_id"])
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["source"] == "pdv"
    assert o["manual"] is True
    assert o["user_id"] is None
    assert o["customer_name"] == "TESTIT53 Guest"
    assert o["customer_email"] == "testit53@x.com"
    assert o["customer_cpf"] == "123.456.789-09"
    assert o["customer_cpf_digits"] == "12345678909"
    assert o["customer_phone"] == "11999998888"
    assert o["shipping_address"]["state"] == "SP"
    assert o["shipping_address"]["zip_code"] == "01001-000"
    assert o["created_by_admin"]  # populated


# --- 2. Existing user inheritance -------------------------------------------

def test_existing_user_id_inherits_sponsor(db, hdr, test_product, maria_user_id):
    body = _basic_body(test_product["product_id"], user_id=maria_user_id, customer=None)
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200, r.text
    o = r.json()
    maria = db.users.find_one({"user_id": maria_user_id})
    assert o["user_id"] == maria_user_id
    assert o["sponsor_id"] == maria.get("sponsor_id")
    assert o["customer_name"] == maria.get("name")


# --- 3. Price resolution ----------------------------------------------------

def test_price_tier_base(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["items"] = [{"product_id": test_product["product_id"], "quantity": 2, "tier_key": "base"}]
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    it = r.json()["items"][0]
    assert it["price"] == 100.0
    assert it["total"] == 200.0
    assert it["tier_applied"]["type"] == "base"


def test_price_tier_index(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["items"] = [{"product_id": test_product["product_id"], "quantity": 1, "tier_key": "tier:1"}]
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    it = r.json()["items"][0]
    assert it["price"] == 70.0
    assert it["tier_applied"]["network_type"] == "affiliate"


def test_price_unit_price_overrides_tier(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["items"] = [{"product_id": test_product["product_id"], "quantity": 1,
                       "tier_key": "tier:1", "unit_price": 12.34}]
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    it = r.json()["items"][0]
    assert it["price"] == 12.34
    assert it["tier_applied"]["type"] == "custom"


# --- 4. Shipping -----------------------------------------------------------

def test_shipping_pickup(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["shipping"] = {"mode": "pickup"}
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert o["shipping_cost"] == 0.0
    assert o["is_pickup"] is True
    assert o["shipping_carrier"] == "Local"
    assert o["shipping_service_id"] == "pickup"


def test_shipping_free(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["shipping"] = {"mode": "free"}
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert o["shipping_cost"] == 0.0
    assert o["shipping_service_id"] == "free"
    assert o.get("is_pickup") is False


def test_shipping_manual_value(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["shipping"] = {"mode": "value", "value": 15.90}
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert o["shipping_cost"] == 15.90
    assert o["shipping_service_id"] == "manual"


# --- 5. Payment --------------------------------------------------------------

def test_payment_card_installments(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["payment"] = {"method": "card_installments", "installments": 3, "notes": "obs"}
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert o["payment_method"] == "card_installments"
    assert o["payment_installments"] == 3
    assert o["payment_notes"] == "obs"


def test_payment_pix(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["payment"] = {"method": "pix"}
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert o["payment_method"] == "pix"
    assert o["payment_installments"] == 1


def test_payment_card_no_installments(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["payment"] = {"method": "card"}
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert o["payment_installments"] == 1


# --- 6. Skip flags ----------------------------------------------------------

def test_skip_points_and_maxx_no_points_log(db, hdr, test_product, maria_user_id):
    # give product some points so we can prove skip actually skips
    db.products.update_one({"product_id": test_product["product_id"]},
                           {"$set": {"points_value": 5.0}})
    try:
        body = _basic_body(test_product["product_id"], user_id=maria_user_id, customer=None,
                           skip_points=True, skip_maxx_sync=True)
        r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        assert r.json()["skip_points"] is True
        assert r.json()["skip_maxx_sync"] is True
        count = db.points_log.count_documents({"order_id": oid})
        assert count == 0, f"skip_points nao zerou points_log ({count} docs)"
    finally:
        db.products.update_one({"product_id": test_product["product_id"]},
                               {"$set": {"points_value": 0.0}})


def test_no_skip_points_creates_points_and_commissions(db, hdr, test_product, maria_user_id):
    """mark_paid=true + skip_points=false + product com points_value: cria points_log."""
    db.products.update_one({"product_id": test_product["product_id"]},
                           {"$set": {"points_value": 3.0}})
    try:
        body = _basic_body(test_product["product_id"], user_id=maria_user_id, customer=None,
                           skip_points=False, skip_maxx_sync=True)
        r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
        assert r.status_code == 200
        oid = r.json()["order_id"]
        pts = db.points_log.count_documents({"order_id": oid, "user_id": maria_user_id})
        assert pts >= 1, "points_log deveria ter pelo menos 1 doc para maria"
    finally:
        db.products.update_one({"product_id": test_product["product_id"]},
                               {"$set": {"points_value": 0.0}})


def test_mark_paid_false(db, hdr, test_product, maria_user_id):
    body = _basic_body(test_product["product_id"], user_id=maria_user_id, customer=None,
                       mark_paid=False)
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    o = r.json()
    assert o["payment_status"] == "pending"
    assert o["order_status"] == "pending"
    assert o.get("paid_at") is None
    assert db.commissions.count_documents({"order_id": o["order_id"]}) == 0
    assert db.points_log.count_documents({"order_id": o["order_id"]}) == 0


# --- 7. Stock ---------------------------------------------------------------

def test_stock_decrement(db, hdr, test_product):
    before = db.products.find_one({"product_id": test_product["product_id"]})["stock"]
    body = _basic_body(test_product["product_id"])
    body["items"] = [{"product_id": test_product["product_id"], "quantity": 2, "tier_key": "base"}]
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 200
    after = db.products.find_one({"product_id": test_product["product_id"]})["stock"]
    assert after == before - 2


def test_stock_insufficient_returns_400(db, hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["items"] = [{"product_id": test_product["product_id"], "quantity": 9999999,
                       "tier_key": "base"}]
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 400
    assert "estoque" in r.text.lower() or "insuficiente" in r.text.lower()
    assert test_product["name"] in r.text


# --- 8. Validation errors ---------------------------------------------------

def test_empty_items_400(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["items"] = []
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    # pydantic field_validator raises ValueError -> FastAPI 422
    assert r.status_code in (400, 422)


def test_unknown_user_id_404(hdr, test_product):
    body = _basic_body(test_product["product_id"], user_id="does_not_exist_xxx", customer=None)
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 404


def test_invalid_payment_method_400(hdr, test_product):
    body = _basic_body(test_product["product_id"])
    body["payment"] = {"method": "boleto"}
    r = requests.post(PDV_URL, json=body, headers=hdr, timeout=20)
    assert r.status_code == 400


# --- 9. Auth ----------------------------------------------------------------

def test_no_token_401(test_product):
    body = _basic_body(test_product["product_id"])
    r = requests.post(PDV_URL, json=body, timeout=15)
    assert r.status_code in (401, 403)


def test_non_admin_403(customer_token, test_product):
    if not customer_token:
        pytest.skip("customer token not available")
    body = _basic_body(test_product["product_id"])
    r = requests.post(PDV_URL, json=body,
                      headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
    assert r.status_code == 403
