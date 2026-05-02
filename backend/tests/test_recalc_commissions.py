"""Testes para o recálculo retroativo de comissões.

Cobre:
  - preview: retorna pedidos elegíveis sem criar nada
  - apply: cria comissões com retroactive=true e batch_id
  - apply é idempotente: rodando 2x não duplica
  - history endpoint funciona
  - filtro por customer_email isola corretamente
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
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


def _now():
    return datetime.now(timezone.utc).isoformat()


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "oxxpharma")]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _seed_legacy_chain(db, prefix):
    """Cria: leader (N1 ativo) <- buyer (customer ativo). Insere 1 order PAID
    do buyer SEM comissao - simulando a situacao 'pre-Maxx'."""
    leader_id = f"{prefix}_leader_{uuid.uuid4().hex[:6]}"
    buyer_id = f"{prefix}_buyer_{uuid.uuid4().hex[:6]}"
    db.users.insert_one({
        "user_id": leader_id, "role": "customer", "status": "active",
        "name": f"{prefix} Leader N1", "email": f"{leader_id}@example.com".lower(),
        "sponsor_id": None, "network_type": "network_1",
        "referral_program_active": True, "referral_code": f"{prefix}LD{uuid.uuid4().hex[:5].upper()}",
        "created_at": _now(),
    })
    db.users.insert_one({
        "user_id": buyer_id, "role": "customer", "status": "active",
        "name": f"{prefix} Buyer", "email": f"{buyer_id}@example.com".lower(),
        "sponsor_id": leader_id, "network_type": "customer",
        "referral_program_active": True, "referral_code": f"{prefix}BY{uuid.uuid4().hex[:5].upper()}",
        "created_at": _now(),
    })
    order_id = f"ord_{prefix}_{uuid.uuid4().hex[:6]}"
    db.orders.insert_one({
        "order_id": order_id, "user_id": buyer_id,
        "customer_name": f"{prefix} Buyer", "customer_email": f"{buyer_id}@example.com".lower(),
        "items": [], "subtotal": 1000.0, "shipping_cost": 0,
        "discount_amount": 0, "total": 1000.0,
        "payment_status": "paid", "order_status": "paid",
        "created_at": _now(),
    })
    return leader_id, buyer_id, order_id


def test_preview_does_not_persist(db, admin_token):
    leader_id, buyer_id, order_id = _seed_legacy_chain(db, "RC1")
    try:
        r = requests.post(f"{API_URL}/api/admin/recalc-commissions/preview",
                          json={"customer_email": f"{buyer_id}@example.com".lower()},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["orders_eligible"] == 1
        assert body["total_commissions"] >= 1
        assert body["total_amount"] > 0
        # Buyer tem afiliado (leader gen 0) + leader gen 1 do MMN N1
        # Esperado: 1 affiliate (rate * 1000) + 1 network_gen gen 1 (rate gen1 * 1000)
        # Valida pelos elementos da breakdown ao inves de hardcode
        order = body["affected_orders"][0]
        types = sorted([c["type"] for c in order["commissions_breakdown"]])
        assert types == ["affiliate", "network_gen"], f"tipos inesperados: {types}"
        # leader recebe ambas
        leader_comms = [c for c in order["commissions_breakdown"] if c["user_id"] == leader_id]
        assert len(leader_comms) == 2
        # Valor total deve bater com soma da breakdown
        sum_break = round(sum(c["amount"] for c in order["commissions_breakdown"]), 2)
        assert abs(body["total_amount"] - sum_break) < 0.01

        # Verifica que NADA foi persistido
        assert db.commissions.count_documents({"order_id": order_id}) == 0
    finally:
        db.users.delete_many({"user_id": {"$in": [leader_id, buyer_id]}})
        db.orders.delete_many({"order_id": order_id})


def test_apply_persists_with_retroactive_flag(db, admin_token):
    leader_id, buyer_id, order_id = _seed_legacy_chain(db, "RC2")
    try:
        r = requests.post(f"{API_URL}/api/admin/recalc-commissions/apply",
                          json={"customer_email": f"{buyer_id}@example.com".lower()},
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["orders_processed"] == 1
        assert body["commissions_created"] >= 1
        batch_id = body["batch_id"]
        assert batch_id

        # Persistido + flag retroactive + batch_id
        comms = list(db.commissions.find({"order_id": order_id}))
        assert len(comms) == body["commissions_created"]
        for c in comms:
            assert c.get("retroactive") is True
            assert c.get("recalc_batch_id") == batch_id
            assert c["status"] == "pending"

        # Audit log gravado
        log = db.recalc_audit_log.find_one({"batch_id": batch_id})
        assert log is not None
        assert log["performed_by_email"] == ADMIN_EMAIL
        assert log["commissions_created"] == body["commissions_created"]
    finally:
        db.commissions.delete_many({"order_id": order_id})
        db.recalc_audit_log.delete_many({"order_ids": order_id})
        db.users.delete_many({"user_id": {"$in": [leader_id, buyer_id]}})
        db.orders.delete_many({"order_id": order_id})


def test_apply_is_idempotent(db, admin_token):
    """Rodando 2x consecutivamente, a 2a vez nao deve duplicar comissoes."""
    leader_id, buyer_id, order_id = _seed_legacy_chain(db, "RC3")
    try:
        r1 = requests.post(f"{API_URL}/api/admin/recalc-commissions/apply",
                           json={"customer_email": f"{buyer_id}@example.com".lower()},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r1.status_code == 200
        first_count = r1.json()["commissions_created"]
        assert first_count >= 1

        # Segunda chamada
        r2 = requests.post(f"{API_URL}/api/admin/recalc-commissions/apply",
                           json={"customer_email": f"{buyer_id}@example.com".lower()},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r2.status_code == 200
        body2 = r2.json()
        # Como ja tem comissao, o pedido nao eh mais elegivel
        assert body2["orders_processed"] == 0
        assert body2["commissions_created"] == 0

        # Total no DB ainda eh first_count (nao duplicou)
        assert db.commissions.count_documents({"order_id": order_id}) == first_count
    finally:
        db.commissions.delete_many({"order_id": order_id})
        db.recalc_audit_log.delete_many({"order_ids": order_id})
        db.users.delete_many({"user_id": {"$in": [leader_id, buyer_id]}})
        db.orders.delete_many({"order_id": order_id})


def test_history_endpoint(admin_token):
    r = requests.get(f"{API_URL}/api/admin/recalc-commissions/history?limit=5",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert isinstance(body["items"], list)


def test_requires_admin():
    """Endpoints exigem admin."""
    for path in ("/api/admin/recalc-commissions/preview", "/api/admin/recalc-commissions/apply"):
        r = requests.post(f"{API_URL}{path}", json={}, timeout=15)
        assert r.status_code in (401, 403), f"{path} deveria exigir auth, retornou {r.status_code}"
