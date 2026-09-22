import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def set_secret():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    secret = "test_opery_key_123"
    for dbname in ["oxxpharma_db", "oxxpharma"]:
        db = client[dbname]
        await db.opery_settings.update_one(
            {"key": "opery_config"},
            {"$set": {"webhook_secret": secret, "key": "opery_config"}},
            upsert=True
        )
        print(f"Set webhook_secret to '{secret}' in DB '{dbname}'")

if __name__ == "__main__":
    asyncio.run(set_secret())
