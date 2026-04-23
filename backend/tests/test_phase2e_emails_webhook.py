"""Phase 2E - Transactional emails (Resend) + External webhook sync tests.

Covers:
- 8 default email templates seeded
- CRUD email-templates, reset default
- email-test endpoint behaviour (disabled / no_api_key)
- email-broadcast (target admin only to save time)
- email-logs pagination
- settings accept new email_* and external_webhook_token
- external/network1/sync auth (401 missing token) + upsert + delete + invalid action
- webhook-logs pagination + token regenerate
- triggers create logs asynchronously (register -> welcome)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ===== Default templates =====
class TestDefaultTemplates:
    def test_eight_default_templates_seeded(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/email-templates", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        slugs = {t["slug"] for t in r.json()["templates"]}
        expected = {"welcome", "order_created", "order_paid", "order_shipped",
                    "order_delivered", "commission_earned",
                    "admin_new_candidate", "admin_new_order"}
        assert expected.issubset(slugs), f"Missing: {expected - slugs}"

    def test_template_fields_present(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/email-templates", headers=admin_headers, timeout=15)
        tpl = next(t for t in r.json()["templates"] if t["slug"] == "welcome")
        for f in ("slug", "name", "subject", "body_html", "active", "template_id"):
            assert f in tpl, f"Field {f} missing in template"


# ===== Template CRUD =====
class TestTemplateCRUD:
    def test_create_update_delete(self, admin_headers):
        slug = f"TEST_tpl_{uuid.uuid4().hex[:8]}"
        payload = {"slug": slug, "name": "Test Tpl", "subject": "Hi {{user.name}}",
                   "body_html": "<p>Hello {{user.name}}</p>", "body_text": "Hi {{user.name}}", "active": True}
        r = requests.post(f"{BASE_URL}/api/admin/email-templates", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        tpl = r.json()
        assert tpl["slug"] == slug
        tid = tpl["template_id"]

        # Duplicate slug
        r2 = requests.post(f"{BASE_URL}/api/admin/email-templates", json=payload, headers=admin_headers, timeout=15)
        assert r2.status_code == 400

        # Update
        r3 = requests.put(f"{BASE_URL}/api/admin/email-templates/{tid}",
                          json={"name": "Updated Name"}, headers=admin_headers, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["name"] == "Updated Name"

        # Delete
        r4 = requests.delete(f"{BASE_URL}/api/admin/email-templates/{tid}", headers=admin_headers, timeout=15)
        assert r4.status_code == 200

    def test_reset_default_template(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/email-templates", headers=admin_headers, timeout=15)
        welcome = next(t for t in r.json()["templates"] if t["slug"] == "welcome")
        tid = welcome["template_id"]
        # modify
        requests.put(f"{BASE_URL}/api/admin/email-templates/{tid}",
                     json={"subject": "MODIFIED_SUBJECT_XXX"}, headers=admin_headers, timeout=15)
        # reset
        r2 = requests.post(f"{BASE_URL}/api/admin/email-templates/{tid}/reset", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        assert "MODIFIED_SUBJECT_XXX" not in r2.json()["subject"]


# ===== Email test endpoint =====
class TestEmailTest:
    def test_email_disabled_default(self, admin_headers):
        # Ensure email_enabled = False
        requests.put(f"{BASE_URL}/api/admin/settings",
                     json={"email_enabled": False}, headers=admin_headers, timeout=15)
        r = requests.post(f"{BASE_URL}/api/admin/email-test",
                          json={"to": "test@example.com", "subject": "T", "body_html": "<p>h</p>"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("sent") is False
        assert r.json().get("reason") == "emails_disabled"

    def test_no_api_key(self, admin_headers):
        # Enable but no api key
        requests.put(f"{BASE_URL}/api/admin/settings",
                     json={"email_enabled": True, "resend_api_key": ""}, headers=admin_headers, timeout=15)
        r = requests.post(f"{BASE_URL}/api/admin/email-test",
                          json={"to": "test@example.com", "subject": "T", "body_html": "<p>h</p>"},
                          headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("sent") is False
        assert r.json().get("reason") == "no_api_key"

        # restore disabled
        requests.put(f"{BASE_URL}/api/admin/settings",
                     json={"email_enabled": False}, headers=admin_headers, timeout=15)


# ===== Broadcast =====
class TestBroadcast:
    def test_broadcast_admin_target(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/email-broadcast",
                          json={"target": "admin", "subject": "TEST_broadcast", "body_html": "<p>x</p>"},
                          headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "sent" in data and "failed" in data and "total" in data
        assert data["total"] >= 1

    def test_broadcast_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/email-broadcast",
                          json={"target": "admin", "subject": "x", "body_html": "x"},
                          headers={"Content-Type": "application/json"}, timeout=15)
        assert r.status_code in (401, 403)


# ===== Email logs =====
class TestEmailLogs:
    def test_list_logs_pagination(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/email-logs?page=1&limit=10",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "logs" in d and "total" in d and "page" in d
        assert isinstance(d["logs"], list)


# ===== Settings accept new fields =====
class TestSettings:
    def test_settings_accept_email_fields(self, admin_headers):
        payload = {
            "email_enabled": False,
            "resend_api_key": "",
            "email_from": "OxxPharma <onboarding@resend.dev>",
            "email_admin_recipients": "admin@example.com",
            "email_trigger_welcome": True,
            "email_trigger_order_created": True,
        }
        r = requests.put(f"{BASE_URL}/api/admin/settings", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15).json()
        assert g.get("email_from") == payload["email_from"]
        assert g.get("email_admin_recipients") == "admin@example.com"

    def test_external_webhook_token_present(self, admin_headers):
        g = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15).json()
        assert g.get("external_webhook_token"), "Token should be auto-generated on startup"


# ===== Webhook external/network1/sync =====
@pytest.fixture(scope="module")
def webhook_token(admin_headers):
    g = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15).json()
    return g.get("external_webhook_token")


class TestWebhookSync:
    def test_missing_token_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/external/network1/sync",
                          json={"action": "upsert", "users": []}, timeout=15)
        assert r.status_code == 401

    def test_wrong_token_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/external/network1/sync",
                          json={"action": "upsert", "users": []},
                          headers={"X-Webhook-Token": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_upsert_creates_users(self, webhook_token, admin_headers):
        rand = uuid.uuid4().hex[:6]
        ext1 = f"TESTEXT{rand}1"
        ext2 = f"TESTEXT{rand}2"
        email1 = f"test_lead_{rand}@ext.com"
        email2 = f"test_mem_{rand}@ext.com"
        payload = {
            "action": "upsert",
            "users": [
                {"external_id": ext1, "name": "TEST Leader", "email": email1},
                {"external_id": ext2, "name": "TEST Member", "email": email2,
                 "leader_external_id": ext1},
            ]
        }
        r = requests.post(f"{BASE_URL}/api/external/network1/sync",
                          json=payload, headers={"X-Webhook-Token": webhook_token}, timeout=30)
        assert r.status_code == 200, r.text
        stats = r.json()
        assert stats.get("created", 0) >= 2 or (stats.get("created", 0) + stats.get("updated", 0)) >= 2
        # Verify via admin users list (search by email)
        u = requests.get(f"{BASE_URL}/api/admin/users?search={email1}",
                         headers=admin_headers, timeout=15).json()
        users = u.get("users", u if isinstance(u, list) else [])
        assert any(x.get("external_id") == ext1 for x in users)

        # Also validate leader linkage
        u2 = requests.get(f"{BASE_URL}/api/admin/users?search={email2}",
                          headers=admin_headers, timeout=15).json()
        users2 = u2.get("users", u2 if isinstance(u2, list) else [])
        member = next((x for x in users2 if x.get("external_id") == ext2), None)
        assert member is not None
        assert member.get("network_type") == "network_1"
        assert member.get("network_sponsor_id"), "Leader should be linked via network_sponsor_id"

    def test_delete_reverts_to_customer(self, webhook_token, admin_headers):
        rand = uuid.uuid4().hex[:6]
        ext = f"TESTDEL{rand}"
        email = f"test_del_{rand}@ext.com"
        # First upsert
        requests.post(f"{BASE_URL}/api/external/network1/sync",
                      json={"action": "upsert", "users": [
                          {"external_id": ext, "name": "TEST Del", "email": email}]},
                      headers={"X-Webhook-Token": webhook_token}, timeout=15)
        # Delete
        r = requests.post(f"{BASE_URL}/api/external/network1/sync",
                          json={"action": "delete", "users": [
                              {"external_id": ext, "name": "x", "email": email}]},
                          headers={"X-Webhook-Token": webhook_token}, timeout=15)
        assert r.status_code == 200
        u = requests.get(f"{BASE_URL}/api/admin/users?search={email}",
                         headers=admin_headers, timeout=15).json()
        users = u.get("users", u if isinstance(u, list) else [])
        found = next((x for x in users if x.get("external_id") == ext), None)
        assert found is not None, "User still exists after delete (soft)"
        assert found.get("network_type") == "customer"
        assert found.get("network_sponsor_id") in (None, "")

    def test_invalid_action_returns_400(self, webhook_token):
        r = requests.post(f"{BASE_URL}/api/external/network1/sync",
                          json={"action": "explode", "users": [
                              {"external_id": "X", "name": "x", "email": "x@x.com"}]},
                          headers={"X-Webhook-Token": webhook_token}, timeout=15)
        assert r.status_code == 400


class TestWebhookAdmin:
    def test_webhook_logs_pagination(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/webhook-logs?page=1&limit=10",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "logs" in d and "total" in d

    def test_regenerate_token(self, admin_headers):
        old = requests.get(f"{BASE_URL}/api/admin/settings", headers=admin_headers, timeout=15).json().get("external_webhook_token")
        r = requests.post(f"{BASE_URL}/api/admin/webhook-token/regenerate", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        new = r.json().get("external_webhook_token")
        assert new and new != old
        # Old token must be invalid
        r2 = requests.post(f"{BASE_URL}/api/external/network1/sync",
                           json={"action": "upsert", "users": []},
                           headers={"X-Webhook-Token": old}, timeout=15)
        assert r2.status_code == 401


# ===== Register trigger creates welcome email log =====
class TestRegisterTrigger:
    def test_register_creates_welcome_log(self, admin_headers):
        # Ensure welcome trigger on, email disabled (expected state)
        requests.put(f"{BASE_URL}/api/admin/settings",
                     json={"email_enabled": False, "email_trigger_welcome": True},
                     headers=admin_headers, timeout=15)
        email = f"test_welcome_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"name": "TEST Welcome", "email": email, "password": "pass1234"}, timeout=15)
        assert r.status_code == 200, r.text
        # asyncio.create_task - wait briefly
        time.sleep(2)
        logs = requests.get(f"{BASE_URL}/api/admin/email-logs?page=1&limit=50",
                            headers=admin_headers, timeout=15).json()
        found = any(email in (log.get("to") or []) for log in logs.get("logs", []))
        assert found, "Welcome email log not found after register"
