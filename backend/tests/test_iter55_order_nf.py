"""Iter 55 — Order Nota Fiscal (NF) endpoints tests.
Tests POST/GET/DELETE /api/admin/orders/{order_id}/nf with audit trail.
"""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://oxx-franchise-system.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"
CUSTOMER_EMAIL = "joao@rede1.com.br"
CUSTOMER_PASSWORD = "oxx@pharma"


# ------------------- Fixtures -------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    j = r.json()
    return j.get("token") or j.get("access_token")


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Customer login failed: {r.status_code}")
    j = r.json()
    return j.get("token") or j.get("access_token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def order_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/orders?limit=5", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    orders = r.json().get("orders") or []
    if not orders:
        pytest.skip("No orders available for testing")
    return orders[0]["order_id"]


def _pdf_data_url(size_kb=2):
    payload = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n" + (b"X" * (size_kb * 1024))
    return "data:application/pdf;base64," + base64.b64encode(payload).decode()


# ------------------- Auth tests -------------------
class TestNfAuth:
    def test_post_nf_no_token_401(self, order_id):
        r = requests.post(f"{BASE_URL}/api/admin/orders/{order_id}/nf", json={"data": _pdf_data_url()}, timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 no auth, got {r.status_code}"

    def test_post_nf_customer_403(self, order_id, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/orders/{order_id}/nf",
            json={"data": _pdf_data_url()},
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_get_nf_no_token_401(self, order_id):
        r = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/nf", timeout=15)
        assert r.status_code in (401, 403)

    def test_delete_nf_customer_403(self, order_id, customer_token):
        r = requests.delete(
            f"{BASE_URL}/api/admin/orders/{order_id}/nf",
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code == 403


# ------------------- Validation tests -------------------
class TestNfValidation:
    def test_post_invalid_format_no_data_prefix(self, order_id, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/orders/{order_id}/nf", json={"data": "notadataurl"}, headers=admin_headers, timeout=15)
        assert r.status_code == 400
        assert "data URL" in r.json().get("detail", "") or "invalido" in r.json().get("detail", "").lower()

    def test_post_malformed_data_url(self, order_id, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/orders/{order_id}/nf", json={"data": "data:application/pdf"}, headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_post_too_large(self, order_id, admin_headers):
        # 9MB payload
        big = "data:application/pdf;base64," + base64.b64encode(b"X" * (9 * 1024 * 1024)).decode()
        r = requests.post(f"{BASE_URL}/api/admin/orders/{order_id}/nf", json={"data": big}, headers=admin_headers, timeout=30)
        assert r.status_code == 400
        assert "8 MB" in r.json().get("detail", "") or "grande" in r.json().get("detail", "").lower()

    def test_post_order_not_found(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/orders/nonexistent_order_xyz/nf", json={"data": _pdf_data_url()}, headers=admin_headers, timeout=15)
        assert r.status_code == 404

    def test_get_nf_not_uploaded_404(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/orders/nonexistent_order_xyz/nf", headers=admin_headers, timeout=15)
        assert r.status_code == 404

    def test_delete_nf_order_not_found(self, admin_headers):
        r = requests.delete(f"{BASE_URL}/api/admin/orders/nonexistent_order_xyz/nf", headers=admin_headers, timeout=15)
        assert r.status_code == 404


# ------------------- CRUD flow -------------------
class TestNfCrudFlow:
    def test_full_upload_replace_delete_flow(self, order_id, admin_headers):
        # 0) Cleanup previous state
        requests.delete(f"{BASE_URL}/api/admin/orders/{order_id}/nf", headers=admin_headers, timeout=15)

        # 1) Upload first NF (PDF)
        pdf1 = _pdf_data_url(2)
        r = requests.post(
            f"{BASE_URL}/api/admin/orders/{order_id}/nf",
            json={"data": pdf1, "name": "TEST_nf_v1.pdf"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["order_id"] == order_id
        meta = body["nf_meta"]
        assert meta["name"] == "TEST_nf_v1.pdf"
        assert meta["mime"] == "application/pdf"
        assert meta["size"] > 0
        assert meta["uploaded_by"]
        assert meta["uploaded_by_name"]
        assert meta["uploaded_at"]

        # 2) GET to verify data_url is persisted
        r = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/nf", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        doc = r.json()
        assert doc["order_id"] == order_id
        assert doc["data_url"].startswith("data:application/pdf;base64,")
        assert doc["name"] == "TEST_nf_v1.pdf"
        assert doc["mime"] == "application/pdf"

        # 3) Verify list endpoint returns nf_meta but NOT data_url
        r = requests.get(f"{BASE_URL}/api/admin/orders?search={order_id}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        listed = next((o for o in r.json()["orders"] if o["order_id"] == order_id), None)
        assert listed is not None
        assert "nf_meta" in listed
        assert listed["nf_meta"]["name"] == "TEST_nf_v1.pdf"
        assert "data_url" not in listed  # heavy payload not in list

        # 4) Replace: upload second NF (XML)
        xml_data = "data:text/xml;base64," + base64.b64encode(b"<?xml version='1.0'?><nfe/>").decode()
        r = requests.post(
            f"{BASE_URL}/api/admin/orders/{order_id}/nf",
            json={"data": xml_data, "name": "TEST_nf_v2.xml"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200
        meta2 = r.json()["nf_meta"]
        assert meta2["name"] == "TEST_nf_v2.xml"
        assert meta2["mime"] == "text/xml"

        # 5) Verify nf_history has replaced entry (via GET of order in list)
        r = requests.get(f"{BASE_URL}/api/admin/orders?search={order_id}", headers=admin_headers, timeout=15)
        listed = next((o for o in r.json()["orders"] if o["order_id"] == order_id), None)
        assert listed is not None
        history = listed.get("nf_history") or []
        assert len(history) >= 1, f"nf_history should have at least 1 entry after replace, got {history}"
        last = history[-1]
        assert last["name"] == "TEST_nf_v1.pdf"
        assert "replaced_at" in last
        assert "replaced_by" in last
        assert "replaced_by_name" in last

        # 6) Verify GET returns the new data (v2)
        r = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/nf", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_nf_v2.xml"

        # 7) DELETE
        r = requests.delete(f"{BASE_URL}/api/admin/orders/{order_id}/nf", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["success"] is True

        # 8) GET after delete -> 404
        r = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/nf", headers=admin_headers, timeout=15)
        assert r.status_code == 404

        # 9) DELETE again -> 404 (no NF)
        r = requests.delete(f"{BASE_URL}/api/admin/orders/{order_id}/nf", headers=admin_headers, timeout=15)
        assert r.status_code == 404

        # 10) Verify nf_history preserved deletion entry
        r = requests.get(f"{BASE_URL}/api/admin/orders?search={order_id}", headers=admin_headers, timeout=15)
        listed = next((o for o in r.json()["orders"] if o["order_id"] == order_id), None)
        assert listed is not None
        assert "nf_meta" not in listed or listed.get("nf_meta") is None
        history = listed.get("nf_history") or []
        deleted_entries = [h for h in history if "deleted_at" in h]
        assert len(deleted_entries) >= 1, "expected deletion entry in nf_history"
        assert deleted_entries[-1]["name"] == "TEST_nf_v2.xml"
        assert "deleted_by_name" in deleted_entries[-1]

    def test_image_upload(self, admin_headers):
        # Try on another order
        r = requests.get(f"{BASE_URL}/api/admin/orders?limit=5", headers=admin_headers, timeout=15)
        orders = r.json()["orders"]
        target = next((o for o in orders if not o.get("nf_meta")), None)
        if not target:
            pytest.skip("no order without nf_meta available")
        oid = target["order_id"]
        img_data = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0FAKE_JPEG_DATA" * 20).decode()
        r = requests.post(f"{BASE_URL}/api/admin/orders/{oid}/nf", json={"data": img_data, "name": "TEST_nf.jpg"}, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["nf_meta"]["mime"] == "image/jpeg"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/orders/{oid}/nf", headers=admin_headers, timeout=15)
