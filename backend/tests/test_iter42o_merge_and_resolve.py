"""Iter 42o: Fix bug merge-users - terceiro user com email do drop NAO deve
quebrar a fusao com 500 dup key error. Em vez disso, o campo eh PULADO."""
import os
import uuid
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN = {"email": "admin@oxxpharma.com", "password": "admin123"}


def _login():
    r = requests.post(f"{API_URL}/api/auth/login", json=ADMIN, timeout=15)
    return r.json()["token"]


def test_merge_skips_email_collision_with_third_user():
    """Se terceiro user ja tem o email do drop, fusao deve passar e PULAR o email."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    suf = uuid.uuid4().hex[:6]
    keep_id = f"keep_{suf}"
    drop_id = f"drop_{suf}"
    third_id = f"third_{suf}"
    drop_email = f"drop_{suf}@example.com"
    keep_email = f"keep_{suf}@example.com"

    db.users.insert_many([
        {"user_id": keep_id, "email": keep_email, "name": "Keep User",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
        # Terceiro user com o email que o drop teria — inserido ANTES para evitar conflict
        {"user_id": third_id, "email": drop_email, "name": "Third User",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
        # Drop com email "fantasma" — depois trocaremos no doc direto (bypass do unique)
        {"user_id": drop_id, "email": f"drop_temp_{suf}@example.com", "name": "Drop User",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
    ])
    # Simulamos o cenario: o drop "originalmente" tinha o mesmo email do third.
    # Como o indice unique nao deixaria, gravamos o email do drop como uma string
    # com case diferente (Mongo unique e' case-sensitive).
    db.users.update_one({"user_id": drop_id}, {"$set": {"email": drop_email.upper()}})

    token = _login()
    r = requests.post(f"{API_URL}/api/admin/merge-users",
                      json={"keep_user_id": keep_id, "drop_user_id": drop_id},
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True
    assert "email" in d.get("skipped_due_collision", {}), f"skipped: {d.get('skipped_due_collision')}"
    # Valor pulado (lower-case) bate
    assert d["skipped_due_collision"]["email"]["value"].lower() == drop_email.lower()
    assert d["skipped_due_collision"]["email"]["owned_by"]["user_id"] == third_id

    # Keep manteve email original
    keep_after = db.users.find_one({"user_id": keep_id})
    assert keep_after["email"] == keep_email
    # Drop foi deletado
    assert db.users.find_one({"user_id": drop_id}) is None
    # Third intacto
    third_after = db.users.find_one({"user_id": third_id})
    assert third_after["email"] == drop_email

    # cleanup
    db.users.delete_many({"user_id": {"$in": [keep_id, third_id]}})


def test_resolve_pending_leaders_endpoint():
    """Endpoint de varredura responde com stats."""
    token = _login()
    r = requests.post(f"{API_URL}/api/admin/network/resolve-pending-leaders",
                      headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "scanned" in d and "resolved" in d and "still_pending" in d
    assert isinstance(d["samples_still_pending"], list)
