"""Integração Melhor Envio - cálculo de frete multi-transportadora via OAuth2.

Credenciais em db.app_credentials com _id = 'melhorenvio':
  client_id, client_secret, redirect_uri, sandbox (bool), scopes (str)
Tokens em db.app_credentials com _id = 'melhorenvio_tokens':
  access_token, refresh_token, expires_at (ISO string), last_refresh_at

Callback URL que o admin deve cadastrar no painel Melhor Envio:
  {REACT_APP_BACKEND_URL}/api/admin/melhorenvio/callback
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

DEFAULT_SCOPES = (
    "cart-read cart-write companies-read coupons-read "
    "notifications-read orders-read products-read products-write "
    "purchases-read shipping-calculate shipping-cancel shipping-checkout "
    "shipping-companies shipping-generate shipping-preview shipping-print "
    "shipping-share shipping-tracking ecommerce-shipping"
)

PRODUCT_HOST = "https://melhorenvio.com.br"
PRODUCT_API_HOST = "https://api.melhorenvio.com.br"
SANDBOX_HOST = "https://sandbox.melhorenvio.com.br"
SANDBOX_API_HOST = "https://sandbox.melhorenvio.com.br"  # No sandbox, tudo na mesma URL

USER_AGENT = "OxxPharma Shipping Integration (contato@oxxpharma.com.br)"


def _hosts(cfg: Dict):
    if cfg.get("sandbox"):
        return SANDBOX_HOST, SANDBOX_API_HOST
    return PRODUCT_HOST, PRODUCT_API_HOST


async def get_config(db) -> Dict:
    doc = await db.app_credentials.find_one({"_id": "melhorenvio"}) or {}
    return {
        "client_id": doc.get("client_id") or "",
        "client_secret": doc.get("client_secret") or "",
        "redirect_uri": doc.get("redirect_uri") or "",
        "sandbox": bool(doc.get("sandbox", True)),
        "scopes": doc.get("scopes") or DEFAULT_SCOPES,
        "origin_postal_code": doc.get("origin_postal_code") or "",
        "origin_name": doc.get("origin_name") or "",
        "default_services": doc.get("default_services") or [],  # filtro opcional
        "timeout": int(doc.get("timeout") or 20),
    }


async def update_config(db, updates: Dict) -> Dict:
    allowed = {"client_id", "client_secret", "redirect_uri", "sandbox",
               "scopes", "origin_postal_code", "origin_name",
               "default_services", "timeout"}
    set_doc = {k: v for k, v in updates.items() if k in allowed}
    if set_doc:
        set_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.app_credentials.update_one({"_id": "melhorenvio"}, {"$set": set_doc}, upsert=True)
    return await get_config(db)


async def get_tokens(db) -> Dict:
    doc = await db.app_credentials.find_one({"_id": "melhorenvio_tokens"}) or {}
    return {
        "access_token": doc.get("access_token"),
        "refresh_token": doc.get("refresh_token"),
        "expires_at": doc.get("expires_at"),
        "last_refresh_at": doc.get("last_refresh_at"),
    }


async def save_tokens(db, token_data: Dict):
    now = datetime.now(timezone.utc)
    expires_in = int(token_data.get("expires_in") or 0)
    expires_at = (now + timedelta(seconds=expires_in)).isoformat() if expires_in else None
    await db.app_credentials.update_one(
        {"_id": "melhorenvio_tokens"},
        {"$set": {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "expires_at": expires_at,
            "last_refresh_at": now.isoformat(),
        }},
        upsert=True,
    )


async def clear_tokens(db):
    await db.app_credentials.delete_one({"_id": "melhorenvio_tokens"})


async def is_connected(db) -> bool:
    t = await get_tokens(db)
    return bool(t.get("access_token"))


def build_authorize_url(cfg: Dict, state: str) -> str:
    """Gera a URL de autorização OAuth para redirecionar o admin."""
    host, _ = _hosts(cfg)
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "scope": cfg.get("scopes") or DEFAULT_SCOPES,
        "state": state,
    }
    qs = "&".join(f"{k}={httpx.QueryParams({k: v}).get(k)}" for k, v in params.items())
    return f"{host}/oauth/authorize?{qs}"


async def exchange_code(db, code: str) -> Dict:
    cfg = await get_config(db)
    host, _ = _hosts(cfg)
    async with httpx.AsyncClient(timeout=cfg["timeout"]) as client:
        r = await client.post(
            f"{host}/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "redirect_uri": cfg["redirect_uri"],
                "code": code,
            },
            headers={"Accept": "application/json", "User-Agent": USER_AGENT},
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Erro ao trocar code: {r.status_code} {r.text[:300]}")
    data = r.json()
    await save_tokens(db, data)
    return data


async def refresh_access_token(db) -> Dict:
    cfg = await get_config(db)
    tokens = await get_tokens(db)
    if not tokens.get("refresh_token"):
        raise RuntimeError("Sem refresh_token. Reconecte a conta.")
    host, _ = _hosts(cfg)
    async with httpx.AsyncClient(timeout=cfg["timeout"]) as client:
        r = await client.post(
            f"{host}/oauth/token",
            json={
                "grant_type": "refresh_token",
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "refresh_token": tokens["refresh_token"],
            },
            headers={"Accept": "application/json", "User-Agent": USER_AGENT},
        )
    if r.status_code >= 400:
        raise RuntimeError(f"Erro ao renovar token: {r.status_code} {r.text[:300]}")
    data = r.json()
    await save_tokens(db, data)
    return data


async def _valid_token(db) -> Optional[str]:
    """Retorna access_token válido (renovando se faltar < 5min p/ expirar)."""
    tokens = await get_tokens(db)
    if not tokens.get("access_token"):
        return None
    exp = tokens.get("expires_at")
    if exp:
        try:
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > (exp_dt - timedelta(minutes=5)):
                try:
                    await refresh_access_token(db)
                    tokens = await get_tokens(db)
                except Exception as e:
                    logger.warning(f"Refresh falhou: {e}. Usando token atual.")
        except Exception:
            pass
    return tokens.get("access_token")


async def calculate_shipping(
    db,
    cep_destination: str,
    items: List[Dict],
    cep_origin: Optional[str] = None,
    insurance_value: float = 0.0,
) -> Dict:
    """Calcula opções de frete para um pedido.

    items = [{weight_kg, length_cm, width_cm, height_cm, insurance_value, quantity}]
    Retorna: {options: [{service_id, service_name, company_name, price, delivery_days, raw}], error?}
    """
    cfg = await get_config(db)
    if not cfg.get("client_id") or not cfg.get("client_secret"):
        return {"options": [], "error": "Melhor Envio nao configurado (client_id/secret)"}
    origin = (cep_origin or cfg.get("origin_postal_code") or "").replace("-", "").replace(".", "").strip()
    destination = (cep_destination or "").replace("-", "").replace(".", "").strip()
    if not origin or not destination:
        return {"options": [], "error": "CEP origem ou destino invalido"}

    token = await _valid_token(db)
    if not token:
        return {"options": [], "error": "Conta Melhor Envio nao conectada"}

    # Melhor Envio aceita 'options' + 'products' (com peso/dimensoes por item)
    # ou 'package' agregado. Usaremos products para melhor acuracia.
    products = []
    total_value = float(insurance_value) or 0.0
    for i, it in enumerate(items or []):
        qty = int(it.get("quantity") or 1)
        weight = float(it.get("weight_kg") or it.get("weight") or 0.3) * qty
        length = float(it.get("length_cm") or 16) or 16
        width = float(it.get("width_cm") or 11) or 11
        height = float(it.get("height_cm") or 2) or 2
        pval = float(it.get("insurance_value") or it.get("value") or 0) * qty
        total_value += pval
        products.append({
            "id": str(it.get("product_id") or f"item_{i}"),
            "weight": round(max(weight, 0.01), 3),
            "length": round(max(length, 1), 2),
            "width": round(max(width, 1), 2),
            "height": round(max(height, 1), 2),
            "insurance_value": round(pval, 2),
            "quantity": qty,
        })

    payload = {
        "from": {"postal_code": origin},
        "to": {"postal_code": destination},
        "products": products,
        "options": {
            "receipt": False,
            "own_hand": False,
            "insurance_value": round(total_value, 2),
        },
    }

    host, api_host = _hosts(cfg)
    url = f"{api_host}/api/v2/me/shipment/calculate"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "User-Agent": USER_AGENT,
    }

    try:
        async with httpx.AsyncClient(timeout=cfg["timeout"]) as client:
            r = await client.post(url, json=payload, headers=headers)
        if r.status_code == 401:
            # Tenta renovar e reenviar 1x
            try:
                await refresh_access_token(db)
                token = await _valid_token(db)
                headers["Authorization"] = f"Bearer {token}"
                async with httpx.AsyncClient(timeout=cfg["timeout"]) as client:
                    r = await client.post(url, json=payload, headers=headers)
            except Exception as e:
                return {"options": [], "error": f"Autenticacao falhou e refresh negado: {e}"}
        if r.status_code >= 400:
            logger.warning(f"Melhor Envio erro {r.status_code}: {r.text[:300]}")
            await _log(db, url, payload, r.status_code, r.text[:1500], None)
            return {"options": [], "error": f"HTTP {r.status_code}: {r.text[:200]}"}
        data = r.json()
        await _log(db, url, payload, r.status_code, None, None)
    except Exception as e:
        logger.exception("Erro chamando Melhor Envio")
        await _log(db, url, payload, None, None, str(e))
        return {"options": [], "error": str(e)[:200]}

    options = []
    default_services = cfg.get("default_services") or []
    for svc in (data if isinstance(data, list) else []):
        # Servicos retornam erro quando nao atendem (campo 'error')
        if svc.get("error"):
            continue
        svc_id = str(svc.get("id") or "")
        if default_services and svc_id not in default_services:
            continue
        delivery_range = svc.get("delivery_range") or {}
        options.append({
            "provider": "melhorenvio",
            "service_id": svc_id,
            "service_name": svc.get("name") or "",
            "company_name": (svc.get("company") or {}).get("name") or "",
            "company_picture": (svc.get("company") or {}).get("picture"),
            "price": float(svc.get("price") or svc.get("custom_price") or 0),
            "delivery_days": int(svc.get("delivery_time") or 0),
            "delivery_min": delivery_range.get("min"),
            "delivery_max": delivery_range.get("max"),
            "discount": float(svc.get("discount") or 0),
            "packages_count": len(svc.get("packages") or []),
        })
    # ordena pelo menor preço
    options.sort(key=lambda x: x["price"])
    return {"options": options}


async def _log(db, url, payload, status_code, response_body, error):
    try:
        await db.melhorenvio_logs.insert_one({
            "log_id": "melog_" + os.urandom(6).hex(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "url": url,
            "request_body": payload,
            "status_code": status_code,
            "response_body": str(response_body)[:1500] if response_body else None,
            "error": str(error)[:500] if error else None,
            "success": bool(status_code and 200 <= status_code < 300),
        })
    except Exception:
        pass
