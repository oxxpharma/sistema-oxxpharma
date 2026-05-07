"""Iter 42d: Comissoes sao criadas APENAS quando o pedido vira 'paid'.
Pedido em pending nao deve ter comissoes.
"""
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


def test_no_orphan_commissions_in_db():
    """DB nao deve ter comissoes em pedidos com payment_status != paid."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    comm_oids = db.commissions.distinct("order_id")
    if not comm_oids:
        return
    paid_oids = set(db.orders.distinct("order_id",
                                       {"payment_status": "paid",
                                        "order_id": {"$in": comm_oids}}))
    orphan = [oid for oid in comm_oids if oid not in paid_oids]
    assert orphan == [], f"Encontradas comissoes orfas em {len(orphan)} pedidos nao pagos: {orphan[:3]}"


def test_marking_order_paid_creates_pending_commissions():
    """Quando admin marca pedido com cadeia valida como paid, comissoes pending
    sao criadas (NAO paid)."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    # Cria sponsor inscrito + customer apontando para ele + pedido pending
    sponsor_id = "test_iter42d_sponsor"
    customer_id = "test_iter42d_customer"
    oid = "test_iter42d_order"
    db.users.delete_many({"user_id": {"$in": [sponsor_id, customer_id]}})
    db.orders.delete_many({"order_id": oid})
    db.commissions.delete_many({"order_id": oid})

    db.users.insert_many([
        {"user_id": sponsor_id, "email": f"{sponsor_id}@t.com", "name": "Sponsor",
         "role": "customer", "status": "active", "referral_program_active": True,
         "referral_code": "TESTITER42D"},
        {"user_id": customer_id, "email": f"{customer_id}@t.com", "name": "Customer",
         "role": "customer", "status": "active", "sponsor_id": sponsor_id},
    ])
    db.orders.insert_one({
        "order_id": oid, "user_id": customer_id, "customer_email": f"{customer_id}@t.com",
        "customer_name": "Customer",
        "subtotal": 100, "total": 100, "items": [],
        "order_status": "pending", "payment_status": "pending",
        "created_at": "2026-05-07T10:00:00+00:00",
    })

    try:
        # Antes: nenhuma comissao
        assert db.commissions.count_documents({"order_id": oid}) == 0

        tk = _login("admin@oxxpharma.com", "admin123")
        r = requests.put(f"{API_URL}/api/admin/orders/{oid}/status",
                         headers={"Authorization": f"Bearer {tk}"},
                         json={"status": "paid"}, timeout=15)
        assert r.status_code == 200, r.text

        # Apos: sponsor recebeu 1 comissao affiliate em status pending (nao paid)
        comms = list(db.commissions.find({"order_id": oid}, {"_id": 0}))
        assert len(comms) == 1, f"Esperado 1 comissao, encontradas {len(comms)}: {comms}"
        c = comms[0]
        assert c["user_id"] == sponsor_id
        assert c["type"] == "affiliate"
        assert c["status"] == "pending"
        assert c["amount"] == 8.0  # 8% de 100
    finally:
        db.users.delete_many({"user_id": {"$in": [sponsor_id, customer_id]}})
        db.orders.delete_many({"order_id": oid})
        db.commissions.delete_many({"order_id": oid})


def test_marking_paid_is_idempotent():
    """Marcar pedido pago 2x nao duplica comissoes."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    sponsor_id = "test_iter42d_idem_s"
    customer_id = "test_iter42d_idem_c"
    oid = "test_iter42d_idem_o"
    db.users.delete_many({"user_id": {"$in": [sponsor_id, customer_id]}})
    db.orders.delete_many({"order_id": oid})
    db.commissions.delete_many({"order_id": oid})
    db.users.insert_many([
        {"user_id": sponsor_id, "email": f"{sponsor_id}@t.com", "name": "S",
         "role": "customer", "status": "active", "referral_program_active": True},
        {"user_id": customer_id, "email": f"{customer_id}@t.com", "name": "C",
         "role": "customer", "status": "active", "sponsor_id": sponsor_id},
    ])
    db.orders.insert_one({
        "order_id": oid, "user_id": customer_id, "customer_email": f"{customer_id}@t.com",
        "customer_name": "C", "subtotal": 50, "total": 50, "items": [],
        "order_status": "pending", "payment_status": "pending",
        "created_at": "2026-05-07T10:00:00+00:00",
    })
    try:
        tk = _login("admin@oxxpharma.com", "admin123")
        # Primeiro PUT
        r = requests.put(f"{API_URL}/api/admin/orders/{oid}/status",
                         headers={"Authorization": f"Bearer {tk}"},
                         json={"status": "paid"}, timeout=15)
        assert r.status_code == 200
        # Volta para pending e refaz pra paid (admin pode mudar tudo)
        requests.put(f"{API_URL}/api/admin/orders/{oid}/status",
                     headers={"Authorization": f"Bearer {tk}"},
                     json={"status": "shipped"}, timeout=15)
        requests.put(f"{API_URL}/api/admin/orders/{oid}/status",
                     headers={"Authorization": f"Bearer {tk}"},
                     json={"status": "paid"}, timeout=15)

        # Apenas 1 comissao deve existir (idempotencia)
        cnt = db.commissions.count_documents({"order_id": oid})
        assert cnt == 1, f"Esperado 1, encontradas {cnt}"
    finally:
        db.users.delete_many({"user_id": {"$in": [sponsor_id, customer_id]}})
        db.orders.delete_many({"order_id": oid})
        db.commissions.delete_many({"order_id": oid})


def test_recalc_force_works_after_orphan_cleanup():
    """Apos limpar orfas, o recalculo force deve produzir o estado esperado."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    # Garante zero orfas
    comm_oids = db.commissions.distinct("order_id")
    paid_oids = set(db.orders.distinct("order_id",
                                       {"payment_status": "paid",
                                        "order_id": {"$in": comm_oids}}))
    orphan = [oid for oid in comm_oids if oid not in paid_oids]
    assert orphan == [], f"Pre-condicao falhou: existem {len(orphan)} orfas"

    tk = _login("admin@oxxpharma.com", "admin123")
    # Preview
    r = requests.post(f"{API_URL}/api/admin/recalc-commissions/preview",
                      headers={"Authorization": f"Bearer {tk}"},
                      json={"force": True}, timeout=30)
    assert r.status_code == 200
    preview = r.json()
    expected_total = preview["total_amount"]
    expected_count = preview["total_commissions"]

    # Apply
    r = requests.post(f"{API_URL}/api/admin/recalc-commissions/apply",
                      headers={"Authorization": f"Bearer {tk}"},
                      json={"force": True}, timeout=30)
    assert r.status_code == 200

    # DB final: total de comissoes ativas deve igualar o expected do preview
    # (paid_out preservados + novos == expected_count)
    rows = list(db.commissions.aggregate([
        {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": "$amount"}}}
    ]))
    if not rows:
        return
    final_count = rows[0]["count"]
    final_total = round(rows[0]["total"], 2)
    assert final_count == expected_count, f"DB tem {final_count}, preview previa {expected_count}"
    assert abs(final_total - expected_total) < 0.01, f"DB total R${final_total} vs preview R${expected_total}"
