"""Iter 42c: Comissoes nao transitam mais para 'paid' automaticamente.
Apenas super_admin pode aprovar manualmente via /api/admin/commissions/approve."""
import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def _login(email, password):
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    return r.json()["token"] if r.status_code == 200 else None


def _admin_token():
    return _login("admin@oxxpharma.com", "admin123")


def test_marking_order_paid_does_not_auto_pay_commission():
    """Quando admin muda pedido para 'paid', comissoes pendentes NAO viram paid."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    oid = "test_iter42c_no_auto_paid"
    cid = "test_iter42c_pending_com"
    db.orders.delete_many({"order_id": oid})
    db.commissions.delete_many({"order_id": oid})
    db.orders.insert_one({
        "order_id": oid, "user_id": "fake_buyer",
        "subtotal": 100, "total": 100, "items": [],
        "order_status": "pending", "payment_status": "pending",
        "created_at": "2026-05-07T10:00:00+00:00",
    })
    db.commissions.insert_one({
        "commission_id": cid, "user_id": "ben_x", "order_id": oid,
        "type": "affiliate", "generation": 0,
        "amount": 8.0, "rate": 0.08, "order_subtotal": 100,
        "status": "pending", "created_at": "2026-05-07T10:00:00+00:00",
    })
    try:
        tk = _admin_token()
        r = requests.put(f"{API_URL}/api/admin/orders/{oid}/status",
                         headers={"Authorization": f"Bearer {tk}"},
                         json={"status": "paid"}, timeout=15)
        assert r.status_code == 200
        c = db.commissions.find_one({"commission_id": cid})
        assert c["status"] == "pending", f"FAIL: status virou {c['status']} (esperado pending)"
    finally:
        db.orders.delete_many({"order_id": oid})
        db.commissions.delete_many({"order_id": oid})


def test_approve_endpoint_requires_super_admin():
    """admin/financeiro nao podem aprovar comissoes."""
    for email in ("admin2@oxxpharma.com", "financeiro@oxxpharma.com"):
        tk = _login(email, "oxx@pharma")
        if not tk:
            continue
        r = requests.post(f"{API_URL}/api/admin/commissions/approve/preview",
                          headers={"Authorization": f"Bearer {tk}"},
                          json={"user_id": "x"}, timeout=15)
        assert r.status_code == 403, f"{email} acessou approve (status {r.status_code})"


def test_approve_pending_to_paid():
    """super_admin aprova comissao pending -> paid."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    cid = "test_iter42c_approve_com"
    uid = "test_iter42c_approve_user"
    db.commissions.delete_many({"user_id": uid})
    db.commissions.insert_one({
        "commission_id": cid, "user_id": uid, "order_id": "test_iter42c_approve_ord",
        "type": "affiliate", "generation": 0,
        "amount": 15.0, "rate": 0.08, "order_subtotal": 187.5,
        "status": "pending", "created_at": "2026-05-07T10:00:00+00:00",
    })
    try:
        tk = _admin_token()
        # Preview
        r = requests.post(f"{API_URL}/api/admin/commissions/approve/preview",
                          headers={"Authorization": f"Bearer {tk}"},
                          json={"commission_ids": [cid]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["total"] == 1

        # Apply
        r = requests.post(f"{API_URL}/api/admin/commissions/approve/apply",
                          headers={"Authorization": f"Bearer {tk}"},
                          json={"commission_ids": [cid]}, timeout=15)
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["modified"] == 1
        assert out["total_amount"] == 15.0

        d = db.commissions.find_one({"commission_id": cid})
        assert d["status"] == "paid"
        assert d.get("paid_at")
        assert d.get("approved_by_email") == "admin@oxxpharma.com"
    finally:
        db.commissions.delete_many({"user_id": uid})


def test_approve_skips_paid_and_paid_out():
    """approve preview deve mostrar 0 quando comissao ja esta paid/paid_out."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    uid = "test_iter42c_skip_user"
    db.commissions.delete_many({"user_id": uid})
    db.commissions.insert_many([
        {"commission_id": "test_skip_paid", "user_id": uid, "order_id": "ord_skip",
         "type": "affiliate", "generation": 0, "amount": 1.0, "rate": 0.01,
         "order_subtotal": 100, "status": "paid",
         "created_at": "2026-05-07T10:00:00+00:00"},
        {"commission_id": "test_skip_paid_out", "user_id": uid, "order_id": "ord_skip2",
         "type": "affiliate", "generation": 0, "amount": 2.0, "rate": 0.02,
         "order_subtotal": 100, "status": "paid_out",
         "created_at": "2026-05-07T10:00:00+00:00"},
    ])
    try:
        tk = _admin_token()
        r = requests.post(f"{API_URL}/api/admin/commissions/approve/preview",
                          headers={"Authorization": f"Bearer {tk}"},
                          json={"user_id": uid}, timeout=15)
        assert r.status_code == 200
        assert r.json()["total"] == 0
    finally:
        db.commissions.delete_many({"user_id": uid})


def test_approve_mass_requires_confirm():
    """Aprovar >1 pedido sem confirm -> 400."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    uid = "test_iter42c_mass_user"
    db.commissions.delete_many({"user_id": uid})
    db.commissions.insert_many([
        {"commission_id": "test_mass_1", "user_id": uid, "order_id": "ord_mass_1",
         "type": "affiliate", "generation": 0, "amount": 1, "rate": 0.01,
         "order_subtotal": 100, "status": "pending",
         "created_at": "2026-05-07T10:00:00+00:00"},
        {"commission_id": "test_mass_2", "user_id": uid, "order_id": "ord_mass_2",
         "type": "affiliate", "generation": 0, "amount": 2, "rate": 0.02,
         "order_subtotal": 100, "status": "pending",
         "created_at": "2026-05-07T10:00:00+00:00"},
    ])
    try:
        tk = _admin_token()
        # sem confirm -> 400
        r = requests.post(f"{API_URL}/api/admin/commissions/approve/apply",
                          headers={"Authorization": f"Bearer {tk}"},
                          json={"user_id": uid}, timeout=15)
        assert r.status_code == 400
        # com confirm -> 200
        r = requests.post(f"{API_URL}/api/admin/commissions/approve/apply",
                          headers={"Authorization": f"Bearer {tk}"},
                          json={"user_id": uid, "confirm": True}, timeout=15)
        assert r.status_code == 200
        assert r.json()["modified"] == 2
    finally:
        db.commissions.delete_many({"user_id": uid})
