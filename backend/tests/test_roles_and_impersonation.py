"""Testes para roles + impersonation (Iter 34)."""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
import bcrypt
from pymongo import MongoClient


def _read_env_url():
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip().strip('"')
    except Exception:
        pass
    return 'http://localhost:8001'


API_URL = os.environ.get("API_URL") or _read_env_url()
ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


def _now(): return datetime.now(timezone.utc).isoformat()


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ.get("MONGO_URL","mongodb://localhost:27017"))[os.environ.get("DB_NAME","oxxpharma")]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _create_user(db, prefix, role="customer", password="oxx@pharma"):
    uid = f"IT34_{prefix}_{uuid.uuid4().hex[:6]}"
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db.users.insert_one({
        "user_id": uid, "role": role, "status": "active",
        "name": f"IT34 {prefix}", "email": f"{uid}@example.com".lower(),
        "password_hash": pw_hash,
        "access_level": 1 if role in ("admin","super_admin") else 2 if role in ("comercial","financeiro") else 10,
        "created_at": _now(),
    })
    return uid


def _login(email, password):
    r = requests.post(f"{API_URL}/api/auth/login", json={"email": email.lower(), "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def test_super_admin_can_access_integrations(admin_token):
    r = requests.get(f"{API_URL}/api/admin/settings",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200


def test_comercial_cannot_access_integrations(db):
    uid = _create_user(db, "com", "comercial")
    try:
        tok = _login(f"{uid}@example.com", "oxx@pharma")
        # /api/admin/settings PUT exige super_admin
        r = requests.put(f"{API_URL}/api/admin/settings",
                         json={"foo": "bar"},
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 403
        # Mas pode listar usuarios
        r = requests.get(f"{API_URL}/api/admin/users?limit=1",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200
        # E pode acessar maxx-config? (é super_admin only)
        r = requests.get(f"{API_URL}/api/admin/maxx-config",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 403
    finally:
        db.users.delete_one({"user_id": uid})


def test_financeiro_can_see_orders_but_not_integrations(db):
    uid = _create_user(db, "fin", "financeiro")
    try:
        tok = _login(f"{uid}@example.com", "oxx@pharma")
        r = requests.get(f"{API_URL}/api/admin/orders?limit=1",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 200
        r = requests.put(f"{API_URL}/api/admin/settings", json={},
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 403
    finally:
        db.users.delete_one({"user_id": uid})


def test_customer_cannot_access_admin(db):
    uid = _create_user(db, "cust", "customer")
    try:
        tok = _login(f"{uid}@example.com", "oxx@pharma")
        r = requests.get(f"{API_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 403
    finally:
        db.users.delete_one({"user_id": uid})


def test_set_role_only_super_admin(db, admin_token):
    target = _create_user(db, "target", "customer")
    comercial = _create_user(db, "comx", "comercial")
    try:
        # Super admin pode
        r = requests.post(f"{API_URL}/api/admin/users/{target}/set-role",
                          json={"role": "financeiro"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "financeiro"

        # Comercial nao pode
        tok = _login(f"{comercial}@example.com", "oxx@pharma")
        r = requests.post(f"{API_URL}/api/admin/users/{target}/set-role",
                          json={"role": "customer"},
                          headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 403
    finally:
        db.users.delete_many({"user_id": {"$in": [target, comercial]}})


def test_impersonate_customer_as_admin(db, admin_token):
    target = _create_user(db, "impt", "customer")
    try:
        r = requests.post(f"{API_URL}/api/admin/users/{target}/impersonate",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        imp_token = r.json()["token"]
        imp_user = r.json()["user"]
        assert imp_user["user_id"] == target

        # O token impersonado acessa /api/auth/me como o user alvo
        r = requests.get(f"{API_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {imp_token}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user_id"] == target

        # Mas NAO consegue acessar endpoints admin (porque é customer)
        r = requests.get(f"{API_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {imp_token}"}, timeout=15)
        assert r.status_code == 403

        # Audit log foi gerado
        log = db.impersonation_audit_log.find_one({"target_user_id": target, "action": "start"})
        assert log is not None
        assert log["impersonator_email"] == ADMIN_EMAIL
    finally:
        db.users.delete_one({"user_id": target})
        db.impersonation_audit_log.delete_many({"target_user_id": target})


def test_impersonate_forbidden_for_financeiro(db):
    fin = _create_user(db, "finimp", "financeiro")
    target = _create_user(db, "tgtimp", "customer")
    try:
        tok = _login(f"{fin}@example.com", "oxx@pharma")
        r = requests.post(f"{API_URL}/api/admin/users/{target}/impersonate",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 403
    finally:
        db.users.delete_many({"user_id": {"$in": [fin, target]}})


def test_cannot_impersonate_another_admin_unless_super_admin(db):
    com = _create_user(db, "comtry", "comercial")
    targetadmin = _create_user(db, "otheradmin", "financeiro")
    try:
        tok = _login(f"{com}@example.com", "oxx@pharma")
        r = requests.post(f"{API_URL}/api/admin/users/{targetadmin}/impersonate",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code == 403
    finally:
        db.users.delete_many({"user_id": {"$in": [com, targetadmin]}})
