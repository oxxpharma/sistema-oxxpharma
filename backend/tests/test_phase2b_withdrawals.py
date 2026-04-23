"""
Fase 2B - Sistema de SAQUES via PIX
Testa balance, criacao de withdrawal (valida enabled/min/available),
FIFO commissions, cancel (libera), admin approve/reject/mark-paid/export,
quarentena (release_days).
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://oxx-franchise-system.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def enabled_settings(admin_token):
    """Ativa saques com min=5 e release_days=0 para permitir testes completos."""
    r = requests.put(
        f"{API}/admin/settings",
        headers=_auth(admin_token),
        json={"withdrawal_enabled": True, "withdrawal_min_amount": 5.0, "withdrawal_release_days": 0},
    )
    assert r.status_code == 200
    s = r.json()
    assert s["withdrawal_enabled"] is True
    assert s["withdrawal_min_amount"] == 5.0
    assert s["withdrawal_release_days"] == 0
    yield s
    # cleanup: restore defaults
    requests.put(
        f"{API}/admin/settings",
        headers=_auth(admin_token),
        json={"withdrawal_enabled": False, "withdrawal_min_amount": 50.0, "withdrawal_release_days": 15},
    )


@pytest.fixture(scope="module")
def user_with_commission(admin_token, enabled_settings):
    """Cria um customer, faz compra, confirma pagamento via ref admin para gerar commission fresca."""
    # 1. cria customer com sponsor = admin (admin eh customer mas tem referral_code)
    # Pegar referral code do admin
    me = requests.get(f"{API}/auth/me", headers=_auth(admin_token)).json()
    admin_ref = me.get("referral_code")
    assert admin_ref

    email = f"test_wd_{uuid.uuid4().hex[:8]}@ex.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "pass123", "name": "WD Tester", "sponsor_code": admin_ref
    })
    assert r.status_code == 200, r.text
    cust = r.json()
    c_token = cust["token"]
    cust_id = cust["user"]["user_id"]

    # 2. adiciona endereco
    r = requests.post(f"{API}/users/me/addresses", headers=_auth(c_token), json={
        "label": "Casa", "street": "Rua A", "number": "1", "neighborhood": "Centro",
        "city": "SP", "state": "SP", "zip_code": "01000-000", "is_default": True
    })
    assert r.status_code == 200
    addr_id = r.json()["addresses"][0]["address_id"]

    # 3. add produto ao carrinho (featured)
    prods = requests.get(f"{API}/products/featured?limit=1").json()["products"]
    assert prods
    pid = prods[0]["product_id"]
    r = requests.post(f"{API}/cart/items", headers=_auth(c_token), json={"product_id": pid, "quantity": 10})
    assert r.status_code == 200

    # 4. checkout
    r = requests.post(f"{API}/checkout", headers=_auth(c_token), json={
        "address_id": addr_id, "payment_method": "pix"
    })
    assert r.status_code == 200, r.text
    order = r.json()
    order_id = order["order_id"]
    assert order.get("affiliate_id")  # deve ser admin

    # 5. confirma pagamento (mock) - gera commission paid para admin
    r = requests.post(f"{API}/payments/mock/confirm/{order_id}", headers=_auth(c_token))
    assert r.status_code == 200

    # Valor de comissao 8%
    commission = round(order["subtotal"] * 0.08, 2)
    return {"email": ADMIN_EMAIL, "token": admin_token, "commission": commission, "order_id": order_id}


class TestBalance:
    def test_balance_has_all_fields(self, admin_token):
        r = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token))
        assert r.status_code == 200
        b = r.json()
        for k in ("available", "quarantine", "pending_commissions", "reserved_in_withdrawals",
                  "total_withdrawn", "withdrawal_enabled", "withdrawal_min_amount", "withdrawal_release_days"):
            assert k in b, f"missing key {k}"

    def test_balance_reflects_enabled_settings(self, admin_token, enabled_settings):
        r = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token))
        b = r.json()
        assert b["withdrawal_enabled"] is True
        assert b["withdrawal_min_amount"] == 5.0
        assert b["withdrawal_release_days"] == 0


class TestQuarantine:
    def test_quarantine_with_release_days_30(self, admin_token, user_with_commission):
        """Com release_days=30 commissao recem-paga vai pra quarantine, nao available."""
        r = requests.put(f"{API}/admin/settings", headers=_auth(admin_token),
                         json={"withdrawal_release_days": 30})
        assert r.status_code == 200
        b = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        assert b["quarantine"] >= user_with_commission["commission"]
        # Restaurar
        requests.put(f"{API}/admin/settings", headers=_auth(admin_token),
                     json={"withdrawal_release_days": 0})


class TestWithdrawalCreate:
    def test_create_withdrawal_validates_min(self, admin_token, enabled_settings, user_with_commission):
        r = requests.post(f"{API}/withdrawals", headers=_auth(admin_token), json={
            "amount": 1.0, "pix_key": "admin@oxxpharma.com", "pix_key_type": "email",
            "pix_name": "Administrador", "pix_cpf": "00000000000"
        })
        assert r.status_code == 400
        assert "minimo" in r.json()["detail"].lower()

    def test_create_withdrawal_validates_available(self, admin_token, enabled_settings):
        r = requests.post(f"{API}/withdrawals", headers=_auth(admin_token), json={
            "amount": 999999.0, "pix_key": "admin@oxxpharma.com", "pix_key_type": "email",
            "pix_name": "Adm", "pix_cpf": "00000000000"
        })
        assert r.status_code == 400
        assert "insuficiente" in r.json()["detail"].lower() or "compor" in r.json()["detail"].lower()

    def test_create_withdrawal_success_and_reserves(self, admin_token, enabled_settings, user_with_commission):
        b_before = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        if b_before["available"] < 5:
            pytest.skip("Nao ha saldo disponivel")
        r = requests.post(f"{API}/withdrawals", headers=_auth(admin_token), json={
            "amount": 5.0, "pix_key": "admin@oxxpharma.com", "pix_key_type": "email",
            "pix_name": "Administrador OxxPharma", "pix_cpf": "11111111111"
        })
        assert r.status_code == 200, r.text
        w = r.json()
        assert w["status"] == "pending"
        assert w["amount"] == 5.0
        assert len(w["commission_ids"]) >= 1
        pytest.wid_pending = w["withdrawal_id"]
        # Saldo deve diminuir available, aumentar reserved
        b_after = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        assert b_after["reserved_in_withdrawals"] > b_before["reserved_in_withdrawals"]


class TestWithdrawalListCancel:
    def test_list_my_withdrawals(self, admin_token):
        r = requests.get(f"{API}/users/me/withdrawals", headers=_auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "withdrawals" in d and "total" in d
        assert d["total"] >= 1

    def test_cancel_pending_releases_commissions(self, admin_token):
        wid = getattr(pytest, "wid_pending", None)
        if not wid:
            pytest.skip("sem withdrawal pending")
        b_before = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        r = requests.post(f"{API}/users/me/withdrawals/{wid}/cancel", headers=_auth(admin_token))
        assert r.status_code == 200
        b_after = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        assert b_after["available"] > b_before["available"]
        assert b_after["reserved_in_withdrawals"] < b_before["reserved_in_withdrawals"]

    def test_cancel_already_cancelled_fails(self, admin_token):
        wid = getattr(pytest, "wid_pending", None)
        if not wid:
            pytest.skip("sem withdrawal")
        r = requests.post(f"{API}/users/me/withdrawals/{wid}/cancel", headers=_auth(admin_token))
        assert r.status_code == 400


class TestAdminWithdrawals:
    def test_create_second_withdrawal_for_admin_flow(self, admin_token, enabled_settings):
        b = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        if b["available"] < 5:
            pytest.skip("sem saldo")
        r = requests.post(f"{API}/withdrawals", headers=_auth(admin_token), json={
            "amount": 5.0, "pix_key": "admin@pix", "pix_key_type": "email",
            "pix_name": "Adm", "pix_cpf": "22222222222"
        })
        assert r.status_code == 200
        pytest.wid_admin = r.json()["withdrawal_id"]

    def test_admin_list_summary(self, admin_token):
        r = requests.get(f"{API}/admin/withdrawals", headers=_auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "withdrawals" in d and "summary" in d
        assert isinstance(d["summary"], dict)

    def test_admin_filter_by_status(self, admin_token):
        r = requests.get(f"{API}/admin/withdrawals?status=pending", headers=_auth(admin_token))
        assert r.status_code == 200
        for w in r.json()["withdrawals"]:
            assert w["status"] == "pending"

    def test_admin_approve_pending(self, admin_token):
        wid = getattr(pytest, "wid_admin", None)
        if not wid:
            pytest.skip("sem wid")
        r = requests.put(f"{API}/admin/withdrawals/{wid}/approve", headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

    def test_admin_approve_already_approved_fails(self, admin_token):
        wid = getattr(pytest, "wid_admin", None)
        if not wid:
            pytest.skip("sem wid")
        r = requests.put(f"{API}/admin/withdrawals/{wid}/approve", headers=_auth(admin_token))
        assert r.status_code == 400

    def test_admin_mark_paid_and_commission_becomes_paid_out(self, admin_token):
        wid = getattr(pytest, "wid_admin", None)
        if not wid:
            pytest.skip("sem wid")
        b_before = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        r = requests.put(f"{API}/admin/withdrawals/{wid}/mark-paid", headers=_auth(admin_token))
        assert r.status_code == 200
        w = r.json()
        assert w["status"] == "paid_out"
        assert w["paid_at"]
        b_after = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        assert b_after["total_withdrawn"] >= b_before["total_withdrawn"] + 5.0 - 0.01

    def test_admin_export_csv_rows(self, admin_token):
        r = requests.get(f"{API}/admin/withdrawals/export?status=paid_out", headers=_auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d and "count" in d
        if d["rows"]:
            row = d["rows"][0]
            for k in ("withdrawal_id", "cpf", "name", "pix_key", "amount"):
                assert k in row


class TestAdminReject:
    def test_create_and_reject(self, admin_token, enabled_settings):
        b = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        if b["available"] < 5:
            pytest.skip("sem saldo")
        r = requests.post(f"{API}/withdrawals", headers=_auth(admin_token), json={
            "amount": 5.0, "pix_key": "x@x", "pix_key_type": "email",
            "pix_name": "Adm", "pix_cpf": "33333333333"
        })
        assert r.status_code == 200
        wid = r.json()["withdrawal_id"]
        b_mid = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        r = requests.put(f"{API}/admin/withdrawals/{wid}/reject", headers=_auth(admin_token),
                         json={"reason": "Teste rejeicao"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
        assert r.json()["admin_notes"] == "Teste rejeicao"
        b_after = requests.get(f"{API}/users/me/balance", headers=_auth(admin_token)).json()
        # available deve ter aumentado em relacao ao mid (commissions liberadas)
        assert b_after["reserved_in_withdrawals"] < b_mid["reserved_in_withdrawals"]


class TestWithdrawalDisabled:
    def test_blocks_when_disabled(self, admin_token):
        requests.put(f"{API}/admin/settings", headers=_auth(admin_token),
                     json={"withdrawal_enabled": False})
        r = requests.post(f"{API}/withdrawals", headers=_auth(admin_token), json={
            "amount": 5.0, "pix_key": "x@x", "pix_key_type": "email",
            "pix_name": "Adm", "pix_cpf": "44444444444"
        })
        assert r.status_code == 400
        assert "desativ" in r.json()["detail"].lower() or "saques" in r.json()["detail"].lower()
        # Restaurar
        requests.put(f"{API}/admin/settings", headers=_auth(admin_token),
                     json={"withdrawal_enabled": True})
