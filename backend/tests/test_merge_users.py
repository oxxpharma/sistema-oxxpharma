"""Teste de regressão para o fluxo de fusão de contas duplicadas.

Cenários:
1. Funde 2 contas (keep + drop) e valida:
   - dados cadastrais preenchidos do drop sobrescrevem keep
   - dados vazios do drop NÃO sobrescrevem keep preenchido
   - orders, points_log, commissions migrados
   - sponsor_id/network_sponsor_id de outros users redirecionado
   - merge_audit_log gerado
   - drop é deletado
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

API_URL = os.environ.get("API_URL") or _read_env_url() if False else None
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


def _now():
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def db():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "oxxpharma")
    client = MongoClient(mongo_url)
    return client[db_name]


def test_merge_preserves_filled_keep_fields(db, admin_token):
    keep_id = f"test_keep_{uuid.uuid4().hex[:8]}"
    drop_id = f"test_drop_{uuid.uuid4().hex[:8]}"
    downstream_id = f"test_dn_{uuid.uuid4().hex[:8]}"
    cpf = "99988877766"
    order_id = f"ord_{uuid.uuid4().hex[:8]}"
    commission_id = f"cm_{uuid.uuid4().hex[:8]}"

    try:
        # Setup
        db.users.insert_one({
            "user_id": keep_id, "role": "customer", "status": "active",
            "name": "João Original Loja", "email": f"keep_{keep_id}@test.local",
            "phone": "11988887777", "cpf": cpf, "cpf_digits": cpf,
            "phone_digits": "11988887777",
            "addresses": [{"zip_code": "01000000", "number": "100", "street": "Rua A"}],
            "created_at": _now(),
        })
        db.users.insert_one({
            "user_id": drop_id, "role": "customer", "status": "active",
            "name": "",  # vazio - NAO deve sobrescrever
            "email": "",  # vazio
            "phone": "",  # vazio
            "cpf": cpf, "cpf_digits": cpf,
            "external_id": "EXT-MAXX-999",
            "leader_external_id": "EXT-LIDER-001",
            "network_type": "network_1",
            "addresses": [],
            "created_at": _now(),
        })
        db.orders.insert_one({
            "order_id": order_id, "user_id": drop_id, "total": 100.0,
            "payment_status": "paid", "created_at": _now(),
        })
        db.points_log.insert_one({
            "user_id": drop_id, "points_total": 50, "registered_at": _now(),
        })
        db.commissions.insert_one({
            "commission_id": commission_id, "user_id": drop_id,
            "amount": 10.0, "status": "pending", "created_at": _now(),
        })
        db.users.insert_one({
            "user_id": downstream_id, "role": "customer", "status": "active",
            "name": "Downline Test Merge", "email": f"dn_{downstream_id}@test.local",
            "sponsor_id": drop_id, "network_sponsor_id": drop_id,
            "created_at": _now(),
        })

        # Action
        r = requests.post(
            f"{API_URL}/api/admin/merge-users",
            json={"keep_user_id": keep_id, "drop_user_id": drop_id},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        moved = body["moved"]

        # Asserts
        merged = db.users.find_one({"user_id": keep_id})
        assert merged is not None
        assert merged["name"] == "João Original Loja", "Nome vazio do drop NAO deveria sobrescrever"
        assert merged["email"].startswith("keep_"), "Email vazio do drop NAO deveria sobrescrever"
        assert merged.get("external_id") == "EXT-MAXX-999"
        assert merged.get("leader_external_id") == "EXT-LIDER-001"
        assert merged.get("network_type") == "network_1"
        assert drop_id in (merged.get("merged_from_user_ids") or [])

        assert db.users.find_one({"user_id": drop_id}) is None, "drop deveria ter sido deletado"

        assert db.orders.find_one({"order_id": order_id})["user_id"] == keep_id
        assert db.points_log.find_one({"user_id": keep_id, "points_total": 50}) is not None
        assert db.commissions.find_one({"commission_id": commission_id})["user_id"] == keep_id
        assert moved.get("orders.user_id", 0) >= 1
        assert moved.get("points_log.user_id", 0) >= 1
        assert moved.get("commissions.user_id", 0) >= 1

        dn = db.users.find_one({"user_id": downstream_id})
        assert dn["sponsor_id"] == keep_id
        assert dn["network_sponsor_id"] == keep_id

        log = db.merge_audit_log.find_one({
            "kept_user_id": keep_id, "deleted_user_id": drop_id,
        })
        assert log is not None, "Audit log deve ter sido criado"
        assert log.get("performed_by_email") == ADMIN_EMAIL
        fields = log.get("fields_overwritten") or []
        assert "external_id" in fields
        assert "name" not in fields, "name vazio NAO deve aparecer em fields_overwritten"
    finally:
        # Cleanup
        db.users.delete_many({"user_id": {"$in": [keep_id, drop_id, downstream_id]}})
        db.orders.delete_many({"order_id": order_id})
        db.points_log.delete_many({"user_id": keep_id})
        db.commissions.delete_many({"commission_id": commission_id})
        db.merge_audit_log.delete_many({"kept_user_id": keep_id})


def test_merge_overwrites_with_filled_drop_fields(db, admin_token):
    """Dados preenchidos do drop DEVEM sobrescrever os do keep."""
    keep_id = f"test_keep2_{uuid.uuid4().hex[:8]}"
    drop_id = f"test_drop2_{uuid.uuid4().hex[:8]}"

    try:
        db.users.insert_one({
            "user_id": keep_id, "role": "customer", "status": "active",
            "name": "Velho Nome", "email": f"old_{keep_id}@test.local",
            "phone": "11900000000", "phone_digits": "11900000000",
            "created_at": _now(),
        })
        db.users.insert_one({
            "user_id": drop_id, "role": "customer", "status": "active",
            "name": "Novo Nome Maxx",  # preenchido
            "email": f"novo_{drop_id}@test.local",  # preenchido
            "phone": "11911111111", "phone_digits": "11911111111",
            "external_id": "EXT-OVR-777",
            "created_at": _now(),
        })

        r = requests.post(
            f"{API_URL}/api/admin/merge-users",
            json={"keep_user_id": keep_id, "drop_user_id": drop_id},
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=30,
        )
        assert r.status_code == 200, r.text

        merged = db.users.find_one({"user_id": keep_id})
        assert merged["name"] == "Novo Nome Maxx"
        assert merged["email"].startswith("novo_")
        assert merged["phone"] == "11911111111"
        assert merged["external_id"] == "EXT-OVR-777"
    finally:
        db.users.delete_many({"user_id": {"$in": [keep_id, drop_id]}})
        db.merge_audit_log.delete_many({"kept_user_id": keep_id})


def test_duplicate_users_endpoint_returns_groups(db, admin_token):
    """Endpoint admin/duplicate-users responde com grupos."""
    r = requests.get(f"{API_URL}/api/admin/duplicate-users",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "groups" in body
    assert "total_groups" in body
    # Estrutura de cada grupo
    for g in body["groups"]:
        assert "match_fields" in g and isinstance(g["match_fields"], list)
        assert "users" in g and len(g["users"]) >= 2
        assert "suggested_keep" in g


def test_merge_audit_log_endpoint(admin_token):
    r = requests.get(f"{API_URL}/api/admin/merge-audit-log?limit=10",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and isinstance(body["items"], list)
