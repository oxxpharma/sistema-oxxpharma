"""Phase 2A tests - Settings, MMN 6 generations, Import Network1, Promote/Revoke, Reports"""
import os, uuid, pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


def _sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin():
    s = _sess()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


def _register(email, name, sponsor_code=None):
    s = _sess()
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Pass1234!", "name": name, "sponsor_code": sponsor_code
    })
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s, r.json()["user"]


# ===== Settings =====
class TestSettings:
    def test_get_settings(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/settings")
        assert r.status_code == 200
        d = r.json()
        assert "affiliate_commission_rate" in d
        assert isinstance(d["network1_generations"], list) and len(d["network1_generations"]) == 6
        assert isinstance(d["network2_generations"], list) and len(d["network2_generations"]) == 6

    def test_update_settings_sanitizes_generations(self, admin):
        # Passar lista de 3 -> deve virar 6. Passar 8 -> cortar para 6.
        r = admin.put(f"{BASE_URL}/api/admin/settings", json={
            "network1_generations": [4, 2, 1],
            "network2_generations": [5, 3, 2, 1, 1, 0.5, 99, 99],
            "affiliate_commission_rate": 0.08,
            "withdrawal_enabled": True,
            "withdrawal_min_amount": 50.0,
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["network1_generations"]) == 6
        assert d["network1_generations"][:3] == [4.0, 2.0, 1.0]
        assert d["network1_generations"][3:] == [0.0, 0.0, 0.0]
        assert len(d["network2_generations"]) == 6
        assert d["network2_generations"] == [5.0, 3.0, 2.0, 1.0, 1.0, 0.5]
        assert d["withdrawal_enabled"] is True

        # Reset to safe defaults for subsequent tests
        admin.put(f"{BASE_URL}/api/admin/settings", json={
            "network1_generations": [5, 3, 2, 1, 1, 0.5],
            "network2_generations": [5, 3, 2, 1, 1, 0.5],
            "affiliate_commission_rate": 0.08,
        })

    def test_non_admin_cannot_access(self):
        u = uuid.uuid4().hex[:6]
        s, _ = _register(f"test_phase2a_noadm_{u}@example.com", "NoAdm")
        r = s.get(f"{BASE_URL}/api/admin/settings")
        assert r.status_code == 403


# ===== Register defaults =====
class TestRegisterDefaults:
    def test_register_defaults_to_customer(self):
        u = uuid.uuid4().hex[:6]
        s, user = _register(f"test_p2a_cust_{u}@example.com", "CustDefault")
        assert user["network_type"] == "customer"
        assert user.get("network_sponsor_id") is None


# ===== Promote / Revoke =====
class TestPromoteRevoke:
    def test_promote_customer_to_propagandista(self, admin):
        u = uuid.uuid4().hex[:6]
        _, user = _register(f"test_p2a_prom_{u}@example.com", "ToPromote")
        r = admin.post(f"{BASE_URL}/api/admin/users/{user['user_id']}/promote-to-propagandista")
        assert r.status_code == 200, r.text
        assert r.json()["network_type"] == "network_2"

        # Revoke
        r2 = admin.post(f"{BASE_URL}/api/admin/users/{user['user_id']}/revoke-network")
        assert r2.status_code == 200
        check = admin.get(f"{BASE_URL}/api/admin/users/{user['user_id']}")
        assert check.json()["network_type"] == "customer"

    def test_promote_non_customer_fails(self, admin):
        u = uuid.uuid4().hex[:6]
        _, user = _register(f"test_p2a_twice_{u}@example.com", "Twice")
        r = admin.post(f"{BASE_URL}/api/admin/users/{user['user_id']}/promote-to-propagandista")
        assert r.status_code == 200
        r2 = admin.post(f"{BASE_URL}/api/admin/users/{user['user_id']}/promote-to-propagandista")
        assert r2.status_code == 400
        # cleanup
        admin.post(f"{BASE_URL}/api/admin/users/{user['user_id']}/revoke-network")

    def test_revoke_non_network2_fails(self, admin):
        u = uuid.uuid4().hex[:6]
        _, user = _register(f"test_p2a_revfail_{u}@example.com", "RevFail")
        r = admin.post(f"{BASE_URL}/api/admin/users/{user['user_id']}/revoke-network")
        assert r.status_code == 400


# ===== Users profile CPF/PIX =====
class TestProfileUpdate:
    def test_update_cpf_pix(self):
        u = uuid.uuid4().hex[:6]
        s, _ = _register(f"test_p2a_pix_{u}@example.com", "Pix User")
        r = s.put(f"{BASE_URL}/api/users/me", json={
            "cpf": "12345678900", "pix_key": "pix@test.com", "pix_key_type": "email", "name": "Updated"
        })
        assert r.status_code == 200
        d = r.json()
        assert d["cpf"] == "12345678900"
        assert d["pix_key"] == "pix@test.com"
        assert d["pix_key_type"] == "email"
        assert d["name"] == "Updated"


# ===== Import Network1 =====
class TestImportNetwork1:
    def test_import_with_leader_mapping(self, admin):
        prefix = uuid.uuid4().hex[:6]
        rows = [
            {"external_id": f"EXT_{prefix}_A", "name": "Leader A", "email": f"n1_{prefix}_a@example.com"},
            {"external_id": f"EXT_{prefix}_B", "name": "Member B", "email": f"n1_{prefix}_b@example.com", "leader_external_id": f"EXT_{prefix}_A"},
            {"external_id": f"EXT_{prefix}_C", "name": "Member C", "email": f"n1_{prefix}_c@example.com", "leader_external_id": f"EXT_{prefix}_B"},
        ]
        r = admin.post(f"{BASE_URL}/api/admin/network1/import", json={"rows": rows})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] == 3
        assert d["sponsors_mapped"] == 2

        # List by network
        lst = admin.get(f"{BASE_URL}/api/admin/users-by-network?network_type=network_1&search=n1_{prefix}_")
        assert lst.status_code == 200
        found = {u["email"] for u in lst.json()["users"]}
        assert f"n1_{prefix}_a@example.com" in found
        assert f"n1_{prefix}_b@example.com" in found

    def test_import_upserts_existing(self, admin):
        prefix = uuid.uuid4().hex[:6]
        rows = [{"external_id": f"EXT_{prefix}_X", "name": "Original", "email": f"n1_{prefix}_x@example.com"}]
        r = admin.post(f"{BASE_URL}/api/admin/network1/import", json={"rows": rows})
        assert r.json()["created"] == 1
        # re-import with updated name
        rows[0]["name"] = "Updated Name"
        r2 = admin.post(f"{BASE_URL}/api/admin/network1/import", json={"rows": rows})
        assert r2.json()["updated"] == 1


# ===== Users by network / Tree =====
class TestUsersByNetwork:
    def test_users_by_network_invalid(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/users-by-network?network_type=invalid")
        assert r.status_code == 400

    def test_users_by_network_customer(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/users-by-network?network_type=customer")
        assert r.status_code == 200
        assert isinstance(r.json()["users"], list)

    def test_user_tree(self, admin):
        # Use admin user itself
        me = admin.get(f"{BASE_URL}/api/auth/me").json()
        r = admin.get(f"{BASE_URL}/api/admin/users/{me['user_id']}/tree")
        assert r.status_code == 200
        d = r.json()
        assert "root" in d and "generations" in d


# ===== My network =====
class TestMyNetwork:
    def test_customer_network_view(self):
        u = uuid.uuid4().hex[:6]
        s, _ = _register(f"test_p2a_mynet_{u}@example.com", "MyNet")
        r = s.get(f"{BASE_URL}/api/users/me/network")
        assert r.status_code == 200
        d = r.json()
        assert d["network_type"] == "customer"
        assert d["generations"] == []  # customer sem rede
        assert "commission_rate_affiliate" in d


# ===== Propaganda Candidates =====
class TestPropagandaCandidates:
    def test_list_candidates_structure(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/propaganda-candidates")
        assert r.status_code == 200
        d = r.json()
        assert "candidates" in d and "threshold" in d and "period_days" in d


# ===== Commissions Report =====
class TestCommissionsReport:
    def test_report_structure(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/commissions-report?status=paid")
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d
        assert d["status"] == "paid"
        for row in d["rows"]:
            assert "user_id" in row
            assert "amount" in row


# ===== Full MMN engine E2E =====
class TestMmnEngine:
    def test_customer_sponsor_no_network_commission(self, admin):
        """Regra 2A: se sponsor B eh customer, cadeia para - so afiliado 8%."""
        # Set a default address for checkout
        pfx = uuid.uuid4().hex[:6]
        # B: customer with sponsor A (also customer)
        _, a = _register(f"test_p2a_A_{pfx}@example.com", "SponsorA")
        sb, b = _register(f"test_p2a_B_{pfx}@example.com", "SponsorB", sponsor_code=a["referral_code"])
        sc, c = _register(f"test_p2a_C_{pfx}@example.com", "BuyerC", sponsor_code=b["referral_code"])

        # Add address to C
        addr_r = sc.post(f"{BASE_URL}/api/users/me/addresses", json={
            "label": "Casa", "street": "Rua A", "number": "1", "neighborhood": "Centro",
            "city": "SP", "state": "SP", "zip_code": "01310100", "is_default": True
        })
        assert addr_r.status_code == 200
        addr_id = addr_r.json()["addresses"][0]["address_id"]

        # Get a product and add to cart
        prods = sc.get(f"{BASE_URL}/api/products").json()["products"]
        assert len(prods) > 0
        prod_id = prods[0]["product_id"]
        sc.post(f"{BASE_URL}/api/cart/items", json={"product_id": prod_id, "quantity": 1})

        # Checkout
        co = sc.post(f"{BASE_URL}/api/checkout", json={"address_id": addr_id, "payment_method": "pix"})
        assert co.status_code == 200, co.text
        order_id = co.json()["order_id"]

        # B should have affiliate commission; A should have nothing from this order
        # Query commissions via admin
        # Fetch commissions for B by reading /api/users/me/commissions (as B)
        b_comms = sb.get(f"{BASE_URL}/api/users/me/commissions").json()["commissions"]
        b_for_order = [x for x in b_comms if x["order_id"] == order_id]
        assert len(b_for_order) == 1
        assert b_for_order[0]["type"] == "affiliate"

        # A: login and check no commission for this order
        sa = _sess()
        r = sa.post(f"{BASE_URL}/api/auth/login", json={"email": f"test_p2a_A_{pfx}@example.com", "password": "Pass1234!"})
        sa.headers["Authorization"] = f"Bearer {r.json()['token']}"
        a_comms = sa.get(f"{BASE_URL}/api/users/me/commissions").json()["commissions"]
        a_for_order = [x for x in a_comms if x["order_id"] == order_id]
        assert len(a_for_order) == 0, "Rule 2A violated: A received commission despite B being customer"

    def test_network2_chain_6_gens(self, admin):
        """B network_2 with network_sponsor A (network_2) -> C compra gera afiliado + gen1(B) + gen2(A)."""
        pfx = uuid.uuid4().hex[:6]
        _, a = _register(f"test_p2a_NA_{pfx}@example.com", "NetA")
        sb, b = _register(f"test_p2a_NB_{pfx}@example.com", "NetB", sponsor_code=a["referral_code"])

        # Promote A then B (B after A so network_sponsor_id picks A)
        admin.post(f"{BASE_URL}/api/admin/users/{a['user_id']}/promote-to-propagandista")
        admin.post(f"{BASE_URL}/api/admin/users/{b['user_id']}/promote-to-propagandista")

        # Verify B has network_sponsor_id = A
        bcheck = admin.get(f"{BASE_URL}/api/admin/users/{b['user_id']}").json()
        assert bcheck["network_sponsor_id"] == a["user_id"]
        assert bcheck["network_type"] == "network_2"

        # C customer sponsored by B
        sc, c = _register(f"test_p2a_NC_{pfx}@example.com", "Buyer", sponsor_code=b["referral_code"])
        addr_r = sc.post(f"{BASE_URL}/api/users/me/addresses", json={
            "label": "Casa", "street": "R", "number": "1", "neighborhood": "C",
            "city": "SP", "state": "SP", "zip_code": "01310100", "is_default": True
        })
        addr_id = addr_r.json()["addresses"][0]["address_id"]

        prods = sc.get(f"{BASE_URL}/api/products").json()["products"]
        sc.post(f"{BASE_URL}/api/cart/items", json={"product_id": prods[0]["product_id"], "quantity": 1})
        co = sc.post(f"{BASE_URL}/api/checkout", json={"address_id": addr_id, "payment_method": "pix"})
        assert co.status_code == 200, co.text
        order_id = co.json()["order_id"]
        subtotal = co.json()["subtotal"]

        # B should have 2 commissions: affiliate + network_gen gen=1
        b_comms = sb.get(f"{BASE_URL}/api/users/me/commissions").json()["commissions"]
        b_for = [x for x in b_comms if x["order_id"] == order_id]
        types = sorted([(x["type"], x.get("generation", 0)) for x in b_for])
        assert ("affiliate", 0) in types
        assert ("network_gen", 1) in types

        # A should have network_gen gen=2
        sa = _sess()
        rr = sa.post(f"{BASE_URL}/api/auth/login", json={"email": f"test_p2a_NA_{pfx}@example.com", "password": "Pass1234!"})
        sa.headers["Authorization"] = f"Bearer {rr.json()['token']}"
        a_comms = sa.get(f"{BASE_URL}/api/users/me/commissions").json()["commissions"]
        a_for = [x for x in a_comms if x["order_id"] == order_id]
        assert len(a_for) == 1
        assert a_for[0]["type"] == "network_gen"
        assert a_for[0]["generation"] == 2
        assert a_for[0]["network_type"] == "network_2"
        # gen2 rate should be 3% (default settings)
        expected_amt = round(subtotal * 0.03, 2)
        assert abs(a_for[0]["amount"] - expected_amt) < 0.05
