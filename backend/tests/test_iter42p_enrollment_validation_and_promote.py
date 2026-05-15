"""Iter 42p: validacao CPF + auto-promote dados PF do enrollment para o cadastro."""
import os
import uuid
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def _register(email, password="Senha123!"):
    r = requests.post(f"{API_URL}/api/auth/register",
                      json={"email": email, "password": password, "name": "PJ TESTE LTDA",
                            "phone": "", "cpf": ""}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_invalid_cpf_rejected():
    """CPF invalido (000.000.000-00) deve ser rejeitado pelo backend."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    suf = uuid.uuid4().hex[:6]
    email = f"inv_{suf}@example.com"
    token = _register(email)
    # garante que enrollment_fields tem CPF como required+mask=cpf
    r = requests.post(f"{API_URL}/api/users/me/referral-enrollment",
                      json={"cpf": "000.000.000-00", "full_name": "Fulano", "birth_date": "01/01/2000",
                            "mother_name": "Maria", "phone": "(11) 99999-9999"},
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 400, r.text
    assert "cpf" in r.json().get("detail", "").lower() or "inv" in r.json().get("detail", "").lower()
    db.users.delete_one({"email": email})


def test_invalid_birth_date_rejected():
    """Data invalida (32/13/2099) deve ser rejeitada."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    suf = uuid.uuid4().hex[:6]
    email = f"dt_{suf}@example.com"
    token = _register(email)
    r = requests.post(f"{API_URL}/api/users/me/referral-enrollment",
                      json={"cpf": "529.982.247-25", "full_name": "Fulano", "birth_date": "32/13/2099",
                            "mother_name": "Maria", "phone": "(11) 99999-9999"},
                      headers={"Authorization": f"Bearer {token}"}, timeout=20)
    assert r.status_code == 400, r.text
    assert "data" in r.json().get("detail", "").lower()
    db.users.delete_one({"email": email})


def test_enrollment_auto_promotes_pf_to_user_profile():
    """User PJ se inscreve com dados PF -> dados sao promovidos para o cadastro principal."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    suf = uuid.uuid4().hex[:6]
    email = f"pj_{suf}@example.com"
    token = _register(email)
    # User comeca como PJ (nome empresa)
    db.users.update_one({"email": email}, {"$set": {"name": "EMPRESA PJ LTDA", "network_type": "network_1"}})

    # Backup config atual e amplia enrollment_fields para incluir endereco
    cfg_before = db.settings.find_one({"_id": "card_config"})
    db.settings.update_one(
        {"_id": "card_config"},
        {"$set": {"enrollment_fields": [
            {"key": "cpf", "label": "CPF", "type": "text", "required": True, "mask": "cpf"},
            {"key": "full_name", "label": "Nome completo", "type": "text", "required": True},
            {"key": "birth_date", "label": "Data de nascimento", "type": "date", "required": True},
            {"key": "mother_name", "label": "Nome da mae", "type": "text", "required": True},
            {"key": "phone", "label": "Telefone", "type": "text", "required": True, "mask": "phone"},
            {"key": "cep", "label": "CEP", "type": "text", "required": True, "mask": "cep"},
            {"key": "rua", "label": "Rua", "type": "text", "required": True},
            {"key": "numero", "label": "Numero", "type": "text", "required": True},
            {"key": "bairro", "label": "Bairro", "type": "text", "required": True},
            {"key": "cidade", "label": "Cidade", "type": "text", "required": True},
            {"key": "uf", "label": "UF", "type": "text", "required": True},
        ]}},
        upsert=True,
    )

    try:
        cpf = "529.982.247-25"  # CPF valido para teste
        r = requests.post(f"{API_URL}/api/users/me/referral-enrollment",
                          json={
                              "cpf": cpf,
                              "full_name": "Fulano de Tal PF",
                              "birth_date": "15/03/1985",
                              "mother_name": "Maria de Tal",
                              "phone": "(11) 98765-4321",
                              "cep": "01000-000",
                              "rua": "Rua das Flores",
                              "numero": "123",
                              "bairro": "Centro",
                              "cidade": "Sao Paulo",
                              "uf": "SP",
                          },
                          headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending_approval"
        promoted = d.get("promoted_to_profile") or []
        print(f"DEBUG promoted: {promoted}")
        assert "name" in promoted
        assert "cpf_digits" in promoted or "cpf" in promoted
        assert "birth_date" in promoted
        assert "mother_name" in promoted

        u = db.users.find_one({"email": email})
        assert u["name"] == "Fulano de Tal PF"
        assert u.get("name_legacy") == "EMPRESA PJ LTDA"
        assert u.get("cpf_digits") == "52998224725"
        assert u.get("birth_date") == "15/03/1985"
        assert u.get("mother_name") == "Maria de Tal"
        assert u.get("phone") == "(11) 98765-4321"
        # Endereco criado
        addrs = u.get("addresses") or []
        assert len(addrs) == 1
        assert addrs[0]["city"] == "Sao Paulo"
        assert addrs[0]["zip_code"] == "01000-000"
    finally:
        # Restaura config original
        if cfg_before:
            db.settings.replace_one({"_id": "card_config"}, cfg_before)
        db.users.delete_one({"email": email})
