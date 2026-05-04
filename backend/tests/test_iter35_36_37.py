"""Testes para Iter 35-37: comissoes por origem, voucher e pontos espelhados Equipe 1."""
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


@pytest.fixture(scope="module")
def webhook_token(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    s = requests.get(f"{API_URL}/api/admin/settings", headers=h, timeout=10).json()
    return s.get("external_webhook_token")


# -------------- Iter 35: Comissoes por origem --------------


def test_commissions_by_source_in_admin_report(db, admin_token):
    # Cria 3 comissoes de origens diferentes para um mesmo user
    uid = f"IT35_{uuid.uuid4().hex[:6]}"
    for kind in [
        ("affiliate", None, 100.0),
        ("network_gen", "network_1", 50.0),
        ("network_gen", "network_2", 30.0),
    ]:
        db.commissions.insert_one({
            "commission_id": f"c_{uuid.uuid4().hex[:8]}",
            "user_id": uid,
            "type": kind[0],
            "network_type": kind[1],
            "amount": kind[2],
            "status": "paid",
            "created_at": _now(),
        })
    db.users.insert_one({
        "user_id": uid, "name": "IT35 Aff", "email": f"{uid}@t.com",
        "role": "customer", "status": "active", "created_at": _now(),
    })
    try:
        r = requests.get(f"{API_URL}/api/admin/commissions-report?status=paid",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        rows = [r for r in body["rows"] if r["user_id"] == uid]
        assert len(rows) == 1
        row = rows[0]
        assert row["amount"] == 180.0
        assert row["amount_affiliate"] == 100.0
        assert row["amount_network_1"] == 50.0
        assert row["amount_network_2"] == 30.0
        assert "totals" in body
        assert body["totals"]["by_source"]["affiliate"] >= 100.0
    finally:
        db.commissions.delete_many({"user_id": uid})
        db.users.delete_one({"user_id": uid})


# -------------- Iter 36: Voucher --------------


def test_voucher_received_via_maxx_sync(db, webhook_token):
    if not webhook_token:
        pytest.skip("webhook_token nao configurado")
    ext_id = f"VOUC_{uuid.uuid4().hex[:6]}"
    email = f"{ext_id.lower()}@t.com"
    try:
        # 1a chamada: cria o user com voucher 100
        r = requests.post(f"{API_URL}/api/external/network1/sync",
                          headers={"X-Webhook-Token": webhook_token},
                          json={"action": "upsert", "users": [{
                              "external_id": ext_id, "name": "VC", "email": email, "voucher": 100.0,
                          }]}, timeout=15)
        assert r.status_code == 200, r.text
        u = db.users.find_one({"email": email})
        assert u is not None
        assert abs((u.get("voucher_balance") or 0) - 100.0) < 0.01

        # 2a chamada: incremento de 50
        r = requests.post(f"{API_URL}/api/external/network1/sync",
                          headers={"X-Webhook-Token": webhook_token},
                          json={"action": "upsert", "users": [{
                              "external_id": ext_id, "name": "VC", "email": email, "voucher": 50.0,
                          }]}, timeout=15)
        assert r.status_code == 200
        u = db.users.find_one({"email": email})
        assert abs((u.get("voucher_balance") or 0) - 150.0) < 0.01
        assert len(u.get("voucher_history") or []) >= 2

        # 3a chamada SEM voucher: nao zera
        r = requests.post(f"{API_URL}/api/external/network1/sync",
                          headers={"X-Webhook-Token": webhook_token},
                          json={"action": "upsert", "users": [{
                              "external_id": ext_id, "name": "VC", "email": email,
                          }]}, timeout=15)
        u = db.users.find_one({"email": email})
        assert abs((u.get("voucher_balance") or 0) - 150.0) < 0.01
    finally:
        db.users.delete_one({"email": email})


def test_voucher_admin_adjust(db, admin_token):
    # Cria user com saldo 0 e admin credita 200, depois debita 50
    uid = f"IT36_{uuid.uuid4().hex[:6]}"
    db.users.insert_one({
        "user_id": uid, "name": "AdjUser", "email": f"{uid}@t.com",
        "role": "customer", "status": "active",
        "voucher_balance": 0, "created_at": _now(),
    })
    try:
        r = requests.post(f"{API_URL}/api/admin/users/{uid}/voucher-adjust",
                          json={"delta": 200.0, "note": "credito teste"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["balance"] == 200.0

        r = requests.post(f"{API_URL}/api/admin/users/{uid}/voucher-adjust",
                          json={"delta": -50.0, "note": "debito teste"},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.json()["balance"] == 150.0

        # Tentar deixar negativo deve falhar
        r = requests.post(f"{API_URL}/api/admin/users/{uid}/voucher-adjust",
                          json={"delta": -1000.0},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 400
    finally:
        db.users.delete_one({"user_id": uid})


def test_voucher_used_in_checkout(db, admin_token):
    """Voucher é deduzido do total no checkout, persistido em order e debitado do user."""
    uid = f"IT36C_{uuid.uuid4().hex[:6]}"
    email = f"{uid}@t.com".lower()
    pw_hash = bcrypt.hashpw(b"oxx@pharma", bcrypt.gensalt()).decode()
    db.users.insert_one({
        "user_id": uid, "name": "VoucherBuyer",
        "email": email,
        "password_hash": pw_hash,
        "role": "customer", "status": "active",
        "voucher_balance": 200.0,
        "created_at": _now(),
    })
    try:
        tok = requests.post(f"{API_URL}/api/auth/login",
                            json={"email": email, "password": "oxx@pharma"}, timeout=15).json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        # Pega um produto
        prods = requests.get(f"{API_URL}/api/products?limit=1", timeout=15).json().get("products", [])
        if not prods:
            pytest.skip("sem produtos")
        pid = prods[0]["product_id"]
        # add ao carrinho
        requests.post(f"{API_URL}/api/cart/items", json={"product_id": pid, "quantity": 1}, headers=h, timeout=15)
        # Endereco
        requests.post(f"{API_URL}/api/users/me/addresses",
                      json={"label":"casa","zip_code":"01000000","street":"X","number":"1",
                            "neighborhood":"C","city":"SP","state":"SP"}, headers=h, timeout=15)
        addr = requests.get(f"{API_URL}/api/users/me/addresses", headers=h, timeout=15).json()["addresses"][-1]["address_id"]
        # Checkout COM voucher 50
        r = requests.post(f"{API_URL}/api/checkout",
                          json={"address_id": addr, "payment_method": "pix",
                                "shipping_price": 0, "shipping_carrier": "t", "shipping_service": "t",
                                "voucher_amount": 50.0},
                          headers=h, timeout=30)
        assert r.status_code == 200, r.text
        order_id = r.json().get("order_id") or r.json().get("order", {}).get("order_id") or r.json().get("id")
        order = db.orders.find_one({"order_id": order_id})
        assert order is not None, f"order nao encontrada: {r.json()}"
        assert order["voucher_used"] == 50.0
        assert abs((order["total_before_voucher"] - order["voucher_used"]) - order["total"]) < 0.02
        # Saldo no user diminuiu
        u2 = db.users.find_one({"user_id": uid})
        assert abs(u2["voucher_balance"] - 150.0) < 0.01
    finally:
        db.orders.delete_many({"user_id": uid})
        db.carts.delete_many({"user_id": uid})
        db.users.delete_one({"user_id": uid})


# -------------- Iter 37: Pontos espelhados Equipe 1 --------------


def test_points_mirrored_to_team1_sponsor(db, admin_token):
    """Sponsor de Equipe 1 recebe os mesmos pontos do indicado direto."""
    leader = f"IT37L_{uuid.uuid4().hex[:6]}"
    buyer = f"IT37B_{uuid.uuid4().hex[:6]}"
    pw_hash = bcrypt.hashpw(b"oxx@pharma", bcrypt.gensalt()).decode()
    db.users.insert_one({
        "user_id": leader, "name": "IT37 Leader", "email": f"{leader}@t.com",
        "role": "customer", "status": "active",
        "network_type": "network_1", "external_id": f"EXT_LDR_{leader}",
        "referral_program_active": True, "referral_code": f"IT37LD{uuid.uuid4().hex[:4].upper()}",
        "created_at": _now(),
    })
    db.users.insert_one({
        "user_id": buyer, "name": "IT37 Buyer", "email": f"{buyer}@t.com",
        "password_hash": pw_hash, "role": "customer", "status": "active",
        "sponsor_id": leader, "network_type": "customer",
        "referral_program_active": True, "referral_code": f"IT37BY{uuid.uuid4().hex[:4].upper()}",
        "created_at": _now(),
    })
    # Cria 1 produto com points_value=15 e fake order paid
    pid = f"prod_{uuid.uuid4().hex[:6]}"
    db.products.insert_one({
        "product_id": pid, "name": "ProdIT37", "price": 100.0, "active": True,
        "points_value": 15.0, "stock": 10, "created_at": _now(),
    })
    order_id = f"ord_{uuid.uuid4().hex[:6]}"
    db.orders.insert_one({
        "order_id": order_id, "user_id": buyer,
        "items": [{"product_id": pid, "name": "ProdIT37", "price": 100.0, "quantity": 2, "points_value": 15.0}],
        "subtotal": 200.0, "total": 200.0,
        "payment_status": "paid", "order_status": "paid",
        "created_at": _now(),
    })
    try:
        # Marca o pedido como pago via endpoint admin (que aciona register_points_from_order)
        r = requests.put(f"{API_URL}/api/admin/orders/{order_id}/status",
                         json={"status": "paid"},
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200, r.text
        import time; time.sleep(0.4)
        logs = list(db.points_log.find({"order_id": order_id}))
        # Esperado: 1 log para buyer + 1 log mirrored para leader
        buyer_logs = [l for l in logs if l["user_id"] == buyer]
        leader_logs = [l for l in logs if l["user_id"] == leader]
        assert len(buyer_logs) >= 1, f"Buyer deveria ter ao menos 1 log: {logs}"
        assert len(leader_logs) >= 1, f"Leader (Equipe 1) deveria ter pontos espelhados: {logs}"
        # Mesmo points_total (15 * 2 = 30)
        assert leader_logs[0]["points_total"] == 30.0
        assert leader_logs[0].get("source") == "team1_indicated"
        assert leader_logs[0].get("indicated_user_id") == buyer
    finally:
        db.points_log.delete_many({"order_id": order_id})
        db.orders.delete_one({"order_id": order_id})
        db.products.delete_one({"product_id": pid})
        db.users.delete_many({"user_id": {"$in": [leader, buyer]}})


def test_points_NOT_mirrored_for_non_team1_sponsor(db, admin_token):
    """Se sponsor for customer (nao Equipe 1), nao espelha."""
    sponsor = f"IT37S_{uuid.uuid4().hex[:6]}"
    buyer = f"IT37BC_{uuid.uuid4().hex[:6]}"
    pw_hash = bcrypt.hashpw(b"oxx@pharma", bcrypt.gensalt()).decode()
    db.users.insert_one({
        "user_id": sponsor, "name": "IT37 Sp", "email": f"{sponsor}@t.com",
        "role": "customer", "status": "active",
        "network_type": "customer",  # NAO eh Equipe 1
        "created_at": _now(),
    })
    db.users.insert_one({
        "user_id": buyer, "name": "IT37 Buyer C", "email": f"{buyer}@t.com",
        "password_hash": pw_hash, "role": "customer", "status": "active",
        "sponsor_id": sponsor, "network_type": "customer",
        "created_at": _now(),
    })
    pid = f"prod_{uuid.uuid4().hex[:6]}"
    db.products.insert_one({
        "product_id": pid, "name": "P2", "price": 100, "active": True,
        "points_value": 20.0, "stock": 10, "created_at": _now(),
    })
    order_id = f"ord_{uuid.uuid4().hex[:6]}"
    db.orders.insert_one({
        "order_id": order_id, "user_id": buyer,
        "items": [{"product_id": pid, "name": "P2", "price": 100, "quantity": 1, "points_value": 20.0}],
        "subtotal": 100, "total": 100, "payment_status": "paid", "order_status": "paid",
        "created_at": _now(),
    })
    try:
        requests.put(f"{API_URL}/api/admin/orders/{order_id}/status",
                     json={"status": "paid"},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        import time; time.sleep(0.4)
        logs = list(db.points_log.find({"order_id": order_id}))
        sponsor_logs = [l for l in logs if l["user_id"] == sponsor]
        assert len(sponsor_logs) == 0, f"sponsor customer NAO deveria ganhar pontos: {sponsor_logs}"
    finally:
        db.points_log.delete_many({"order_id": order_id})
        db.orders.delete_one({"order_id": order_id})
        db.products.delete_one({"product_id": pid})
        db.users.delete_many({"user_id": {"$in": [sponsor, buyer]}})
