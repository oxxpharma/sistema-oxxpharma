"""Iter 42j: garantir extracao robusta de endereco do referral_enrollment
(suporta variantes PT/EN flat + schema aninhado + fallback addresses)."""
import sys
sys.path.insert(0, "/app/backend")
from server import _extract_enrollment_address


def test_nested_schema():
    enr = {"address": {"zip_code": "01310100", "street": "Av Paulista",
                       "number": "1000", "complement": "ap 5",
                       "neighborhood": "Bela Vista", "city": "Sao Paulo", "state": "SP"}}
    a = _extract_enrollment_address(enr, {})
    assert a["zip_code"] == "01310100"
    assert a["street"] == "Av Paulista"
    assert a["state"] == "SP"


def test_flat_pt_keys():
    """O cliente reportou esse caso: chaves em PT-BR direto no enrollment."""
    enr = {
        "cpf": "12345678900",
        "full_name": "Joao Silva",
        "cep": "01310-100",
        "rua": "Av Paulista",
        "numero": "1000",
        "complemento": "ap 5",
        "bairro": "Bela Vista",
        "cidade": "Sao Paulo",
        "uf": "SP",
    }
    a = _extract_enrollment_address(enr, {})
    assert a["zip_code"] == "01310-100"
    assert a["street"] == "Av Paulista"
    assert a["number"] == "1000"
    assert a["complement"] == "ap 5"
    assert a["neighborhood"] == "Bela Vista"
    assert a["city"] == "Sao Paulo"
    assert a["state"] == "SP"


def test_flat_pt_keys_alternativas():
    """Aceita 'logradouro', 'estado', 'municipio'."""
    enr = {"cep": "20040000", "logradouro": "Rua Sete", "numero": "55",
           "bairro": "Centro", "municipio": "Rio de Janeiro", "estado": "RJ"}
    a = _extract_enrollment_address(enr, {})
    assert a["street"] == "Rua Sete"
    assert a["city"] == "Rio de Janeiro"
    assert a["state"] == "RJ"


def test_fallback_user_addresses():
    """Quando enrollment nao tem endereco, usa user.addresses[0]."""
    enr = {"cpf": "11111111111"}
    user = {"addresses": [{
        "is_default": True, "zip_code": "30000000", "street": "Rua A",
        "number": "10", "neighborhood": "B", "city": "BH", "state": "MG",
    }]}
    a = _extract_enrollment_address(enr, user)
    assert a["zip_code"] == "30000000"
    assert a["street"] == "Rua A"
    assert a["state"] == "MG"


def test_nested_prevails_over_flat():
    """Se ambos existem, o nested prevalece (schema oficial)."""
    enr = {
        "address": {"zip_code": "00000000", "street": "Rua Oficial"},
        "cep": "11111111", "rua": "Rua Flat",
    }
    a = _extract_enrollment_address(enr, {})
    assert a["zip_code"] == "00000000"
    assert a["street"] == "Rua Oficial"


def test_all_empty_returns_empty_strings():
    a = _extract_enrollment_address({}, {})
    assert all(v == "" for v in a.values())


def test_partial_flat_keys():
    """Cobre o caso de o usuario ter preenchido so alguns campos."""
    enr = {"cep": "12345678", "cidade": "Salvador"}
    a = _extract_enrollment_address(enr, {})
    assert a["zip_code"] == "12345678"
    assert a["city"] == "Salvador"
    assert a["street"] == ""
