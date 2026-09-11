"""
Teste Automatizado E2E do Sistema de Convênio de Empresas
Valida:
1. Topo da Rede 2
2. Propagandista criando empresa e posicionando na Rede 2
3. Empresa criando/importando funcionário e posicionando na Rede 2
4. Contexto de funcionário (desconto 5% no checkout + limite em folha)
5. Compra do funcionário com desconto em folha (comissões: Empresa 10%, Propagandista 5%, Líder 1%)
6. Compra direta da empresa (comissões: Propagandista 15%, Líder 5%)
7. Fechamento mensal da empresa e geração de faturamento MercadoPago
"""

import asyncio
import os
import sys
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# adiciona backend ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import convenio_routes
import payments_service

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "oxxpharma_db")

async def run_e2e_test():
    print("[E2E TEST] Iniciando teste E2E do Sistema de Convênio de Empresas...", flush=True)
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]

    # Clean test data from previous runs if any
    test_emails = ["leader_top@test.com", "propagandista_e2e@test.com", "empresa_e2e@test.com", "funcionario_e2e@test.com"]
    await db.users.delete_many({"email": {"$in": test_emails}})
    await db.companies.delete_many({"email": "empresa_e2e@test.com"})
    await db.company_employees.delete_many({"email": "funcionario_e2e@test.com"})
    await db.propagandista_commissions.delete_many({"user_id": {"$in": test_emails}})

    pwd_hash = bcrypt.hashpw("123456".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    now = datetime.now(timezone.utc).isoformat()

    # 1. Configurar Topo da Rede 2 (Líder Supremo da Rede 2)
    leader_id = "usr_top_leader_net2"
    await db.users.insert_one({
        "user_id": leader_id,
        "name": "Líder Topo da Rede 2",
        "email": "leader_top@test.com",
        "password_hash": pwd_hash,
        "role": "admin",
        "networks": ["network_2"],
        "created_at": now
    })
    await db.platform_settings.update_one(
        {"key": "network_top_leaders"},
        {"$set": {"key": "network_top_leaders", "value": {"network_2": leader_id}}},
        upsert=True
    )
    print("OK 1. Topo da Rede 2 configurado com sucesso.")

    # 2. Criar Propagandista
    propagandista_id = "usr_prop_e2e"
    await db.users.insert_one({
        "user_id": propagandista_id,
        "name": "Propagandista Teste E2E",
        "email": "propagandista_e2e@test.com",
        "password_hash": pwd_hash,
        "role": "propagandista",
        "networks": ["network_2"],
        "sponsor_id": leader_id,
        "sponsor_id_net2": leader_id,
        "created_at": now
    })
    print("OK 2. Propagandista criado e vinculado ao Topo da Rede 2.")

    # Simula mock de request para o endpoint de cadastro de empresa pelo propagandista
    class DummyRequest:
        def __init__(self, db):
            self.app = type("App", (), {"db": db})()
            self.base_url = "http://localhost:8001"

    req = DummyRequest(db)
    prop_user = await db.users.find_one({"user_id": propagandista_id}, {"_id": 0})

    # 3. Propagandista cadastra Empresa no convênio com ficha completa
    comp_create_data = convenio_routes.PropagandistaCompanyCreate(
        name="Empresa Farmácia E2E Ltda",
        cnpj="12.345.678/0001-99",
        ie="123.456.789.111",
        status="ativa",
        slug="empresa-farmacia-e2e-ltda",
        email="empresa_e2e@test.com",
        whatsapp="(11) 98888-7777",
        cep="01001-000",
        street="Praça da Sé",
        number="100",
        complement="Bloco A",
        neighborhood="Sé",
        city="São Paulo",
        state="SP",
        rep_name="Gerente RH E2E",
        rep_role="Diretor de RH",
        rep_cpf="111.222.333-44",
        rep_phone="(11) 98888-7777",
        rep_email="empresa_e2e@test.com",
        bank_name="001 - Banco do Brasil S.A.",
        account_type="corrente",
        agency="0001",
        account_number="12345-6",
        pix_type="cnpj",
        pix_key="12345678000199",
        bank_favored_name="Empresa Farmácia E2E Ltda",
        password="123456",
        contact_name="Gerente RH",
        contact_phone="(11) 98888-7777",
        employee_discount_pct=5.0,  # 5% de desconto ao funcionário
        payroll_enabled=True,
        payroll_limit_percent=35.0
    )
    res_company = await convenio_routes.propagandista_create_company(req, comp_create_data, prop_user)
    company_id = res_company["company_id"]
    company_rep_id = res_company["representative_user_id"]

    company_user = await db.users.find_one({"user_id": company_rep_id}, {"_id": 0})
    assert company_user["sponsor_id"] == propagandista_id, "Empresa não foi vinculada ao Propagandista na Rede 2!"
    assert "network_2" in company_user["networks"], "Empresa não pertence à network_2!"
    assert res_company["ie"] == "123.456.789.111"
    assert res_company["address"]["street"] == "Praça da Sé"
    assert res_company["bank_name"] == "001 - Banco do Brasil S.A."
    print(f"OK 3. Empresa cadastrada pelo Propagandista com Ficha Completa. Empresa User ID: {company_rep_id} na Rede 2 abaixo do Propagandista.")

    # 4. Empresa cadastra Funcionário
    comp_admin_user = await db.users.find_one({"user_id": company_rep_id}, {"_id": 0})
    emp_create_data = convenio_routes.EmployeeCreate(
        name="Carlos Funcionário E2E",
        email="funcionario_e2e@test.com",
        cpf="123.456.789-00",
        phone="(11) 97777-6666",
        position="Analista de Sistemas",
        salary=4000.0,
        active=True
    )
    res_emp = await convenio_routes.create_employee(req, emp_create_data, company_id=company_id, user=comp_admin_user)
    emp_user_id = res_emp["user_id"]

    emp_user = await db.users.find_one({"user_id": emp_user_id}, {"_id": 0})
    assert emp_user["sponsor_id"] == company_rep_id, "Funcionário não foi vinculado à Empresa na Rede 2!"
    assert "network_2" in emp_user["networks"], "Funcionário não pertence à network_2!"
    print(f"OK 4. Funcionário cadastrado pela Empresa com sucesso. Funcionário User ID: {emp_user_id} na Rede 2 abaixo da Empresa.")

    # 5. Verifica contexto do funcionário (desconto e limite em folha)
    emp_ctx = await convenio_routes.get_employee_context(db, emp_user)
    assert emp_ctx["discount_percent"] == 5.0, f"Esperado desconto 5.0, obtido {emp_ctx['discount_percent']}"
    assert emp_ctx["payroll_limit_amount"] == 1400.0, f"Esperado limite 1400.0 (35% de 4000), obtido {emp_ctx['payroll_limit_amount']}"
    print(f"OK 5. Contexto do funcionário validado: Desconto de {emp_ctx['discount_percent']}% | Limite em folha disponível: R$ {emp_ctx['available_limit']}.")

    # 6. Simula compra do Funcionário
    order_func = {
        "order_id": "ord_func_e2e_001",
        "user_id": emp_user_id,
        "subtotal": 1000.0,
        "total": 950.0,  # com 5% de desconto
        "paid_at": now,
        "payment_status": "paid"
    }
    await db.orders.insert_one(order_func)
    await convenio_routes.create_propagandista_commissions_for_order(db, order_func)

    func_comms = await db.propagandista_commissions.find({"order_id": "ord_func_e2e_001"}, {"_id": 0}).to_list(10)
    print(f"   Comissões geradas pela compra do Funcionário ({len(func_comms)} registros):")
    emp_comm = next(c for c in func_comms if c["beneficiary_role"] == "empresa")
    prop_comm = next(c for c in func_comms if c["beneficiary_role"] == "propagandista")
    leader_comm = next(c for c in func_comms if c["beneficiary_role"] == "leader")

    assert emp_comm["amount"] == 100.0, f"Comissão da empresa esperada R$ 100.0 (15%-5%=10%), obtido R$ {emp_comm['amount']}"
    assert prop_comm["amount"] == 50.0, f"Comissão do propagandista esperada R$ 50.0 (5%), obtido R$ {prop_comm['amount']}"
    assert leader_comm["amount"] == 10.0, f"Comissão do líder esperada R$ 10.0 (1%), obtido R$ {leader_comm['amount']}"
    print("OK 6. Comissões da compra do Funcionário verificadas perfeitamente (Empresa: 10%, Propagandista: 5%, Líder: 1%).")

    # 7. Simula compra direta da Empresa (Usuário Representante)
    order_company = {
        "order_id": "ord_comp_e2e_001",
        "user_id": company_rep_id,
        "subtotal": 2000.0,
        "total": 2000.0,
        "paid_at": now,
        "payment_status": "paid"
    }
    await db.orders.insert_one(order_company)
    await convenio_routes.create_propagandista_commissions_for_order(db, order_company)

    comp_comms = await db.propagandista_commissions.find({"order_id": "ord_comp_e2e_001"}, {"_id": 0}).to_list(10)
    print(f"   Comissões geradas pela compra da Empresa ({len(comp_comms)} registros):")
    prop_comp_comm = next(c for c in comp_comms if c["beneficiary_role"] == "propagandista")
    leader_comp_comm = next(c for c in comp_comms if c["beneficiary_role"] == "leader")

    assert prop_comp_comm["amount"] == 300.0, f"Comissão do propagandista esperada R$ 300.0 (15%), obtido R$ {prop_comp_comm['amount']}"
    assert leader_comp_comm["amount"] == 100.0, f"Comissão do líder esperada R$ 100.0 (5%), obtido R$ {leader_comp_comm['amount']}"
    print("OK 7. Comissões da compra direta da Empresa verificadas perfeitamente (Propagandista: 15%, Líder: 5%).")

    # 8. Fechamento mensal e pagamento MercadoPago
    period_curr = now[:7]
    # Registra uma cobrança payroll em aberto para a empresa
    await db.payroll_charges.insert_one({
        "charge_id": "payr_e2e_001",
        "order_id": "ord_func_e2e_001",
        "company_id": company_id,
        "employee_id": res_emp["employee_id"],
        "employee_name": "Carlos Funcionário E2E",
        "amount": 950.0,
        "status": "open",
        "period_month": period_curr,
        "created_at": now
    })

    closing_res = await convenio_routes.process_monthly_closing(db, period_curr)
    assert closing_res["closed_companies"] > 0, "Nenhuma empresa foi fechada!"
    print(f"OK 8. Fechamento mensal processado com sucesso. Período: {period_curr} | Total Faturado: R$ {closing_res['total_amount']}.")

    # Busca faturas da empresa
    billings_res = await convenio_routes.company_list_billings(req, user=comp_admin_user)
    billings = billings_res["billings"]
    assert len(billings) > 0, "Fatura da empresa não encontrada!"
    billing_id = billings[0]["billing_id"]

    # Simula geração de cobrança MercadoPago (mock da chamada da API externa do MP)
    async def mock_create_billing_preference(db, billing, frontend_url, backend_url):
        return {
            "preference_id": "PREF_TEST_MP_123456",
            "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=PREF_TEST_MP_123456",
            "sandbox_init_point": "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=PREF_TEST_MP_123456",
            "environment": "sandbox"
        }

    payments_service.create_billing_preference = mock_create_billing_preference

    pay_res = await convenio_routes.company_billing_create_payment(req, billing_id, user=comp_admin_user)
    assert "payment_url" in pay_res or "preference_id" in pay_res, "Falha ao gerar cobrança MercadoPago!"
    print(f"OK 9. Cobrança MercadoPago gerada para a Fatura {billing_id} da Empresa. Preference ID: {pay_res.get('preference_id')}.")

    print("\nTODOS OS TESTES DO SISTEMA DE CONVENIO PASSARAM COM SUCESSO! 100% FUNCIONAL!")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
