"""
OxxPharma E-commerce MVP - Backend Tests
Covers: auth, referrals, products, cart, addresses, checkout, commissions, admin, payments
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://oxx-franchise-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


def _unique_email(tag: str) -> str:
    return f"test_{tag}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}@test.com"


@pytest.fixture(scope="session")
def s_admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def customer_a():
    s = requests.Session()
    email = _unique_email("A")
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Cliente A"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"session": s, "email": email, "user": data["user"], "referral_code": data["user"]["referral_code"]}


@pytest.fixture(scope="session")
def customer_b(customer_a):
    """Cliente B indicado por A (via sponsor_code no register)"""
    s = requests.Session()
    email = _unique_email("B")
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "pass1234", "name": "Cliente B",
        "sponsor_code": customer_a["referral_code"],
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "user": r.json()["user"]}


# ==================== HEALTH ====================
def test_health():
    r = requests.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ==================== AUTH ====================
class TestAuth:
    def test_register_generates_referral_code(self):
        email = _unique_email("reg")
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Reg User"})
        assert r.status_code == 200
        user = r.json()["user"]
        assert user["email"] == email
        assert user["role"] == "customer"
        assert user.get("referral_code") and len(user["referral_code"]) == 8
        assert user.get("sponsor_id") is None

    def test_register_with_sponsor_code(self, customer_a):
        email = _unique_email("spons")
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "pass1234", "name": "Spons User",
            "sponsor_code": customer_a["referral_code"],
        })
        assert r.status_code == 200
        user = r.json()["user"]
        assert user["sponsor_id"] == customer_a["user"]["user_id"]
        assert user["sponsor_code"] == customer_a["referral_code"]

    def test_register_invalid_sponsor_code_ignored(self):
        email = _unique_email("badspons")
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "pass1234", "name": "Bad Spons",
            "sponsor_code": "ZZZZZZZZ",
        })
        assert r.status_code == 200
        assert r.json()["user"]["sponsor_id"] is None

    def test_register_duplicate_email(self, customer_a):
        r = requests.post(f"{API}/auth/register", json={"email": customer_a["email"], "password": "x", "name": "x"})
        assert r.status_code == 400

    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d
        # Admin identified by access_level <= 1 OR role=="admin"
        u = d["user"]
        assert u.get("role") == "admin" or u.get("access_level", 99) <= 1

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me_requires_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ==================== REFERRAL VALIDATE ====================
class TestReferralValidate:
    def test_valid_code(self, customer_a):
        r = requests.get(f"{API}/referrals/validate/{customer_a['referral_code']}")
        assert r.status_code == 200
        d = r.json()
        assert d["valid"] is True
        assert d["affiliate_name"] == "Cliente A"

    def test_invalid_code(self):
        r = requests.get(f"{API}/referrals/validate/ZZZZZZZZ")
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_code_case_insensitive(self, customer_a):
        r = requests.get(f"{API}/referrals/validate/{customer_a['referral_code'].lower()}")
        assert r.status_code == 200
        assert r.json()["valid"] is True


# ==================== CATEGORIES & PRODUCTS (PUBLIC) ====================
class TestPublicCatalog:
    def test_list_categories(self):
        r = requests.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert len(cats) >= 6

    def test_list_products(self):
        r = requests.get(f"{API}/products")
        assert r.status_code == 200
        d = r.json()
        assert "products" in d and "total" in d and "pages" in d
        assert len(d["products"]) >= 1

    def test_products_filter_category(self):
        r = requests.get(f"{API}/products", params={"category": "Vitaminas e Suplementos"})
        assert r.status_code == 200
        for p in r.json()["products"]:
            assert p["category"].lower() == "vitaminas e suplementos"

    def test_products_search(self):
        r = requests.get(f"{API}/products", params={"search": "Vitamina"})
        assert r.status_code == 200
        assert r.json()["total"] >= 1

    def test_products_featured(self):
        r = requests.get(f"{API}/products", params={"featured": "true"})
        assert r.status_code == 200
        for p in r.json()["products"]:
            assert p.get("featured") is True

    def test_featured_endpoint(self):
        r = requests.get(f"{API}/products/featured")
        assert r.status_code == 200
        assert len(r.json()["products"]) >= 1

    def test_get_product_detail(self):
        plist = requests.get(f"{API}/products").json()["products"]
        pid = plist[0]["product_id"]
        r = requests.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        d = r.json()
        assert d["product"]["product_id"] == pid
        assert "related" in d

    def test_get_product_not_found(self):
        r = requests.get(f"{API}/products/nonexistent")
        assert r.status_code == 404


# ==================== CART ====================
class TestCart:
    def test_cart_requires_auth(self):
        r = requests.get(f"{API}/cart")
        assert r.status_code == 401

    def test_add_update_remove_cart(self, customer_a):
        s = customer_a["session"]
        pid = requests.get(f"{API}/products").json()["products"][0]["product_id"]
        r = s.post(f"{API}/cart/items", json={"product_id": pid, "quantity": 2})
        assert r.status_code == 200
        assert r.json()["count"] >= 1
        # Update
        r = s.put(f"{API}/cart/items/{pid}", json={"quantity": 3})
        assert r.status_code == 200
        # Remove
        r = s.delete(f"{API}/cart/items/{pid}")
        assert r.status_code == 200
        assert r.json()["count"] == 0

    def test_add_invalid_product(self, customer_a):
        r = customer_a["session"].post(f"{API}/cart/items", json={"product_id": "x", "quantity": 1})
        assert r.status_code == 404

    def test_add_exceeds_stock(self, customer_a):
        pid = requests.get(f"{API}/products").json()["products"][0]["product_id"]
        r = customer_a["session"].post(f"{API}/cart/items", json={"product_id": pid, "quantity": 999999})
        assert r.status_code == 400


# ==================== ADDRESSES ====================
class TestAddresses:
    def test_crud_address(self, customer_a):
        s = customer_a["session"]
        payload = {"label": "Casa", "street": "Rua X", "number": "100", "neighborhood": "Centro",
                   "city": "SP", "state": "SP", "zip_code": "01000-000", "is_default": True}
        r = s.post(f"{API}/users/me/addresses", json=payload)
        assert r.status_code == 200
        addrs = r.json()["addresses"]
        assert len(addrs) >= 1
        aid = addrs[-1]["address_id"]
        # GET
        r = s.get(f"{API}/users/me/addresses")
        assert r.status_code == 200
        # UPDATE
        payload["city"] = "RJ"
        r = s.put(f"{API}/users/me/addresses/{aid}", json=payload)
        assert r.status_code == 200
        assert any(a["city"] == "RJ" for a in r.json()["addresses"])
        # Dont DELETE (needed for checkout)


# ==================== CHECKOUT + COMMISSION FLOW ====================
class TestCheckoutFlow:
    def test_checkout_generates_commission_via_sponsor(self, customer_a, customer_b):
        """B is sponsored by A; checkout should auto-generate 8% commission for A."""
        sb = customer_b["session"]
        # Add address
        addr_payload = {"label": "Casa", "street": "Rua B", "number": "50", "neighborhood": "Bairro",
                        "city": "SP", "state": "SP", "zip_code": "02000-000", "is_default": True}
        ar = sb.post(f"{API}/users/me/addresses", json=addr_payload)
        assert ar.status_code == 200
        aid = ar.json()["addresses"][-1]["address_id"]
        # Add product to cart
        prods = requests.get(f"{API}/products").json()["products"]
        pid = prods[0]["product_id"]
        price = prods[0].get("discount_price") or prods[0]["price"]
        sb.post(f"{API}/cart/items", json={"product_id": pid, "quantity": 2})
        # Checkout
        r = sb.post(f"{API}/checkout", json={"address_id": aid, "payment_method": "pix"})
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["affiliate_id"] == customer_a["user"]["user_id"]
        assert order["affiliate_code"] == customer_a["referral_code"]
        expected_commission = round(price * 2 * 0.08, 2)
        assert abs(order["affiliate_commission"] - expected_commission) < 0.02
        assert order["shipping_cost"] == 15.90
        assert order["payment_status"] == "pending"
        # Save for next tests
        pytest.shared_order_id = order["order_id"]
        pytest.shared_commission_expected = expected_commission

    def test_a_sees_pending_commission(self, customer_a):
        r = customer_a["session"].get(f"{API}/users/me/commissions")
        assert r.status_code == 200
        comms = r.json()["commissions"]
        assert any(c["order_id"] == pytest.shared_order_id and c["status"] == "pending" for c in comms)

    def test_referral_stats_for_a(self, customer_a):
        r = customer_a["session"].get(f"{API}/users/me/referral")
        assert r.status_code == 200
        d = r.json()
        assert d["commission_rate"] == 0.08
        assert d["referrals_count"] >= 1
        assert d["stats"]["pending"] >= pytest.shared_commission_expected - 0.02

    def test_mock_confirm_payment_marks_commission_paid(self, customer_b, customer_a):
        r = customer_b["session"].post(f"{API}/payments/mock/confirm/{pytest.shared_order_id}")
        assert r.status_code == 200
        assert r.json()["payment_status"] == "paid"
        # Check commission is now paid
        r2 = customer_a["session"].get(f"{API}/users/me/commissions")
        comms = r2.json()["commissions"]
        comm = next(c for c in comms if c["order_id"] == pytest.shared_order_id)
        assert comm["status"] == "paid"

    def test_checkout_with_ref_code_no_sponsor(self, customer_a):
        """User without sponsor_id can still generate commission via ref_code in checkout body."""
        s = requests.Session()
        email = _unique_email("nosponsor")
        s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "NoSponsor"})
        addr = {"label": "Casa", "street": "Rua Z", "number": "1", "neighborhood": "C",
                "city": "SP", "state": "SP", "zip_code": "01000-000", "is_default": True}
        aid = s.post(f"{API}/users/me/addresses", json=addr).json()["addresses"][-1]["address_id"]
        pid = requests.get(f"{API}/products").json()["products"][0]["product_id"]
        s.post(f"{API}/cart/items", json={"product_id": pid, "quantity": 1})
        r = s.post(f"{API}/checkout", json={"address_id": aid, "payment_method": "pix",
                                            "ref_code": customer_a["referral_code"]})
        assert r.status_code == 200
        order = r.json()
        assert order["affiliate_id"] == customer_a["user"]["user_id"]
        assert order["affiliate_commission"] > 0

    def test_checkout_empty_cart(self, customer_a):
        # cart was cleared after previous checkouts; try checkout with empty cart
        s = requests.Session()
        email = _unique_email("empty")
        s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Empty"})
        addr = {"label": "x", "street": "x", "number": "1", "neighborhood": "x",
                "city": "SP", "state": "SP", "zip_code": "01000-000", "is_default": True}
        aid = s.post(f"{API}/users/me/addresses", json=addr).json()["addresses"][-1]["address_id"]
        r = s.post(f"{API}/checkout", json={"address_id": aid, "payment_method": "pix"})
        assert r.status_code == 400


# ==================== ADMIN ====================
class TestAdmin:
    def test_admin_dashboard(self, s_admin):
        r = s_admin.get(f"{API}/admin/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "total_orders", "total_revenue", "orders_by_status"]:
            assert k in d

    def test_admin_list_users(self, s_admin):
        r = s_admin.get(f"{API}/admin/users")
        assert r.status_code == 200
        assert "users" in r.json()

    def test_admin_list_orders(self, s_admin):
        r = s_admin.get(f"{API}/admin/orders")
        assert r.status_code == 200
        assert "orders" in r.json()

    def test_admin_crud_category(self, s_admin):
        payload = {"name": f"TEST_CAT_{int(time.time())}", "description": "t", "order": 99, "active": True}
        r = s_admin.post(f"{API}/admin/categories", json=payload)
        assert r.status_code == 200
        cid = r.json()["category_id"]
        # Update
        payload["description"] = "updated"
        r2 = s_admin.put(f"{API}/admin/categories/{cid}", json=payload)
        assert r2.status_code == 200
        assert r2.json()["description"] == "updated"
        # Delete
        r3 = s_admin.delete(f"{API}/admin/categories/{cid}")
        assert r3.status_code == 200

    def test_admin_crud_product(self, s_admin):
        payload = {"name": f"TEST_PROD_{int(time.time())}", "description": "t", "price": 10.0,
                   "category": "Medicamentos", "images": ["data:image/png;base64,iVBORw0KG"],
                   "stock": 5, "active": True, "featured": False}
        r = s_admin.post(f"{API}/admin/products", json=payload)
        assert r.status_code == 200
        pid = r.json()["product_id"]
        # Verify persisted via GET
        gr = requests.get(f"{API}/products/{pid}")
        assert gr.status_code == 200
        # Update
        payload["price"] = 20.0
        r2 = s_admin.put(f"{API}/admin/products/{pid}", json=payload)
        assert r2.status_code == 200
        assert r2.json()["price"] == 20.0
        # Delete
        r3 = s_admin.delete(f"{API}/admin/products/{pid}")
        assert r3.status_code == 200
        # Verify 404 after delete
        assert requests.get(f"{API}/products/{pid}").status_code == 404

    def test_admin_update_order_status(self, s_admin):
        # Use shared order if exists
        oid = getattr(pytest, "shared_order_id", None)
        if not oid:
            pytest.skip("No order available")
        r = s_admin.put(f"{API}/admin/orders/{oid}/status", json={"status": "shipped"})
        assert r.status_code == 200
        assert r.json()["order_status"] == "shipped"

    def test_customer_blocked_from_admin(self, customer_a):
        r = customer_a["session"].get(f"{API}/admin/dashboard")
        assert r.status_code == 403

    def test_unauth_blocked_from_admin(self):
        r = requests.get(f"{API}/admin/dashboard")
        assert r.status_code == 401
