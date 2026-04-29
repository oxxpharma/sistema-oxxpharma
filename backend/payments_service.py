"""MercadoPago integration service.

Credenciais e ambiente vem da coleção settings (doc _id=global), com fallback para .env.
Campos no DB:
  mp_environment: "test" | "production"
  mp_test_public_key, mp_test_access_token
  mp_prod_public_key, mp_prod_access_token
  mp_webhook_secret
"""
import os
import uuid
import hmac
import hashlib
import logging
from typing import Optional, Dict, List
import mercadopago

logger = logging.getLogger(__name__)


async def _get_settings(db) -> Dict:
    return await db.settings.find_one({"_id": "global"}) or {}


async def get_mp_environment(db) -> str:
    s = await _get_settings(db)
    env = s.get("mp_environment", "test")
    return "production" if env == "production" else "test"


async def _get_tokens(db, environment: str):
    s = await _get_settings(db)
    if environment == "production":
        pub = (s.get("mp_prod_public_key") or "").strip() or os.environ.get("MP_PUBLIC_KEY_PROD", "")
        tok = (s.get("mp_prod_access_token") or "").strip() or os.environ.get("MP_ACCESS_TOKEN_PROD", "")
    else:
        pub = (s.get("mp_test_public_key") or "").strip() or os.environ.get("MP_PUBLIC_KEY_TEST", "")
        tok = (s.get("mp_test_access_token") or "").strip() or os.environ.get("MP_ACCESS_TOKEN_TEST", "")
    return pub, tok


async def get_webhook_secret(db) -> str:
    s = await _get_settings(db)
    return (s.get("mp_webhook_secret") or "").strip() or os.environ.get("MP_WEBHOOK_SECRET", "")


async def is_mp_configured(db) -> bool:
    env = await get_mp_environment(db)
    _, token = await _get_tokens(db, env)
    return bool(token)


async def get_public_config(db) -> Dict:
    env = await get_mp_environment(db)
    pub, tok = await _get_tokens(db, env)
    return {
        "environment": env,
        "configured": bool(tok),
        "public_key": pub if tok else "",
    }


async def get_admin_config(db) -> Dict:
    """Inclui credenciais (mascaradas) e flags. Admin only."""
    s = await _get_settings(db)
    env = await get_mp_environment(db)

    def mask(v):
        if not v:
            return ""
        if len(v) <= 12:
            return "*" * len(v)
        return v[:8] + "..." + v[-4:]

    test_tok = (s.get("mp_test_access_token") or "").strip() or os.environ.get("MP_ACCESS_TOKEN_TEST", "")
    prod_tok = (s.get("mp_prod_access_token") or "").strip() or os.environ.get("MP_ACCESS_TOKEN_PROD", "")
    secret = (s.get("mp_webhook_secret") or "").strip() or os.environ.get("MP_WEBHOOK_SECRET", "")
    return {
        "mp_environment": env,
        "test_public_key": (s.get("mp_test_public_key") or "").strip() or os.environ.get("MP_PUBLIC_KEY_TEST", ""),
        "test_access_token_masked": mask(test_tok),
        "test_configured": bool(test_tok),
        "prod_public_key": (s.get("mp_prod_public_key") or "").strip() or os.environ.get("MP_PUBLIC_KEY_PROD", ""),
        "prod_access_token_masked": mask(prod_tok),
        "production_configured": bool(prod_tok),
        "webhook_secret_masked": mask(secret),
        "webhook_secret_configured": bool(secret),
    }


async def update_credentials(db, updates: Dict) -> Dict:
    """Aceita: mp_environment, mp_test_public_key, mp_test_access_token, mp_prod_public_key, mp_prod_access_token, mp_webhook_secret."""
    allowed = {
        "mp_environment", "mp_test_public_key", "mp_test_access_token",
        "mp_prod_public_key", "mp_prod_access_token", "mp_webhook_secret",
    }
    set_doc = {k: v for k, v in updates.items() if k in allowed}
    if "mp_environment" in set_doc and set_doc["mp_environment"] not in ("test", "production"):
        raise ValueError("mp_environment deve ser 'test' ou 'production'")
    if set_doc:
        from datetime import datetime, timezone
        set_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"_id": "global"}, {"$set": set_doc}, upsert=True)
    return await get_admin_config(db)


async def create_preference(db, order: Dict, user: Dict, items_full: List[Dict], frontend_url: str, backend_url: str) -> Dict:
    env = await get_mp_environment(db)
    _, token = await _get_tokens(db, env)
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
    _, token = await _get_tokens(db, env)
    if not token:
        return None
    sdk = mercadopago.SDK(token)
    try:
        r = sdk.payment().get(payment_id)
        return r.get("response")
    except Exception as e:
        logger.exception(f"MP get_payment failed {payment_id}: {e}")
        return None


async def verify_webhook_signature(db, body: bytes, x_signature: Optional[str], x_request_id: Optional[str], data_id: Optional[str]) -> bool:
    secret = await get_webhook_secret(db)
    if not secret:
        logger.warning("MP_WEBHOOK_SECRET nao configurado - aceitando webhook sem validacao")
        return True
    if not x_signature or not x_request_id or not data_id:
        return False
    try:
        ts = sig = None
        for p in x_signature.split(","):
            k, _, v = p.strip().partition("=")
            if k == "ts": ts = v
            elif k == "v1": sig = v
        if not ts or not sig:
            return False
        signed = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
        calc = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(calc, sig)
    except Exception as e:
        logger.exception(f"verify_webhook_signature error: {e}")
        return False
