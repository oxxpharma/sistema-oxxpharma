"""iPag REST API v2 integration service.

Gerencia autenticação, criação de transações (Pix, Cartão de Crédito, Boleto),
consultas e webhooks do gateway iPag.

Credenciais e ambiente armazenados na coleção `settings` (doc _id=global):
  active_payment_provider: "mercadopago" | "ipag" | "mock"
  ipag_environment: "sandbox" | "production"
  ipag_api_id: string (API ID do estabelecimento)
  ipag_api_key: string (API Key / Secret Key)
"""
import os
import re
import json
import base64
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

SANDBOX_URL = "https://sandbox.ipag.com.br"
PROD_URL = "https://api.ipag.com.br"


async def _get_settings(db) -> Dict:
    return await db.settings.find_one({"_id": "global"}) or {}


async def get_active_provider(db) -> str:
    """Retorna o gateway ativo no sistema ('mercadopago', 'ipag', ou 'mock')."""
    s = await _get_settings(db)
    provider = (s.get("active_payment_provider") or "mercadopago").strip().lower()
    if provider in {"ipag", "mercadopago", "mock"}:
        return provider
    return "mercadopago"


async def get_ipag_environment(db) -> str:
    s = await _get_settings(db)
    env = s.get("ipag_environment", "sandbox")
    return "production" if env == "production" else "sandbox"


async def _get_ipag_credentials(db, environment: Optional[str] = None):
    s = await _get_settings(db)
    if not environment:
        environment = await get_ipag_environment(db)

    if environment == "production":
        api_id = (s.get("ipag_prod_api_id") or s.get("ipag_api_id") or "").strip() or os.environ.get("IPAG_API_ID_PROD", "")
        api_key = (s.get("ipag_prod_api_key") or s.get("ipag_api_key") or "").strip() or os.environ.get("IPAG_API_KEY_PROD", "")
    else:
        api_id = (s.get("ipag_sandbox_api_id") or s.get("ipag_api_id") or "").strip() or os.environ.get("IPAG_API_ID_SANDBOX", "")
        api_key = (s.get("ipag_sandbox_api_key") or s.get("ipag_api_key") or "").strip() or os.environ.get("IPAG_API_KEY_SANDBOX", "")

    return api_id, api_key


async def is_ipag_configured(db) -> bool:
    env = await get_ipag_environment(db)
    api_id, api_key = await _get_ipag_credentials(db, env)
    return bool(api_id and api_key)


async def get_ipag_admin_config(db) -> Dict:
    """Retorna status e credenciais mascaradas do iPag para a interface admin."""
    s = await _get_settings(db)
    env = await get_ipag_environment(db)
    active = await get_active_provider(db)

    def mask(v):
        if not v:
            return ""
        if len(v) <= 8:
            return "*" * len(v)
        return v[:4] + "..." + v[-4:]

    sb_id, sb_key = await _get_ipag_credentials(db, "sandbox")
    prod_id, prod_key = await _get_ipag_credentials(db, "production")

    return {
        "active_payment_provider": active,
        "ipag_environment": env,
        "sandbox_api_id": sb_id,
        "sandbox_api_key_masked": mask(sb_key),
        "sandbox_configured": bool(sb_id and sb_key),
        "prod_api_id": prod_id,
        "prod_api_key_masked": mask(prod_key),
        "production_configured": bool(prod_id and prod_key),
    }


async def update_ipag_config(db, updates: Dict) -> Dict:
    """Atualiza configurações de pagamentos e credenciais do iPag."""
    allowed = {
        "active_payment_provider",
        "ipag_environment",
        "ipag_sandbox_api_id",
        "ipag_sandbox_api_key",
        "ipag_prod_api_id",
        "ipag_prod_api_key",
    }
    set_doc = {k: v for k, v in updates.items() if k in allowed}

    if "active_payment_provider" in set_doc:
        prov = str(set_doc["active_payment_provider"]).strip().lower()
        if prov not in {"mercadopago", "ipag", "mock"}:
            raise ValueError("Provedor deve ser 'mercadopago', 'ipag' ou 'mock'")
        set_doc["active_payment_provider"] = prov

    if "ipag_environment" in set_doc:
        env = str(set_doc["ipag_environment"]).strip().lower()
        if env not in {"sandbox", "production"}:
            raise ValueError("ipag_environment deve ser 'sandbox' ou 'production'")
        set_doc["ipag_environment"] = env

    if set_doc:
        set_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"_id": "global"}, {"$set": set_doc}, upsert=True)

    return await get_ipag_admin_config(db)


def _get_base_url(env: str) -> str:
    return PROD_URL if env == "production" else SANDBOX_URL


def _clean_digits(val: Optional[str]) -> str:
    if not val:
        return ""
    return re.sub(r"\D", "", str(val))


async def create_ipag_payment(
    db,
    order: Dict[str, Any],
    user: Dict[str, Any],
    payment_type: str = "pix",
    payment_method: str = "pix",
    card_data: Optional[Dict[str, Any]] = None,
    installments: int = 1,
    frontend_url: str = "",
    backend_url: str = "",
) -> Dict[str, Any]:
    """Cria uma transação de pagamento no iPag (Pix, Cartão de Crédito ou Boleto)."""
    env = await get_ipag_environment(db)
    api_id, api_key = await _get_ipag_credentials(db, env)

    if not api_id or not api_key:
        raise RuntimeError(f"Credenciais do iPag não configuradas para o ambiente {env.upper()}")

    base_url = _get_base_url(env)
    callback_url = f"{backend_url}/api/payments/webhook/ipag"

    amount = float(order.get("total") or order.get("amount") or 0)
    if amount <= 0:
        raise ValueError("Valor do pedido deve ser maior que zero")

    order_id = str(order.get("order_id") or "")
    cpf_cnpj = _clean_digits(user.get("cpf") or user.get("cpf_digits") or order.get("customer_cpf"))
    phone = _clean_digits(user.get("phone") or user.get("phone_digits") or order.get("customer_phone"))

    # Endereço de cobrança
    shipping = order.get("shipping_address") or {}
    zipcode = _clean_digits(shipping.get("zip_code"))

    billing_address = {
        "street": shipping.get("street") or "Rua Principal",
        "number": shipping.get("number") or "100",
        "district": shipping.get("neighborhood") or "Centro",
        "complement": shipping.get("complement") or "",
        "city": shipping.get("city") or "Sao Paulo",
        "state": (shipping.get("state") or "SP").upper()[:2],
        "zipcode": zipcode if len(zipcode) == 8 else "01001000",
    }

    # Produtos do pedido
    items_full = order.get("items") or []
    products_payload = []
    for it in items_full:
        products_payload.append({
            "name": (it.get("name") or "Produto")[:60],
            "description": (it.get("name") or "Item OxxPharma")[:100],
            "unit_price": round(float(it.get("price") or it.get("unit_price") or 0), 2),
            "quantity": int(it.get("quantity", 1)),
            "sku": str(it.get("product_id") or it.get("sku") or "ITEM")[:30],
        })

    if not products_payload:
        products_payload.append({
            "name": f"Pedido {order_id[-8:].upper()}",
            "unit_price": round(amount, 2),
            "quantity": 1,
            "sku": order_id[-8:].upper(),
        })

    # Estrutura do Pagamento conforme documentação iPag
    payment_obj: Dict[str, Any] = {
        "type": payment_type.lower(),
        "method": payment_method.lower() if payment_method else payment_type.lower(),
    }

    if payment_type.lower() == "pix":
        payment_obj["type"] = "pix"
        payment_obj["method"] = "pix"
        payment_obj["pix_expires_in"] = 60  # minutos
    elif payment_type.lower() in {"card", "credit_card"}:
        payment_obj["type"] = "card"
        payment_obj["method"] = (payment_method or "visa").lower()
        payment_obj["installments"] = max(1, int(installments))
        payment_obj["capture"] = True
        if card_data:
            payment_obj["card"] = {
                "holder": str(card_data.get("holder") or user.get("name") or "TITULAR").upper(),
                "number": _clean_digits(card_data.get("number")),
                "expiry_month": str(card_data.get("expiry_month") or "").zfill(2),
                "expiry_year": str(card_data.get("expiry_year") or ""),
                "cvv": str(card_data.get("cvv") or ""),
            }
    elif payment_type.lower() == "boleto":
        payment_obj["type"] = "boleto"
        payment_obj["method"] = "boletopagseguro"
        due = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
        payment_obj["boleto"] = {
            "due_date": due,
            "instructions": [
                "Nao receber apos o vencimento.",
                f"Referente ao pedido #{order_id[-8:].upper()}",
            ],
        }

    body = {
        "amount": round(amount, 2),
        "callback_url": callback_url,
        "order_id": order_id,
        "payment": payment_obj,
        "customer": {
            "name": (user.get("name") or order.get("customer_name") or "Cliente OxxPharma")[:60],
            "cpf_cnpj": cpf_cnpj if cpf_cnpj else "00000000000",
            "email": user.get("email") or order.get("customer_email") or "cliente@oxxpharma.com",
            "phone": phone if phone else "11999999999",
            "billing_address": billing_address,
        },
        "products": products_payload,
    }

    # Cabeçalho HTTP Basic Auth + x-api-version: 2
    credentials = f"{api_id}:{api_key}"
    encoded = base64.b64encode(credentials.encode("ascii")).decode("ascii")

    headers = {
        "Authorization": f"Basic {encoded}",
        "x-api-version": "2",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    url = f"{base_url}/service/payment"
    logger.info(f"Enviando requisicao iPag ({env}): {url} para pedido {order_id}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, json=body, headers=headers)
        if res.status_code not in (200, 201):
            logger.error(f"Erro iPag HTTP {res.status_code}: {res.text}")
            raise RuntimeError(f"Erro no iPag ({res.status_code}): {res.text}")

        res_data = res.json()
        logger.info(f"Resposta iPag ({order_id}): {res_data}")

        # Parsing dos dados de resposta da transação iPag
        tx = res_data.get("attributes") or res_data.get("data") or res_data

        # Respostas de Pix
        pix_info = tx.get("pix") or {}
        pix_code = pix_info.get("qrcode_text") or pix_info.get("emv") or tx.get("pix_qrcode_text") or ""
        pix_qr_image = pix_info.get("qrcode_image_url") or pix_info.get("qrcode_url") or tx.get("pix_qrcode_url") or ""

        # Resposta de Boleto
        boleto_info = tx.get("boleto") or {}
        boleto_url = boleto_info.get("url") or tx.get("boleto_url") or ""
        barcode = boleto_info.get("barcode") or tx.get("barcode") or ""

        return {
            "provider": "ipag",
            "environment": env,
            "transaction_id": str(tx.get("id") or tx.get("transaction_id") or res_data.get("id") or ""),
            "tid": str(tx.get("tid") or ""),
            "status": str(tx.get("status") or tx.get("status_code") or "1"),
            "status_message": tx.get("message") or tx.get("status_message") or "Transacao criada",
            "amount": amount,
            "order_id": order_id,
            # Dados Pix
            "pix_qrcode": pix_code,
            "pix_qrcode_url": pix_qr_image,
            # Dados Boleto
            "boleto_url": boleto_url,
            "barcode": barcode,
            "raw_response": res_data,
        }


async def consult_ipag_transaction(db, transaction_id: str) -> Optional[Dict[str, Any]]:
    """Consulta o status atual de uma transação no iPag."""
    env = await get_ipag_environment(db)
    api_id, api_key = await _get_ipag_credentials(db, env)

    if not api_id or not api_key:
        return None

    base_url = _get_base_url(env)
    credentials = f"{api_id}:{api_key}"
    encoded = base64.b64encode(credentials.encode("ascii")).decode("ascii")

    headers = {
        "Authorization": f"Basic {encoded}",
        "x-api-version": "2",
        "Accept": "application/json",
    }

    url = f"{base_url}/service/consult?id={transaction_id}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                return res.json()
            logger.warning(f"Consult iPag HTTP {res.status_code}: {res.text}")
            return None
    except Exception as e:
        logger.exception(f"Erro ao consultar transação iPag {transaction_id}: {e}")
        return None
