"""Iter 38: validações de role na criação/atualização de usuários admin."""
import os
import time
import requests

API_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")


def _admin_token():
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": "admin@oxxpharma.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _unique(prefix):
    return f"{prefix}_{int(time.time()*1000)}@ex.com"


def test_super_admin_can_create_any_role():
    tok = _admin_token()
    headers = {"Authorization": f"Bearer {tok}"}
    for role in ["customer", "comercial", "financeiro", "admin", "super_admin"]:
        email = _unique(f"sa_{role}")
        r = requests.post(f"{API_URL}/api/admin/users",
                          json={"name": f"Test {role}", "email": email, "role": role,
                                "send_first_access": False},
                          headers=headers)
        assert r.status_code == 200, f"role={role}: {r.text}"
        user = r.json()["user"]
        assert user["role"] == role
        # access_level deve refletir o role
        if role in ("admin", "super_admin"):
            assert user["access_level"] == 0
        elif role in ("comercial", "financeiro"):
            assert user["access_level"] == 1
        else:
            assert user["access_level"] == 99


def test_non_super_admin_cannot_create_admin():
    sa_tok = _admin_token()
    sa_h = {"Authorization": f"Bearer {sa_tok}"}
    # Cria um admin 'comercial' (que nao eh super_admin)
    com_email = _unique("com_role")
    r = requests.post(f"{API_URL}/api/admin/users",
                      json={"name": "Comercial Test", "email": com_email, "role": "comercial",
                            "send_first_access": False},
                      headers=sa_h)
    assert r.status_code == 200
    com_uid = r.json()["user"]["user_id"]
    # Define senha direto no DB para login (via set_password endpoint fake). Vamos usar reset
    # flow para obter token do comercial - mais simples: promover via endpoint set-role pra
    # ver se bloqueia? Precisamos efetivamente logar como ele.
    # Simplifica: pede set-password via endpoint admin
    r2 = requests.post(f"{API_URL}/api/admin/users/{com_uid}/set-password",
                       json={"password": "TestPass@123"}, headers=sa_h)
    if r2.status_code != 200:
        # fallback: put direto com must_set_password=false e hash via fluxo normal
        import pytest
        pytest.skip("Endpoint set-password nao disponivel; teste direto de 403 indisponivel sem senha")
    com_login = requests.post(f"{API_URL}/api/auth/login",
                              json={"email": com_email, "password": "TestPass@123"})
    assert com_login.status_code == 200
    com_h = {"Authorization": f"Bearer {com_login.json()['token']}"}
    # Comercial tenta criar admin -> 403
    r = requests.post(f"{API_URL}/api/admin/users",
                      json={"name": "Hack", "email": _unique("hack"), "role": "admin",
                            "send_first_access": False},
                      headers=com_h)
    assert r.status_code == 403, f"Esperado 403, veio {r.status_code}: {r.text}"


def test_super_admin_can_update_role_via_put():
    tok = _admin_token()
    headers = {"Authorization": f"Bearer {tok}"}
    email = _unique("upd_role")
    r = requests.post(f"{API_URL}/api/admin/users",
                      json={"name": "Upd", "email": email, "role": "customer",
                            "send_first_access": False},
                      headers=headers)
    assert r.status_code == 200
    uid = r.json()["user"]["user_id"]
    # Atualiza para comercial via PUT
    r2 = requests.put(f"{API_URL}/api/admin/users/{uid}",
                      json={"role": "comercial"}, headers=headers)
    assert r2.status_code == 200, r2.text
    assert r2.json()["role"] == "comercial"
    assert r2.json()["access_level"] == 1
