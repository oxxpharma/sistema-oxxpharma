"""Iter 42: Garante que nao ha comissoes duplicadas no banco e que o recalc force
NAO recria comissoes ja pagas (paid) ou saqueadas (paid_out)."""
import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def _admin_token():
    r = requests.post(
        f"{API_URL}/api/auth/login",
        json={"email": "admin@oxxpharma.com", "password": "admin123"},
        timeout=15,
    )
    assert r.status_code == 200
    return r.json()["token"]


def test_no_duplicate_commissions_in_db():
    """Banco limpo: nao deve existir mais de 1 comissao para o mesmo
    (order_id, user_id, type, generation)."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    pipe = [
        {"$group": {
            "_id": {
                "order_id": "$order_id",
                "user_id": "$user_id",
                "type": "$type",
                "generation": "$generation",
            },
            "count": {"$sum": 1},
        }},
        {"$match": {"count": {"$gt": 1}}},
    ]
    dupes = list(db.commissions.aggregate(pipe))
    assert dupes == [], f"Encontradas {len(dupes)} duplicatas: {dupes[:5]}"


def test_unique_index_exists():
    """O indice unico em (order_id,user_id,type,generation) precisa existir."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    indexes = list(db.commissions.list_indexes())
    target_keys = [("order_id", 1), ("user_id", 1), ("type", 1), ("generation", 1)]
    found = False
    for idx in indexes:
        keys = list(idx.get("key", {}).items())
        if keys == target_keys and idx.get("unique"):
            found = True
            break
    assert found, f"Indice unico nao encontrado. Existing: {[i.get('name') for i in indexes]}"


def test_recalc_force_does_not_duplicate_paid_or_paid_out():
    """Roda recalc apply em modo force e garante que comissoes paid/paid_out
    permanecem unicas (nao sao recriadas)."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    # Snapshot dos paid/paid_out atuais
    before = list(db.commissions.find(
        {"status": {"$in": ["paid", "paid_out"]}, "type": {"$exists": True}},
        {"_id": 0, "commission_id": 1, "order_id": 1, "user_id": 1,
         "type": 1, "generation": 1, "status": 1, "amount": 1},
    ))
    if not before:
        # Nenhum paid/paid_out: skip silently
        return

    token = _admin_token()
    # Pega um order_id especifico que tem comissao paid_out
    target_order = before[0]["order_id"]

    r = requests.post(
        f"{API_URL}/api/admin/recalc-commissions/apply",
        headers={"Authorization": f"Bearer {token}"},
        json={"order_ids": [target_order], "force": True},
        timeout=30,
    )
    assert r.status_code == 200, f"recalc apply failed: {r.status_code} {r.text}"

    # Confirma que continua tendo apenas 1 comissao por (user, type, generation) no order
    pipe = [
        {"$match": {"order_id": target_order}},
        {"$group": {
            "_id": {"user_id": "$user_id", "type": "$type", "generation": "$generation"},
            "count": {"$sum": 1},
            "statuses": {"$push": "$status"},
        }},
        {"$match": {"count": {"$gt": 1}}},
    ]
    dupes = list(db.commissions.aggregate(pipe))
    assert dupes == [], f"Recalc force gerou duplicatas em {target_order}: {dupes}"

    # Confirma que os paid/paid_out originais ainda estao la com mesmo amount
    for orig in [c for c in before if c["order_id"] == target_order]:
        match = db.commissions.find_one({
            "order_id": orig["order_id"], "user_id": orig["user_id"],
            "type": orig["type"], "generation": orig["generation"],
            "status": orig["status"],
        })
        assert match is not None, f"Comissao {orig['status']} sumiu apos recalc force"
        assert abs((match.get("amount") or 0) - orig["amount"]) < 0.01
