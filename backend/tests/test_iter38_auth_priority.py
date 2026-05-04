"""Iter 38 bugfix: Impersonation + header tem prioridade sobre cookie.

Cenario: admin faz login (grava cookie + retorna token). Ao impersonar um cliente,
o frontend troca o token no localStorage mas o cookie HTTP-only do admin permanece.
O backend DEVE priorizar o header Authorization sobre o cookie, caso contrario o
/api/auth/me retorna o admin e o frontend 'volta para admin' em <1s.
"""
import os
import time
import requests

API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")


def _random_email(prefix):
    return f"{prefix}_{int(time.time()*1000)}@ex.com"


def test_authorization_header_overrides_cookie():
    """Login admin -> recebe cookie+token. Login customer com outra sessao -> token B.
    Chama /api/auth/me usando o cookie do admin + header do customer.
    Deve retornar o CUSTOMER (o header vence)."""

    # Admin login
    admin = requests.post(f"{API_URL}/api/auth/login", json={
        "email": "admin@oxxpharma.com", "password": "admin123"
    })
    assert admin.status_code == 200
    admin_cookie = admin.cookies.get("access_token")
    assert admin_cookie, "admin login deve gravar cookie"
    admin_user_id = admin.json()["user"]["user_id"]

    # Registra cliente de teste
    email = _random_email("imp_target")
    reg = requests.post(f"{API_URL}/api/auth/register", json={
        "name": "Cliente Imp", "email": email, "password": "test@123"
    })
    assert reg.status_code == 200, reg.text
    customer = reg.json()["user"]
    customer_id = customer["user_id"]

    # Admin chama endpoint de impersonation
    imp = requests.post(
        f"{API_URL}/api/admin/users/{customer_id}/impersonate",
        headers={"Authorization": f"Bearer {admin.json()['token']}"}
    )
    assert imp.status_code == 200, imp.text
    target_token = imp.json()["token"]

    # Agora simula o cenario do bug: manda cookie do admin + header do target
    me = requests.get(
        f"{API_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {target_token}"},
        cookies={"access_token": admin_cookie},
    )
    assert me.status_code == 200, me.text
    returned_user = me.json()
    # O header deve vencer: retorna o target, NAO o admin
    assert returned_user["user_id"] == customer_id, (
        f"Esperava user_id={customer_id} (target), veio {returned_user['user_id']} "
        f"(admin={admin_user_id}). Header Authorization deveria sobrepor o cookie."
    )
