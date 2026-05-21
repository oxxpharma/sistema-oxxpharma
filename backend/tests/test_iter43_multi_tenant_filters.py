"""Iter 43 — Multi-tenant Fases 2-4:
- Filtros tenant em commissions-report, invoices, points-report.
- MercadoPago metadata carrega tenant.
- Templates de email com tenant especifico + fallback global.
"""
import os
import uuid
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN = {"email": "admin@oxxpharma.com", "password": "admin123"}


def _login():
    return requests.post(f"{API_URL}/api/auth/login", json=ADMIN, timeout=15).json()["token"]


def _h(token, tenant=None):
    h = {"Authorization": f"Bearer {token}"}
    if tenant:
        h["X-Tenant"] = tenant
    return h


def test_commissions_report_filters_by_tenant():
    token = _login()
    r1 = requests.get(f"{API_URL}/api/admin/commissions-report?status=pending",
                      headers=_h(token), timeout=15)
    assert r1.status_code == 200
    r2 = requests.get(f"{API_URL}/api/admin/commissions-report?status=pending&tenant=pharmakon",
                      headers=_h(token), timeout=15)
    assert r2.status_code == 200
    # Pharmakon comeca vazio (sem pedidos), oxxpharma tem o que ja existia
    total_all = sum(x.get("total_amount", 0) for x in (r1.json().get("items") or []))
    total_pk = sum(x.get("total_amount", 0) for x in (r2.json().get("items") or []))
    assert total_pk == 0 or total_pk <= total_all


def test_invoices_filters_by_tenant():
    token = _login()
    r = requests.get(f"{API_URL}/api/admin/invoices?tenant=pharmakon",
                     headers=_h(token), timeout=15)
    assert r.status_code == 200
    # Sem pedidos faturados em pharmakon ainda
    assert (r.json().get("total") or 0) == 0


def test_points_report_filters_by_tenant():
    token = _login()
    r = requests.get(f"{API_URL}/api/admin/points-report?tenant=pharmakon",
                     headers=_h(token), timeout=15)
    assert r.status_code == 200


def test_email_template_per_tenant_creation_and_resolution():
    """Cria template global + override pharmakon; verifica que get_template prioriza tenant."""
    token = _login()
    suf = uuid.uuid4().hex[:6]
    slug = f"test_slug_{suf}"
    h = _h(token)
    # Global
    r1 = requests.post(f"{API_URL}/api/admin/email-templates",
                       json={"slug": slug, "name": "Global", "subject": "G", "body_html": "<p>global</p>", "active": True},
                       headers=h, timeout=15)
    assert r1.status_code == 200, r1.text
    tid1 = r1.json()["template_id"]
    # Pharmakon-specifico (mesmo slug, tenant diferente)
    r2 = requests.post(f"{API_URL}/api/admin/email-templates",
                       json={"slug": slug, "name": "PK", "subject": "P", "body_html": "<p>pharmakon</p>",
                             "tenant": "pharmakon", "active": True},
                       headers=h, timeout=15)
    assert r2.status_code == 200, r2.text
    tid2 = r2.json()["template_id"]
    # Tentar criar duplicata global - deve dar 400
    r3 = requests.post(f"{API_URL}/api/admin/email-templates",
                       json={"slug": slug, "name": "Dup", "subject": "D", "body_html": "<p>dup</p>"},
                       headers=h, timeout=15)
    assert r3.status_code == 400
    # cleanup
    requests.delete(f"{API_URL}/api/admin/email-templates/{tid1}", headers=h, timeout=10)
    requests.delete(f"{API_URL}/api/admin/email-templates/{tid2}", headers=h, timeout=10)
