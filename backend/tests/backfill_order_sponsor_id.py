"""
Backfill: popula order.sponsor_id em pedidos antigos via LINK DE INDICACAO.

IMPORTANTE: sponsor_id != network_sponsor_id.
  - sponsor_id        = afiliacao via link `?ref=CODE` (cashback de indicacao)
  - network_sponsor_id = hierarquia MMN do Maxx (lider importado por CSV/API)

Este script SO recupera afiliacoes via link de indicacao. Pedidos de membros
da Rede 1/Rede 2 que nunca clicaram em link de indicacao continuam SEM
sponsor_id (correto — eles nao foram indicados, foram importados).

Estrategia (prioridade decrescente):
  1) Se order.affiliate_id existe (pedido VEIO via ref_code) -> sponsor_id = affiliate_id
  2) Se user.sponsor_id atual existe (user cadastrou via ?ref=) -> sponsor_id = user.sponsor_id

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

    stats = {"from_affiliate": 0, "from_user_sponsor": 0, "no_data": 0}
    updated_user_sponsor = 0

    async for order in db.orders.find(q, {"_id": 0, "order_id": 1, "user_id": 1, "affiliate_id": 1}):
        sponsor_id = None
        source = None

        # 1) affiliate_id no proprio order (pedido VEIO via ref_code)
        if order.get("affiliate_id"):
            sponsor_id = order["affiliate_id"]
            source = "from_affiliate"
        else:
            # 2) user.sponsor_id (user se cadastrou via ?ref=)
            # NAO usa network_sponsor_id! Isso e' hierarquia Maxx, nao link de indicacao.
            u = await db.users.find_one(
                {"user_id": order.get("user_id")},
                {"_id": 0, "sponsor_id": 1},
            )
            if u and u.get("sponsor_id"):
                sponsor_id = u["sponsor_id"]
                source = "from_user_sponsor"

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
    print(f"  sem dado (correto p/ Rede)  : {stats['no_data']}")
    print(f"  users com sponsor_id retroativo: {updated_user_sponsor}")
    print(f"\nModo: {'APPLY (mudancas gravadas)' if apply else 'DRY-RUN (nada gravado)'}")


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    asyncio.run(main(apply))
