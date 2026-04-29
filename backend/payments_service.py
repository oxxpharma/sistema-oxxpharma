"""MercadoPago integration service.

Sandbox vs Producao: definido pela flag `mp_environment` em settings (test|production).
Tokens vem de .env (MP_PUBLIC_KEY_TEST/PROD, MP_ACCESS_TOKEN_TEST/PROD, MP_WEBHOOK_SECRET).
"""
import os
import uuid
import hmac
import hashlib
import logging
from typing import Optional, Dict, List
import mercadopago

logger = logging.getLogger(__name__)


def _get_tokens(environment: str):
    if environment == "production":
        return (
            os.environ.get("MP_PUBLIC_KEY_PROD", ""),
            os.environ.get("MP_ACCESS_TOKEN_PROD", ""),
        )
    return (
        os.environ.get("MP_PUBLIC_KEY_TEST", ""),
        os.environ.get("MP_ACCESS_TOKEN_TEST", ""),
    )


async def get_mp_environment(db) -> str:
    s = await db.settings.find_one({"_id": "global"}) or {}
    env = s.get("mp_environment", "test")
    return "production" if env == "production" else "test"


async def is_mp_configured(db) -> bool:
    env = await get_mp_environment(db)
    _, token = _get_tokens(env)
    return bool(token)


async def get_public_config(db) -> Dict:
    env = await get_mp_environment(db)
    pub, tok = _get_tokens(env)
    return {
        "environment": env,
        "configured": bool(tok),
        "public_key": pub if tok else "",
    }


async def create_preference(db, order: Dict, user: Dict, items_full: List[Dict], frontend_url: str, backend_url: str) -> Dict:
    """Cria preferencia no MercadoPago. items_full deve ser [{name, quantity, price, ...}].

    Retorna {preference_id, init_point, sandbox_init_point} ou levanta excecao.
    """
    env = await get_mp_environment(db)
    _, token = _get_tokens(env)
    if not token:
        raise RuntimeError(f"MercadoPago token not configured for {env}")

    sdk = mercadopago.SDK(token)

    mp_items = [{
        "id": str(it.get("product_id") or it.get("id") or it.get("name", "item"))[:50],
        "title": (it.get("name") or "Produto")[:60],
        "quantity": int(it.get("quantity", 1)),
        "unit_price": float(it.get("price") or it.get("unit_price") or 0),
        "currency_id": "BRL",
    } for it in items_full]

    payer = {
        "email": user.get("email"),
        "name": (user.get("name") or "").split(" ")[0][:30],
    }
    if user.get("cpf"):
        payer["identification"] = {"type": "CPF", "number": str(user["cpf"]).replace(".", "").replace("-", "")}

    body = {
        "items": mp_items,
        "payer": payer,
        "back_urls": {
            "success": f"{frontend_url}/pedido/{order['order_id']}?mp=success",
            "failure": f"{frontend_url}/pedido/{order['order_id']}?mp=failure",
            "pending": f"{frontend_url}/pedido/{order['order_id']}?mp=pending",
        },
        "auto_return": "approved",
        "notification_url": f"{backend_url}/api/payments/webhook/mercadopago",
        "external_reference": order["order_id"],
        "statement_descriptor": "OXXPHARMA",
    }

    request_options = mercadopago.config.RequestOptions()
    request_options.custom_headers = {"x-idempotency-key": str(uuid.uuid4())}

    result = sdk.preference().create(body, request_options)
    resp = result.get("response", {})
    if not resp.get("id"):
        raise RuntimeError(f"MP error: {result}")

    return {
        "preference_id": resp["id"],
        "init_point": resp.get("init_point"),
        "sandbox_init_point": resp.get("sandbox_init_point"),
        "environment": env,
    }


async def get_payment_details(db, payment_id: str) -> Optional[Dict]:
    env = await get_mp_environment(db)
    _, token = _get_tokens(env)
    if not token:
        return None
    sdk = mercadopago.SDK(token)
    try:
        r = sdk.payment().get(payment_id)
        return r.get("response")
    except Exception as e:
        logger.exception(f"MP get_payment failed {payment_id}: {e}")
        return None


def verify_webhook_signature(body: bytes, x_signature: Optional[str], x_request_id: Optional[str], data_id: Optional[str]) -> bool:
    """Verifica HMAC SHA256 do webhook. Retorna True se valido OU se secret nao configurado (modo permissivo p/ testes)."""
    secret = os.environ.get("MP_WEBHOOK_SECRET", "")
    if not secret:
        # Sem secret configurado: aceita (apenas em test/dev)
        logger.warning("MP_WEBHOOK_SECRET nao configurado - aceitando webhook sem validacao")
        return True
    if not x_signature or not x_request_id or not data_id:
        return False
    try:
        ts = None
        sig = None
        for p in x_signature.split(","):
            k, _, v = p.strip().partition("=")
            if k == "ts":
                ts = v
            elif k == "v1":
                sig = v
        if not ts or not sig:
            return False
        signed = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
        calc = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(calc, sig)
    except Exception as e:
        logger.exception(f"verify_webhook_signature error: {e}")
        return False
