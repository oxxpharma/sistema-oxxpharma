"""Limpeza de comissoes orfas (em pedidos com payment_status != paid).

Iter 42d: como passamos a criar comissoes apenas quando o pedido vira 'paid',
todas as comissoes existentes em pedidos nao-pagos sao orfas (resquicio do fluxo
antigo onde elas eram criadas no checkout).

Mantem as comissoes em pedidos pagos. Apaga apenas as em pedidos pending/cancelled.
"""
import asyncio
import os
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")


async def main(dry_run: bool = False):
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ["DB_NAME"]]

    # Order_ids que tem comissoes
    comm_oids = await db.commissions.distinct("order_id")
    print(f"Pedidos com comissoes: {len(comm_oids)}")

    # Pedidos paid
    paid_oids = set(await db.orders.distinct(
        "order_id",
        {"payment_status": "paid", "order_id": {"$in": comm_oids}}
    ))
    orphan_oids = [oid for oid in comm_oids if oid not in paid_oids]
    print(f"  paid: {len(paid_oids)} | orfas (em pedidos NAO-paid): {len(orphan_oids)}")

    if not orphan_oids:
        print("Nada a limpar.")
        cli.close()
        return

    total_orfas = await db.commissions.count_documents({"order_id": {"$in": orphan_oids}})
    print(f"Comissoes orfas a deletar: {total_orfas}")

    # Detalhe por pedido orfao
    for oid in orphan_oids:
        order = await db.orders.find_one(
            {"order_id": oid},
            {"_id": 0, "payment_status": 1, "order_status": 1, "created_at": 1}
        )
        cnt = await db.commissions.count_documents({"order_id": oid})
        amount_agg = await db.commissions.aggregate([
            {"$match": {"order_id": oid}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        amt = amount_agg[0]["total"] if amount_agg else 0
        print(f"  {oid}: order_status={order.get('order_status') if order else 'NO_ORDER'} payment_status={order.get('payment_status') if order else 'NO_ORDER'} comms={cnt} R${amt:.2f}")

    if dry_run:
        print("\n[DRY-RUN] Nada foi alterado.")
        cli.close()
        return

    res = await db.commissions.delete_many({"order_id": {"$in": orphan_oids}})
    print(f"\nRemovidas: {res.deleted_count}")
    cli.close()


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    asyncio.run(main(dry_run=dry))
