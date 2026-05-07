"""Diagnostico de saude das comissoes/cashbacks (read-only).

Uso: rodar no servidor de producao com python3 /caminho/para/este/script.py [start] [end]
Ex:  python3 diagnose_cashbacks.py 2026-04-01 2026-05-08

Sem argumentos = analisa todo o historico.

O que verifica:
  1) Comissoes orfas (em pedidos nao-paid)
  2) Comissoes duplicadas por (order_id, user_id, type, generation)
  3) Soma de cashback por status no periodo
  4) Faturamento (subtotal + total) dos pedidos pagos no periodo
  5) % real cashback / faturamento (deveria ser ~20%)
  6) Distribuicao por origem (afiliado direto + 6 geracoes)
  7) Pedidos com cashback acima de 20% do subtotal (suspeita de duplicacao)
"""
import asyncio
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")


async def main():
    args = sys.argv[1:]
    start = args[0] if len(args) > 0 else None
    end = args[1] if len(args) > 1 else None

    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ["DB_NAME"]]

    print("=" * 70)
    print(f"DIAGNOSTICO DE CASHBACKS  -  Periodo: {start or 'inicio'} ate {end or 'agora'}")
    print("=" * 70)

    order_filter = {}
    if start:
        order_filter.setdefault("created_at", {})["$gte"] = start + "T00:00:00"
    if end:
        order_filter.setdefault("created_at", {})["$lte"] = end + "T23:59:59"

    # 1) Pedidos pagos no periodo
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

    # 2) Comissoes orfas (em pedidos nao-paid)
    comm_oids = await db.commissions.distinct("order_id")
    paid_oids = set(await db.orders.distinct(
        "order_id", {"payment_status": "paid", "order_id": {"$in": comm_oids}}
    ))
    orphan_oids = [o for o in comm_oids if o not in paid_oids]
    if orphan_oids:
        orphan_agg = await db.commissions.aggregate([
            {"$match": {"order_id": {"$in": orphan_oids}}},
            {"$group": {"_id": None, "count": {"$sum": 1}, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        oc = orphan_agg[0] if orphan_agg else {"count": 0, "total": 0}
        print(f"\n[2] !! COMISSOES ORFAS (em pedidos nao-paid): {oc['count']} = R$ {oc['total']:.2f}")
        print(f"    Pedidos nao-paid com comissao: {len(orphan_oids)}")
        print(f"    >> Rode tests/cleanup_orphan_commissions.py para limpar")
    else:
        print("\n[2] OK Nenhuma comissao orfa.")

    # 3) Comissoes duplicadas
    pipe = [
        {"$group": {
            "_id": {"order_id": "$order_id", "user_id": "$user_id",
                    "type": "$type", "generation": "$generation"},
            "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    dupes = await db.commissions.aggregate(pipe).to_list(1000)
    if dupes:
        extra = sum(d["count"] - 1 for d in dupes)
        print(f"\n[3] !! COMISSOES DUPLICADAS: {len(dupes)} grupos / {extra} docs extras")
        print(f"    >> Rode tests/cleanup_duplicate_commissions.py para limpar")
    else:
        print("\n[3] OK Nenhuma duplicata.")

    # 4) Cashback por status no periodo (filtra por created_at da comissao)
    comm_filter = dict(order_filter) if order_filter else {}
    pipe = ([{"$match": comm_filter}] if comm_filter else []) + [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$amount"}}}
    ]
    by_status = await db.commissions.aggregate(pipe).to_list(20)
    total_cashback = sum(s["total"] for s in by_status)
    total_count = sum(s["count"] for s in by_status)
    print(f"\n[4] CASHBACKS no periodo (por status):")
    for s in sorted(by_status, key=lambda x: -(x["total"] or 0)):
        print(f"    {s['_id']:25s} {s['count']:5d}  R$ {s['total']:.2f}")
    print(f"    {'TOTAL':25s} {total_count:5d}  R$ {total_cashback:.2f}")

    # 5) % cashback / subtotal pagos
    if paid["subtotal_sum"] > 0:
        pct = (total_cashback / paid["subtotal_sum"]) * 100
        print(f"\n[5] % CASHBACK / SUBTOTAL: {pct:.2f}% (esperado ~20% para 6 geracoes Equipe 1 + 8% afiliado)")
        if pct > 22:
            print("    !! ACIMA do esperado - pode haver duplicacao ou periodo mal alinhado")

    # 6) Distribuicao por origem
    pipe = ([{"$match": comm_filter}] if comm_filter else []) + [
        {"$group": {"_id": {"type": "$type", "network_type": "$network_type",
                            "generation": "$generation"},
                    "count": {"$sum": 1}, "total": {"$sum": "$amount"}}},
        {"$sort": {"_id.generation": 1}}
    ]
    origins = await db.commissions.aggregate(pipe).to_list(50)
    print(f"\n[6] DISTRIBUICAO POR ORIGEM:")
    for o in origins:
        k = o["_id"]
        label = f"{k.get('type','?'):12s} gen={k.get('generation','?')} net={k.get('network_type','-') or '-'}"
        print(f"    {label}  {o['count']:4d}  R$ {o['total']:.2f}")

    # 7) Pedidos com cashback > 20% do subtotal (suspeita)
    pipe = [
        {"$group": {"_id": "$order_id",
                    "comm_total": {"$sum": "$amount"},
                    "subtotal": {"$first": "$order_subtotal"}}},
        {"$match": {"$expr": {"$gt": ["$comm_total",
                                      {"$multiply": ["$subtotal", 0.21]}]}}},
        {"$sort": {"comm_total": -1}},
        {"$limit": 10}
    ]
    suspect = await db.commissions.aggregate(pipe).to_list(10)
    if suspect:
        print(f"\n[7] !! PEDIDOS COM CASHBACK > 21% DO SUBTOTAL ({len(suspect)} suspeitos, top 10):")
        for s in suspect:
            sub = s["subtotal"] or 0
            pct = (s["comm_total"] / sub * 100) if sub else 0
            print(f"    {s['_id']}  subtotal=R${sub:.2f}  cashback=R${s['comm_total']:.2f}  ({pct:.1f}%)")
    else:
        print("\n[7] OK Nenhum pedido com cashback acima de 21% do subtotal.")

    print("\n" + "=" * 70)
    cli.close()


if __name__ == "__main__":
    asyncio.run(main())
