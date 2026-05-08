"""Iter 42g: Frete gratis com multiplas regras OR."""
import os
import sys
sys.path.insert(0, "/app/backend")

# Carrega o helper diretamente sem subir o app inteiro
from server import _evaluate_free_shipping, _user_matches_rule


def test_rule_min_subtotal_only():
    settings = {"free_shipping_enabled": True, "free_shipping_rules": [
        {"name": "acima de R$ 199", "min_subtotal": 199},
    ]}
    apply, _ = _evaluate_free_shipping(settings, None, 250.0)
    assert apply is True
    apply, info = _evaluate_free_shipping(settings, None, 100.0)
    assert apply is False
    assert info["free_shipping_threshold"] == 199.0
    assert info["free_shipping_remaining"] == 99.0


def test_rule_account_type_only():
    settings = {"free_shipping_enabled": True, "free_shipping_rules": [
        {"name": "Equipe 1", "account_types": ["network_1"]},
    ]}
    user = {"network_type": "network_1"}
    other = {"network_type": "customer"}
    assert _evaluate_free_shipping(settings, user, 50.0)[0] is True
    assert _evaluate_free_shipping(settings, other, 5000.0)[0] is False


def test_rule_or_combination():
    """Equipe 1 OU compra > 500 -> frete gratis."""
    settings = {"free_shipping_enabled": True, "free_shipping_rules": [
        {"name": "Equipe 1", "account_types": ["network_1"]},
        {"name": "Acima 500", "min_subtotal": 500},
    ]}
    eq1 = {"network_type": "network_1"}
    customer = {"network_type": "customer"}
    # Equipe 1 com R$ 50 -> regra 1 casa
    assert _evaluate_free_shipping(settings, eq1, 50.0)[0] is True
    # Customer com R$ 600 -> regra 2 casa
    assert _evaluate_free_shipping(settings, customer, 600.0)[0] is True
    # Customer com R$ 200 -> nada casa
    apply, info = _evaluate_free_shipping(settings, customer, 200.0)
    assert apply is False
    assert info.get("free_shipping_threshold") == 500.0


def test_rule_and_inside():
    """Dentro de uma regra: account_type AND min_subtotal."""
    settings = {"free_shipping_enabled": True, "free_shipping_rules": [
        {"name": "Equipe 1 acima de 100", "account_types": ["network_1"], "min_subtotal": 100},
    ]}
    eq1_low = {"network_type": "network_1"}
    # Equipe 1 mas R$ 50 (< 100) -> NAO casa
    assert _evaluate_free_shipping(settings, eq1_low, 50.0)[0] is False
    # Equipe 1 com R$ 150 -> casa
    assert _evaluate_free_shipping(settings, eq1_low, 150.0)[0] is True


def test_disabled_flag_blocks_all():
    settings = {"free_shipping_enabled": False, "free_shipping_rules": [
        {"name": "Tudo", "min_subtotal": 0},
    ]}
    # Mesmo com regra que casaria, enabled=False bloqueia tudo
    assert _evaluate_free_shipping(settings, None, 9999)[0] is False


def test_legacy_schema_above():
    """Schema legado deve continuar funcionando quando free_shipping_rules vazio."""
    settings = {
        "free_shipping_mode": "above",
        "free_shipping_min_subtotal": 199.0,
        "free_shipping_rules": [],
    }
    assert _evaluate_free_shipping(settings, None, 250)[0] is True
    assert _evaluate_free_shipping(settings, None, 100)[0] is False


def test_legacy_schema_audiences():
    settings = {
        "free_shipping_mode": "audiences",
        "free_shipping_audiences": ["network_1"],
        "free_shipping_min_subtotal": 0,
        "free_shipping_rules": [],
    }
    assert _evaluate_free_shipping(settings, {"network_type": "network_1"}, 50)[0] is True
    assert _evaluate_free_shipping(settings, {"network_type": "customer"}, 5000)[0] is False


def test_rules_prevail_over_legacy():
    """Quando free_shipping_rules existe nao-vazio, ignora schema legado."""
    settings = {
        "free_shipping_mode": "all",  # legado liberaria tudo
        "free_shipping_rules": [
            {"name": "Apenas Equipe 1", "account_types": ["network_1"]},
        ],
    }
    # Customer NAO deve receber frete gratis (regras do novo modelo prevalecem)
    assert _evaluate_free_shipping(settings, {"network_type": "customer"}, 9999)[0] is False


def test_universal_rule():
    """Regra sem account_types/categories e min_subtotal=0 = libera para todos."""
    settings = {"free_shipping_enabled": True, "free_shipping_rules": [
        {"name": "Tudo gratis"},  # sem nenhum criterio
    ]}
    assert _evaluate_free_shipping(settings, None, 0)[0] is True
    assert _evaluate_free_shipping(settings, {"network_type": "customer"}, 1)[0] is True
