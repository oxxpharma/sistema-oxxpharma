"""
Backfill: popula order.sponsor_id em pedidos antigos.

Estrategia (prioridade decrescente):
  1) Se order.affiliate_id existe -> sponsor_id = affiliate_id
  2) Se o user atual (orders.user_id) tem sponsor_id -> sponsor_id = user.sponsor_id
  3) Se o user atual tem network_sponsor_id -> sponsor_id = network_sponsor_id

Modo: padrao DRY-RUN (so mostra o impacto).
Para aplicar: rode com `--apply`.

Uso:
  python -m tests.backfill_order_sponsor_id          # dry-run
  python -m tests.backfill_order_sponsor_id --apply  # aplica
"""
import asyncio
import os
import sys
import pathlib

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Carrega .env do mesmo diretorio do backend (../ a partir de tests/)
_ENV_PATH = pathlib.Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)


async def main(apply: bool):
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Pedidos sem sponsor_id definido (ou None)
    q = {"$or": [{"sponsor_id": None}, {"sponsor_id": {"$exists": False}}]}
    total = await db.orders.count_documents(q)
    print(f"Pedidos sem sponsor_id: {total}")

    stats = {"from_affiliate": 0, "from_user_sponsor": 0, "from_user_network": 0, "no_data": 0}
    updated_user_sponsor = 0

    async for order in db.orders.find(q, {"_id": 0, "order_id": 1, "user_id": 1, "affiliate_id": 1}):
        sponsor_id = None
        source = None

        # 1) affiliate_id no proprio order
        if order.get("affiliate_id"):
            sponsor_id = order["affiliate_id"]
            source = "from_affiliate"
        else:
            # 2) user.sponsor_id atual
            u = await db.users.find_one(
                {"user_id": order.get("user_id")},
                {"_id": 0, "sponsor_id": 1, "network_sponsor_id": 1},
            )
            if u:
                if u.get("sponsor_id"):
                    sponsor_id = u["sponsor_id"]
                    source = "from_user_sponsor"
                elif u.get("network_sponsor_id"):
                    sponsor_id = u["network_sponsor_id"]
                    source = "from_user_network"

        if sponsor_id and source:
            stats[source] += 1
            if apply:
                await db.orders.update_one(
                    {"order_id": order["order_id"]},
                    {"$set": {"sponsor_id": sponsor_id, "sponsor_id_backfilled": True}},
                )
        else:
            stats["no_data"] += 1

    # Bonus: tambem reforça user.sponsor_id quando perdido mas
    # algum pedido do user tem affiliate_id. Isso garante futuros pedidos
    # via voucher/admin tambem mantenham vinculacao.
    pipeline = [
        {"$match": {"affiliate_id": {"$ne": None}}},
        {"$group": {"_id": "$user_id", "aff": {"$first": "$affiliate_id"}}},
    ]
    async for row in db.orders.aggregate(pipeline):
        uid = row["_id"]
        aff = row["aff"]
        if not uid or not aff:
            continue
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "sponsor_id": 1})
        if u and not u.get("sponsor_id"):
            updated_user_sponsor += 1
            if apply:
                await db.users.update_one(
                    {"user_id": uid},
                    {"$set": {"sponsor_id": aff, "sponsor_id_backfilled": True}},
                )

    print("\n=== Resultado ===")
    print(f"  via order.affiliate_id .... : {stats['from_affiliate']}")
    print(f"  via user.sponsor_id ....... : {stats['from_user_sponsor']}")
    print(f"  via user.network_sponsor_id : {stats['from_user_network']}")
    print(f"  sem dado disponivel ....... : {stats['no_data']}")
    print(f"  users com sponsor_id retroativo: {updated_user_sponsor}")
    print(f"\nModo: {'APPLY (mudancas gravadas)' if apply else 'DRY-RUN (nada gravado)'}")


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    asyncio.run(main(apply))
