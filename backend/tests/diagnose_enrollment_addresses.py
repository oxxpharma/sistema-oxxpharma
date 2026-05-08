"""Diagnostico: imprime as chaves usadas no referral_enrollment do produção
e mostra o que o helper extrai delas. Util para debug do export.

Uso: python3 tests/diagnose_enrollment_addresses.py
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Carrega .env
for p in [Path(__file__).resolve().parent.parent / ".env",
          Path("/app/backend/.env"),
          Path("/var/www/oxxpharma/backend/.env")]:
    if p.exists():
        load_dotenv(p)
        print(f"[env] carregado de {p}")
        break

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server import _extract_enrollment_address


async def main():
    cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = cli[os.environ.get("DB_NAME", "oxxpharma")]
    print("=" * 70)
    print("DIAGNOSTICO DE CHAVES DE ENDERECO NO referral_enrollment")
    print("=" * 70)

    # 1) Configuracao admin: quais campos estao definidos?
    cfg = await db.settings.find_one({"_id": "card_config"})
    if cfg:
        print("\n[1] CAMPOS configurados no formulario (enrollment_fields):")
        for f in (cfg.get("enrollment_fields") or []):
            print(f"    key={f.get('key'):25s} label={f.get('label')!r}  required={f.get('required')}")

    # 2) Pega ate 5 aprovados e mostra as chaves reais que vieram
    print("\n[2] Amostras reais de referral_enrollment (5 aprovados):")
    cursor = db.users.find(
        {"referral_program_active": True, "referral_enrollment": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 1, "name": 1, "referral_enrollment": 1, "addresses": 1}
    ).limit(5)
    samples = await cursor.to_list(5)
    for u in samples:
        enr = u.get("referral_enrollment") or {}
        print(f"\n  --- {u.get('name')} ({u.get('user_id')}) ---")
        print(f"  Chaves no referral_enrollment: {sorted(enr.keys())}")
        for k, v in enr.items():
            if isinstance(v, dict):
                print(f"    {k}: {v}")
            else:
                print(f"    {k}: {v!r}")
        addr = _extract_enrollment_address(enr, u)
        print(f"  ==> EXTRACTED: {addr}")

    cli.close()


if __name__ == "__main__":
    asyncio.run(main())
