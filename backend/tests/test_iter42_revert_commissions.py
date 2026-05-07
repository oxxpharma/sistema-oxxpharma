"""Iter 42: Reverter status de comissoes (paid|paid_out -> pending)."""
import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def _login(email, password):
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    if r.status_code != 200:
        return None
    return r.json()["token"]


def test_revert_requires_super_admin():
    """Apenas super_admin pode usar o endpoint."""
    admin_tk = _login("admin2@oxxpharma.com", "oxx@pharma")
    if admin_tk:
        r = requests.post(f"{API_URL}/api/admin/commissions/revert/preview",
                          headers={"Authorization": f"Bearer {admin_tk}"},
                          json={"user_id": "x"}, timeout=15)
        assert r.status_code == 403, f"admin role nao deveria acessar (got {r.status_code})"

    fin_tk = _login("financeiro@oxxpharma.com", "oxx@pharma")
    if fin_tk:
        r = requests.post(f"{API_URL}/api/admin/commissions/revert/preview",
                          headers={"Authorization": f"Bearer {fin_tk}"},
                          json={"user_id": "x"}, timeout=15)
        assert r.status_code == 403


def test_revert_requires_filter():
    """Sem filtro -> 400."""
    super_tk = _login("admin@oxxpharma.com", "admin123")
    assert super_tk
    r = requests.post(f"{API_URL}/api/admin/commissions/revert/preview",
                      headers={"Authorization": f"Bearer {super_tk}"},
                      json={}, timeout=15)
    assert r.status_code == 400


def test_revert_mass_requires_confirm():
    """Reverter em massa (>1 pedido) sem confirm -> 400."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    # Cria 2 comissoes paid em 2 pedidos diferentes para um user de teste
    test_uid = "test_revert_mass_user"
    db.commissions.delete_many({"user_id": test_uid})
    db.commissions.insert_many([
        {"commission_id": "test_com_1", "user_id": test_uid,
         "order_id": "test_ord_1", "type": "affiliate", "generation": 0,
         "amount": 10.0, "rate": 0.08, "order_subtotal": 125.0,
         "status": "paid", "created_at": "2026-05-01T10:00:00+00:00"},
        {"commission_id": "test_com_2", "user_id": test_uid,
         "order_id": "test_ord_2", "type": "affiliate", "generation": 0,
         "amount": 20.0, "rate": 0.08, "order_subtotal": 250.0,
         "status": "paid", "created_at": "2026-05-02T10:00:00+00:00"},
    ])
    try:
        super_tk = _login("admin@oxxpharma.com", "admin123")
        # Sem confirm -> 400
        r = requests.post(f"{API_URL}/api/admin/commissions/revert/apply",
                          headers={"Authorization": f"Bearer {super_tk}"},
                          json={"user_id": test_uid}, timeout=15)
        assert r.status_code == 400, r.text

        # Com confirm -> 200 + 2 modificadas
        r = requests.post(f"{API_URL}/api/admin/commissions/revert/apply",
                          headers={"Authorization": f"Bearer {super_tk}"},
                          json={"user_id": test_uid, "confirm": True}, timeout=15)
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["modified"] == 2
        assert out["affected_orders"] == 2

        # Confirma DB
        for cid in ("test_com_1", "test_com_2"):
            d = db.commissions.find_one({"commission_id": cid})
            assert d["status"] == "pending"
            assert "paid_at" not in d
            assert "withdrawal_id" not in d
            assert d.get("reverted_by_email") == "admin@oxxpharma.com"
    finally:
        db.commissions.delete_many({"user_id": test_uid})


def test_revert_unsets_withdrawal_id():
    """paid_out com withdrawal_id -> pending sem withdrawal_id."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    test_uid = "test_revert_wd_user"
    db.commissions.delete_many({"user_id": test_uid})
    db.commissions.insert_one({
        "commission_id": "test_com_wd",
        "user_id": test_uid,
        "order_id": "test_ord_wd",
        "type": "affiliate",
        "generation": 0,
        "amount": 50.0, "rate": 0.08, "order_subtotal": 625.0,
        "status": "paid_out",
        "withdrawal_id": "wd_fake_123",
        "paid_out_at": "2026-05-03T10:00:00+00:00",
        "created_at": "2026-05-01T10:00:00+00:00",
    })
    try:
        super_tk = _login("admin@oxxpharma.com", "admin123")
        r = requests.post(f"{API_URL}/api/admin/commissions/revert/apply",
                          headers={"Authorization": f"Bearer {super_tk}"},
                          json={"commission_ids": ["test_com_wd"]}, timeout=15)
        assert r.status_code == 200, r.text
        d = db.commissions.find_one({"commission_id": "test_com_wd"})
        assert d["status"] == "pending"
        assert "withdrawal_id" not in d
        assert "paid_out_at" not in d
    finally:
        db.commissions.delete_many({"user_id": test_uid})


def test_revert_skips_pending_commissions():
    """Comissoes pending nao podem ser revertidas (so paid|paid_out)."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    test_uid = "test_revert_pending_user"
    db.commissions.delete_many({"user_id": test_uid})
    db.commissions.insert_one({
        "commission_id": "test_com_pending",
        "user_id": test_uid,
        "order_id": "test_ord_pending",
        "type": "affiliate", "generation": 0,
        "amount": 5.0, "rate": 0.08, "order_subtotal": 62.5,
        "status": "pending",
        "created_at": "2026-05-01T10:00:00+00:00",
    })
    try:
        super_tk = _login("admin@oxxpharma.com", "admin123")
        r = requests.post(f"{API_URL}/api/admin/commissions/revert/preview",
                          headers={"Authorization": f"Bearer {super_tk}"},
                          json={"commission_ids": ["test_com_pending"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["total"] == 0  # filtro paid/paid_out exclui

        # Status nao muda
        d = db.commissions.find_one({"commission_id": "test_com_pending"})
        assert d["status"] == "pending"
    finally:
        db.commissions.delete_many({"user_id": test_uid})
