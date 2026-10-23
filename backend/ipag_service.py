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
import uuid
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


async def record_payment_log(
    db,
    provider: str,
    direction: str,
    action: str,
    order_id: Optional[str] = None,
    data_id: Optional[str] = None,
    environment: Optional[str] = None,
    endpoint: Optional[str] = None,
    method: str = "POST",
    status_code: Optional[int] = None,
    success: bool = True,
    request_payload: Any = None,
    response_payload: Any = None,
    headers_sent: Any = None,
    headers_received: Any = None,
    error_message: Optional[str] = None,
):
    """Grava log detalhado de integração de pagamento (requisição ou webhook)."""
    try:
        if db is None:
            return None
        log_entry = {
            "log_id": f"paylog_{uuid.uuid4().hex[:12]}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "provider": provider,
            "direction": direction,  # "outgoing" (enviado) ou "incoming" (recebido)
            "action": action,
            "order_id": str(order_id) if order_id else None,
            "data_id": str(data_id) if data_id else None,
            "environment": environment,
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "success": success,
            "request_payload": request_payload,
            "response_payload": response_payload,
            "headers_sent": headers_sent,
            "headers_received": headers_received,
            "error_message": error_message,
        }
        await db.payment_integration_logs.insert_one(log_entry)
        return log_entry
    except Exception as e:
        logger.warning(f"Falha ao gravar payment_integration_logs: {e}")
        return None


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
    payment_type: str = "card",
    payment_method: str = "card",
    card_data: Optional[Dict[str, Any]] = None,
    installments: int = 1,
    frontend_url: str = "",
    backend_url: str = "",
) -> Dict[str, Any]:
    """Cria um Link de Pagamento Hospedado no iPag para checkout seguro.

    O cliente é redirecionado ao ambiente do iPag para escolher a forma de pagamento e digitar seus dados.
    """
    if not isinstance(payment_type, str):
        payment_type = "card"
    if not isinstance(payment_method, str):
        payment_method = "card"

    env = await get_ipag_environment(db)
    api_id, api_key = await _get_ipag_credentials(db, env)

    if not api_id or not api_key:
        raise RuntimeError(f"Credenciais do iPag não configuradas para o ambiente {env.upper()}")

    base_url = _get_base_url(env)
    order_id = str(order.get("order_id") or "")
    callback_url = f"{backend_url}/api/payments/webhook/ipag?order_id={order_id}"
    redirect_url = f"{frontend_url}/pedido/{order_id}?from=ipag"

    amount = float(order.get("total") or order.get("amount") or 0)
    if amount <= 0:
        raise ValueError("Valor do pedido deve ser maior que zero")

    cpf_cnpj = _clean_digits(user.get("cpf") or user.get("cpf_digits") or order.get("customer_cpf"))
    phone = _clean_digits(user.get("phone") or user.get("phone_digits") or order.get("customer_phone"))

    shipping = order.get("shipping_address") or {}
    zipcode = _clean_digits(shipping.get("zip_code"))

    raw_street = shipping.get("street") or "Rua Principal"
    clean_street = re.sub(r"\s*-\s*de\s+\d+.*$", "", raw_street, flags=re.IGNORECASE).strip()
    clean_street = clean_street[:60] if clean_street else "Rua Principal"

    billing_address = {
        "street": clean_street,
        "number": str(shipping.get("number") or "100")[:10],
        "district": str(shipping.get("neighborhood") or "Centro")[:40],
        "complement": str(shipping.get("complement") or "")[:40],
        "city": str(shipping.get("city") or "Sao Paulo")[:40],
        "state": (shipping.get("state") or "SP").upper()[:2],
        "zipcode": zipcode if len(zipcode) == 8 else "01001000",
    }

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

    credentials = f"{api_id}:{api_key}"
    encoded = base64.b64encode(credentials.encode("ascii")).decode("ascii")

    headers = {
        "Authorization": f"Basic {encoded}",
        "x-api-version": "2",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Data de expiração do link (7 dias)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

    # Configurações de checkout explícitas para garantir compatibilidade total no ambiente iPag
    checkout_settings = {
        "max_installments": 12,
        "interest_free_installments": 12,
        "min_installment_value": 5.0,
        "payment_method": "all",
    }

    link_body = {
        "amount": round(amount, 2),
        "order_id": order_id[:50],
        "external_code": order_id[:50],
        "reference": order_id[:50],
        "description": f"Pedido #{order_id[-8:].upper()} - OxxPharma",
        "expires_at": expires_at,
        "callback_url": callback_url,
        "redirect_url": redirect_url,
        "checkout_settings": checkout_settings,
        "customer": {
            "name": (user.get("name") or order.get("customer_name") or "Cliente OxxPharma")[:60],
            "cpf_cnpj": cpf_cnpj if cpf_cnpj else "00000000000",
            "email": user.get("email") or order.get("customer_email") or "cliente@oxxpharma.com",
            "phone": phone if phone else "11999999999",
            "billing_address": billing_address,
        },
        "products": products_payload,
    }

    link_url_endpoint = f"{base_url}/service/v2/payment_links"
    logger.info(f"Criando Link de Pagamento iPag ({env}): {link_url_endpoint} para pedido {order_id}")

    res_data = None
    res_status = None
    error_msg = None
    headers_for_log = {"Content-Type": "application/json", "x-api-version": "2"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(link_url_endpoint, json=link_body, headers=headers)
            res_status = res.status_code
            try:
                res_data = res.json()
            except Exception:
                res_data = {"raw_text": res.text}

            if res.status_code not in (200, 201):
                error_msg = f"Erro no iPag HTTP {res.status_code}: {res.text}"
                logger.error(error_msg)
                await record_payment_log(
                    db=db,
                    provider="ipag",
                    direction="outgoing",
                    action="create_payment_link",
                    order_id=order_id,
                    environment=env,
                    endpoint=link_url_endpoint,
                    method="POST",
                    status_code=res_status,
                    success=False,
                    request_payload=link_body,
                    response_payload=res_data,
                    headers_sent=headers_for_log,
                    error_message=error_msg,
                )
                raise RuntimeError(error_msg)
    except Exception as e:
        if not error_msg:
            error_msg = str(e)
            await record_payment_log(
                db=db,
                provider="ipag",
                direction="outgoing",
                action="create_payment_link",
                order_id=order_id,
                environment=env,
                endpoint=link_url_endpoint,
                method="POST",
                status_code=res_status or 500,
                success=False,
                request_payload=link_body,
                response_payload=res_data,
                headers_sent=headers_for_log,
                error_message=error_msg,
            )
        raise

    logger.info(f"Link iPag v2 criado com sucesso ({order_id}): {res_data}")
    tx = res_data.get("attributes") or res_data.get("data") or res_data
    trans_id = str(res_data.get("id") or tx.get("id") or tx.get("payment_link_id") or "")

    await record_payment_log(
        db=db,
        provider="ipag",
        direction="outgoing",
        action="create_payment_link",
        order_id=order_id,
        data_id=trans_id,
        environment=env,
        endpoint=link_url_endpoint,
        method="POST",
        status_code=res_status,
        success=True,
        request_payload=link_body,
        response_payload=res_data,
        headers_sent=headers_for_log,
    )

    links_obj = res_data.get("links") or {}
    pay_url = (
        links_obj.get("payment")
        or tx.get("url")
        or tx.get("link_url")
        or tx.get("payment_url")
        or tx.get("checkout_url")
        or res_data.get("url")
        or res_data.get("link_url")
        or (f"{base_url}/pay/{trans_id}" if trans_id else "")
    )

    return {
        "provider": "ipag",
        "environment": env,
        "payment_id": trans_id,
        "transaction_id": trans_id,
        "payment_url": pay_url,
        "status": "1",
        "amount": amount,
        "order_id": order_id,
        "raw_response": res_data,
    }


def is_ipag_status_paid(status_obj_or_val, event_name: str = "", gateway_obj: Optional[Dict] = None) -> bool:
    """Verifica de forma exaustiva se os dados do iPag indicam pagamento efetuado/capturado."""
    # 1. Evento explícito
    ev = str(event_name or "").strip().lower()
    paid_events = {
        "paymentlinkpaymentsucceeded",
        "transactioncaptured",
        "chargepaymentsucceeded",
        "transactionapproved",
        "paymentsucceeded",
        "captured",
        "approved",
    }
    if ev in paid_events or "succeeded" in ev or "captured" in ev or "approved" in ev:
        return True

    # 2. Gateway code P0 = sucesso
    if isinstance(gateway_obj, dict):
        gcode = str(gateway_obj.get("code") or "").strip().upper()
        gmsg = str(gateway_obj.get("message") or "").strip().lower()
        if gcode in ("P0", "0", "00") or "sucesso" in gmsg or "concluída" in gmsg or "concluida" in gmsg:
            if not any(neg in gmsg for neg in ["cancel", "recus", "falh", "negad"]):
                return True

    # 3. Analisa status_obj_or_val (pode ser dict, int ou str)
    code_str = ""
    msg_str = ""
    if isinstance(status_obj_or_val, dict):
        code_str = str(status_obj_or_val.get("code") or status_obj_or_val.get("status_code") or "").strip().lower()
        msg_str = str(status_obj_or_val.get("message") or status_obj_or_val.get("name") or status_obj_or_val.get("description") or "").strip().lower()
    elif isinstance(status_obj_or_val, (int, float)):
        code_str = str(int(status_obj_or_val))
    elif isinstance(status_obj_or_val, str):
        v = status_obj_or_val.strip().lower()
        if v.isdigit():
            code_str = v
        else:
            msg_str = v

    paid_messages = {"approved", "captured", "capturado", "aprovado", "succeeded", "paid", "pago", "concluido", "concluído"}
    if msg_str in paid_messages or any(pm in msg_str for pm in paid_messages):
        return True

    # 8 = CAPTURED na v2 da iPag
    if code_str in ("8", "5"):
        return True

    # 2 = APPROVED no contexto de webhook de pagamento
    if code_str == "2":
        if msg_str in ("approved", "aprovado", "paid", "pago", "captured", "capturado"):
            return True
        if not msg_str or msg_str not in ("waiting payment", "aguardando pagamento", "pending", "criado", "created"):
            return True

    return False


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

    # Tenta consultar como payment_links ou transaction
    urls = [
        f"{base_url}/service/v2/payment_links/{transaction_id}",
        f"{base_url}/service/v2/transactions/{transaction_id}",
        f"{base_url}/service/consult?id={transaction_id}",
    ]
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            logger.warning(f"Erro ao consultar iPag em {url}: {e}")
    return None


async def consult_ipag_order_payment(db, order: Dict[str, Any]) -> Dict[str, Any]:
    """Consulta iPag para verificar se o pedido foi pago.
    Testa endpoints de payment_links e transactions por ID e order_id.
    Retorna dict com: {"is_paid": bool, "is_rejected": bool, "payment_id": str, "status": str}
    """
    env = await get_ipag_environment(db)
    api_id, api_key = await _get_ipag_credentials(db, env)
    if not api_id or not api_key:
        return {"is_paid": False, "reason": "not_configured"}

    base_url = _get_base_url(env)
    credentials = f"{api_id}:{api_key}"
    encoded = base64.b64encode(credentials.encode("ascii")).decode("ascii")
    headers = {
        "Authorization": f"Basic {encoded}",
        "x-api-version": "2",
        "Accept": "application/json",
    }

    order_id = str(order.get("order_id") or "")
    payment_id = str(order.get("payment_id") or "")

    urls_to_try = []
    if payment_id:
        urls_to_try.append(f"{base_url}/service/v2/payment_links/{payment_id}")
        urls_to_try.append(f"{base_url}/service/v2/transactions/{payment_id}")
        urls_to_try.append(f"{base_url}/service/consult?id={payment_id}")
    if order_id:
        urls_to_try.append(f"{base_url}/service/v2/transactions?order_id={order_id}")
        urls_to_try.append(f"{base_url}/service/v2/transactions?external_code={order_id}")
        urls_to_try.append(f"{base_url}/service/v2/payment_links?external_code={order_id}")

    async with httpx.AsyncClient(timeout=15.0) as client:
        for url in urls_to_try:
            try:
                res = await client.get(url, headers=headers)
                if res.status_code != 200:
                    continue
                data = res.json()
                if not data:
                    continue

                items = data if isinstance(data, list) else [data]
                if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                    items = data["data"]

                for item in items:
                    if not isinstance(item, dict):
                        continue
                    tx_obj = item.get("transaction") if isinstance(item.get("transaction"), dict) else item
                    attrs = tx_obj.get("attributes") if isinstance(tx_obj.get("attributes"), dict) else tx_obj
                    st = attrs.get("status") or tx_obj.get("status")
                    gw = attrs.get("gateway") or tx_obj.get("gateway")
                    ev = item.get("event") or attrs.get("event") or ""
                    tid = str(tx_obj.get("id") or item.get("id") or "")

                    if is_ipag_status_paid(st, event_name=ev, gateway_obj=gw):
                        return {
                            "is_paid": True,
                            "payment_id": tid or payment_id,
                            "status": "paid",
                            "raw": item,
                        }

                    # Rejeição / cancelamento
                    code_str = ""
                    msg_str = ""
                    if isinstance(st, dict):
                        code_str = str(st.get("code") or "").strip().lower()
                        msg_str = str(st.get("message") or "").strip().lower()
                    elif isinstance(st, str):
                        msg_str = st.strip().lower()
                    if code_str in ("3", "7") or any(r in msg_str for r in ["canceled", "cancelled", "declined", "recusado", "cancelado"]):
                        return {
                            "is_paid": False,
                            "is_rejected": True,
                            "payment_id": tid or payment_id,
                            "status": "rejected",
                            "raw": item,
                        }
            except Exception as e:
                logger.warning(f"Erro ao consultar iPag em {url}: {e}")
                continue

    return {"is_paid": False, "status": "pending"}
