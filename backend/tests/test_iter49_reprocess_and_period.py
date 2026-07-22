"""Iter 49 - Testes de:
 - POST /api/admin/igvd/reprocess-order (auth, 400/404, idempotencia, short_id)
 - GET /api/users/me/network com start/end e novos campos received_total/purchases_total
 - GET /api/users/me/referral com start/end
 - GET /api/users/me/commissions com start/end

Cria dados prefixados com 'TEST_' e limpa ao final.
"""
import os
import secrets
import pytest
import requests
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "oxxpharma")

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text[:200]}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def customer_token():
    # joao@rede1 é topo (network_1), tem downlines. Ideal para /me/network
    return _login("joao@rede1.com.br", "oxx@pharma")


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


# ---------- helpers ----------

def _cleanup(db):
    orders = list(db.orders.find({"igvd_voucher_code": {"$regex": "^TESTIT49"}}, {"order_id": 1}))
    order_ids = [o["order_id"] for o in orders]
    if order_ids:
        db.commissions.delete_many({"order_id": {"$in": order_ids}})
        db.points_log.delete_many({"order_id": {"$in": order_ids}})
        db.email_logs.delete_many({"meta.order_id": {"$in": order_ids}})
    db.orders.delete_many({"igvd_voucher_code": {"$regex": "^TESTIT49"}})
    db.orders.delete_many({"order_id": {"$regex": "^ord_testit49"}})
    db.users.delete_many({"email": {"$regex": "^TESTIT49_"}})


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _create_customer(db, email=None, sponsor_id=None):
    uid = "usr_" + secrets.token_hex(6)
    email = email or f"TESTIT49_{secrets.token_hex(3)}@oxx.com"
    db.users.insert_one({
        "user_id": uid,
        "email": email,
        "name": "TESTIT49 Customer",
        "password_hash": "$2b$12$abcdefghijklmnopqrstuvxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "roles": ["customer"],
        "role": "customer",
        "network_type": "customer",
        "sponsor_id": sponsor_id,
        "network_sponsor_id": None,
        "referral_program_active": False,
        "created_at": _now_iso(),
        "cpf_digits": "",
        "cpf": "",
        "addresses": [],
        "phone": "",
        "tenant": "oxxpharma",
    })
    return uid


def _create_igvd_order(db, user_id, voucher_code=None, paid=True, order_id=None):
    voucher_code = voucher_code or "TESTIT49_v_" + secrets.token_hex(4)
    oid = order_id or ("ord_testit49" + secrets.token_hex(4))  # 12 hex chars total
    order = {
        "order_id": oid,
        "user_id": user_id,
        "items": [{"product_id": "PROD_A", "name": "TEST Kit", "price": 100.0, "quantity": 1}],
        "subtotal": 100.0,
        "shipping_cost": 0.0,
        "discount_amount": 0.0,
        "voucher_used": 0.0,
        "total": 100.0,
        "payment_status": "paid" if paid else "pending",
        "status": "pending",
        "payment_provider": "voucher",
        "payment_id": f"voucher_TESTIT49_{secrets.token_hex(4)}",
        "shipping_address": {"street": "Rua Teste", "number": "1", "city": "SP", "state": "SP", "zip_code": "01000-000"},
        "created_at": _now_iso(),
        "paid_at": _now_iso() if paid else None,
        "igvd_voucher_code": voucher_code,
        "tenant": "oxxpharma",
    }
    db.orders.insert_one(order)
    return oid, voucher_code


# ==================== reprocess-order tests ====================

class TestReprocessOrder:

    @pytest.fixture(autouse=True)
    def _cleanup(self, mongo_db):
        _cleanup(mongo_db)
        yield
        _cleanup(mongo_db)

    def test_1_requires_auth_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/admin/igvd/reprocess-order", json={"order_id": "ord_xyz"}, timeout=15)
        assert r.status_code in (401, 403), f"expected 401/403 without token, got {r.status_code}"

    def test_2_forbids_non_admin_returns_403(self, customer_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": "ord_xyz"},
            headers=customer_headers,
            timeout=15,
        )
        assert r.status_code in (401, 403), f"expected 403 for non-admin, got {r.status_code} {r.text[:200]}"

    def test_3_returns_400_for_empty_order_id(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": "  "},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400 for empty, got {r.status_code} {r.text[:200]}"

    def test_4_returns_404_for_unknown_order(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": "ord_doesnotexist_" + secrets.token_hex(3)},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text[:200]}"

    def test_5_returns_400_if_order_not_igvd(self, admin_headers, mongo_db):
        # cria pedido normal (sem igvd_voucher_code)
        uid = _create_customer(mongo_db)
        oid = "ord_testit49" + secrets.token_hex(4)
        mongo_db.orders.insert_one({
            "order_id": oid,
            "user_id": uid,
            "items": [{"product_id": "P", "name": "X", "price": 10, "quantity": 1}],
            "subtotal": 10.0, "shipping_cost": 0.0, "total": 10.0,
            "payment_status": "paid",
            "status": "pending",
            "created_at": _now_iso(),
            "tenant": "oxxpharma",
        })
        r = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": oid},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400 (not IGVD), got {r.status_code} {r.text[:200]}"
        assert "IGVD" in r.text or "igvd_voucher_code" in r.text

    def test_6_reprocess_full_order_id_success(self, admin_headers, mongo_db):
        sponsor_id = _create_customer(mongo_db)
        mongo_db.users.update_one({"user_id": sponsor_id}, {"$set": {"referral_code": "TESTIT49R", "referral_program_active": True}})
        cust_id = _create_customer(mongo_db, sponsor_id=sponsor_id)
        oid, voucher_code = _create_igvd_order(mongo_db, cust_id)

        r = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": oid},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"reprocess failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("success") is True
        assert body.get("order_id") == oid
        assert body.get("short_id") == oid[-8:].upper()
        assert body.get("voucher_code") == voucher_code
        assert "commissions_created" in body
        assert "points_created" in body
        # comissao afiliado deve ter sido criada
        aff = mongo_db.commissions.find_one({"order_id": oid, "user_id": sponsor_id, "type": "affiliate"})
        assert aff is not None, "affiliate commission not created after reprocess"

    def test_7_reprocess_short_id_uppercase_hash(self, admin_headers, mongo_db):
        sponsor_id = _create_customer(mongo_db)
        mongo_db.users.update_one({"user_id": sponsor_id}, {"$set": {"referral_code": "TESTIT49S", "referral_program_active": True}})
        cust_id = _create_customer(mongo_db, sponsor_id=sponsor_id)
        oid, _ = _create_igvd_order(mongo_db, cust_id)
        short = "#" + oid[-8:].upper()

        r = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": short},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"reprocess by short id (upper) failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("order_id") == oid
        assert body.get("short_id") == oid[-8:].upper()

    def test_8_reprocess_short_id_lowercase(self, admin_headers, mongo_db):
        sponsor_id = _create_customer(mongo_db)
        mongo_db.users.update_one({"user_id": sponsor_id}, {"$set": {"referral_code": "TESTIT49L", "referral_program_active": True}})
        cust_id = _create_customer(mongo_db, sponsor_id=sponsor_id)
        oid, _ = _create_igvd_order(mongo_db, cust_id)
        short_lower = oid[-8:].lower()

        r = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": short_lower},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"reprocess by short id (lower) failed: {r.status_code} {r.text[:300]}"
        assert r.json().get("order_id") == oid

    def test_9_idempotent_no_duplicate_commissions(self, admin_headers, mongo_db):
        sponsor_id = _create_customer(mongo_db)
        mongo_db.users.update_one({"user_id": sponsor_id}, {"$set": {"referral_code": "TESTIT49I", "referral_program_active": True}})
        cust_id = _create_customer(mongo_db, sponsor_id=sponsor_id)
        oid, _ = _create_igvd_order(mongo_db, cust_id)

        # 1a chamada — cria comissoes
        r1 = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": oid},
            headers=admin_headers,
            timeout=30,
        )
        assert r1.status_code == 200, r1.text[:300]
        b1 = r1.json()
        total_after_first = b1["commissions_total"]
        assert total_after_first >= 1, f"expected >=1 commission after first call, got {total_after_first}"
        created_first = b1["commissions_created"]
        assert created_first == total_after_first, f"first call should count all created: {created_first} vs {total_after_first}"

        # 2a chamada — nao deve duplicar
        r2 = requests.post(
            f"{BASE_URL}/api/admin/igvd/reprocess-order",
            json={"order_id": oid},
            headers=admin_headers,
            timeout=30,
        )
        assert r2.status_code == 200, r2.text[:300]
        b2 = r2.json()
        assert b2["commissions_created"] == 0, f"expected 0 new commissions on 2nd call, got {b2['commissions_created']}"
        assert b2["commissions_total"] == total_after_first, f"total changed: {b2['commissions_total']} vs {total_after_first}"

        # verifica no db diretamente
        total_db = mongo_db.commissions.count_documents({"order_id": oid})
        assert total_db == total_after_first, f"db mismatch: {total_db} vs {total_after_first}"


# ==================== /users/me/network with start/end ====================

class TestMyNetworkPeriod:

    def test_1_network_returns_period_object(self, customer_headers):
        r = requests.get(f"{BASE_URL}/api/users/me/network", headers=customer_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "period" in data, "missing 'period' key in response"
        assert "start" in data["period"] and "end" in data["period"]

    def test_2_network_generation_has_new_fields(self, customer_headers):
        r = requests.get(f"{BASE_URL}/api/users/me/network", headers=customer_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        gens = data.get("generations") or []
        assert len(gens) >= 1, "no generations returned"
        for g in gens:
            assert "received_total" in g, f"gen {g.get('generation')} missing received_total"
            assert "purchases_total" in g, f"gen {g.get('generation')} missing purchases_total"
            assert "purchases_count" in g, f"gen {g.get('generation')} missing purchases_count"

    def test_3_network_accepts_start_end_params(self, customer_headers):
        r = requests.get(
            f"{BASE_URL}/api/users/me/network?start=2026-01-01&end=2026-01-31",
            headers=customer_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["period"]["start"] == "2026-01-01"
        assert data["period"]["end"] == "2026-01-31"

    def test_4_network_period_filter_changes_values(self, customer_headers):
        # Periodo muito antigo — deve zerar received/purchases
        r_old = requests.get(
            f"{BASE_URL}/api/users/me/network?start=1990-01-01&end=1990-12-31",
            headers=customer_headers, timeout=20,
        )
        assert r_old.status_code == 200
        old_gens = r_old.json().get("generations") or []
        for g in old_gens:
            assert g["received_total"] == 0, f"expected 0 received in 1990, got {g['received_total']}"
            assert g["purchases_total"] == 0, f"expected 0 purchases in 1990, got {g['purchases_total']}"

        # Periodo amplo — pode ter valores >= 0
        r_wide = requests.get(
            f"{BASE_URL}/api/users/me/network?start=2020-01-01&end=2030-12-31",
            headers=customer_headers, timeout=20,
        )
        assert r_wide.status_code == 200


# ==================== /users/me/referral with start/end ====================

class TestMyReferralPeriod:

    def test_1_referral_accepts_start_end(self, customer_headers):
        r = requests.get(
            f"{BASE_URL}/api/users/me/referral?start=2026-01-01&end=2026-01-31",
            headers=customer_headers, timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "stats" in data
        assert "pending" in data["stats"] and "paid" in data["stats"]

    def test_2_referral_old_period_zeroes_stats(self, customer_headers):
        r = requests.get(
            f"{BASE_URL}/api/users/me/referral?start=1990-01-01&end=1990-12-31",
            headers=customer_headers, timeout=20,
        )
        assert r.status_code == 200
        stats = r.json().get("stats") or {}
        assert stats.get("pending", 0) == 0
        assert stats.get("paid", 0) == 0


# ==================== /users/me/commissions with start/end ====================

class TestMyCommissionsPeriod:

    def test_1_commissions_accepts_start_end(self, customer_headers):
        r = requests.get(
            f"{BASE_URL}/api/users/me/commissions?start=2026-01-01&end=2026-01-31&page=1&limit=5",
            headers=customer_headers, timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "commissions" in data
        assert "total" in data
        assert isinstance(data["commissions"], list)

    def test_2_commissions_old_period_empty(self, customer_headers):
        r = requests.get(
            f"{BASE_URL}/api/users/me/commissions?start=1990-01-01&end=1990-12-31",
            headers=customer_headers, timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("total", 0) == 0, f"expected 0 commissions in 1990, got {data.get('total')}"
        assert len(data.get("commissions") or []) == 0
