"""Iter 43.5: Page Builder por tenant + preview de marca."""
import os
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN = {"email": "admin@oxxpharma.com", "password": "admin123"}


def _login():
    return requests.post(f"{API_URL}/api/auth/login", json=ADMIN, timeout=15).json()["token"]


def _h(token, tenant=None):
    h = {"Authorization": f"Bearer {token}"}
    if tenant:
        h["X-Tenant"] = tenant
    return h


def test_public_page_returns_default_for_home_when_no_layout():
    r = requests.get(f"{API_URL}/api/pages/home", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["slug"] == "home"
    assert isinstance(d["blocks"], list)


def test_admin_can_save_layout_per_tenant():
    token = _login()
    # Salva layout para oxxpharma
    payload = {"blocks": [
        {"id": "blk_1", "type": "hero", "props": {"title": "OXX Home", "cta_label": "Loja", "cta_link": "/loja"}},
        {"id": "blk_2", "type": "section_title", "props": {"title": "Destaques"}},
        {"id": "blk_3", "type": "product_grid", "props": {"source": "featured", "limit": 4, "columns": 4}},
    ], "published": True}
    r = requests.put(f"{API_URL}/api/admin/pages/home?tenant=oxxpharma",
                     json=payload, headers=_h(token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["tenant_id"] == "oxxpharma"
    assert d["published"] is True
    assert len(d["blocks"]) == 3

    # Salva layout DIFERENTE para pharmakon
    payload2 = {"blocks": [
        {"id": "blk_p1", "type": "hero", "props": {"title": "Pharmakon Home"}},
    ], "published": True}
    r2 = requests.put(f"{API_URL}/api/admin/pages/home?tenant=pharmakon",
                      json=payload2, headers=_h(token), timeout=15)
    assert r2.status_code == 200
    assert r2.json()["blocks"][0]["props"]["title"] == "Pharmakon Home"

    # Publico le baseado em tenant resolvido por header
    rp1 = requests.get(f"{API_URL}/api/pages/home", timeout=10)
    # Sem header pharmakon, deve cair em oxxpharma
    assert rp1.json()["blocks"][0]["props"]["title"] == "OXX Home"
    rp2 = requests.get(f"{API_URL}/api/pages/home", headers={"X-Tenant": "pharmakon"}, timeout=10)
    assert rp2.json()["blocks"][0]["props"]["title"] == "Pharmakon Home"


def test_invalid_block_type_is_filtered_out():
    token = _login()
    payload = {"blocks": [
        {"id": "good", "type": "hero", "props": {"title": "Ok"}},
        {"id": "bad", "type": "BLOCK_INEXISTENTE", "props": {}},
    ], "published": False}
    r = requests.put(f"{API_URL}/api/admin/pages/home?tenant=oxxpharma",
                     json=payload, headers=_h(token), timeout=15)
    assert r.status_code == 200
    blocks = r.json()["blocks"]
    assert len(blocks) == 1
    assert blocks[0]["type"] == "hero"


def test_resolve_product_list_endpoint():
    """Endpoint usado pelos blocos product_grid (publico)."""
    r = requests.get(f"{API_URL}/api/pages/_resolve/product-list?source=featured&limit=4", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert "products" in d
    assert isinstance(d["products"], list)
