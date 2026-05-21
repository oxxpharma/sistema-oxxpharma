"""Iter 43: Multi-tenant — Fase 1 (backbone)."""
import os
import uuid
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN = {"email": "admin@oxxpharma.com", "password": "admin123"}


def _login():
    return requests.post(f"{API_URL}/api/auth/login", json=ADMIN, timeout=15).json()["token"]


def test_tenant_current_default_oxxpharma():
    r = requests.get(f"{API_URL}/api/tenant/current", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["tenant_id"] == "oxxpharma"
    assert "name" in d and "theme" in d


def test_tenant_resolution_via_x_tenant_header():
    r = requests.get(f"{API_URL}/api/tenant/current",
                     headers={"X-Tenant": "pharmakon"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["tenant_id"] == "pharmakon"


def test_admin_tenants_lists_both():
    token = _login()
    r = requests.get(f"{API_URL}/api/admin/tenants",
                     headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r.status_code == 200
    ids = sorted([t["tenant_id"] for t in r.json().get("items", [])])
    assert ids == ["oxxpharma", "pharmakon"]


def test_brands_unified_toggle():
    token = _login()
    h = {"Authorization": f"Bearer {token}"}
    # liga
    r = requests.put(f"{API_URL}/api/admin/brands-unified", json={"enabled": True}, headers=h, timeout=15)
    assert r.status_code == 200 and r.json()["enabled"] is True
    # com fusao ligada, tenant/current sempre retorna primary
    r2 = requests.get(f"{API_URL}/api/tenant/current",
                      headers={"X-Tenant": "pharmakon"}, timeout=10)
    assert r2.json()["tenant_id"] == "oxxpharma"
    # desliga
    r3 = requests.put(f"{API_URL}/api/admin/brands-unified", json={"enabled": False}, headers=h, timeout=15)
    assert r3.status_code == 200 and r3.json()["enabled"] is False
    # volta a respeitar header
    r4 = requests.get(f"{API_URL}/api/tenant/current",
                      headers={"X-Tenant": "pharmakon"}, timeout=10)
    assert r4.json()["tenant_id"] == "pharmakon"


def test_backfill_marked_existing_orders():
    """Todos os pedidos existentes ja foram marcados com tenant=oxxpharma no startup."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    n_without = db.orders.count_documents({"tenant": {"$exists": False}})
    assert n_without == 0


def test_product_supports_sku_ean_and_tenant_price():
    """Criar produto com SKU/EAN/price_by_tenant e ler usando X-Tenant."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    token = _login()
    h = {"Authorization": f"Bearer {token}"}
    suf = uuid.uuid4().hex[:6]
    payload = {
        "name": f"Prod Test {suf}",
        "description": "teste",
        "price": 100.0,
        "category": "Vitaminas",
        "stock": 10,
        "active": True,
        "sku": f"SKU-{suf}",
        "ean": f"789{suf}{'0' * (10 - len(suf))}"[:13],
        "price_by_tenant": {"pharmakon": 89.90},
    }
    r = requests.post(f"{API_URL}/api/admin/products", json=payload, headers=h, timeout=20)
    assert r.status_code == 200, r.text
    pid = r.json()["product_id"]
    # Le como Oxxpharma (default) - usa preco base
    r1 = requests.get(f"{API_URL}/api/products/{pid}", timeout=10)
    assert r1.status_code == 200
    p1 = r1.json()["product"]
    assert p1["sku"] == f"SKU-{suf}"
    assert p1["ean"]
    assert float(p1.get("effective_price") or p1.get("price")) == 100.0
    # Le como pharmakon - usa override
    r2 = requests.get(f"{API_URL}/api/products/{pid}",
                      headers={"X-Tenant": "pharmakon"}, timeout=10)
    p2 = r2.json()["product"]
    assert float(p2.get("effective_price") or p2.get("price")) == 89.90
    # cleanup
    db.products.delete_one({"product_id": pid})
