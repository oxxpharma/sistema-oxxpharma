import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.oxxpharma_db
    charges = await db.payroll_charges.find({}, {'_id': 0}).to_list(100)
    print("CHARGES FOUND IN oxxpharma_db:", len(charges))
    for c in charges:
        print("Charge:", c)

if __name__ == "__main__":
    asyncio.run(main())
