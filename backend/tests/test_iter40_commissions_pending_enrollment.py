"""Iter 40: Comissoes geradas para todos, ocultas ate inscricao no programa."""
import os
import time
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def _now():
    return int(time.time() * 1000)


def _admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": "admin@oxxpharma.com", "password": "admin123"},
                      timeout=15)
    assert r.status_code == 200
    return r.json()["token"]


def test_mmn_commission_created_even_without_enrollment_and_hidden_from_user():
    """Cliente compra; ancestral N1 SEM programa ativo deve receber comissao com
    status=pending_enrollment, invisivel para ele em /me/commissions."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    boss_id = f"IT40_boss_{_now()}"
    cust_id = f"IT40_cust_{_now()}"
    boss_email = f"boss_{_now()}@x.com"
    cust_email = f"cust_{_now()}@x.com"

    import bcrypt
    pwd_hash = bcrypt.hashpw(b"test@123", bcrypt.gensalt()).decode()

    db.users.insert_many([
        {"user_id": boss_id, "email": boss_email, "name": "Boss", "password_hash": pwd_hash,
         "status": "active", "network_type": "network_1",
         "referral_program_active": False, "addresses": []},
        {"user_id": cust_id, "email": cust_email, "name": "Cust", "password_hash": pwd_hash,
         "status": "active", "network_type": "customer",
         "sponsor_id": boss_id, "addresses": []},
    ])
    try:
        # cust loga, adiciona produto, faz checkout
        cust_tok = requests.post(f"{API_URL}/api/auth/login",
                                 json={"email": cust_email, "password": "test@123"}, timeout=15).json()["token"]
        h = {"Authorization": f"Bearer {cust_tok}"}
        prods = requests.get(f"{API_URL}/api/products?limit=20", timeout=15).json()["products"]
        prods = [p for p in prods if (p.get("stock") or 0) > 0 and (p.get("price") or 0) > 0]
        pid = prods[0]["product_id"]
        requests.post(f"{API_URL}/api/cart/items",
                      json={"product_id": pid, "quantity": 1}, headers=h, timeout=15)
        requests.post(f"{API_URL}/api/users/me/addresses",
                      json={"label": "casa", "zip_code": "01000000", "street": "X", "number": "1",
                            "neighborhood": "C", "city": "SP", "state": "SP"}, headers=h, timeout=15)
        addr_id = requests.get(f"{API_URL}/api/users/me/addresses", headers=h, timeout=15)\
            .json()["addresses"][-1]["address_id"]
        r = requests.post(f"{API_URL}/api/checkout",
                          json={"address_id": addr_id, "payment_method": "pix", "shipping_price": 0},
                          headers=h, timeout=30)
        assert r.status_code == 200, r.text
        order_id = r.json().get("order_id") or r.json().get("order", {}).get("order_id")

        # Boss recebeu comissao MMN com status pending_enrollment
        comms = list(db.commissions.find({"order_id": order_id, "user_id": boss_id}))
        mmn = [c for c in comms if c["type"] == "network_gen"]
        assert len(mmn) == 1, f"Esperado 1 MMN, encontrou {len(mmn)}"
        assert mmn[0]["status"] == "pending_enrollment"
        assert mmn[0]["program_active_at_creation"] is False

        # Boss loga e NAO deve ver a comissao em /me/commissions
        boss_tok = requests.post(f"{API_URL}/api/auth/login",
                                 json={"email": boss_email, "password": "test@123"}, timeout=15).json()["token"]
        my = requests.get(f"{API_URL}/api/users/me/commissions",
                          headers={"Authorization": f"Bearer {boss_tok}"}, timeout=15).json()
        boss_sees_order = [c for c in my["commissions"] if c.get("order_id") == order_id]
        assert len(boss_sees_order) == 0, f"Boss nao deveria ver comissao oculta: {boss_sees_order}"

        # Admin ativa programa de Boss -> comissoes promovidas para pending
        admin_tok = _admin_token()
        # Insere referral_enrollment minimo (necessario para approve)
        db.users.update_one({"user_id": boss_id}, {"$set": {
            "referral_enrollment_status": "pending_approval",
            "referral_enrollment": {"full_name": "Boss", "cpf": "00000000000",
                                    "rg": "0000000", "birth_date": "1990-01-01",
                                    "phone": "11999999999"},
        }})
        ar = requests.post(f"{API_URL}/api/admin/users/{boss_id}/approve-referral-enrollment",
                           headers={"Authorization": f"Bearer {admin_tok}"}, timeout=20)
        assert ar.status_code == 200, ar.text

        # Comissao deve estar pending agora
        c = db.commissions.find_one({"order_id": order_id, "user_id": boss_id, "type": "network_gen"})
        assert c["status"] == "pending"
        assert c.get("promoted_on_enrollment_at") is not None

        # Boss agora VE as 2 comissoes (afiliado + MMN)
        my2 = requests.get(f"{API_URL}/api/users/me/commissions",
                           headers={"Authorization": f"Bearer {boss_tok}"}, timeout=15).json()
        sees = [c for c in my2["commissions"] if c.get("order_id") == order_id]
        assert len(sees) == 2, f"Boss deveria ver 2 comissoes (afiliado + MMN) apos inscricao: {sees}"
        assert all(c["status"] == "pending" for c in sees)
    finally:
        # cleanup
        db.commissions.delete_many({"customer_id": cust_id})
        db.orders.delete_many({"user_id": cust_id})
        db.carts.delete_many({"user_id": cust_id})
        db.users.delete_many({"user_id": {"$in": [boss_id, cust_id]}})
        client.close()
