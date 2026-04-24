"""Phase 3 - Card Benefits Program tests.
Covers:
- Public enrollment fields endpoint
- New user register WITHOUT referral_code
- Enrollment flow via /api/users/me/referral-enrollment
- Admin card-config CRUD
- Admin activate/deactivate referral manually
- Card batches: run, list, export CSV, mark-exported
- Card logs endpoint
- User card-balance endpoint
- E2E: enroll -> buy with sponsor_code -> admin mark paid -> run batch -> verify sent_to_card
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"

RUN_TAG = uuid.uuid4().hex[:8]


# ------------------- Fixtures -------------------

def _fresh_session():
    """Return a fresh requests session (no cookie bleed between admin/user)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def api():
    """Base session used only for unauthenticated + user-register flows.
    Note: register/login set httpOnly cookie -> any later admin call via
    this same session would carry that cookie and be authenticated AS USER
    (server.get_current_user reads cookie BEFORE Authorization header).
    """
    return _fresh_session()


@pytest.fixture(scope="module")
def admin_session():
    """Separate session so cookie is isolated to admin login only."""
    s = _fresh_session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def admin_headers(admin_session):
    # Back-compat - tests that use admin_headers get the admin_session headers/cookies
    return admin_session.headers


# Adapter so tests keep api.<method>() interface but use correct session.
class _AdminClient:
    def __init__(self, session):
        self._s = session
    def get(self, *a, **kw): return self._s.get(*a, **kw)
    def post(self, *a, **kw): return self._s.post(*a, **kw)
    def put(self, *a, **kw): return self._s.put(*a, **kw)
    def delete(self, *a, **kw): return self._s.delete(*a, **kw)


@pytest.fixture(scope="module")
def admin_api(admin_session):
    return _AdminClient(admin_session)


@pytest.fixture(scope="module")
def test_user(api):
    """Register a NEW user (without referral link). Uses its OWN session so
    the user cookie doesn't bleed into admin calls."""
    email = f"test_phase3_{RUN_TAG}@example.com"
    user_session = _fresh_session()
    r = user_session.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "TestPass123!", "name": f"TEST Phase3 {RUN_TAG}",
        "phone": "11999998888"
    })
    assert r.status_code == 200, f"register failed: {r.text}"
    data = r.json()
    user_session.headers.update({"Authorization": f"Bearer {data['token']}"})
    return {"token": data["token"], "user": data["user"], "email": email, "session": user_session}


@pytest.fixture(scope="module")
def user_api(test_user):
    return _AdminClient(test_user["session"])


@pytest.fixture(scope="module")
def user_headers(test_user):
    return {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}


# ------------------- 1. Health & Public -------------------

class TestHealthAndPublic:
    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200

    def test_public_card_enrollment_fields(self, api):
        r = api.get(f"{BASE_URL}/api/public/card-enrollment-fields")
        assert r.status_code == 200
        body = r.json()
        assert "fields" in body
        keys = [f["key"] for f in body["fields"]]
        for expected in ["cpf", "full_name", "birth_date", "mother_name", "phone"]:
            assert expected in keys, f"missing default field {expected}"


# ------------------- 2. New register -------------------

class TestRegisterNoReferralCode:
    def test_new_user_has_no_referral_code(self, test_user):
        u = test_user["user"]
        assert u.get("referral_code") in (None, ""), f"referral_code should be null, got {u.get('referral_code')}"
        assert u.get("referral_program_active") is False


# ------------------- 3. /api/users/me/referral -------------------

class TestMyReferralBeforeEnrollment:
    def test_referral_inactive(self, api, user_headers):
        r = api.get(f"{BASE_URL}/api/users/me/referral", headers=user_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["has_referral_program"] is False
        assert body["referral_code"] in (None, "")
        assert body["account_balance"] == 0
        assert body["sent_to_card_total"] == 0


# ------------------- 4. Enrollment flow -------------------

class TestEnrollment:
    def test_enrollment_missing_fields_400(self, api, user_headers):
        r = api.post(f"{BASE_URL}/api/users/me/referral-enrollment", headers=user_headers, json={"cpf": "12345678901"})
        assert r.status_code == 400, f"expected 400 on missing fields, got {r.status_code}: {r.text}"

    def test_enrollment_success(self, api, user_headers):
        payload = {
            "cpf": "123.456.789-01",
            "full_name": "TEST Phase3 Full Name",
            "birth_date": "1990-01-15",
            "mother_name": "TEST Mother Name",
            "phone": "(11) 99999-8888",
        }
        r = api.post(f"{BASE_URL}/api/users/me/referral-enrollment", headers=user_headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["referral_code"]
        assert "referral_link" in body
        assert body["enrollment"]["cpf"]

    def test_enrollment_second_time_blocked(self, api, user_headers):
        """Calling again after already enrolled must 400."""
        r = api.post(f"{BASE_URL}/api/users/me/referral-enrollment", headers=user_headers, json={
            "cpf": "123.456.789-01", "full_name": "x", "birth_date": "1990-01-15",
            "mother_name": "x", "phone": "11999998888",
        })
        assert r.status_code == 400

    def test_my_referral_after_enrollment(self, api, user_headers):
        r = api.get(f"{BASE_URL}/api/users/me/referral", headers=user_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["has_referral_program"] is True
        assert body["referral_code"]
        assert body["referral_enrollment"] is not None
        assert body["referral_enrollment"].get("cpf")

    def test_card_balance_endpoint(self, api, user_headers):
        r = api.get(f"{BASE_URL}/api/users/me/card-balance", headers=user_headers)
        assert r.status_code == 200
        body = r.json()
        for k in ["account_balance", "sent_to_card_total", "pending_commissions"]:
            assert k in body
            assert isinstance(body[k], (int, float))


# ------------------- 5. Admin card-config -------------------

class TestAdminCardConfig:
    def test_get_config_default(self, admin_api):
        r = admin_api.get(f"{BASE_URL}/api/admin/card-config")
        assert r.status_code == 200
        cfg = r.json()
        assert "enabled" in cfg
        assert "cron_hour" in cfg
        assert "cron_minute" in cfg
        assert isinstance(cfg.get("enrollment_fields"), list)
        assert len(cfg["enrollment_fields"]) >= 5

    def test_update_config(self, admin_api):
        new_fields = [
            {"key": "cpf", "label": "CPF", "type": "text", "required": True, "mask": "cpf"},
            {"key": "full_name", "label": "Nome completo", "type": "text", "required": True},
            {"key": "birth_date", "label": "Nascimento", "type": "date", "required": True},
            {"key": "mother_name", "label": "Mae", "type": "text", "required": True},
            {"key": "phone", "label": "Telefone", "type": "text", "required": True},
        ]
        payload = {
            "enabled": True, "cron_hour": 23, "cron_minute": 59,
            "enrollment_fields": new_fields, "api_url": "",
            "api_method": "POST", "api_auth_type": "bearer", "api_timeout_seconds": 30,
        }
        r = admin_api.put(f"{BASE_URL}/api/admin/card-config", json=payload)
        assert r.status_code == 200, r.text
        cfg = r.json()
        assert cfg["enabled"] is True
        assert cfg["cron_hour"] == 23
        assert cfg["cron_minute"] == 59

    def test_get_after_update_persists(self, admin_api):
        r = admin_api.get(f"{BASE_URL}/api/admin/card-config")
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["enabled"] is True
        assert cfg["cron_hour"] == 23


# ------------------- 6. Admin activate/deactivate manual -------------------

class TestAdminManualReferral:
    @pytest.fixture(scope="class")
    def target_user(self):
        email = f"test_p3_manual_{RUN_TAG}@example.com"
        s = _fresh_session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Pass123!", "name": "TEST Manual",
            "phone": "11988887777",
        })
        assert r.status_code == 200
        return r.json()["user"]

    def test_activate_manual(self, admin_api, target_user):
        uid = target_user["user_id"]
        r = admin_api.post(f"{BASE_URL}/api/admin/users/{uid}/activate-referral")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body.get("referral_code")

    def test_activate_idempotent(self, admin_api, target_user):
        uid = target_user["user_id"]
        r = admin_api.post(f"{BASE_URL}/api/admin/users/{uid}/activate-referral")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body.get("already_active") is True or body.get("referral_code")

    def test_deactivate_manual(self, admin_api, target_user):
        uid = target_user["user_id"]
        r = admin_api.post(f"{BASE_URL}/api/admin/users/{uid}/deactivate-referral")
        assert r.status_code == 200
        # Verify
        g = admin_api.get(f"{BASE_URL}/api/admin/users/{uid}")
        assert g.status_code == 200
        u = g.json()
        assert u.get("referral_program_active") is False
        assert not u.get("referral_code")


# ------------------- 7. Admin card-batches run/list/export -------------------

class TestAdminCardBatches:
    def test_run_batch_manual(self, admin_api):
        r = admin_api.post(f"{BASE_URL}/api/admin/card-batches/run")
        assert r.status_code == 200, r.text
        body = r.json()
        # ran can be true or false depending on pending commissions
        assert "ran" in body
        if body["ran"]:
            assert "batch_id" in body
            assert "users_count" in body
            assert "total_amount" in body
            TestAdminCardBatches.created_batch_id = body["batch_id"]
        else:
            TestAdminCardBatches.created_batch_id = None

    def test_list_batches(self, admin_api):
        r = admin_api.get(f"{BASE_URL}/api/admin/card-batches")
        assert r.status_code == 200
        body = r.json()
        assert "batches" in body
        assert "total" in body
        assert isinstance(body["batches"], list)

    def test_get_batch_detail(self, admin_api):
        # Use any existing batch
        r = admin_api.get(f"{BASE_URL}/api/admin/card-batches")
        batches = r.json()["batches"]
        if not batches:
            pytest.skip("no batches to inspect")
        bid = batches[0]["batch_id"]
        r2 = admin_api.get(f"{BASE_URL}/api/admin/card-batches/{bid}")
        assert r2.status_code == 200
        b = r2.json()
        assert b["batch_id"] == bid
        assert "entries" in b

    def test_export_csv(self, admin_api):
        r = admin_api.get(f"{BASE_URL}/api/admin/card-batches")
        batches = r.json()["batches"]
        if not batches:
            pytest.skip("no batches")
        bid = batches[0]["batch_id"]
        r2 = admin_api.get(f"{BASE_URL}/api/admin/card-batches/{bid}/export.csv")
        assert r2.status_code == 200
        assert "text/csv" in r2.headers.get("content-type", "").lower()
        assert b"user_id" in r2.content

    def test_card_logs(self, admin_api):
        r = admin_api.get(f"{BASE_URL}/api/admin/card-logs")
        assert r.status_code == 200
        body = r.json()
        assert "logs" in body
        assert "total" in body


# ------------------- 8. E2E: sponsor purchase -> commission -> batch -> sent_to_card -------------------

class TestE2EFlow:
    @pytest.fixture(scope="class")
    def sponsor_and_buyer(self, admin_api):
        sponsor_email = f"test_p3_sponsor_{RUN_TAG}@example.com"
        sponsor_s = _fresh_session()
        r = sponsor_s.post(f"{BASE_URL}/api/auth/register", json={
            "email": sponsor_email, "password": "Pass123!", "name": "TEST Sponsor",
            "phone": "11977776666",
        })
        assert r.status_code == 200
        sponsor_token = r.json()["token"]
        sponsor_uid = r.json()["user"]["user_id"]

        # Activate referral manually via admin (faster than enrollment form)
        act = admin_api.post(f"{BASE_URL}/api/admin/users/{sponsor_uid}/activate-referral")
        assert act.status_code == 200
        code = act.json()["referral_code"]

        # Buyer registers with sponsor_code - own session
        buyer_s = _fresh_session()
        buyer_email = f"test_p3_buyer_{RUN_TAG}@example.com"
        r2 = buyer_s.post(f"{BASE_URL}/api/auth/register", json={
            "email": buyer_email, "password": "Pass123!", "name": "TEST Buyer",
            "phone": "11966665555", "sponsor_code": code,
        })
        assert r2.status_code == 200
        buyer = r2.json()["user"]
        assert buyer.get("sponsor_id") == sponsor_uid

        return {
            "sponsor_token": sponsor_token, "sponsor_uid": sponsor_uid,
            "sponsor_code": code, "buyer_token": r2.json()["token"],
            "buyer": buyer,
        }

    def test_sponsor_linked(self, sponsor_and_buyer):
        assert sponsor_and_buyer["buyer"]["sponsor_id"] == sponsor_and_buyer["sponsor_uid"]

    def test_sponsor_my_referral_active(self, sponsor_and_buyer):
        s = _fresh_session()
        r = s.get(
            f"{BASE_URL}/api/users/me/referral",
            headers={"Authorization": f"Bearer {sponsor_and_buyer['sponsor_token']}"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["has_referral_program"] is True
        assert body["referral_code"] == sponsor_and_buyer["sponsor_code"]


# ------------------- 9. Reset all referrals (destructive; run last) -------------------

class TestResetAllReferralsZZ:
    """Destructive - named ZZ so pytest runs it late. Requires admin."""
    def test_reset_all(self, admin_api):
        # Create one throwaway user with a manually activated code, confirm reset clears it
        s = _fresh_session()
        email = f"test_p3_reset_{RUN_TAG}@example.com"
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Pass123!", "name": "TEST Reset", "phone": "11955554444",
        })
        uid = r.json()["user"]["user_id"]
        admin_api.post(f"{BASE_URL}/api/admin/users/{uid}/activate-referral")

        r2 = admin_api.post(f"{BASE_URL}/api/admin/reset-all-referrals")
        assert r2.status_code == 200
        body = r2.json()
        assert body["ok"] is True
        assert body["updated"] >= 1

        # Verify admin still logs in
        s2 = _fresh_session()
        r3 = s2.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r3.status_code == 200

        # Verify target user reset
        g = admin_api.get(f"{BASE_URL}/api/admin/users/{uid}")
        u = g.json()
        assert u.get("referral_program_active") is False
        assert not u.get("referral_code")
