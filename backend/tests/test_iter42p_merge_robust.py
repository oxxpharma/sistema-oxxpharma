"""
Iter 42p: Fix DEFINITIVO do bug merge-users E11000.

Cenarios reais reportados:
  - Bug do usuario: keep e drop tem emails diferentes, mas o $set no keep com
    o email do drop quebra com "duplicate key" mesmo apos o $unset previo no drop.
  - Hipoteses (mitigadas):
    a) Mongo snapshot do indice antes do commit do unset
    b) Race condition
    c) Terceiro user com email com case/spaces diferentes nao detectado no pre-check

Solucao:
  1. DELETAR o drop ANTES do $set no keep (libera indices unique).
  2. Retry com fallback (remove campo problematico) caso ainda colida.
"""
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
    return requests.post(f"{API_URL}/api/auth/login", json=ADMIN, timeout=15).json()["token"]


def test_merge_transfers_email_when_drop_only_owns_it():
    """Cenario base: drop tem email proprio, keep tem outro. Merge deve transferir
    email do drop pro keep (sem 500), apos a fusao keep tem o email do drop."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    suf = uuid.uuid4().hex[:6]
    keep_id, drop_id = f"keep_{suf}", f"drop_{suf}"
    keep_email = f"keep_{suf}@example.com"
    drop_email = f"drop_{suf}@example.com"
    db.users.insert_many([
        {"user_id": keep_id, "email": keep_email, "name": "Keep",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
        {"user_id": drop_id, "email": drop_email, "name": "Drop",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
    ])
    token = _login()
    r = requests.post(f"{API_URL}/api/admin/merge-users",
                      json={"keep_user_id": keep_id, "drop_user_id": drop_id},
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True
    # Esperado: keep ficou com email do drop (drop nao tinha email vazio)
    keep_after = db.users.find_one({"user_id": keep_id})
    assert keep_after["email"] == drop_email
    # Drop deletado
    assert db.users.find_one({"user_id": drop_id}) is None
    # Sem skipped
    assert d.get("skipped_due_collision", {}) == {}
    # cleanup
    db.users.delete_one({"user_id": keep_id})


def test_merge_with_simulated_third_party_email_collision():
    """Simula cenario raro: depois do unset do drop, um terceiro user existe
    com o mesmo email. Forca a colisao para validar o retry/fallback."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    suf = uuid.uuid4().hex[:6]
    keep_id, drop_id, third_id = f"keep_{suf}", f"drop_{suf}", f"third_{suf}"
    drop_email = f"drop_{suf}@example.com"

    db.users.insert_many([
        {"user_id": keep_id, "email": f"keep_{suf}@example.com", "name": "Keep",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
        # Third tem o email que o drop teria (pre-existe no banco)
        {"user_id": third_id, "email": drop_email, "name": "Third",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
        # Drop com email upper-case (Mongo unique e case-sensitive — convivem)
        {"user_id": drop_id, "email": drop_email.upper(), "name": "Drop",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
    ])

    token = _login()
    r = requests.post(f"{API_URL}/api/admin/merge-users",
                      json={"keep_user_id": keep_id, "drop_user_id": drop_id},
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True
    # Email do keep NAO mudou (foi pulado por colisao)
    keep_after = db.users.find_one({"user_id": keep_id})
    assert keep_after["email"] == f"keep_{suf}@example.com"
    # Skipped reportado
    assert "email" in d.get("skipped_due_collision", {})
    # Drop deletado
    assert db.users.find_one({"user_id": drop_id}) is None
    # Third intacto
    third_after = db.users.find_one({"user_id": third_id})
    assert third_after is not None and third_after["email"] == drop_email
    # cleanup
    db.users.delete_many({"user_id": {"$in": [keep_id, third_id]}})


def test_merge_drop_email_with_leading_space_does_not_crash():
    """Cenario defensivo: drop tem email com espaco/case bizarro. Merge NAO deve
    quebrar com 500 — usa retry se necessario."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    suf = uuid.uuid4().hex[:6]
    keep_id, drop_id = f"keep_{suf}", f"drop_{suf}"
    db.users.insert_many([
        {"user_id": keep_id, "email": f"keep_{suf}@example.com", "name": "Keep",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
        {"user_id": drop_id, "email": f"  weird_{suf}@example.com  ", "name": "Drop",
         "password_hash": "x", "role": "customer", "status": "active",
         "network_type": "customer", "addresses": []},
    ])
    token = _login()
    r = requests.post(f"{API_URL}/api/admin/merge-users",
                      json={"keep_user_id": keep_id, "drop_user_id": drop_id},
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 200, r.text
    # cleanup
    db.users.delete_one({"user_id": keep_id})
