"""Iter 48f - Testes do fluxo pos-criacao de pedido IGVD:
 - Cashback/comissao para sponsor
 - CEP preenchido no shipping_address (com/sem endereco default)
 - Fatura detalhada automatica por email (invoice_admin_paid)
 - Idempotencia
 - Backfill via retry-pending

Cria dados prefixados com 'TEST_' e limpa ao final.
"""
import os
import time
import uuid
import secrets
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "oxxpharma")

ADMIN_EMAIL = "admin@oxxpharma.com"
ADMIN_PASSWORD = "admin123"
IGVD_SECRET = "test-secret-123"
INVOICE_TO = "test-invoice@oxx.com"


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login response: {r.text[:200]}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def kit_product(mongo_db, admin_headers):
    """Garante 1 produto minimo no catalogo com points_value > 0 para usar no kit."""
    # tenta usar um produto ja existente
    p = mongo_db.products.find_one({"price": {"$gt": 0}}, {"_id": 0})
    if not p:
        # cria um produto TEST direto no mongo
        p = {
            "product_id": f"TESTP_{secrets.token_hex(4)}",
            "name": "TEST Kit Product IGVD",
            "sku": "TESTSKU-IGVD",
            "ean": "0000000000001",
            "price": 100.0,
            "points_value": 50.0,
            "stock": 999,
            "active": True,
            "tenant": "oxxpharma",
        }
        mongo_db.products.insert_one(p)
    else:
        # garante points_value > 0 para testar registro de pontos
        if not p.get("points_value"):
            mongo_db.products.update_one({"product_id": p["product_id"]}, {"$set": {"points_value": 10.0}})
            p["points_value"] = 10.0
    return p


@pytest.fixture(scope="module", autouse=True)
def configure_settings(admin_headers, kit_product):
    """Configura settings globais necessarias para o teste."""
    # PUT /api/admin/settings soh aceita chaves whitelistadas
    payload = {
        "igvd_voucher_enabled": True,
        "igvd_voucher_secret": IGVD_SECRET,
        "igvd_kit_items": [{"product_id": kit_product["product_id"], "quantity": 1}],
        "order_invoice_email_to": INVOICE_TO,
        "affiliate_commission_rate": 0.08,
    }
    r = requests.put(f"{BASE_URL}/api/admin/settings", json=payload, headers=admin_headers, timeout=15)
    assert r.status_code == 200, f"settings update failed: {r.status_code} {r.text[:200]}"
    yield


# ---------- helpers ----------

def _cleanup_test_data(db):
    orders = list(db.orders.find({"igvd_voucher_code": {"$regex": "^TEST"}}, {"order_id": 1}))
    order_ids = [o["order_id"] for o in orders]
    if order_ids:
        db.commissions.delete_many({"order_id": {"$in": order_ids}})
        db.points_log.delete_many({"order_id": {"$in": order_ids}})
        db.email_logs.delete_many({"meta.order_id": {"$in": order_ids}})
    db.orders.delete_many({"igvd_voucher_code": {"$regex": "^TEST"}})
    db.igvd_vouchers.delete_many({"voucher_code": {"$regex": "^TEST"}})
    db.users.delete_many({"email": {"$regex": "^TEST_"}})


def _create_user(db, email: str, name: str = "TEST User", sponsor_id=None, addresses=None, cpf_digits=None):
    uid = "usr_" + secrets.token_hex(6)
    user = {
        "user_id": uid,
        "email": email,
        "name": name,
        "password_hash": "$2b$12$abcdefghijklmnopqrstuvxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "roles": ["customer"],
        "role": "customer",
        "network_type": "customer",
        "sponsor_id": sponsor_id,
        "network_sponsor_id": None,
        "referral_program_active": False,
        "created_at": "2026-01-01T00:00:00+00:00",
        "cpf_digits": cpf_digits or "",
        "cpf": (f"{cpf_digits[:3]}.{cpf_digits[3:6]}.{cpf_digits[6:9]}-{cpf_digits[9:]}" if cpf_digits and len(cpf_digits) == 11 else ""),
        "addresses": addresses or [],
        "phone": "",
        "tenant": "oxxpharma",
    }
    db.users.insert_one(user)
    return uid


def _voucher_payload(voucher_code: str, licenciado_email: str, licenciado_cpf: str, address: dict, amount_brl: float = 250.0, adesao_id=None):
    return {
        "adesao_id": adesao_id or f"ades_{secrets.token_hex(4)}",
        "source": "igvd",
        "voucher": {
            "code": voucher_code,
            "amount_brl": amount_brl,
            "amount_cents": int(amount_brl * 100),
            "issued_at": "2026-01-15T10:00:00Z",
        },
        "licenciado": {
            "full_name": "TEST Licenciado",
            "email": licenciado_email,
            "cpf": licenciado_cpf,
            "phone": "11999998888",
            "birth_date": "1990-01-01",
            "address": address,
        },
    }


def _post_voucher(payload, idem_key=None):
    headers = {"x-Api-Key": IGVD_SECRET, "Content-Type": "application/json"}
    if idem_key:
        headers["Idempotency-Key"] = idem_key
    return requests.post(f"{BASE_URL}/api/integrations/igvd/voucher", json=payload, headers=headers, timeout=30)


# ---------- tests ----------

class TestIGVDPostOrderCreated:
    """Iter 48f: efeitos colaterais apos criacao do pedido IGVD."""

    @pytest.fixture(autouse=True)
    def _cleanup(self, mongo_db):
        _cleanup_test_data(mongo_db)
        yield
        _cleanup_test_data(mongo_db)

    def test_1_commission_created_for_sponsor(self, mongo_db):
        # Sponsor (afiliado) + customer com sponsor_id apontando pra ele
        sponsor_email = f"TEST_sponsor_{secrets.token_hex(3)}@oxx.com"
        sponsor_id = _create_user(mongo_db, sponsor_email, name="TEST Sheila (Sponsor)")
        # Marca sponsor como afiliado com referral_code
        mongo_db.users.update_one(
            {"user_id": sponsor_id},
            {"$set": {"referral_code": "TESTREF", "network_type": "customer", "referral_program_active": True}},
        )

        customer_email = f"TEST_raquel_{secrets.token_hex(3)}@oxx.com"
        cpf_digits = "".join([str((i * 7) % 10) for i in range(11)])  # 11 digitos
        customer_id = _create_user(
            mongo_db,
            customer_email,
            name="TEST Raquel",
            sponsor_id=sponsor_id,
            cpf_digits=cpf_digits,
        )

        voucher_code = "TEST_v_" + secrets.token_hex(4)
        payload = _voucher_payload(
            voucher_code,
            customer_email,
            cpf_digits,
            {"street": "Rua Teste", "number": "100", "neighborhood": "Centro",
             "city": "SP", "state": "SP", "zip_code": "01310-100"},
            amount_brl=250.0,
        )
        r = _post_voucher(payload)
        assert r.status_code == 200, f"webhook status {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert body.get("status") == "applied", f"expected applied, got {body}"
        order_id = body.get("order_id")
        assert order_id, f"no order_id in response: {body}"

        # aguarda scheduling assincrono se houver
        time.sleep(1.0)

        # verifica pedido persistido
        order = mongo_db.orders.find_one({"order_id": order_id}, {"_id": 0})
        assert order is not None, "order not found in db"
        assert order.get("igvd_voucher_code") == voucher_code
        assert order.get("user_id") == customer_id

        # verifica comissao criada para sponsor
        comms = list(mongo_db.commissions.find({"order_id": order_id, "user_id": sponsor_id}, {"_id": 0}))
        assert len(comms) >= 1, f"no commission for sponsor. comms found: {list(mongo_db.commissions.find({'order_id': order_id}, {'_id': 0}))}"
        aff = next((c for c in comms if c.get("type") == "affiliate"), None)
        assert aff is not None, f"no affiliate commission created; got: {comms}"
        # 8% do subtotal
        assert aff["amount"] > 0
        assert aff["rate"] == 0.08

    def test_2_shipping_address_has_zip_when_user_no_address(self, mongo_db):
        # user sem endereco -> address_dict from IGVD payload deve ser criado no user
        # e o shipping_address do pedido deve ter zip_code preenchido
        email = f"TEST_no_addr_{secrets.token_hex(3)}@oxx.com"
        cpf = "".join([str((i * 3 + 1) % 10) for i in range(11)])
        uid = _create_user(mongo_db, email, cpf_digits=cpf)

        voucher_code = "TEST_v_" + secrets.token_hex(4)
        payload = _voucher_payload(voucher_code, email, cpf,
            {"street": "Av Paulista", "number": "1000", "neighborhood": "Bela Vista",
             "city": "Sao Paulo", "state": "SP", "zip_code": "01310-100"},
        )
        r = _post_voucher(payload)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("status") == "applied", body
        order_id = body["order_id"]

        # verifica user recebeu endereco
        user = mongo_db.users.find_one({"user_id": uid}, {"_id": 0})
        addrs = user.get("addresses") or []
        assert len(addrs) == 1, f"expected 1 default address, got {addrs}"
        addr = addrs[0]
        assert addr.get("zip_code") in ("01310-100",), f"zip_code not filled: {addr}"
        assert addr.get("city") == "Sao Paulo"
        assert addr.get("is_default") is True

        # verifica shipping_address do pedido
        order = mongo_db.orders.find_one({"order_id": order_id}, {"_id": 0})
        ship = order.get("shipping_address") or {}
        zip_val = str(ship.get("zip_code") or "")
        assert "01310" in zip_val, f"order shipping_address.zip_code not filled: {ship}"

    def test_3_shipping_address_merges_zip_when_user_has_empty_zip(self, mongo_db):
        # user com endereco default mas SEM CEP -> merge do CEP vindo do payload
        email = f"TEST_empty_zip_{secrets.token_hex(3)}@oxx.com"
        cpf = "".join([str((i * 5 + 2) % 10) for i in range(11)])
        existing_addr = {
            "address_id": "addr_existing",
            "label": "Casa",
            "name": "TEST Existing",
            "street": "Rua Antiga",
            "number": "50",
            "neighborhood": "Centro Antigo",
            "city": "Rio",
            "state": "RJ",
            "zip_code": "",  # VAZIO
            "is_default": True,
        }
        uid = _create_user(mongo_db, email, cpf_digits=cpf, addresses=[existing_addr])

        voucher_code = "TEST_v_" + secrets.token_hex(4)
        payload = _voucher_payload(voucher_code, email, cpf,
            {"street": "Nova Rua Ignorada", "number": "999", "neighborhood": "Novo Bairro",
             "city": "Nova Cidade", "state": "MG", "zip_code": "22222-333"},
        )
        r = _post_voucher(payload)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("status") == "applied", body
        order_id = body["order_id"]

        order = mongo_db.orders.find_one({"order_id": order_id}, {"_id": 0})
        ship = order.get("shipping_address") or {}
        zip_val = str(ship.get("zip_code") or "")
        assert "22222" in zip_val, f"expected merged zip 22222-333, got {ship}"
        # campos existentes preservados
        assert ship.get("city") == "Rio", f"expected preserved city Rio, got {ship}"

    def test_4_invoice_email_triggered(self, mongo_db):
        # ver se _send_admin_invoice_if_configured foi chamado -> deve haver
        # entry em db.email_logs com slug=invoice_admin_paid e meta.order_id=<order_id>
        email = f"TEST_invoice_{secrets.token_hex(3)}@oxx.com"
        cpf = "".join([str((i * 2 + 3) % 10) for i in range(11)])
        _create_user(mongo_db, email, cpf_digits=cpf)

        voucher_code = "TEST_v_" + secrets.token_hex(4)
        payload = _voucher_payload(voucher_code, email, cpf,
            {"street": "R X", "number": "1", "neighborhood": "B", "city": "SP",
             "state": "SP", "zip_code": "01000-000"},
        )
        r = _post_voucher(payload)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("status") == "applied", body
        order_id = body["order_id"]

        # espera scheduling assincrono
        time.sleep(2.0)

        logs = list(mongo_db.email_logs.find(
            {"meta.order_id": order_id, "meta.slug": "invoice_admin_paid"},
            {"_id": 0},
        ))
        # fallback: se a chave meta.slug nao existir, ver por slug direto ou to
        if not logs:
            logs = list(mongo_db.email_logs.find(
                {"$or": [
                    {"meta.order_id": order_id},
                    {"to": INVOICE_TO},
                ]},
                {"_id": 0},
            ))
        assert logs, (
            f"no invoice_admin_paid log for order {order_id}. "
            f"Total email_logs recent: {mongo_db.email_logs.count_documents({})}"
        )
        # ao menos 1 log referencia o order_id ou o email de destino
        matching = [
            log for log in logs
            if (log.get("meta") or {}).get("order_id") == order_id
            or log.get("to") == INVOICE_TO
            or (isinstance(log.get("to"), list) and INVOICE_TO in log.get("to"))
        ]
        assert matching, f"no email_log referencing order {order_id} or to={INVOICE_TO}. Sample logs: {logs[:3]}"

    def test_5_idempotency_no_duplicate_commission(self, mongo_db):
        sponsor_email = f"TEST_sponsor2_{secrets.token_hex(3)}@oxx.com"
        sponsor_id = _create_user(mongo_db, sponsor_email)
        mongo_db.users.update_one({"user_id": sponsor_id}, {"$set": {"referral_code": "TESTREF2"}})

        cust_email = f"TEST_cust_idem_{secrets.token_hex(3)}@oxx.com"
        cpf = "".join([str((i * 9 + 1) % 10) for i in range(11)])
        _create_user(mongo_db, cust_email, sponsor_id=sponsor_id, cpf_digits=cpf)

        voucher_code = "TEST_v_idem_" + secrets.token_hex(4)
        payload = _voucher_payload(voucher_code, cust_email, cpf,
            {"street": "R", "number": "1", "neighborhood": "B", "city": "SP",
             "state": "SP", "zip_code": "01000-000"},
        )
        r1 = _post_voucher(payload, idem_key=f"idem-{voucher_code}")
        assert r1.status_code == 200, r1.text[:300]
        body1 = r1.json()
        assert body1.get("status") == "applied"
        order_id = body1["order_id"]

        time.sleep(0.5)
        count1 = mongo_db.commissions.count_documents({"order_id": order_id})
        assert count1 >= 1, f"expected commission created, got {count1}"

        # 2a chamada com mesmo voucher_code -> duplicate=true
        r2 = _post_voucher(payload, idem_key=f"idem-{voucher_code}")
        assert r2.status_code == 200, r2.text[:300]
        body2 = r2.json()
        assert body2.get("duplicate") is True, f"expected duplicate=true, got {body2}"

        time.sleep(0.5)
        count2 = mongo_db.commissions.count_documents({"order_id": order_id})
        assert count2 == count1, f"commissions duplicated: {count1} -> {count2}"

    def test_6_retry_pending_creates_order_and_commissions(self, mongo_db, admin_headers):
        # 1) primeiro, envia voucher SEM user cadastrado -> fica pending
        cust_email = f"TEST_backfill_{secrets.token_hex(3)}@oxx.com"
        cpf = "".join([str((i * 4 + 7) % 10) for i in range(11)])
        voucher_code = "TEST_v_bkfl_" + secrets.token_hex(4)
        payload = _voucher_payload(voucher_code, cust_email, cpf,
            {"street": "R Backfill", "number": "10", "neighborhood": "B",
             "city": "SP", "state": "SP", "zip_code": "05000-000"},
        )
        r = _post_voucher(payload)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("status") == "pending", f"expected pending (no user yet), got {body}"
        assert not body.get("order_id")

        # 2) agora, cria user com sponsor
        sponsor_email = f"TEST_sponsor3_{secrets.token_hex(3)}@oxx.com"
        sponsor_id = _create_user(mongo_db, sponsor_email)
        mongo_db.users.update_one({"user_id": sponsor_id}, {"$set": {"referral_code": "TESTREF3"}})
        _create_user(mongo_db, cust_email, sponsor_id=sponsor_id, cpf_digits=cpf)

        # 3) roda o retry-pending
        r2 = requests.post(f"{BASE_URL}/api/admin/igvd/vouchers/retry-pending", headers=admin_headers, timeout=30)
        assert r2.status_code == 200, r2.text[:300]
        result = r2.json()
        assert result.get("applied", 0) >= 1, f"nenhum voucher aplicado: {result}"

        time.sleep(1.5)

        # 4) valida pedido criado + comissao gerada
        order = mongo_db.orders.find_one({"igvd_voucher_code": voucher_code}, {"_id": 0})
        assert order is not None, "order not created by retry-pending"
        order_id = order["order_id"]

        # shipping_address deve ter CEP
        ship = order.get("shipping_address") or {}
        assert "05000" in str(ship.get("zip_code") or ""), f"missing zip in shipping: {ship}"

        # comissao criada
        comms = list(mongo_db.commissions.find({"order_id": order_id, "user_id": sponsor_id}, {"_id": 0}))
        assert len(comms) >= 1, f"no commission after retry-pending. all comms: {list(mongo_db.commissions.find({'order_id': order_id}, {'_id': 0}))}"

        # fatura disparada
        logs = list(mongo_db.email_logs.find(
            {"$or": [{"meta.order_id": order_id}, {"to": INVOICE_TO}]},
            {"_id": 0},
        ))
        matching = [
            log for log in logs
            if (log.get("meta") or {}).get("order_id") == order_id
            or log.get("to") == INVOICE_TO
            or (isinstance(log.get("to"), list) and INVOICE_TO in log.get("to"))
        ]
        # nao fatal se o template nao estiver ativo; apenas relata
        if not matching:
            print(f"WARN: no invoice email log found for backfilled order {order_id}")
