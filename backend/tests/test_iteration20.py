"""Iteration 20 backend tests:
- Maxx MMN integration (config, sync, logs)
- Site Settings (public + admin PUT)
- Upload image (base64)
- CMS Pages (CRUD + public render)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ==================== MAXX MMN ====================

class TestMaxxConfig:
    def test_get_default_config(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/maxx-config")
        assert r.status_code == 200
        d = r.json()
        # Has all keys
        assert "maxx_enabled" in d
        assert "maxx_mode" in d
        assert "maxx_auth_type" in d
        assert d["maxx_mode"] in ("realtime", "batch", "manual")
        assert d["maxx_auth_type"] in ("none", "bearer", "apikey", "basic")

    def test_put_config_persists(self, admin_session):
        payload = {
            "maxx_enabled": False,  # keep disabled to not pollute
            "maxx_api_url": "https://httpbin.org/post",
            "maxx_mode": "manual",
            "maxx_auth_type": "bearer",
            "maxx_auth_value": "TEST_token_xyz",
            "maxx_payload_template": "",
        }
        r = admin_session.put(f"{BASE_URL}/api/admin/maxx-config", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["maxx_api_url"] == "https://httpbin.org/post"
        assert d["maxx_auth_type"] == "bearer"
        # Verify persistence via GET
        r2 = admin_session.get(f"{BASE_URL}/api/admin/maxx-config")
        assert r2.json()["maxx_api_url"] == "https://httpbin.org/post"

    def test_invalid_mode_returns_400(self, admin_session):
        r = admin_session.put(f"{BASE_URL}/api/admin/maxx-config", json={"maxx_mode": "invalid_mode"})
        assert r.status_code == 400

    def test_invalid_auth_type_returns_400(self, admin_session):
        r = admin_session.put(f"{BASE_URL}/api/admin/maxx-config", json={"maxx_auth_type": "magic"})
        assert r.status_code == 400


class TestMaxxSync:
    def test_sync_when_disabled_skips(self, admin_session):
        # ensure disabled
        admin_session.put(f"{BASE_URL}/api/admin/maxx-config", json={"maxx_enabled": False})
        r = admin_session.post(f"{BASE_URL}/api/admin/maxx-sync-points")
        assert r.status_code == 200
        d = r.json()
        assert d.get("success") is False
        assert d.get("skipped") is True

    def test_sync_with_no_url_returns_error_when_enabled(self, admin_session):
        # enable but clear URL
        admin_session.put(f"{BASE_URL}/api/admin/maxx-config", json={"maxx_enabled": True, "maxx_api_url": ""})
        r = admin_session.post(f"{BASE_URL}/api/admin/maxx-sync-points")
        assert r.status_code == 200
        d = r.json()
        # Either error or no_pending if no points to send
        # If there are pending points, it would say maxx_api_url nao configurada
        # If no pending, would say no_pending. Both acceptable.
        assert d.get("success") is False or d.get("skipped") is True

    def test_sync_with_fake_url_logs_attempt(self, admin_session):
        # Setup: enable + bad URL to force connection error AND make sure there's at least 1 pending point
        admin_session.put(f"{BASE_URL}/api/admin/maxx-config", json={
            "maxx_enabled": True,
            "maxx_api_url": "http://localhost:9999/fake",
            "maxx_mode": "manual",
            "maxx_auth_type": "none",
        })
        # Trigger sync (may have 0 pending - that's fine, we test non-crash)
        r = admin_session.post(f"{BASE_URL}/api/admin/maxx-sync-points")
        assert r.status_code == 200
        # cleanup
        admin_session.put(f"{BASE_URL}/api/admin/maxx-config", json={"maxx_enabled": False})


class TestMaxxLogs:
    def test_logs_endpoint_returns_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/maxx-logs")
        assert r.status_code == 200
        d = r.json()
        assert "logs" in d
        assert "total" in d
        assert isinstance(d["logs"], list)


# ==================== SITE SETTINGS ====================

class TestSiteSettings:
    def test_public_get_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/site-settings")
        assert r.status_code == 200
        d = r.json()
        assert "store_name" in d
        assert "brand_primary_color" in d
        assert "hero_title" in d
        assert "footer_pages" in d
        assert "announcement_bar_enabled" in d

    def test_admin_put_persists_all_fields(self, admin_session):
        payload = {
            "store_name": "TEST_OxxPharma",
            "logo_url": "https://example.com/logo.png",
            "brand_primary_color": "#FF00AA",
            "hero_title": "TEST_Hero",
            "hero_subtitle": "TEST_Sub",
            "hero_image_url": "https://example.com/hero.jpg",
            "hero_cta_label": "TEST_CTA",
            "hero_cta_link": "/test",
            "social_instagram": "@testoxx",
            "footer_about": "TEST_about",
            "footer_pages": [{"label": "TEST_Page", "slug": "test-page"}],
            "announcement_bar_enabled": True,
            "announcement_bar_text": "TEST_announcement",
            "announcement_bar_bg_color": "#000000",
        }
        r = admin_session.put(f"{BASE_URL}/api/admin/site-settings", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["store_name"] == "TEST_OxxPharma"
        assert d["logo_url"] == "https://example.com/logo.png"
        assert d["brand_primary_color"] == "#FF00AA"
        assert d["hero_title"] == "TEST_Hero"
        assert d["announcement_bar_enabled"] is True
        assert d["announcement_bar_text"] == "TEST_announcement"
        assert isinstance(d["footer_pages"], list)
        assert d["footer_pages"][0]["slug"] == "test-page"

        # Public read confirms
        r2 = requests.get(f"{BASE_URL}/api/site-settings")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["store_name"] == "TEST_OxxPharma"
        assert d2["announcement_bar_enabled"] is True

    def test_restore_defaults(self, admin_session):
        # cleanup - reset to defaults
        admin_session.put(f"{BASE_URL}/api/admin/site-settings", json={
            "store_name": "OxxPharma",
            "announcement_bar_enabled": False,
            "announcement_bar_text": "",
            "brand_primary_color": "#E8731A",
            "hero_title": "Saúde e bem-estar em sua casa",
        })


# ==================== UPLOAD IMAGE ====================

class TestUploadImage:
    def test_upload_valid_base64(self, admin_session):
        # 1x1 transparent PNG
        b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        payload = {"data": f"data:image/png;base64,{b64}", "name": "TEST_img.png"}
        r = admin_session.post(f"{BASE_URL}/api/admin/upload-image", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert "upload_id" in d
        assert "url" in d
        assert d["url"].startswith("data:image/")

    def test_upload_invalid_format_returns_400(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/upload-image", json={"data": "not_a_data_url"})
        assert r.status_code == 400


# ==================== CMS PAGES ====================

class TestCmsPages:
    @pytest.fixture(scope="class")
    def created_page_id(self, admin_session):
        slug = f"test-page-{int(time.time())}"
        r = admin_session.post(f"{BASE_URL}/api/admin/pages", json={
            "slug": slug,
            "title": "TEST Page",
            "html": "<div><h1>TEST</h1><p>content</p></div>",
            "css": ".x{color:red}",
            "components_json": {"type": "wrapper"},
            "published": True,
        })
        assert r.status_code == 200
        d = r.json()
        page_id = d["page_id"]
        yield {"page_id": page_id, "slug": slug}
        # teardown
        admin_session.delete(f"{BASE_URL}/api/admin/pages/{page_id}")

    def test_create_no_slug_returns_400(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/pages", json={"title": "x"})
        assert r.status_code == 400

    def test_create_duplicate_slug_returns_400(self, admin_session, created_page_id):
        r = admin_session.post(f"{BASE_URL}/api/admin/pages", json={"slug": created_page_id["slug"]})
        assert r.status_code == 400

    def test_list_pages_no_html_css(self, admin_session, created_page_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/pages")
        assert r.status_code == 200
        d = r.json()
        assert "pages" in d
        # Find our page
        found = [p for p in d["pages"] if p.get("page_id") == created_page_id["page_id"]]
        assert len(found) == 1
        # Should NOT have html/css/components_json (perf optimization)
        assert "html" not in found[0]
        assert "css" not in found[0]

    def test_get_page_by_id_returns_full(self, admin_session, created_page_id):
        r = admin_session.get(f"{BASE_URL}/api/admin/pages/{created_page_id['page_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["page_id"] == created_page_id["page_id"]
        assert "html" in d
        assert d["html"].startswith("<div>")
        assert "css" in d

    def test_update_page(self, admin_session, created_page_id):
        r = admin_session.put(f"{BASE_URL}/api/admin/pages/{created_page_id['page_id']}", json={
            "title": "TEST Updated",
            "html": "<p>updated</p>",
            "css": ".y{color:blue}",
            "published": True,
            "meta_description": "TEST meta",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "TEST Updated"
        assert d["html"] == "<p>updated</p>"
        assert d["meta_description"] == "TEST meta"
        # Verify persistence via GET
        r2 = admin_session.get(f"{BASE_URL}/api/admin/pages/{created_page_id['page_id']}")
        assert r2.json()["title"] == "TEST Updated"

    def test_update_slug_duplicate_returns_400(self, admin_session, created_page_id):
        # Create another page first
        slug2 = f"test-page2-{int(time.time())}"
        r = admin_session.post(f"{BASE_URL}/api/admin/pages", json={"slug": slug2})
        assert r.status_code == 200
        page_id2 = r.json()["page_id"]
        try:
            # Try to rename second to first's slug
            r2 = admin_session.put(f"{BASE_URL}/api/admin/pages/{page_id2}", json={"slug": created_page_id["slug"]})
            assert r2.status_code == 400
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/pages/{page_id2}")

    def test_public_get_published_page(self, created_page_id):
        r = requests.get(f"{BASE_URL}/api/pages/{created_page_id['slug']}")
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == created_page_id["slug"]
        assert "html" in d  # public exposes html for rendering

    def test_public_get_unpublished_returns_404(self, admin_session):
        slug = f"test-unpub-{int(time.time())}"
        r = admin_session.post(f"{BASE_URL}/api/admin/pages", json={"slug": slug, "published": False})
        assert r.status_code == 200
        page_id = r.json()["page_id"]
        try:
            r2 = requests.get(f"{BASE_URL}/api/pages/{slug}")
            assert r2.status_code == 404
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/pages/{page_id}")

    def test_public_get_unknown_slug_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/pages/this-slug-does-not-exist-zzz")
        assert r.status_code == 404

    def test_delete_page(self, admin_session):
        slug = f"test-del-{int(time.time())}"
        r = admin_session.post(f"{BASE_URL}/api/admin/pages", json={"slug": slug})
        assert r.status_code == 200
        page_id = r.json()["page_id"]
        r2 = admin_session.delete(f"{BASE_URL}/api/admin/pages/{page_id}")
        assert r2.status_code == 200
        # Verify removed
        r3 = admin_session.get(f"{BASE_URL}/api/admin/pages/{page_id}")
        assert r3.status_code == 404
