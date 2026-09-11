"""
Script de Seed para o Sistema de Convênio da OxxPharma.
Cria usuários de demonstração prontos para teste local:
1. Líder Supremo da Rede 2: lider.rede2@oxxpharma.com / 123456
2. Propagandista: propagandista@oxxpharma.com / 123456
3. Empresa Conveniada: rh.farmacia@oxxpharma.com / 123456
4. Funcionário: carlos.funcionario@oxxpharma.com / 123456
"""

import asyncio
import os
import sys
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "oxxpharma_db")

async def seed_demo():
    print("[SEED] Criando usuários e dados de teste para o Sistema de Convênio...")
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]

    pwd_hash = bcrypt.hashpw("123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    now = datetime.now(timezone.utc).isoformat()

    # 1. Topo da Rede 2
    leader_id = "usr_lider_net2_demo"
    await db.users.update_one(
        {"email": "lider.rede2@oxxpharma.com"},
        {"$set": {
            "user_id": leader_id,
            "name": "Líder Supremo da Rede 2",
            "email": "lider.rede2@oxxpharma.com",
            "password_hash": pwd_hash,
            "role": "admin",
            "networks": ["network_2"],
            "network_type": "network_2",
            "updated_at": now
        }},
        upsert=True
    )
    await db.platform_settings.update_one(
        {"key": "network_top_leaders"},
        {"$set": {"key": "network_top_leaders", "value": {"network_2": leader_id}}},
        upsert=True
    )

    # 2. Propagandista
    propagandista_id = "usr_propagandista_demo"
    await db.users.update_one(
        {"email": "propagandista@oxxpharma.com"},
        {"$set": {
            "user_id": propagandista_id,
            "name": "Propagandista Comercial Demo",
            "email": "propagandista@oxxpharma.com",
            "password_hash": pwd_hash,
            "role": "propagandista",
            "networks": ["network_2"],
            "network_type": "network_2",
            "sponsor_id": leader_id,
            "sponsor_id_net2": leader_id,
            "updated_at": now
        }},
        upsert=True
    )

    # 3. Empresa
    company_id = "cmp_farmacia_demo"
    company_rep_id = "usr_empresa_demo"
    await db.users.update_one(
        {"email": "rh.farmacia@oxxpharma.com"},
        {"$set": {
            "user_id": company_rep_id,
            "name": "Gerente RH - Farmácia Modelo",
            "email": "rh.farmacia@oxxpharma.com",
            "password_hash": pwd_hash,
            "role": "company_admin",
            "company_admin_of": company_id,
            "networks": ["network_2"],
            "network_type": "network_2",
            "sponsor_id": propagandista_id,
            "sponsor_id_net2": propagandista_id,
            "updated_at": now
        }},
        upsert=True
    )

    await db.companies.update_one(
        {"company_id": company_id},
        {"$set": {
            "company_id": company_id,
            "name": "Farmácia Modelo Ltda",
            "cnpj": "12.345.678/0001-99",
            "email": "rh.farmacia@oxxpharma.com",
            "contact_name": "Gerente RH",
            "contact_phone": "(11) 98888-7777",
            "discount_percent": 0.0,
            "employee_discount_pct": 5.0,  # 5% desconto aos funcionários
            "payroll_enabled": True,
            "payroll_limit_percent": 35.0,
            "propagandista_id": propagandista_id,
            "representative_user_id": company_rep_id,
            "active": True,
            "updated_at": now
        }},
        upsert=True
    )

    # 4. Funcionário
    employee_id = "emp_carlos_demo"
    employee_user_id = "usr_carlos_demo"
    await db.users.update_one(
        {"email": "carlos.funcionario@oxxpharma.com"},
        {"$set": {
            "user_id": employee_user_id,
            "name": "Carlos Funcionário Demo",
            "email": "carlos.funcionario@oxxpharma.com",
            "password_hash": pwd_hash,
            "role": "customer",
            "networks": ["network_2"],
            "network_type": "network_2",
            "sponsor_id": company_rep_id,
            "sponsor_id_net2": company_rep_id,
            "updated_at": now
        }},
        upsert=True
    )

    await db.company_employees.update_one(
        {"employee_id": employee_id},
        {"$set": {
            "employee_id": employee_id,
            "company_id": company_id,
            "user_id": employee_user_id,
            "name": "Carlos Funcionário Demo",
            "email": "carlos.funcionario@oxxpharma.com",
            "cpf": "123.456.789-00",
            "cpf_digits": "12345678900",
            "phone": "(11) 97777-6666",
            "position": "Analista de TI",
            "salary": 4000.0,
            "active": True,
            "updated_at": now
        }},
        upsert=True
    )

    print("\n[SEED CONCLUÍDO] Usuários de demonstração prontos para uso:")
    print("----------------------------------------------------------------")
    print("1. Líder Topo da Rede 2:  lider.rede2@oxxpharma.com    / 123456")
    print("2. Propagandista:         propagandista@oxxpharma.com  / 123456")
    print("3. Empresa Representante: rh.farmacia@oxxpharma.com    / 123456")
    print("4. Funcionário Empresa:   carlos.funcionario@oxxpharma.com / 123456")
    print("----------------------------------------------------------------")

if __name__ == "__main__":
    asyncio.run(seed_demo())
