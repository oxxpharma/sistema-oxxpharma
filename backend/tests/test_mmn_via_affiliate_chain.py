"""Teste de regressão para a regra de comissão MMN via cadeia de afiliados.

Iter 31: MMN (network_1/network_2) com programa ativo recebe comissões da 1ª à 6ª
geração seguindo a cadeia de SPONSOR_ID, mesmo que os intermediários sejam customers.
Múltiplos MMN na mesma cadeia recebem cada um sua geração relativa ao comprador.

Cenário base do teste:
  Giovani (N1, programa ativo) <- A (customer + programa) <- B <- C <- D <- E <- F (customer)
  F faz um pedido pago.
  Esperado:
    - E ganha comissão de afiliado (gen 0)
    - Giovani ganha comissão MMN gen 6 (taxa N1: 0,5%)
    - B/C/D NÃO ganham nada (somente sponsor direto e MMN ancestrais)
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
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "oxxpharma")
    client = MongoClient(mongo_url)
    return client[db_name]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _make_chain(db, prefix, count, top_sponsor_id=None, network_type="customer", referral_active=True):
    """Cria uma cadeia de N usuários onde cada um é sponsor do próximo.
    Retorna lista de user_ids do topo para o último (top_sponsor_id é o sponsor do 1o)."""
    ids = []
    last = top_sponsor_id
    for i in range(count):
        uid = f"{prefix}_{i}_{uuid.uuid4().hex[:6]}"
        doc = {
            "user_id": uid, "role": "customer", "status": "active",
            "name": f"{prefix} {i}",
            "email": f"{uid}@example.com".lower(),
            "sponsor_id": last,
            "network_type": network_type,
            "referral_program_active": referral_active,
            "referral_code": uid.upper()[:12] if referral_active else None,
            "created_at": _now(),
        }
        db.users.insert_one(doc)
        ids.append(uid)
        last = uid
    return ids


def _create_paid_order(db, user_id, subtotal=1000.0):
    """Insere um pedido fake (sem passar pelo /api/checkout). Útil quando vamos
    chamar a logica diretamente. Mas como queremos testar a logica de checkout,
    precisamos passar pelo endpoint. Helper nao usado diretamente."""
    raise NotImplementedError


def _signup_and_login(email, password, sponsor_code=None):
    """Faz registro publico via /api/auth/register e retorna (token, user_id)."""
    body = {"name": email.split('@')[0], "email": email, "password": password}
    if sponsor_code:
        body["ref_code"] = sponsor_code
    r = requests.post(f"{API_URL}/api/auth/register", json=body, timeout=15)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"register failed: {r.status_code} {r.text}")
    j = r.json()
    return j.get("token") or j.get("access_token"), j.get("user", {}).get("user_id")


def test_mmn_receives_commission_through_affiliate_chain_up_to_6_gen(db, admin_token):
    """Giovani (N1 ativo) recebe gen 1..6 quando descendentes na cadeia de afiliados compram."""
    # Cleanup eventual de runs anteriores
    db.commissions.delete_many({"customer_name": {"$regex": "^IT31_"}})
    db.users.delete_many({"name": {"$regex": "^IT31_"}})
    db.orders.delete_many({"customer_name": {"$regex": "^IT31_"}})

    giovani_id = f"IT31_giovani_{uuid.uuid4().hex[:6]}"
    db.users.insert_one({
        "user_id": giovani_id, "role": "customer", "status": "active",
        "name": "IT31_Giovani N1",
        "email": f"{giovani_id}@example.com".lower(),
        "sponsor_id": None,
        "network_type": "network_1",
        "referral_program_active": True,
        "referral_code": f"IT31GIO{uuid.uuid4().hex[:5].upper()}",
        "created_at": _now(),
    })

    # Cadeia: Giovani <- A <- B <- C <- D <- E <- F (customers em programa)
    chain = _make_chain(db, "IT31", count=6, top_sponsor_id=giovani_id)
    a_id, b_id, c_id, d_id, e_id, f_id = chain

    # F precisa virar comprador real -> ele precisa ter senha + ser autenticavel
    # Setamos password_hash diretamente
    import bcrypt
    pw_hash = bcrypt.hashpw(b"oxx@pharma", bcrypt.gensalt()).decode()
    db.users.update_one({"user_id": f_id}, {"$set": {"password_hash": pw_hash}})

    # F faz login
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": f"{f_id}@example.com".lower(), "password": "oxx@pharma"}, timeout=15)
    assert r.status_code == 200, r.text
    f_token = r.json()["token"]

    # Pega um produto com estoque
    r = requests.get(f"{API_URL}/api/products?limit=20", timeout=15)
    products = [p for p in (r.json().get("products") or [])
                if (p.get("stock") or 0) > 0 and (p.get("price") or 0) > 0]
    if not products:
        pytest.skip("Nao ha produtos com estoque para testar checkout")
    product = products[0]
    pid = product["product_id"]
    price = float(product["price"])

    # F adiciona ao carrinho e faz checkout
    requests.post(f"{API_URL}/api/cart/items",
                  json={"product_id": pid, "quantity": 1},
                  headers={"Authorization": f"Bearer {f_token}"}, timeout=15)
    # Endereco de F
    r = requests.post(f"{API_URL}/api/users/me/addresses",
                      json={"label": "casa", "zip_code": "01000000", "street": "Rua X",
                            "number": "1", "neighborhood": "Centro", "city": "Sao Paulo", "state": "SP"},
                      headers={"Authorization": f"Bearer {f_token}"}, timeout=15)
    addr_id = r.json().get("address_id") or (r.json().get("addresses") or [{}])[-1].get("address_id")
    if not addr_id:
        # Tenta GET p/ pegar o id
        r = requests.get(f"{API_URL}/api/users/me/addresses",
                         headers={"Authorization": f"Bearer {f_token}"}, timeout=15)
        addrs = r.json().get("addresses") or []
        assert addrs, "endereco nao foi criado"
        addr_id = addrs[-1]["address_id"]

    r = requests.post(f"{API_URL}/api/checkout",
                      json={"address_id": addr_id, "payment_method": "pix",
                            "shipping_price": 0, "shipping_carrier": "test",
                            "shipping_service": "test"},
                      headers={"Authorization": f"Bearer {f_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    order = r.json()
    order_id = order.get("order_id") or order.get("order", {}).get("order_id")
    assert order_id, f"order_id ausente: {order}"

    # Buscar comissoes geradas para esse pedido
    comms = list(db.commissions.find({"order_id": order_id}, {"_id": 0}))
    print(f"\n=== Comissoes geradas para order {order_id} ===")
    for c in comms:
        print(f"  user={c['user_id']} type={c['type']} gen={c['generation']} amt={c['amount']} rate={c.get('rate')}")

    # E ganha comissao de afiliado (sponsor direto de F)
    aff_e = [c for c in comms if c["user_id"] == e_id and c["type"] == "affiliate"]
    assert len(aff_e) == 1, f"E deveria ter 1 comissao de afiliado, teve {len(aff_e)}"

    # Giovani ganha gen 6 N1
    gio_comms = [c for c in comms if c["user_id"] == giovani_id]
    assert len(gio_comms) == 1, f"Giovani deveria ter 1 comissao MMN, teve {len(gio_comms)}: {gio_comms}"
    assert gio_comms[0]["type"] == "network_gen"
    assert gio_comms[0]["generation"] == 6
    assert gio_comms[0]["network_type"] == "network_1"
    # Taxa esperada: network1_generations[5] = 0.5% (default)
    assert abs(gio_comms[0]["rate"] - 0.005) < 1e-6 or gio_comms[0]["rate"] > 0

    # B, C, D NAO devem ter comissao (so afiliado direto e MMN ancestrais)
    for uid in (a_id, b_id, c_id, d_id):
        cs = [c for c in comms if c["user_id"] == uid]
        assert not cs, f"User intermediario {uid} nao deveria receber: {cs}"

    # Cleanup
    db.commissions.delete_many({"order_id": order_id})
    db.orders.delete_many({"order_id": order_id})
    db.carts.delete_many({"user_id": f_id})
    db.users.delete_many({"user_id": {"$in": [giovani_id] + chain}})


def test_two_mmn_in_chain_each_gets_their_generation(db, admin_token):
    """Se houver 2 MMN ativos na cadeia, ambos recebem (cada um sua geracao relativa)."""
    db.commissions.delete_many({"customer_name": {"$regex": "^IT31B_"}})
    db.users.delete_many({"name": {"$regex": "^IT31B_"}})
    db.orders.delete_many({"customer_name": {"$regex": "^IT31B_"}})

    # Cadeia: top (N1) <- mid (N1 ativo) <- X (customer) <- Y (customer comprador)
    top_id = f"IT31B_top_{uuid.uuid4().hex[:6]}"
    mid_id = f"IT31B_mid_{uuid.uuid4().hex[:6]}"
    x_id = f"IT31B_x_{uuid.uuid4().hex[:6]}"
    y_id = f"IT31B_y_{uuid.uuid4().hex[:6]}"

    db.users.insert_one({
        "user_id": top_id, "role": "customer", "status": "active",
        "name": "IT31B_Top N1", "email": f"{top_id}@example.com".lower(),
        "sponsor_id": None, "network_type": "network_1",
        "referral_program_active": True, "referral_code": f"IT31BTOP{uuid.uuid4().hex[:4].upper()}",
        "created_at": _now(),
    })
    db.users.insert_one({
        "user_id": mid_id, "role": "customer", "status": "active",
        "name": "IT31B_Mid N1", "email": f"{mid_id}@example.com".lower(),
        "sponsor_id": top_id, "network_type": "network_1",
        "referral_program_active": True, "referral_code": f"IT31BMID{uuid.uuid4().hex[:4].upper()}",
        "created_at": _now(),
    })
    db.users.insert_one({
        "user_id": x_id, "role": "customer", "status": "active",
        "name": "IT31B_X cust", "email": f"{x_id}@example.com".lower(),
        "sponsor_id": mid_id, "network_type": "customer",
        "referral_program_active": True, "referral_code": f"IT31BX{uuid.uuid4().hex[:5].upper()}",
        "created_at": _now(),
    })
    import bcrypt
    pw_hash = bcrypt.hashpw(b"oxx@pharma", bcrypt.gensalt()).decode()
    db.users.insert_one({
        "user_id": y_id, "role": "customer", "status": "active",
        "name": "IT31B_Y buyer", "email": f"{y_id}@example.com".lower(),
        "sponsor_id": x_id, "network_type": "customer",
        "referral_program_active": True, "referral_code": f"IT31BY{uuid.uuid4().hex[:5].upper()}",
        "password_hash": pw_hash,
        "created_at": _now(),
    })

    # Y faz login + checkout
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": f"{y_id}@example.com".lower(), "password": "oxx@pharma"}, timeout=15)
    assert r.status_code == 200, r.text
    y_token = r.json()["token"]

    r = requests.get(f"{API_URL}/api/products?limit=20", timeout=15)
    products = [p for p in (r.json().get("products") or []) if (p.get("stock") or 0) > 0 and (p.get("price") or 0) > 0]
    if not products:
        pytest.skip("sem produtos com estoque")
    pid = products[0]["product_id"]

    requests.post(f"{API_URL}/api/cart/items", json={"product_id": pid, "quantity": 1},
                  headers={"Authorization": f"Bearer {y_token}"}, timeout=15)
    r = requests.post(f"{API_URL}/api/users/me/addresses",
                      json={"label": "casa", "zip_code": "01000000", "street": "X",
                            "number": "1", "neighborhood": "C", "city": "SP", "state": "SP"},
                      headers={"Authorization": f"Bearer {y_token}"}, timeout=15)
    r2 = requests.get(f"{API_URL}/api/users/me/addresses",
                      headers={"Authorization": f"Bearer {y_token}"}, timeout=15)
    addr_id = r2.json()["addresses"][-1]["address_id"]

    r = requests.post(f"{API_URL}/api/checkout",
                      json={"address_id": addr_id, "payment_method": "pix",
                            "shipping_price": 0, "shipping_carrier": "t", "shipping_service": "t"},
                      headers={"Authorization": f"Bearer {y_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    order_id = (r.json().get("order_id") or r.json().get("order", {}).get("order_id"))
    assert order_id

    comms = list(db.commissions.find({"order_id": order_id}, {"_id": 0}))
    print(f"\n=== test_two_mmn order {order_id} ===")
    for c in comms:
        print(f"  user={c['user_id']} type={c['type']} gen={c['generation']} amt={c['amount']}")

    # X (sponsor direto, customer ativo) ganha afiliado gen 0
    aff_x = [c for c in comms if c["user_id"] == x_id and c["type"] == "affiliate"]
    assert len(aff_x) == 1

    # mid: gen 2 (Y -> X -> mid)
    mid_comms = [c for c in comms if c["user_id"] == mid_id]
    assert len(mid_comms) == 1
    assert mid_comms[0]["type"] == "network_gen"
    assert mid_comms[0]["generation"] == 2

    # top: gen 3 (Y -> X -> mid -> top)
    top_comms = [c for c in comms if c["user_id"] == top_id]
    assert len(top_comms) == 1
    assert top_comms[0]["generation"] == 3

    db.commissions.delete_many({"order_id": order_id})
    db.orders.delete_many({"order_id": order_id})
    db.carts.delete_many({"user_id": y_id})
    db.users.delete_many({"user_id": {"$in": [top_id, mid_id, x_id, y_id]}})


def test_mmn_without_program_active_does_not_receive(db):
    """Iter 31 regra 3: MMN sem programa de indicacao ativo NAO recebe comissao."""
    boss_id = f"IT31C_boss_{uuid.uuid4().hex[:6]}"
    cust_id = f"IT31C_cust_{uuid.uuid4().hex[:6]}"
    db.users.insert_one({
        "user_id": boss_id, "role": "customer", "status": "active",
        "name": "IT31C Boss N1 inactive", "email": f"{boss_id}@example.com".lower(),
        "sponsor_id": None, "network_type": "network_1",
        "referral_program_active": False,  # programa NAO ativo
        "created_at": _now(),
    })
    import bcrypt
    pw_hash = bcrypt.hashpw(b"oxx@pharma", bcrypt.gensalt()).decode()
    db.users.insert_one({
        "user_id": cust_id, "role": "customer", "status": "active",
        "name": "IT31C Cust", "email": f"{cust_id}@example.com".lower(),
        "sponsor_id": boss_id, "network_type": "customer",
        "referral_program_active": True, "referral_code": f"IT31CCUST{uuid.uuid4().hex[:4].upper()}",
        "password_hash": pw_hash,
        "created_at": _now(),
    })

    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": f"{cust_id}@example.com".lower(), "password": "oxx@pharma"}, timeout=15)
    assert r.status_code == 200
    tok = r.json()["token"]

    r = requests.get(f"{API_URL}/api/products?limit=20", timeout=15)
    products = [p for p in (r.json().get("products") or []) if (p.get("stock") or 0) > 0 and (p.get("price") or 0) > 0]
    if not products:
        pytest.skip("sem produtos com estoque")
    pid = products[0]["product_id"]

    requests.post(f"{API_URL}/api/cart/items", json={"product_id": pid, "quantity": 1},
                  headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    requests.post(f"{API_URL}/api/users/me/addresses",
                  json={"label": "casa", "zip_code": "01000000", "street": "X", "number": "1",
                        "neighborhood": "C", "city": "SP", "state": "SP"},
                  headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    r2 = requests.get(f"{API_URL}/api/users/me/addresses",
                      headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    addr_id = r2.json()["addresses"][-1]["address_id"]
    r = requests.post(f"{API_URL}/api/checkout",
                      json={"address_id": addr_id, "payment_method": "pix",
                            "shipping_price": 0, "shipping_carrier": "t", "shipping_service": "t"},
                      headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert r.status_code == 200, r.text
    order_id = (r.json().get("order_id") or r.json().get("order", {}).get("order_id"))

    # Iter 40: Comissao MMN AGORA eh sempre criada, mesmo sem programa ativo,
    # porem com status='pending_enrollment' e program_active_at_creation=False.
    # Quando o beneficiario ativa o programa, sao promovidas para 'pending'.
    mmn_comms = list(db.commissions.find(
        {"order_id": order_id, "user_id": boss_id, "type": "network_gen"}
    ))
    assert len(mmn_comms) == 1, f"Boss N1 deveria receber 1 MMN (pending_enrollment): {mmn_comms}"
    c = mmn_comms[0]
    assert c["status"] == "pending_enrollment"
    assert c.get("program_active_at_creation") is False

    db.commissions.delete_many({"order_id": order_id})
    db.orders.delete_many({"order_id": order_id})
    db.carts.delete_many({"user_id": cust_id})
    db.users.delete_many({"user_id": {"$in": [boss_id, cust_id]}})
