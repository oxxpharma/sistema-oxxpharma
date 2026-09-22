import asyncio
import json
import urllib.request

async def test_live_server():
    secret = "test_opery_key_123"
    headers = {
        "Content-Type": "application/json",
        "X-Opery-Api-Key": secret
    }
    
    # 1. Post to Sandbox webhook
    sb_payload = {
        "snapshot": {
            "date": "2026-09-22",
            "total_revenue": 999.0,
            "total_orders_value": 999.0,
            "orders_count": 5
        }
    }
    req = urllib.request.Request("http://127.0.0.1:8001/api/opery/sandbox/webhook/revenue",
                                 data=json.dumps(sb_payload).encode(),
                                 headers=headers)
    resp = json.loads(urllib.request.urlopen(req).read().decode())
    print("Sandbox webhook response:", resp)
    assert resp.get("environment") == "sandbox"
    
    # 2. Post to Production webhook
    prod_payload = {
        "snapshot": {
            "date": "2026-09-22",
            "total_revenue": 1500.0,
            "total_orders_value": 1500.0,
            "orders_count": 10
        }
    }
    req2 = urllib.request.Request("http://127.0.0.1:8001/api/opery/webhook/revenue",
                                  data=json.dumps(prod_payload).encode(),
                                  headers=headers)
    resp2 = json.loads(urllib.request.urlopen(req2).read().decode())
    print("Production webhook response:", resp2)
    assert resp2.get("environment") == "production"

    print("Live server sandbox & production webhook tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(test_live_server())
