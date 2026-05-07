"""Script idempotente para limpar comissoes duplicadas.

Regra de prioridade (mantem 1, deleta o resto, dentro de cada grupo
(order_id, user_id, type, generation)):
  1) Se houver paid_out -> mantem paid_out
  2) Senao se houver paid -> mantem paid
  3) Senao se houver pending -> mantem pending
  4) Senao mantem pending_enrollment
  5) Em caso de empate, mantem o mais antigo (created_at).

Tambem cria um INDICE UNICO em (order_id, user_id, type, generation)
para impedir duplicacoes futuras a nivel de banco.
"""
import asyncio
import os
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

STATUS_PRIORITY = {
    "paid_out": 0,
    "paid": 1,
    "pending": 2,
    "pending_enrollment": 3,
}


def _sort_key(doc):
    return (
        STATUS_PRIORITY.get(doc.get("status"), 99),
        doc.get("created_at") or "",
    )


async def main(dry_run: bool = False):
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ["DB_NAME"]]

    pipe = [
        {"$group": {
            "_id": {
                "order_id": "$order_id",
                "user_id": "$user_id",
                "type": "$type",
                "generation": "$generation",
            },
            "count": {"$sum": 1},
            "ids": {"$push": "$commission_id"},
        }},
        {"$match": {"count": {"$gt": 1}}},
    ]
    groups = await db.commissions.aggregate(pipe).to_list(10000)
    print(f"Grupos duplicados encontrados: {len(groups)}")

    total_deleted = 0
    for g in groups:
        ids = g["ids"]
        docs = await db.commissions.find(
            {"commission_id": {"$in": ids}}, {"_id": 0}
        ).to_list(len(ids))
        docs.sort(key=_sort_key)
        keeper = docs[0]
        to_delete = [d["commission_id"] for d in docs[1:]]
        print(
            f"  {g['_id']} -> mantem {keeper['commission_id']} "
            f"(status={keeper.get('status')}); deleta {to_delete}"
        )
        if not dry_run and to_delete:
            res = await db.commissions.delete_many(
                {"commission_id": {"$in": to_delete}}
            )
            total_deleted += res.deleted_count

    print(f"\nTotal documentos removidos: {total_deleted}")

    # Cria indice unico para impedir novas duplicacoes
    if not dry_run:
        try:
            await db.commissions.create_index(
                [("order_id", 1), ("user_id", 1), ("type", 1), ("generation", 1)],
                unique=True,
                name="uq_commission_per_beneficiary",
            )
            print("Indice unico criado/garantido: uq_commission_per_beneficiary")
        except Exception as e:
            print(f"AVISO: nao consegui criar indice unico: {e}")

    cli.close()


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    asyncio.run(main(dry_run=dry))
