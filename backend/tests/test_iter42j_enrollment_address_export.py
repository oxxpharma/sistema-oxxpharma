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


def test_fuzzy_keys_unusual():
    """Iter 42j+: match fuzzy para chaves customizadas pelo admin."""
    cases = [
        ({"meu_cep": "01310100"}, "zip_code", "01310100"),
        ({"endereco_cep": "20040-000"}, "zip_code", "20040-000"),
        ({"cep_postal": "30000000"}, "zip_code", "30000000"),
        ({"endereco_completo": "Rua das Flores"}, "street", "Rua das Flores"),
        ({"endereco_numero": "100"}, "number", "100"),
        ({"endereco_bairro": "Centro"}, "neighborhood", "Centro"),
        ({"endereco_cidade": "Curitiba"}, "city", "Curitiba"),
        ({"endereco_uf": "PR"}, "state", "PR"),
    ]
    for enr, field, expected in cases:
        a = _extract_enrollment_address(enr, {})
        assert a[field] == expected, f"FAIL: {enr} esperava {field}={expected}, recebeu {a}"


def test_fuzzy_does_not_confuse_phone_with_number():
    """Telefone NAO deve virar 'number' do endereco mesmo contendo digitos."""
    enr = {"telefone": "(11) 99999-9999", "celular": "(21) 88888-8888",
           "numero_endereco": "555"}
    a = _extract_enrollment_address(enr, {})
    assert a["number"] == "555"


def test_format_detection_8digit_cep():
    """Quando nao casa por nome, detecta CEP pelo FORMATO (8 digitos puros)."""
    enr = {"campo_estranho_qualquer": "01310100"}  # 8 digitos = formato CEP
    a = _extract_enrollment_address(enr, {})
    assert a["zip_code"] == "01310100"


def test_birth_date_does_not_become_zip():
    """REGRESSAO: birth_date '1993-04-06' tem 8 digitos quando removidos os hifens.
    NAO pode virar CEP por engano."""
    enr = {"cpf": "12345678901", "full_name": "Joao", "birth_date": "1993-04-06",
           "phone": "11999999999", "mother_name": "Maria"}
    a = _extract_enrollment_address(enr, {})
    assert a["zip_code"] == "", f"birth_date virou CEP! got {a['zip_code']!r}"


def test_format_detection_with_hyphen():
    """Detecta CEP no formato XXXXX-XXX (8 digitos com hifen na posicao 5)."""
    enr = {"qualquer_campo_custom": "01310-100"}
    a = _extract_enrollment_address(enr, {})
    assert a["zip_code"] == "01310-100"


def test_state_does_not_match_city_key():
    """A regra de 'state' nao pode capturar a chave 'cidade'."""
    enr = {"cidade": "Sao Paulo"}
    a = _extract_enrollment_address(enr, {})
    assert a["city"] == "Sao Paulo"
    assert a["state"] == ""
