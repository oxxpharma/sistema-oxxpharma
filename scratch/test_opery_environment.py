import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import backend.opery_service as opery_service

async def test_env_separation():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["oxxpharma_test_env_db"]
    
    # Cleanup test db collection
    await db.opery_revenue_snapshots.delete_many({})
    
    # Ensure indexes
    await opery_service.ensure_indexes(db)
    
    # Upsert sandbox snapshot
    r1 = await opery_service.upsert_revenue_snapshot(db, {
        "date": "2026-09-20",
        "total_revenue": 500.0,
        "total_orders_value": 500.0,
        "orders_count": 10
    }, environment="sandbox")
    assert r1["created"] is True
    assert r1["environment"] == "sandbox"
    
    # Upsert production snapshot for same date
    r2 = await opery_service.upsert_revenue_snapshot(db, {
        "date": "2026-09-20",
        "total_revenue": 1200.0,
        "total_orders_value": 1500.0,
        "orders_count": 15
    }, environment="production")
    assert r2["created"] is True
    assert r2["environment"] == "production"

    # Upsert legacy snapshot (untagged environment)
    await db.opery_revenue_snapshots.insert_one({
        "date": "2026-09-19",
        "total_revenue": 800.0,
        "total_orders_value": 800.0,
        "orders_count": 8,
        "tenant": "oxxpharma"
    })
    
    # Check aggregate_stats
    stats = await opery_service.aggregate_stats(db)
    print("Aggregate Stats Output:", stats)
    
    # Production total_revenue should be 1200 + 800 = 2000.0 (Sandbox 500.0 must be excluded)
    assert stats["total_revenue"] == 2000.0, f"Expected 2000.0, got {stats['total_revenue']}"
    assert stats["orders_count"] == 23, f"Expected 23, got {stats['orders_count']}"
    
    # Clean up test DB
    await client.drop_database("oxxpharma_test_env_db")
    print("Test passed successfully!")

if __name__ == "__main__":
    asyncio.run(test_env_separation())
