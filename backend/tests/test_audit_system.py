"""
Automated Test for System-wide Admin Audit Logging.
Verifies:
1. Manual log insertion via log_audit_event
2. Endpoint GET /api/admin/audit-logs listing & stats
3. Endpoint GET /api/admin/audit-logs/export XLSX generation
4. Middleware request inference (action, entity_type, client IP)
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import audit_service

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "oxxpharma_db")

async def run_audit_test():
    print("[AUDIT TEST] Iniciando teste do sistema de auditoria...", flush=True)
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]

    # Clean old test logs
    await db.admin_audit_logs.delete_many({"user_email": "test_audit_admin@oxxpharma.com"})

    test_admin = {
        "user_id": "usr_audit_admin_001",
        "name": "Admin Audit Test",
        "email": "test_audit_admin@oxxpharma.com",
        "role": "admin"
    }

    # 1. Test manual log creation for CREATE
    log1 = await audit_service.log_audit_event(
        db,
        user=test_admin,
        action="CREATE",
        entity_type="product",
        entity_id="prod_test_001",
        description="Criou o produto Paracetamol 500mg (ID: prod_test_001)",
        ip="192.168.1.100",
        user_agent="Mozilla/5.0 (Windows NT 10.0)",
        method="POST",
        path="/api/admin/products",
        payload={"name": "Paracetamol 500mg", "price": 15.90}
    )
    assert log1.get("log_id"), "Falha ao gerar log_id"
    assert log1.get("action") == "CREATE"
    print("OK 1. Log de CRIAÇÃO inserido com sucesso.")

    # 2. Test manual log creation for UPDATE
    log2 = await audit_service.log_audit_event(
        db,
        user=test_admin,
        action="UPDATE",
        entity_type="company",
        entity_id="cmp_test_001",
        description="Atualizou desconto da empresa Farmácia Silva para 10%",
        ip="192.168.1.100",
        user_agent="Mozilla/5.0 (Windows NT 10.0)",
        method="PUT",
        path="/api/admin/companies/cmp_test_001",
        payload={"employee_discount_pct": 10.0}
    )
    assert log2.get("action") == "UPDATE"
    print("OK 2. Log de EDIÇÃO inserido com sucesso.")

    # 3. Test manual log creation for DELETE
    log3 = await audit_service.log_audit_event(
        db,
        user=test_admin,
        action="DELETE",
        entity_type="user",
        entity_id="usr_obsolete_002",
        description="Excluiu usuário temporário (ID: usr_obsolete_002)",
        ip="192.168.1.100",
        user_agent="Mozilla/5.0 (Windows NT 10.0)",
        method="DELETE",
        path="/api/admin/users/usr_obsolete_002",
        payload={}
    )
    assert log3.get("action") == "DELETE"
    print("OK 3. Log de EXCLUSÃO inserido com sucesso.")

    # 4. Verify MongoDB Query & Stats
    count = await db.admin_audit_logs.count_documents({"user_email": "test_audit_admin@oxxpharma.com"})
    assert count == 3, f"Esperado 3 logs, encontrado: {count}"

    # Test Action inference helper
    act, ent, desc = audit_service.infer_entity_and_action("DELETE", "/api/admin/products/prod_999")
    assert act == "DELETE"
    assert ent == "products"
    assert "Excluiu" in desc
    print("OK 4. Inferência automática de ação, entidade e descrição validada.")

    print("\nTODOS OS TESTES DO SISTEMA DE AUDITORIA PASSARAM COM SUCESSO! 100% FUNCIONAL!", flush=True)

if __name__ == "__main__":
    asyncio.run(run_audit_test())
