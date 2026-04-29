"""Iteration 17 - Admin user mgmt, MercadoPago real, Points system."""
import os, uuid, requests, pytest

def _load_backend_url():
    v = os.environ.get('REACT_APP_BACKEND_URL')
    if not v:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    v = line.split('=', 1)[1].strip()
                    break
    return v.rstrip('/')
BASE_URL = _load_backend_url()
ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASS = "admin123"

def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    s.cookies.clear()  # prefer bearer
    return s, token

@pytest.fixture(scope="module")
def admin():
    s, tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    return s

@pytest.fixture(scope="module")
def customer():
    tag = uuid.uuid4().hex[:6]
    email = f"test_it17_{tag}@ex.com"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "pass123", "name": f"Test {tag}", "phone": "11999"})
    assert r.status_code == 200
    tok = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    user_id = r.json()["user"]["user_id"]
    return s, email, user_id

def test_health():
    r = requests.get(f"{BASE_URL}/api/health")
    # accept 404 if not defined, or 200
    assert r.status_code in (200, 404)

def test_payments_config_public():
    r = requests.get(f"{BASE_URL}/api/payments/config")
    assert r.status_code == 200
    d = r.json()
    assert d.get("environment") == "test"
    assert d.get("configured") is True
    assert d.get("public_key", "").startswith("APP_USR-")

def test_admin_payments_config_get(admin):
    r = admin.get(f"{BASE_URL}/api/admin/payments-config")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("mp_environment") == "test"
    assert d.get("test_configured") is True
    assert d.get("prod_configured") is False

def test_admin_payments_config_set_test(admin):
    r = admin.put(f"{BASE_URL}/api/admin/payments-config", json={"mp_environment": "test"})
    assert r.status_code == 200, r.text

def test_admin_payments_config_set_prod_blocked(admin):
    r = admin.put(f"{BASE_URL}/api/admin/payments-config", json={"mp_environment": "production"})
    assert r.status_code == 400, f"expected 400 since prod not configured: {r.status_code} {r.text}"

def test_admin_edit_user(admin, customer):
    _, _, uid = customer
    r = admin.put(f"{BASE_URL}/api/admin/users/{uid}", json={"name": "Updated Name", "phone": "11888"})
    assert r.status_code == 200, r.text
    g = admin.get(f"{BASE_URL}/api/admin/users/{uid}")
    assert g.json().get("name") == "Updated Name"

def test_admin_edit_user_duplicate_email(admin, customer):
    _, _, uid = customer
    r = admin.put(f"{BASE_URL}/api/admin/users/{uid}", json={"email": ADMIN_EMAIL})
    assert r.status_code == 400

def test_admin_toggle_status(admin, customer):
    _, _, uid = customer
    r = admin.post(f"{BASE_URL}/api/admin/users/{uid}/toggle-status")
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "inactive"
    # toggle back
    r2 = admin.post(f"{BASE_URL}/api/admin/users/{uid}/toggle-status")
    assert r2.json().get("status") == "active"

def test_login_blocked_when_inactive(admin):
    # create fresh user, deactivate, attempt login
    tag = uuid.uuid4().hex[:6]
    email = f"test_it17_inactive_{tag}@ex.com"
    rr = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "pass123", "name": "X"})
    assert rr.status_code == 200
    uid = rr.json()["user"]["user_id"]
    admin.post(f"{BASE_URL}/api/admin/users/{uid}/toggle-status")
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "pass123"})
    assert r.status_code == 401
    # cleanup
    admin.delete(f"{BASE_URL}/api/admin/users/{uid}")

def test_admin_send_password_reset(admin, customer):
    _, _, uid = customer
    r = admin.post(f"{BASE_URL}/api/admin/users/{uid}/send-password-reset")
    assert r.status_code == 200, r.text
    link = r.json().get("reset_link") or r.json().get("link")
    assert link and ("redefinir-senha" in link or "token=" in link)

def test_admin_send_first_access(admin, customer):
    _, _, uid = customer
    r = admin.post(f"{BASE_URL}/api/admin/users/{uid}/send-first-access")
    assert r.status_code == 200, r.text
    link = r.json().get("link") or r.json().get("reset_link") or ""
    assert "primeiro-acesso" in link or "token=" in link

def test_password_reset_request_always_ok():
    r = requests.post(f"{BASE_URL}/api/auth/password-reset/request", json={"email": "nonexistent_xyz@ex.com"})
    assert r.status_code == 200
    assert r.json().get("ok") is True

def test_password_reset_validate_invalid():
    r = requests.get(f"{BASE_URL}/api/auth/password-reset/validate", params={"token": "INVALID_TOKEN_XYZ"})
    assert r.status_code == 400

def test_password_reset_full_flow(admin, customer):
    _, email, uid = customer
    rr = admin.post(f"{BASE_URL}/api/admin/users/{uid}/send-password-reset")
    link = rr.json().get("reset_link") or rr.json().get("link") or ""
    token = link.split("token=")[-1] if "token=" in link else rr.json().get("token")
    assert token
    val = requests.get(f"{BASE_URL}/api/auth/password-reset/validate", params={"token": token})
    assert val.status_code == 200, val.text
    # short password rejected
    bad = requests.post(f"{BASE_URL}/api/auth/password-reset/confirm", json={"token": token, "password": "123"})
    assert bad.status_code == 400
    # change password
    new = requests.post(f"{BASE_URL}/api/auth/password-reset/confirm", json={"token": token, "password": "newpass456"})
    assert new.status_code == 200, new.text
    # login with new
    lg = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "newpass456"})
    assert lg.status_code == 200

def test_product_points_value(admin):
    payload = {"name": f"TestP_{uuid.uuid4().hex[:4]}", "description": "d", "price": 10.0, "category": "Bem-estar", "stock": 50, "points_value": 15}
    r = admin.post(f"{BASE_URL}/api/admin/products", json=payload)
    assert r.status_code == 200, r.text
    pid = r.json()["product_id"]
    assert r.json().get("points_value") == 15
    admin.delete(f"{BASE_URL}/api/admin/products/{pid}")

def test_points_report_endpoint(admin):
    r = admin.get(f"{BASE_URL}/api/admin/points-report")
    assert r.status_code == 200, r.text
    data = r.json()
    # Accept list or wrapped format
    logs = data if isinstance(data, list) else data.get("logs") or data.get("items") or []
    assert isinstance(logs, list)

def test_points_export_csv(admin):
    r = admin.get(f"{BASE_URL}/api/admin/points-report/export.csv")
    assert r.status_code == 200, r.text
    # Should start with BOM
    assert r.content.startswith(b"\xef\xbb\xbf") or "text/csv" in r.headers.get("content-type", "")

def test_create_payment_mp_real(admin, customer):
    s, email, uid = customer
    # login fresh to ensure password is newpass456 (from previous test) OR pass123
    # skip if password changed - use admin-added address + product
    # add address
    addr = s.post(f"{BASE_URL}/api/users/me/addresses", json={"street": "X", "number": "1", "neighborhood": "Y", "city": "SP", "state": "SP", "zip_code": "00000-000", "is_default": True})
    if addr.status_code != 200:
        pytest.skip(f"addr add failed: {addr.status_code}")
    aid = addr.json()["addresses"][0]["address_id"]
    # get a product
    prods = requests.get(f"{BASE_URL}/api/products").json()["products"]
    if not prods:
        pytest.skip("no products")
    pid = prods[0]["product_id"]
    s.post(f"{BASE_URL}/api/cart/items", json={"product_id": pid, "quantity": 1})
    co = s.post(f"{BASE_URL}/api/checkout", json={"address_id": aid, "payment_method": "credit_card"})
    assert co.status_code == 200, co.text
    oid = co.json()["order_id"]
    pay = s.post(f"{BASE_URL}/api/payments/create/{oid}")
    assert pay.status_code == 200, pay.text
    url = pay.json().get("payment_url", "")
    assert pay.json().get("provider") == "mercadopago"
    assert "mercadopago.com" in url
    # Mark order as paid via admin
    ms = admin.put(f"{BASE_URL}/api/admin/orders/{oid}/status", json={"status": "paid"})
    assert ms.status_code == 200
    # Idempotency: mark again
    ms2 = admin.put(f"{BASE_URL}/api/admin/orders/{oid}/status", json={"status": "paid"})
    assert ms2.status_code == 200

def test_webhook_permissive(admin):
    fake_id = uuid.uuid4().hex[:10]
    r = requests.post(f"{BASE_URL}/api/payments/webhook/mercadopago", json={"type": "payment", "data": {"id": fake_id}})
    # permissive mode => 200 (even if payment fetch fails)
    assert r.status_code == 200, r.text
    # verify logged
    logs = admin.get(f"{BASE_URL}/api/admin/payments-webhook-logs")
    assert logs.status_code == 200, logs.text

def test_admin_hard_delete_user(admin):
    tag = uuid.uuid4().hex[:6]
    email = f"test_it17_del_{tag}@ex.com"
    rr = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "pass123", "name": "Del"})
    uid = rr.json()["user"]["user_id"]
    r = admin.delete(f"{BASE_URL}/api/admin/users/{uid}")
    assert r.status_code in (200, 204)
    g = admin.get(f"{BASE_URL}/api/admin/users/{uid}")
    assert g.status_code == 404
