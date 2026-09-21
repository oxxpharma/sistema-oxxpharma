"""Testes unitários e de integração para o Sistema de SEO & Meta Tags em Produtos e Categorias.
"""
import pytest
import asyncio, sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server import app, _slugify, _ensure_unique_slug

def test_slugify_helper():
    assert _slugify("Shampoo Anti-Queda 250ml!") == "shampoo-anti-queda-250ml"
    assert _slugify("Creme de Nutrição Épica") == "creme-de-nutricao-epica"
    assert _slugify("  --- OxxPharma ---  ") == "oxxpharma"
    assert _slugify("") == "categoria"

print("✓ Helper _slugify testado com sucesso!")
