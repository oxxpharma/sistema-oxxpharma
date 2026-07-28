"""Iter 54 — Multiplier Campaign endpoint tests."""
import os
import re
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASS = "admin123"
CUST_EMAIL = "joao@rede1.com.br"
CUST_PASS = "oxx@pharma"

CURRENT_MONTH = datetime.now(timezone.utc).astimezone().strftime("%Y-%m")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUST_EMAIL, CUST_PASS)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def cust_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


@pytest.fixture(scope="module", autouse=True)
def reset_campaign_state(admin_headers):
    """Ensure clean baseline and cleanup at end."""
    # Reset to disabled/empty
    requests.put(f"{BASE_URL}/api/admin/multiplier-campaign",
                 headers=admin_headers,
                 json={"enabled": False, "value": 2.0, "started_at": "", "goals": {}},
                 timeout=15)
    yield
    # Teardown
    requests.put(f"{BASE_URL}/api/admin/multiplier-campaign",
                 headers=admin_headers,
                 json={"enabled": False, "value": 2.0, "started_at": "", "goals": {}},
                 timeout=15)


# ============ Auth checks ============

class TestAuth:
    def test_get_cfg_no_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign", timeout=10)
        assert r.status_code in (401, 403)

    def test_get_cfg_customer_forbidden(self, cust_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign", headers=cust_headers, timeout=10)
        assert r.status_code == 403

    def test_stats_customer_forbidden(self, cust_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign/stats", headers=cust_headers, timeout=10)
        assert r.status_code == 403

    def test_reprocess_customer_forbidden(self, cust_headers):
        r = requests.post(f"{BASE_URL}/api/admin/multiplier-campaign/reprocess",
                          headers=cust_headers, timeout=10)
        assert r.status_code == 403

    def test_users_customer_forbidden(self, cust_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign/users", headers=cust_headers, timeout=10)
        assert r.status_code == 403

    def test_me_multiplier_no_token(self):
        r = requests.get(f"{BASE_URL}/api/users/me/multiplier", timeout=10)
        assert r.status_code in (401, 403)

    def test_me_multiplier_customer_ok(self, cust_headers):
        r = requests.get(f"{BASE_URL}/api/users/me/multiplier", headers=cust_headers, timeout=15)
        assert r.status_code == 200


# ============ GET /admin/multiplier-campaign initial state ============

class TestGetCampaign:
    def test_initial_state(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert set(["enabled", "value", "goals", "started_at", "start_month"]).issubset(d.keys())
        assert d["enabled"] is False
        assert d["value"] == 2.0
        assert d["goals"] == {}
        assert d["started_at"] is None
        assert d["start_month"] == ""


# ============ PUT validation ============

class TestUpdateCampaign:
    def test_update_value_out_of_range_low(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/admin/multiplier-campaign",
                         headers=admin_headers, json={"value": 0.5}, timeout=10)
        assert r.status_code == 400

    def test_update_value_out_of_range_high(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/admin/multiplier-campaign",
                         headers=admin_headers, json={"value": 25}, timeout=10)
        assert r.status_code == 400

    def test_update_started_at_invalid(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/admin/multiplier-campaign",
                         headers=admin_headers, json={"started_at": "2026/01/01"}, timeout=10)
        assert r.status_code == 400

    def test_update_full_valid(self, admin_headers):
        payload = {
            "enabled": True,
            "value": 3.0,
            "started_at": f"{CURRENT_MONTH}-01",
            "goals": {CURRENT_MONTH: 5000.0, "invalid-key": 100, "2026-01": -50},
        }
        r = requests.put(f"{BASE_URL}/api/admin/multiplier-campaign",
                         headers=admin_headers, json=payload, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is True
        assert d["value"] == 3.0
        assert d["started_at"] == f"{CURRENT_MONTH}-01"
        assert d["start_month"] == CURRENT_MONTH
        # invalid-key filtered out; negative goal filtered out
        assert "invalid-key" not in d["goals"]
        assert "2026-01" not in d["goals"] or d["goals"].get("2026-01", 1) > 0
        assert d["goals"].get(CURRENT_MONTH) == 5000.0


# ============ Reprocess ============

class TestReprocess:
    def test_invalid_month(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/multiplier-campaign/reprocess?month=2026-1",
                          headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_bootstrap_activates_all(self, admin_headers):
        # Config was already set: enabled=True, started_at=CURRENT_MONTH-01
        r = requests.post(f"{BASE_URL}/api/admin/multiplier-campaign/reprocess?month={CURRENT_MONTH}",
                          headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["month"] == CURRENT_MONTH
        assert d["bootstrap"] is True
        assert d["evaluated"] > 0
        assert d["activated"] == d["evaluated"]
        assert d["deactivated"] == 0

    def test_non_bootstrap_missing_goal_deactivates(self, admin_headers):
        # Reprocess a different month with NO goal set for prev -> deactivates all
        # Pick 2027-06 (way future, non-bootstrap)
        target = "2027-06"
        r = requests.post(f"{BASE_URL}/api/admin/multiplier-campaign/reprocess?month={target}",
                          headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["bootstrap"] is False
        assert d["prev_goal"] == 0
        assert d["activated"] == 0
        assert d["deactivated"] == d["evaluated"]

    def test_idempotent(self, admin_headers):
        # Run bootstrap twice, expect same counts
        r1 = requests.post(f"{BASE_URL}/api/admin/multiplier-campaign/reprocess?month={CURRENT_MONTH}",
                           headers=admin_headers, timeout=60).json()
        r2 = requests.post(f"{BASE_URL}/api/admin/multiplier-campaign/reprocess?month={CURRENT_MONTH}",
                           headers=admin_headers, timeout=60).json()
        assert r1["activated"] == r2["activated"]
        assert r1["evaluated"] == r2["evaluated"]


# ============ Stats ============

class TestStats:
    def test_stats_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign/stats?month={CURRENT_MONTH}",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("month", "campaign_enabled", "multiplier_value", "total_mmn_users",
                  "active_count", "hit_last_month_count", "goal_current",
                  "top_streak", "history", "progress_buckets"):
            assert k in d, f"missing key {k}"
        for b in ("0-25", "25-50", "50-75", "75-100", "100+"):
            assert b in d["progress_buckets"]
        assert d["total_mmn_users"] > 0
        assert d["active_count"] >= 0


# ============ Users list ============

class TestUsersList:
    def test_all(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign/users?month={CURRENT_MONTH}&filter=all",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["month"] == CURRENT_MONTH
        assert d["filter"] == "all"
        assert isinstance(d["users"], list)
        assert len(d["users"]) > 0

    def test_filter_active(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign/users?month={CURRENT_MONTH}&filter=active",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        for u in r.json()["users"]:
            assert u["active"] is True

    def test_search(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/multiplier-campaign/users?month={CURRENT_MONTH}&search=joao",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200
        users = r.json()["users"]
        # All returned users should have 'joao' in name or email
        for u in users:
            hay = (u.get("name","") + " " + u.get("email","")).lower()
            assert "joao" in hay


# ============ /users/me/multiplier ============

class TestMySnapshot:
    def test_shape(self, cust_headers):
        r = requests.get(f"{BASE_URL}/api/users/me/multiplier", headers=cust_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("campaign_enabled", "multiplier_value", "month", "active",
                  "sales_gen1_current_month", "goal_current_month",
                  "progress_pct", "hit_goal_last_month", "streak_months",
                  "applicable_generations"):
            assert k in d, f"missing key {k}"
        assert d["applicable_generations"] == [3, 4, 5, 6]
        assert d["month"] == CURRENT_MONTH

    def test_bootstrap_active(self, cust_headers):
        # After bootstrap reprocess, joao should be active
        r = requests.get(f"{BASE_URL}/api/users/me/multiplier", headers=cust_headers, timeout=20)
        d = r.json()
        assert d["campaign_enabled"] is True
        assert d["active"] is True
