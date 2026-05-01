"""Regression tests for the leader_external_id mapping bug fix.

Bug: When users are synced via /api/external/network1/sync (or admin import),
if the leader (`leader_external_id`) is not yet in the DB nor in the same batch,
the `network_sponsor_id` was never resolved later.

Fix: Persist `leader_external_id` on each user doc and resolve pending links
on every subsequent sync. Also auto-resolve when an admin edits the field.
"""
import os
import requests
import pytest

API_URL = os.environ.get("API_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="module")
def webhook_token(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    s = requests.get(f"{API_URL}/api/admin/settings", headers=headers, timeout=10).json()
    tok = s.get("external_webhook_token")
    if not tok:
        tok = requests.post(f"{API_URL}/api/admin/webhook-token/regenerate",
                            headers=headers, timeout=10).json()["external_webhook_token"]
    return tok


def _find_user_by_external_id(admin_token, ext_id):
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{API_URL}/api/admin/users", headers=headers, timeout=10).json()
    users = r.get("users", r) if isinstance(r, dict) else r
    for u in users:
        if u.get("external_id") == ext_id:
            return u
    return None


def test_leader_in_separate_later_batch(admin_token, webhook_token):
    """Leader vem em batch posterior - deve auto-resolver."""
    pfx = f"PYT_LATE_{os.urandom(3).hex().upper()}"
    headers = {"X-Webhook-Token": webhook_token, "Content-Type": "application/json"}

    # Batch 1: Apenas o membro B (cujo líder A ainda não existe)
    r1 = requests.post(f"{API_URL}/api/external/network1/sync", headers=headers, json={
        "action": "upsert",
        "users": [{"external_id": f"{pfx}_B", "name": "Membro B",
                   "email": f"b_{pfx.lower()}@t.com", "leader_external_id": f"{pfx}_A"}],
    }, timeout=10).json()
    assert r1["created"] == 1
    assert r1["sponsors_pending"] == 1
    assert r1["sponsors_mapped"] == 0

    # B deve ter leader_external_id persistido mas network_sponsor_id None
    b = _find_user_by_external_id(admin_token, f"{pfx}_B")
    assert b is not None
    assert b.get("leader_external_id") == f"{pfx}_A"
    assert b.get("network_sponsor_id") in (None, "")

    # Batch 2: Importar A (deve auto-resolver B)
    r2 = requests.post(f"{API_URL}/api/external/network1/sync", headers=headers, json={
        "action": "upsert",
        "users": [{"external_id": f"{pfx}_A", "name": "Líder A",
                   "email": f"a_{pfx.lower()}@t.com", "leader_external_id": None}],
    }, timeout=10).json()
    assert r2["created"] == 1
    # Pelo menos 1 mapeado: B->A foi resolvido na cascata
    assert r2["sponsors_mapped"] >= 1

    a = _find_user_by_external_id(admin_token, f"{pfx}_A")
    b = _find_user_by_external_id(admin_token, f"{pfx}_B")
    assert b["network_sponsor_id"] == a["user_id"], "B deveria estar vinculado a A"


def test_full_hierarchy_same_batch(admin_token, webhook_token):
    """Líder + liderados no mesmo batch -> tudo mapeado."""
    pfx = f"PYT_SAME_{os.urandom(3).hex().upper()}"
    headers = {"X-Webhook-Token": webhook_token, "Content-Type": "application/json"}
    res = requests.post(f"{API_URL}/api/external/network1/sync", headers=headers, json={
        "action": "upsert",
        "users": [
            {"external_id": f"{pfx}_A", "name": "A", "email": f"a_{pfx.lower()}@t.com", "leader_external_id": None},
            {"external_id": f"{pfx}_B", "name": "B", "email": f"b_{pfx.lower()}@t.com", "leader_external_id": f"{pfx}_A"},
            {"external_id": f"{pfx}_C", "name": "C", "email": f"c_{pfx.lower()}@t.com", "leader_external_id": f"{pfx}_B"},
        ],
    }, timeout=10).json()
    assert res["created"] == 3
    assert res["sponsors_mapped"] == 2

    a = _find_user_by_external_id(admin_token, f"{pfx}_A")
    b = _find_user_by_external_id(admin_token, f"{pfx}_B")
    c = _find_user_by_external_id(admin_token, f"{pfx}_C")
    assert b["network_sponsor_id"] == a["user_id"]
    assert c["network_sponsor_id"] == b["user_id"]


def test_admin_put_resolves_leader_external_id(admin_token, webhook_token):
    """Admin edita leader_external_id no PUT -> backend auto-resolve network_sponsor_id."""
    pfx = f"PYT_PUT_{os.urandom(3).hex().upper()}"
    headers = {"X-Webhook-Token": webhook_token, "Content-Type": "application/json"}
    requests.post(f"{API_URL}/api/external/network1/sync", headers=headers, json={
        "action": "upsert",
        "users": [
            {"external_id": f"{pfx}_X", "name": "X", "email": f"x_{pfx.lower()}@t.com", "leader_external_id": None},
            {"external_id": f"{pfx}_Y", "name": "Y", "email": f"y_{pfx.lower()}@t.com", "leader_external_id": None},
        ],
    }, timeout=10).json()

    x = _find_user_by_external_id(admin_token, f"{pfx}_X")
    y = _find_user_by_external_id(admin_token, f"{pfx}_Y")
    assert y.get("network_sponsor_id") in (None, "")

    # Admin define que Y deve ter X como líder usando leader_external_id
    auth = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    updated = requests.put(f"{API_URL}/api/admin/users/{y['user_id']}", headers=auth,
                           json={"leader_external_id": f"{pfx}_X"}, timeout=10).json()
    assert updated.get("leader_external_id") == f"{pfx}_X"
    assert updated.get("network_sponsor_id") == x["user_id"]
