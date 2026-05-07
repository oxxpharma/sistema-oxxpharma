"""Diagnostico de saude das comissoes/cashbacks (read-only por padrao).

Uso:
  python3 tests/diagnose_cashbacks.py                                # tudo
  python3 tests/diagnose_cashbacks.py 2026-04-01 2026-05-08          # periodo
  python3 tests/diagnose_cashbacks.py --cleanup                      # APAGA orfas tambem
  python3 tests/diagnose_cashbacks.py 2026-04-01 2026-05-08 --cleanup
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


def _load_env():
    """Tenta carregar .env de varios caminhos provaveis."""
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent / ".env",        # backend/.env
        here.parent.parent.parent / ".env", # repo_root/.env
        Path("/app/backend/.env"),
        Path("/var/www/oxxpharma/backend/.env"),
    ]
    for p in candidates:
        if p.exists():
            load_dotenv(p)
            print(f"[env] carregado de {p}")
            return
    print("[env] !! nenhum .env encontrado nos caminhos padrao")


_load_env()


async def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    cleanup = "--cleanup" in flags
    start = args[0] if len(args) > 0 else None
    end = args[1] if len(args) > 1 else None

    if "MONGO_URL" not in os.environ:
        print("ERRO: MONGO_URL nao encontrado no ambiente. Rode com:")
        print("  export MONGO_URL=mongodb://...  ou ajuste o .env")
        sys.exit(1)

    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ.get("DB_NAME", "oxxpharma")]

    print("=" * 70)
    print(f"DIAGNOSTICO DE CASHBACKS  -  Periodo: {start or 'inicio'} ate {end or 'agora'}")
    if cleanup:
        print("MODO: --cleanup (vai APAGAR orfas)")
    else:
        print("MODO: read-only (use --cleanup para corrigir)")
    print("=" * 70)

    order_filter = {}
    if start:
        order_filter.setdefault("created_at", {})["$gte"] = start + "T00:00:00"
    if end:
        order_filter.setdefault("created_at", {})["$lte"] = end + "T23:59:59"

    paid_filter = dict(order_filter)
    paid_filter["payment_status"] = "paid"
    paid_orders = await db.orders.aggregate([
        {"$match": paid_filter},
        {"$group": {"_id": None, "count": {"$sum": 1},
                    "subtotal_sum": {"$sum": "$subtotal"},
                    "total_sum": {"$sum": "$total"}}}
    ]).to_list(1)
    paid = paid_orders[0] if paid_orders else {"count": 0, "subtotal_sum": 0, "total_sum": 0}
    print(f"\n[1] PEDIDOS PAGOS no periodo: {paid['count']}")
    print(f"    Subtotal (base de cashback): R$ {paid['subtotal_sum']:.2f}")
    print(f"    Total (com frete):           R$ {paid['total_sum']:.2f}")

    # Orfas
    comm_oids = await db.commissions.distinct("order_id")
    # Pedido eh "valido" se payment_status=paid OU order_status em estado pos-pagamento.
    # Isso protege casos onde webhook nao chegou mas admin marcou shipped/delivered.
    VALID_ORDER_STATES = ["paid", "shipped", "delivered"]
    valid_oids = set()
    valid_oids.update(await db.orders.distinct(
        "order_id", {"payment_status": "paid", "order_id": {"$in": comm_oids}}
    ))
    valid_oids.update(await db.orders.distinct(
        "order_id",
        {"order_status": {"$in": VALID_ORDER_STATES}, "order_id": {"$in": comm_oids}}
    ))
    orphan_oids = [o for o in comm_oids if o not in valid_oids]
    if orphan_oids:
        orphan_agg = await db.commissions.aggregate([
            {"$match": {"order_id": {"$in": orphan_oids}}},
            {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        oc = orphan_agg[0] if orphan_agg else {"count": 0, "total": 0}
        print(f"\n[2] !! COMISSOES ORFAS (em pedidos nao-paid): {oc['count']} = R$ {oc['total']:.2f}")
        print(f"    Pedidos nao-paid com comissao: {len(orphan_oids)}")
        if cleanup:
            res = await db.commissions.delete_many({"order_id": {"$in": orphan_oids}})
            print(f"    >> CLEANUP: {res.deleted_count} comissoes orfas REMOVIDAS")
        else:
            print(f"    >> Rode com --cleanup para REMOVER")
    else:
        print("\n[2] OK Nenhuma comissao orfa.")

    # Duplicatas
    pipe = [
        {"$group": {
            "_id": {"order_id": "$order_id", "user_id": "$user_id",
                    "type": "$type", "generation": "$generation"},
            "count": {"$sum": 1}, "ids": {"$push": "$commission_id"},
            "statuses": {"$push": "$status"}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    dupes = await db.commissions.aggregate(pipe).to_list(1000)
    if dupes:
        extra = sum(d["count"] - 1 for d in dupes)
        print(f"\n[3] !! COMISSOES DUPLICADAS: {len(dupes)} grupos / {extra} docs extras")
        if cleanup:
            STATUS_PRIORITY = {"paid_out": 0, "paid": 1, "pending": 2, "pending_enrollment": 3}
            removed = 0
            for d in dupes:
                docs = await db.commissions.find(
                    {"commission_id": {"$in": d["ids"]}}, {"_id": 0}
                ).to_list(len(d["ids"]))
                docs.sort(key=lambda x: (STATUS_PRIORITY.get(x.get("status"), 99),
                                          x.get("created_at") or ""))
                to_del = [x["commission_id"] for x in docs[1:]]
                if to_del:
                    r = await db.commissions.delete_many({"commission_id": {"$in": to_del}})
                    removed += r.deleted_count
            print(f"    >> CLEANUP: {removed} duplicatas REMOVIDAS")
            # Cria indice unico para impedir novas
            try:
                await db.commissions.create_index(
                    [("order_id", 1), ("user_id", 1), ("type", 1), ("generation", 1)],
                    unique=True, name="uq_commission_per_beneficiary")
                print("    >> Indice unico uq_commission_per_beneficiary criado")
            except Exception as e:
                print(f"    !! Falha ao criar indice unico: {e}")
        else:
            print(f"    >> Rode com --cleanup para REMOVER")
    else:
        print("\n[3] OK Nenhuma duplicata.")

    # Cashback por status no periodo
    comm_filter = dict(order_filter) if order_filter else {}
    pipe = ([{"$match": comm_filter}] if comm_filter else []) + [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$amount"}}}
    ]
    by_status = await db.commissions.aggregate(pipe).to_list(20)
    total_cashback = sum(s["total"] for s in by_status)
    total_count = sum(s["count"] for s in by_status)
    print(f"\n[4] CASHBACKS no periodo (por status):")
    for s in sorted(by_status, key=lambda x: -(x["total"] or 0)):
        print(f"    {(s['_id'] or '?'):25s} {s['count']:5d}  R$ {s['total']:.2f}")
    print(f"    {'TOTAL':25s} {total_count:5d}  R$ {total_cashback:.2f}")

    if paid["subtotal_sum"] > 0:
        pct = (total_cashback / paid["subtotal_sum"]) * 100
        print(f"\n[5] % CASHBACK / SUBTOTAL: {pct:.2f}% (esperado ~20% para 6 geracoes Equipe 1)")
        if pct > 22:
            print("    !! ACIMA do esperado")

    # Pedidos suspeitos (>21% do subtotal)
    pipe = [
        {"$group": {"_id": "$order_id", "comm_total": {"$sum": "$amount"},
                    "subtotal": {"$first": "$order_subtotal"}}},
        {"$match": {"$expr": {"$gt": ["$comm_total", {"$multiply": ["$subtotal", 0.21]}]}}},
        {"$sort": {"comm_total": -1}}, {"$limit": 10}
    ]
    suspect = await db.commissions.aggregate(pipe).to_list(10)
    if suspect:
        print(f"\n[6] !! PEDIDOS COM CASHBACK > 21% DO SUBTOTAL ({len(suspect)} suspeitos):")
        for s in suspect:
            sub = s["subtotal"] or 0
            pct = (s["comm_total"] / sub * 100) if sub else 0
            print(f"    {s['_id']}  subtotal=R${sub:.2f}  cashback=R${s['comm_total']:.2f}  ({pct:.1f}%)")
    else:
        print("\n[6] OK Nenhum pedido com cashback acima de 21%.")

    print("\n" + "=" * 70)
    cli.close()


if __name__ == "__main__":
    asyncio.run(main())
