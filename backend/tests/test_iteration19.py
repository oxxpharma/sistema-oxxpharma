"""Iteration 19: Correios CWS (Bearer Token) migration tests.

Tests:
- GET /api/admin/correios-config returns new fields (environment/user/api_code/contract) and NO legacy password
- PUT /api/admin/correios-config validates environment enum
- PUT /api/admin/correios-config invalidates cached tokens on credential change
- POST /api/admin/correios-test-auth with missing creds returns clear error
- POST /api/admin/correios-test-auth with fake creds hits CWS real endpoint and returns 401 error
- db.correios_logs registers calls
- POST /api/shipping/calculate works with incomplete creds (no 500)
- Pickup option is prepended
- Package calc respects minimum dimensions/weight
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ============================ CONFIG ============================

class TestCorreiosConfigSchema:
    def test_get_config_returns_new_cws_fields_no_legacy_password(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/correios-config", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        cfg = r.json()
        # New CWS fields
        assert "correios_environment" in cfg
        assert cfg["correios_environment"] in ("homologacao", "producao")
        assert "correios_user" in cfg
        assert "correios_api_code" in cfg
        assert "correios_contract" in cfg
        assert "correios_origin_cep" in cfg
        assert "correios_services" in cfg
        assert isinstance(cfg["correios_services"], list)
        # Legacy field must not exist
        assert "correios_password" not in cfg, "Legacy correios_password should be REMOVED"

    def test_default_services_contains_cws_codes(self, auth_headers, db):
        # Reset to defaults to validate DEFAULT_SERVICES behavior
        db.settings.update_one(
            {"_id": "global"},
            {"$unset": {"correios_services": ""}},
            upsert=True
        )
        r = requests.get(f"{BASE_URL}/api/admin/correios-config", headers=auth_headers, timeout=10)
        cfg = r.json()
        codes = [s["code"] for s in cfg["correios_services"]]
        assert "03298" in codes, "PAC CWS code 03298 missing"
        assert "03220" in codes, "SEDEX CWS code 03220 missing"

    def test_put_invalid_environment_returns_400(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/admin/correios-config",
                         headers=auth_headers,
                         json={"correios_environment": "staging"}, timeout=10)
        assert r.status_code == 400, f"Expected 400 for invalid env got {r.status_code}: {r.text}"

    def test_put_accepts_homologacao_and_producao(self, auth_headers):
        for env in ("homologacao", "producao"):
            r = requests.put(f"{BASE_URL}/api/admin/correios-config",
                             headers=auth_headers,
                             json={"correios_environment": env}, timeout=10)
            assert r.status_code == 200, f"Failed setting env={env}"
            assert r.json()["correios_environment"] == env
        # Leave in homologacao
        requests.put(f"{BASE_URL}/api/admin/correios-config", headers=auth_headers,
                     json={"correios_environment": "homologacao"}, timeout=10)

    def test_put_credentials_invalidates_token_cache(self, auth_headers, db):
        # Seed a fake cached token
        db.correios_tokens.insert_one({
            "_id": "homologacao:FAKEUSER:999",
            "token": "OLDTOKEN",
            "expires_at": "2099-01-01T00:00:00+00:00",
            "env": "homologacao", "user": "FAKEUSER", "contract": "999",
        })
        count_before = db.correios_tokens.count_documents({})
        assert count_before >= 1

        # Update credentials
        r = requests.put(f"{BASE_URL}/api/admin/correios-config",
                         headers=auth_headers,
                         json={"correios_user": "NEWUSER_TEST"}, timeout=10)
        assert r.status_code == 200

        # Tokens collection must be cleared
        count_after = db.correios_tokens.count_documents({})
        assert count_after == 0, f"Token cache should be cleared, still has {count_after}"


# ============================ TEST-AUTH ENDPOINT ============================

class TestCorreiosTestAuth:
    def test_test_auth_missing_credentials(self, auth_headers, db):
        # Clear credentials
        db.settings.update_one(
            {"_id": "global"},
            {"$set": {
                "correios_user": "",
                "correios_api_code": "",
                "correios_contract": "",
                "correios_environment": "homologacao",
            }},
            upsert=True,
        )
        r = requests.post(f"{BASE_URL}/api/admin/correios-test-auth",
                          headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is False
        err = (data.get("error") or "").lower()
        assert "credenciais" in err or "incompleta" in err, f"Unexpected error msg: {data}"

    def test_test_auth_fake_credentials_hits_real_cws(self, auth_headers, db):
        # Set fake credentials
        requests.put(f"{BASE_URL}/api/admin/correios-config",
                     headers=auth_headers,
                     json={
                         "correios_environment": "homologacao",
                         "correios_user": "FAKEUSER_TEST",
                         "correios_api_code": "FAKECODE_TEST",
                         "correios_contract": "0000000000",
                     }, timeout=10)
        r = requests.post(f"{BASE_URL}/api/admin/correios-test-auth",
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is False
        err = (data.get("error") or "").lower()
        # Either 401 from real server, or a network failure — both prove integration is real
        assert ("401" in err or "falha autenticacao" in err or "autentica" in err), \
            f"Expected CWS auth failure got: {data}"

    def test_correios_logs_registered(self, auth_headers, db):
        # After above call, logs should contain an auth entry
        log = db.correios_logs.find_one({"kind": "auth"}, sort=[("created_at", -1)])
        assert log is not None, "No auth log registered"
        assert log.get("env") in ("homologacao", "producao")
        assert "status_code" in log
        assert "request_body" in log
        assert "token/v1/autentica/contrato" in log.get("url", "")


# ============================ SHIPPING CALCULATE ============================

class TestShippingCalculate:
    def test_calculate_with_incomplete_creds_no_500(self, auth_headers, db):
        # Ensure enabled but with fake creds + valid origin
        requests.put(f"{BASE_URL}/api/admin/correios-config",
                     headers=auth_headers,
                     json={
                         "correios_enabled": True,
                         "correios_origin_cep": "01310100",
                         "correios_user": "FAKEUSER",
                         "correios_api_code": "FAKECODE",
                         "correios_contract": "9999999999",
                         "correios_pickup_enabled": False,
                     }, timeout=10)
        r = requests.post(f"{BASE_URL}/api/shipping/calculate",
                          json={"cep_destination": "04567000",
                                "items": [{"weight": 0.5, "quantity": 1}]},
                          timeout=45)
        assert r.status_code == 200, f"Must not 500 - got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "options" in data
        # Options should contain error entries (not crash)
        # Note: could be empty if everything failed gracefully

    def test_pickup_prepended_when_enabled(self, auth_headers, db):
        requests.put(f"{BASE_URL}/api/admin/correios-config",
                     headers=auth_headers,
                     json={
                         "correios_pickup_enabled": True,
                         "correios_pickup_label": "Retirar em São Paulo",
                         "correios_pickup_price": 0,
                     }, timeout=10)
        r = requests.post(f"{BASE_URL}/api/shipping/calculate",
                          json={"cep_destination": "04567000",
                                "items": [{"weight": 0.5, "quantity": 1}]},
                          timeout=45)
        assert r.status_code == 200
        opts = r.json().get("options", [])
        assert len(opts) > 0
        assert opts[0]["code"] == "PICKUP", f"Pickup must be first, got {opts[0]}"
        assert opts[0].get("pickup") is True

    def test_package_minimum_dimensions(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/shipping/calculate",
                          json={"cep_destination": "04567000",
                                "items": [{"weight": 0.01, "quantity": 1,
                                           "length_cm": 5, "width_cm": 3, "height_cm": 1}]},
                          timeout=45)
        assert r.status_code == 200
        pkg = r.json().get("package")
        assert pkg is not None
        assert pkg["length_cm"] >= 16
        assert pkg["width_cm"] >= 11
        assert pkg["height_cm"] >= 2
        assert pkg["weight_kg"] >= 0.3  # min weight default


# ============================ CLEANUP ============================

def teardown_module(module):
    """Reset credentials to empty for safety."""
    try:
        client = MongoClient(MONGO_URL)
        client[DB_NAME].settings.update_one(
            {"_id": "global"},
            {"$set": {
                "correios_user": "",
                "correios_api_code": "",
                "correios_contract": "",
                "correios_enabled": False,
                "correios_environment": "homologacao",
            }},
        )
        client[DB_NAME].correios_tokens.delete_many({})
        client.close()
    except Exception:
        pass
