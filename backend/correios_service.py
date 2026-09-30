"""
Modulo de Integracao Correios CWS v1 - Cotacao, Rastreamento em Tempo Real e Cron de Notificacoes
Oficial dos Correios (API CWS Producao/Homologacao).

Funcionalidades:
1. Autenticacao CWS via Cartao de Postagem ou Contrato (Basic Auth -> Bearer Token com cache 30min pre-expiracao).
2. Cotacao de Frete Nacional (SEDEX, PAC, Retirada no Local).
3. Rastreamento SRO Rastro v1 (GET /srorastro/v1/objetos/{codigo}?resultado=T).
4. Cron / Job de Rastreamento Automatizado & Notificacoes por E-mail para Pedidos em Transito.
5. Endpoint de Diagnostico Passo a Passo para o Painel Admin.
"""

import os
import re
import base64
import time
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple, Any

import httpx
import email_service

logger = logging.getLogger(__name__)

# Endpoints CWS Oficial
API_HOM = "https://apihom.correios.com.br"
API_PROD = "https://api.correios.com.br"

DEFAULT_CONFIG = {
    # Habilita provider Correios
    "correios_enabled": True,
    "correios_environment": "producao",  # "producao" | "homologacao"
    
    # Credenciais CWS
    "correios_user": "",             # Usuario / idCorreios (ex: 30721838000135)
    "correios_api_code": "",         # Codigo de Acesso / Senha API CWS
    "correios_password": "",         # Alias para correios_api_code
    "correios_contract": "",         # Numero do contrato (ex: 9912536173)
    "correios_posting_card": "",     # Cartao de postagem (ex: 0079705995)
    "correios_dr": "",               # Codigo DR (ex: 72)
    
    # Origem e Dimensoes Padrao
    "correios_origin_cep": "87033370",
    "shipping_origin_cep": "87033370",
    "correios_default_height_cm": 24,
    "correios_default_length_cm": 34,
    "correios_default_width_cm": 14,
    "shipping_default_height": 24,
    "shipping_default_length": 34,
    "shipping_default_width": 14,
    "correios_min_weight_kg": 0.3,
    "correios_cache_minutes": 60,

    # Formas de envio ativas
    "shipping_enable_pac": True,
    "shipping_enable_sedex": True,
    "shipping_enable_pickup": True,
    "shipping_enable_melhorenvio": False,
    "shipping_melhorenvio_token": "",

    # Rastreamento Automático & Alertas por E-mail
    "shipping_tracking_enabled": True,
    "shipping_tracking_interval_hours": 4,
    "shipping_tracking_last_run_at": None,

    # Retirada no Local
    "pickup_enabled": True,
    "pickup_address": "",
    "pickup_phone": "",
    "pickup_hours": "",
    "pickup_instructions": "",
}

# In-Memory Bearer Token Cache: { token, expiresAt_ms, key }
_TOKEN_CACHE: Dict[str, Any] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id(prefix: str = "tnot_") -> str:
    return f"{prefix}{os.urandom(6).hex()}"


def _normalize_cep(cep: str) -> str:
    return "".join(c for c in (cep or "") if c.isdigit())


def _api_base(env: str) -> str:
    return API_PROD if env == "producao" else API_HOM


async def get_config(db) -> Dict[str, Any]:
    s = await db.settings.find_one({"_id": "global"}, {"_id": 0}) or {}
    out = {**DEFAULT_CONFIG}
    for k in DEFAULT_CONFIG:
        if k in s and s[k] is not None:
            out[k] = s[k]
    # Sincroniza aliases de campos
    if s.get("shipping_origin_cep"):
        out["correios_origin_cep"] = s["shipping_origin_cep"]
    if s.get("shipping_correios_contract"):
        out["correios_contract"] = s["shipping_correios_contract"]
    if s.get("shipping_correios_user"):
        out["correios_user"] = s["shipping_correios_user"]
    if s.get("shipping_correios_password"):
        out["correios_api_code"] = s["shipping_correios_password"]
        out["correios_password"] = s["shipping_correios_password"]
    if s.get("shipping_correios_posting_card"):
        out["correios_posting_card"] = s["shipping_correios_posting_card"]
    if s.get("shipping_correios_dr"):
        out["correios_dr"] = str(s["shipping_correios_dr"])
    return out


async def update_config(db, updates: Dict[str, Any]) -> Dict[str, Any]:
    allowed = set(DEFAULT_CONFIG.keys()) | {
        "shipping_origin_cep", "shipping_default_height", "shipping_default_length", "shipping_default_width",
        "shipping_correios_contract", "shipping_correios_user", "shipping_correios_password",
        "shipping_correios_posting_card", "shipping_correios_dr", "shipping_enable_pac", "shipping_enable_sedex",
        "shipping_enable_pickup", "shipping_enable_melhorenvio", "shipping_melhorenvio_token",
        "shipping_tracking_enabled", "shipping_tracking_interval_hours"
    }
    set_doc = {k: v for k, v in updates.items() if k in allowed and v is not None}
    
    # Tratamento de aliases
    if "shipping_origin_cep" in set_doc:
        set_doc["correios_origin_cep"] = set_doc["shipping_origin_cep"]
    elif "correios_origin_cep" in set_doc:
        set_doc["shipping_origin_cep"] = set_doc["correios_origin_cep"]
        
    if "shipping_default_height" in set_doc:
        set_doc["correios_default_height_cm"] = set_doc["shipping_default_height"]
    if "shipping_default_length" in set_doc:
        set_doc["correios_default_length_cm"] = set_doc["shipping_default_length"]
    if "shipping_default_width" in set_doc:
        set_doc["correios_default_width_cm"] = set_doc["shipping_default_width"]

    if "shipping_correios_contract" in set_doc:
        set_doc["correios_contract"] = set_doc["shipping_correios_contract"]
    if "shipping_correios_user" in set_doc:
        set_doc["correios_user"] = set_doc["shipping_correios_user"]
    if "shipping_correios_password" in set_doc:
        set_doc["correios_api_code"] = set_doc["shipping_correios_password"]
        set_doc["correios_password"] = set_doc["shipping_correios_password"]
    elif "correios_api_code" in set_doc:
        set_doc["shipping_correios_password"] = set_doc["correios_api_code"]
        set_doc["correios_password"] = set_doc["correios_api_code"]
        
    if "shipping_correios_posting_card" in set_doc:
        set_doc["correios_posting_card"] = set_doc["shipping_correios_posting_card"]
    if "shipping_correios_dr" in set_doc:
        set_doc["correios_dr"] = str(set_doc["shipping_correios_dr"])

    if set_doc:
        set_doc["updated_at"] = _now_iso()
        await db.settings.update_one({"_id": "global"}, {"$set": set_doc}, upsert=True)
        # Limpa cache de token em memoria ao alterar credenciais
        _TOKEN_CACHE.clear()

    return await get_config(db)


# ==============================================================================
# 1. AUTENTICACAO OFICIAL CORREIOS CWS (Bearer Token com Cache 30min)
# ==============================================================================

async def get_correios_auth_token(db, cfg: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Obtem Bearer Token do CWS dos Correios.
    Utiliza endpoint /token/v1/autentica/cartaopostagem (fallback /contrato).
    Renova automaticamente se faltar menos de 30 minutos para expirar.
    """
    if cfg is None:
        cfg = await get_config(db)

    user = (cfg.get("correios_user") or "").strip()
    passw = (cfg.get("correios_api_code") or cfg.get("correios_password") or "").strip()
    card = (cfg.get("correios_posting_card") or cfg.get("correios_contract") or "").strip()
    contract = (cfg.get("correios_contract") or "").strip()
    env = cfg.get("correios_environment") or "producao"

    if not (user and passw):
        logger.warning("Correios CWS: usuario ou senha API nao configurados.")
        return None

    cache_key = f"{env}:{user}:{card or contract}"
    
    # 1. Verifica cache em memoria (validade > 30 min)
    now_ms = time.time() * 1000
    if cache_key in _TOKEN_CACHE:
        cached = _TOKEN_CACHE[cache_key]
        # Se faltar mais de 30 minutos (1800000 ms) para expirar
        if cached["expires_at_ms"] > now_ms + (30 * 60 * 1000):
            return cached["token"]

    base_url = _api_base(env)
    auth_header = "Basic " + base64.b64encode(f"{user}:{passw}".encode("utf-8")).decode("utf-8")

    # 2. Tenta autenticacao por Cartao de Postagem
    url_card = f"{base_url}/token/v1/autentica/cartaopostagem"
    card_number = card if card else contract

    payload = {"numero": card_number}
    dr = (cfg.get("correios_dr") or "").strip()
    if dr:
        try:
            payload["dr"] = int(dr)
        except Exception:
            pass

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.post(
                url_card,
                json=payload,
                headers={
                    "Authorization": auth_header,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            
            # Se falhou cartaopostagem, tenta fallback em /autentica/contrato
            if resp.status_code >= 400 and contract:
                url_contract = f"{base_url}/token/v1/autentica/contrato"
                resp = await client.post(
                    url_contract,
                    json={"numero": contract},
                    headers={
                        "Authorization": auth_header,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                )

            if resp.status_code in (200, 201):
                data = resp.json()
                token = data.get("token")
                exp_str = data.get("expiraEm")
                
                exp_ms = now_ms + (23 * 60 * 60 * 1000) # default 23h
                if exp_str:
                    try:
                        clean_exp = exp_str.replace("Z", "+00:00")
                        dt_exp = datetime.fromisoformat(clean_exp)
                        if not dt_exp.tzinfo:
                            dt_exp = dt_exp.replace(tzinfo=timezone.utc)
                        exp_ms = dt_exp.timestamp() * 1000
                    except Exception:
                        pass
                
                _TOKEN_CACHE[cache_key] = {
                    "token": token,
                    "expires_at_ms": exp_ms,
                    "obtained_at": _now_iso(),
                }
                return token
            else:
                logger.error(f"Correios CWS Auth Error HTTP {resp.status_code}: {resp.text[:300]}")
        except Exception as e:
            logger.error(f"Correios CWS Auth Exception: {e}")

    return None


# ==============================================================================
# 2. RASTREAMENTO DE OBJETOS EM TEMPO REAL (SRO Rastro v1 + Fallback)
# ==============================================================================

def _parse_sro_events(eventos_raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    parsed_events = []
    for ev in eventos_raw:
        dt_raw = ev.get("dtHrCriado") or ev.get("dtCriado") or _now_iso()
        date_str = ""
        time_str = ""
        try:
            clean_dt = str(dt_raw).replace("Z", "+00:00")
            dt_obj = datetime.fromisoformat(clean_dt)
            date_str = dt_obj.strftime("%d/%m/%Y")
            time_str = dt_obj.strftime("%H:%M")
        except Exception:
            date_str = str(dt_raw)[:10]
            time_str = str(dt_raw)[11:16]

        unidade = ev.get("unidade") or {}
        end = unidade.get("endereco") or {}
        cidade = end.get("cidade") or unidade.get("nome") or ""
        uf = end.get("uf") or ""
        bairro = end.get("bairro") or ""

        if cidade and uf:
            loc = f"{cidade}/{uf} ({bairro})" if bairro else f"{cidade}/{uf}"
        else:
            loc = cidade or unidade.get("nome") or "Unidade dos Correios"

        desc = ev.get("descricao") or "Movimentação do Objeto"
        detalhe = ev.get("detalhe") or desc or "Objeto em trânsito"

        parsed_events.append({
            "status": desc,
            "codigo": ev.get("codigo"),
            "date": date_str,
            "time": time_str,
            "location": loc,
            "description": detalhe,
            "completed": True,
            "raw_date": dt_raw,
        })
    return parsed_events


async def track_correios_package(
    db,
    tracking_code: str,
    cfg: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Consulta rastreamento em tempo real nos Correios SRO Rastro (com fallback Melhor Envio)."""
    code = (tracking_code or "").strip().upper().replace(" ", "")
    if not code:
        return None

    if cfg is None:
        cfg = await get_config(db)

    correios_url = f"https://rastreamento.correios.com.br/app/index.php?codigo={code}"
    env = cfg.get("correios_environment") or "producao"
    base_url = _api_base(env)

    # 1. Tenta API Oficial Correios SRO Rastro
    token = await get_correios_auth_token(db, cfg)
    if token:
        sro_url = f"{base_url}/srorastro/v1/objetos/{code}?resultado=T"
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                resp = await client.get(
                    sro_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/json",
                        "Accept-Language": "pt-BR",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    objetos = data.get("objetos") or []
                    if objetos and len(objetos) > 0:
                        obj = objetos[0]
                        evs_raw = obj.get("eventos") or []
                        if isinstance(evs_raw, list) and len(evs_raw) > 0:
                            events = _parse_sro_events(evs_raw)
                            # Verifica entrega
                            is_delivered = any(
                                ("entregue" in (e["status"] or "").lower() or (e.get("codigo") == "BDE"))
                                for e in events
                            )
                            return {
                                "tracking_code": code,
                                "carrier": "Correios",
                                "status": "delivered" if is_delivered else "shipped",
                                "delivered": is_delivered,
                                "events": events,
                                "correios_url": correios_url,
                                "source": "correios_cws",
                            }
            except Exception as e:
                logger.warning(f"Correios SRO track error for {code}: {e}")

    # 2. Fallback: Melhor Envio se configurado
    me_token = (cfg.get("shipping_melhorenvio_token") or "").strip()
    if cfg.get("shipping_enable_melhorenvio") and me_token:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                me_resp = await client.get(
                    f"https://melhorenvio.com.br/api/v2/me/shipment/tracking?orders[]={code}",
                    headers={
                        "Authorization": f"Bearer {me_token}",
                        "Accept": "application/json",
                        "User-Agent": "OxxPharma (suporte@oxxpharma.com.br)",
                    },
                )
                if me_resp.status_code == 200:
                    me_data = me_resp.json()
                    track_obj = me_data.get(code) or (list(me_data.values())[0] if me_data else None)
                    if track_obj and isinstance(track_obj.get("events"), list):
                        events = []
                        for ev in track_obj["events"]:
                            dt_obj = datetime.fromisoformat(ev.get("created_at", _now_iso()).replace("Z", "+00:00"))
                            events.append({
                                "status": ev.get("status") or "Movimentação",
                                "date": dt_obj.strftime("%d/%m/%Y"),
                                "time": dt_obj.strftime("%H:%M"),
                                "location": ev.get("location") or "Centro de Distribuição",
                                "description": ev.get("description") or ev.get("status") or "",
                                "completed": True,
                            })
                        is_deliv = track_obj.get("status") == "delivered"
                        return {
                            "tracking_code": code,
                            "carrier": track_obj.get("carrier") or "Melhor Envio",
                            "status": "delivered" if is_deliv else "shipped",
                            "delivered": is_deliv,
                            "events": events,
                            "correios_url": correios_url,
                            "source": "melhor_envio",
                        }
        except Exception as e:
            logger.warning(f"Melhor Envio tracking fallback error for {code}: {e}")

    return None


# ==============================================================================
# 3. ENDPOINT DE DIAGNOSTICO PASSO A PASSO (Admin Debug Visual)
# ==============================================================================

async def diagnose_tracking(db, tracking_code: str) -> Dict[str, Any]:
    """Executa diagnostico completo do rastreamento gerando log detalhado em ms."""
    code = (tracking_code or "").strip().upper().replace(" ", "")
    cfg = await get_config(db)
    env = cfg.get("correios_environment") or "producao"
    base_url = _api_base(env)
    
    user = (cfg.get("correios_user") or "").strip()
    passw = (cfg.get("correios_api_code") or cfg.get("correios_password") or "").strip()
    card = (cfg.get("correios_posting_card") or cfg.get("correios_contract") or "").strip()
    
    steps = []
    
    # Passo 1: Autenticacao CWS
    t0 = time.time()
    auth_header = "Basic " + base64.b64encode(f"{user}:{passw}".encode("utf-8")).decode("utf-8") if (user and passw) else "Basic N/A"
    url_auth = f"{base_url}/token/v1/autentica/cartaopostagem"
    payload_auth = {"numero": card}
    
    token = None
    auth_status = 0
    auth_resp_body = None
    
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            res_auth = await client.post(
                url_auth,
                json=payload_auth,
                headers={"Authorization": auth_header, "Content-Type": "application/json", "Accept": "application/json"},
            )
            auth_status = res_auth.status_code
            auth_resp_body = res_auth.json() if res_auth.status_code in (200, 201) else res_auth.text
            if res_auth.status_code in (200, 201) and isinstance(auth_resp_body, dict):
                token = auth_resp_body.get("token")
        except Exception as e:
            auth_resp_body = f"Erro de Conexao: {str(e)}"
            
    t1 = time.time()
    duration_auth_ms = int((t1 - t0) * 1000)

    steps.append({
        "step": 1,
        "title": "Autenticação CWS Correios",
        "endpoint": f"POST {url_auth}",
        "headers": {
            "Authorization": f"Basic {user[:4]}***:{'*'*6}" if user else "Basic (ausente)",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        "payload": payload_auth,
        "status_code": auth_status,
        "duration_ms": duration_auth_ms,
        "response_body": (
            {**auth_resp_body, "token": auth_resp_body["token"][:20] + "... [retido]"}
            if isinstance(auth_resp_body, dict) and "token" in auth_resp_body
            else auth_resp_body
        ),
        "ok": auth_status in (200, 201),
    })

    # Passo 2: Requisição SRO Rastro
    sro_status = 0
    sro_body = None
    events_parsed = []
    is_delivered = False

    if token:
        t2 = time.time()
        url_sro = f"{base_url}/srorastro/v1/objetos/{code}?resultado=T"
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                res_sro = await client.get(
                    url_sro,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/json",
                        "Accept-Language": "pt-BR",
                    },
                )
                sro_status = res_sro.status_code
                try:
                    sro_body = res_sro.json()
                except Exception:
                    sro_body = res_sro.text

                if res_sro.status_code == 200 and isinstance(sro_body, dict):
                    objs = sro_body.get("objetos") or []
                    if objs:
                        evs = objs[0].get("eventos") or []
                        events_parsed = _parse_sro_events(evs)
                        is_delivered = any(
                            ("entregue" in (e["status"] or "").lower() or e.get("codigo") == "BDE")
                            for e in events_parsed
                        )
            except Exception as e:
                sro_body = f"Erro de Conexao SRO: {str(e)}"
                
        t3 = time.time()
        duration_sro_ms = int((t3 - t2) * 1000)

        steps.append({
            "step": 2,
            "title": "Requisição SRO Rastro (Objetos)",
            "endpoint": f"GET {url_sro}",
            "headers": {
                "Authorization": f"Bearer {token[:15]}...",
                "Accept": "application/json",
                "Accept-Language": "pt-BR",
            },
            "status_code": sro_status,
            "duration_ms": duration_sro_ms,
            "response_body": sro_body,
            "parsed_events_count": len(events_parsed),
            "ok": sro_status == 200,
        })
    else:
        steps.append({
            "step": 2,
            "title": "Requisição SRO Rastro (Ignorada)",
            "endpoint": f"GET {base_url}/srorastro/v1/objetos/{code}?resultado=T",
            "status_code": 0,
            "duration_ms": 0,
            "response_body": "Não executado pois a autenticação CWS falhou (sem token).",
            "parsed_events_count": 0,
            "ok": False,
        })

    return {
        "ok": bool(events_parsed),
        "tracking_code": code,
        "carrier": "Correios",
        "status": "delivered" if is_delivered else "shipped",
        "delivered": is_delivered,
        "steps": steps,
        "events": events_parsed,
        "correios_url": f"https://rastreamento.correios.com.br/app/index.php?codigo={code}",
        "diagnosed_at": _now_iso(),
    }


# ==============================================================================
# 4. PREVENCAO RIGOROSA DE DUPLICIDADE & ENVIO DE E-MAILS
# ==============================================================================

async def check_notification_exists(db, order_id: str, event_type: str, event_date: Optional[str] = None) -> bool:
    """Verifica se um aviso de e-mail ja foi enviado para este pedido e evento."""
    q: Dict[str, Any] = {"order_id": order_id, "event_type": event_type}
    if event_type in ("unattended", "waiting_pickup") and event_date:
        q["event_date"] = event_date
    found = await db.tracking_notifications.find_one(q)
    return bool(found)


async def record_notification(db, order_id: str, tracking_code: str, event_type: str, recipient_email: str, event_date: str) -> None:
    """Registra historico de notificacao enviada (idempotencia)."""
    doc = {
        "id": _gen_id("tnot_"),
        "order_id": order_id,
        "tracking_code": tracking_code,
        "event_type": event_type,
        "recipient_email": recipient_email,
        "event_date": event_date,
        "sent_at": _now_iso(),
    }
    await db.tracking_notifications.insert_one(doc)


async def send_tracking_email_alert(db, event_type: str, order: Dict[str, Any], event_data: Dict[str, Any]) -> bool:
    """Envia o e-mail transacional estilizado conforme o tipo de evento."""
    to_email = order.get("customer_email") or (order.get("user") or {}).get("email")
    if not to_email:
        return False

    customer_name = order.get("customer_name") or "Cliente"
    raw_oid = order.get("order_id") or ""
    order_number = raw_oid[-8:].upper() if raw_oid else "—"
    tracking_code = (order.get("tracking_code") or event_data.get("tracking_code") or "").strip().upper()
    link_rastreio = f"https://rastreamento.correios.com.br/app/index.php?codigo={tracking_code}"
    
    event_date = event_data.get("date") or datetime.now(timezone.utc).strftime("%d/%m/%Y")
    event_time = event_data.get("time") or ""
    date_time_str = f"{event_date} às {event_time}" if event_time else event_date
    location = event_data.get("location") or "Unidade dos Correios"
    description = event_data.get("description") or ""

    if event_type == "delivered":
        subject = f"🎉 Seu pedido #{order_number} foi entregue com sucesso!"
        inner_html = f"""
        <div style="padding:32px 24px;font-family:Arial,sans-serif;color:#1E293B;line-height:1.6;">
            <div style="text-align:center;margin-bottom:24px;">
                <span style="font-size:48px;">🎉</span>
                <h2 style="font-size:22px;font-weight:900;color:#059669;margin:12px 0 4px 0;">Seu pacote foi entregue!</h2>
                <p style="font-size:14px;color:#64748B;margin:0;">Olá <b>{customer_name}</b>, confirmamos que o seu pedido #{order_number} foi entregue no endereço de destino.</p>
            </div>
            
            <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin-bottom:24px;font-size:13px;">
                <div style="margin-bottom:8px;"><b>Código de Rastreio:</b> <span style="font-family:monospace;font-size:14px;font-weight:bold;color:#047857;">{tracking_code}</span></div>
                <div style="margin-bottom:8px;"><b>Data e Horário:</b> {date_time_str}</div>
                <div><b>Local de Entrega:</b> {location}</div>
            </div>

            <div style="text-align:center;">
                <a href="{link_rastreio}" target="_blank" style="display:inline-block;background:#059669;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;">
                    Acompanhar no site dos Correios
                </a>
            </div>
        </div>
        """
    elif event_type == "unattended":
        subject = f"⚠️ Carteiro não atendido na entrega do pedido #{order_number}"
        inner_html = f"""
        <div style="padding:32px 24px;font-family:Arial,sans-serif;color:#1E293B;line-height:1.6;">
            <div style="text-align:center;margin-bottom:24px;">
                <span style="font-size:48px;">⚠️</span>
                <h2 style="font-size:22px;font-weight:900;color:#D97706;margin:12px 0 4px 0;">Tentativa de entrega não realizada</h2>
                <p style="font-size:14px;color:#64748B;margin:0;">Olá <b>{customer_name}</b>, os Correios tentaram entregar o seu pedido #{order_number}, mas não havia ninguém disponível no local.</p>
            </div>

            <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:12px;padding:20px;margin-bottom:24px;font-size:13px;">
                <div style="margin-bottom:8px;"><b>Código de Rastreio:</b> <span style="font-family:monospace;font-size:14px;font-weight:bold;color:#B45309;">{tracking_code}</span></div>
                <div style="margin-bottom:8px;"><b>Data da Tentativa:</b> {date_time_str}</div>
                <div><b>Local da Tentativa:</b> {location}</div>
            </div>

            <p style="font-size:13px;color:#475569;background:#F8FAFC;padding:14px;border-radius:8px;border-left:4px solid #D97706;">
                💡 <b>O que acontece agora?</b> Normalmente os Correios realizam uma nova tentativa de entrega no próximo dia útil. Recomendamos ter alguém no local para receber o pacote.
            </p>

            <div style="text-align:center;margin-top:24px;">
                <a href="{link_rastreio}" target="_blank" style="display:inline-block;background:#D97706;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;">
                    Ver Rastreamento Completo
                </a>
            </div>
        </div>
        """
    elif event_type == "waiting_pickup":
        subject = f"📍 Seu pedido #{order_number} está aguardando retirada na agência"
        inner_html = f"""
        <div style="padding:32px 24px;font-family:Arial,sans-serif;color:#1E293B;line-height:1.6;">
            <div style="text-align:center;margin-bottom:24px;">
                <span style="font-size:48px;">📍</span>
                <h2 style="font-size:22px;font-weight:900;color:#2563EB;margin:12px 0 4px 0;">Objeto disponível para retirada!</h2>
                <p style="font-size:14px;color:#64748B;margin:0;">Olá <b>{customer_name}</b>, o seu pedido #{order_number} está aguardando retirada em uma agência dos Correios.</p>
            </div>

            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;margin-bottom:24px;font-size:13px;">
                <div style="margin-bottom:8px;"><b>Código de Rastreio:</b> <span style="font-family:monospace;font-size:14px;font-weight:bold;color:#1D4ED8;">{tracking_code}</span></div>
                <div style="margin-bottom:8px;"><b>Data do Aviso:</b> {date_time_str}</div>
                <div style="margin-bottom:8px;"><b>Endereço / Agência:</b> {location}</div>
                {f'<div><b>Detalhes:</b> {description}</div>' if description else ''}
            </div>

            <p style="font-size:13px;color:#475569;background:#F8FAFC;padding:14px;border-radius:8px;border-left:4px solid #2563EB;">
                📋 <b>O que levar para retirar:</b> Documento oficial com foto (RG/CNH), número do CPF e o código de rastreamento <b>{tracking_code}</b>.
            </p>

            <div style="text-align:center;margin-top:24px;">
                <a href="{link_rastreio}" target="_blank" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;">
                    Instruções dos Correios
                </a>
            </div>
        </div>
        """
    else:
        return False

    full_html = await email_service.wrap_email_html(db, inner_html)
    res = await email_service.send_email(db, to=to_email, subject=subject, html=full_html)
    return res.get("sent", False)


# ==============================================================================
# 5. CRON / JOB AUTOMATICO DE RASTREAMENTO E MONITORAMENTO DE ENCOMENDAS
# ==============================================================================

async def run_automatic_tracking_cycle(db) -> Dict[str, Any]:
    """Varre todos os pedidos em transito ('shipped') com código de rastreio.
    Atualiza status para entregue e dispara e-mails preventivos sem duplicidade.
    """
    cfg = await get_config(db)
    if not cfg.get("shipping_tracking_enabled"):
        return {"ok": False, "reason": "tracking_disabled", "checked": 0}

    # Busca pedidos com status='shipped' e tracking_code nao vazio
    cursor = db.orders.find(
        {
            "order_status": "shipped",
            "tracking_code": {"$exists": True, "$ne": "", "$nin": [None, ""]}
        },
        {"_id": 0}
    )
    shipped_orders = await cursor.to_list(1000)

    checked_count = 0
    delivered_count = 0
    notifications_sent = 0
    details = []

    for order in shipped_orders:
        order_id = order.get("order_id")
        code = (order.get("tracking_code") or "").strip()
        if not code:
            continue

        checked_count += 1
        track_res = await track_correios_package(db, code, cfg)
        if not track_res or not track_res.get("events"):
            continue

        events = track_res["events"]
        latest_event = events[0]
        full_text = f"{latest_event.get('status', '')} {latest_event.get('description', '')}".lower()

        is_unattended = ("não atendido" in full_text or "não entregue" in full_text or "ausente" in full_text)
        is_waiting_pickup = ("aguardando retirada" in full_text or "disponível para retirada" in full_text)
        is_delivered = not is_unattended and (track_res.get("delivered") or "entregue" in full_text or latest_event.get("codigo") == "BDE")

        event_date = latest_event.get("date") or datetime.now(timezone.utc).strftime("%d/%m/%Y")

        if is_delivered:
            # 1. Caso Entregue: atualiza status no banco
            await db.orders.update_one(
                {"order_id": order_id},
                {"$set": {"order_status": "delivered", "delivered_at": _now_iso(), "updated_at": _now_iso()}}
            )
            delivered_count += 1

            already_notified = await check_notification_exists(db, order_id, "delivered")
            if not already_notified:
                sent_ok = await send_tracking_email_alert(db, "delivered", order, latest_event)
                await record_notification(db, order_id, code, "delivered", order.get("customer_email") or "", event_date)
                notifications_sent += 1
                details.append({"order_id": order_id, "code": code, "event": "delivered", "notified": sent_ok})

        elif is_unattended:
            already_notified = await check_notification_exists(db, order_id, "unattended", event_date)
            if not already_notified:
                sent_ok = await send_tracking_email_alert(db, "unattended", order, latest_event)
                await record_notification(db, order_id, code, "unattended", order.get("customer_email") or "", event_date)
                notifications_sent += 1
                details.append({"order_id": order_id, "code": code, "event": "unattended", "notified": sent_ok})

        elif is_waiting_pickup:
            already_notified = await check_notification_exists(db, order_id, "waiting_pickup", event_date)
            if not already_notified:
                sent_ok = await send_tracking_email_alert(db, "waiting_pickup", order, latest_event)
                await record_notification(db, order_id, code, "waiting_pickup", order.get("customer_email") or "", event_date)
                notifications_sent += 1
                details.append({"order_id": order_id, "code": code, "event": "waiting_pickup", "notified": sent_ok})

    # Registra timestamp da ultima execucao no settings
    now_ts = _now_iso()
    await db.settings.update_one({"_id": "global"}, {"$set": {"shipping_tracking_last_run_at": now_ts}})

    return {
        "ok": True,
        "checked": checked_count,
        "delivered_count": delivered_count,
        "notifications_sent": notifications_sent,
        "last_run_at": now_ts,
        "details": details,
    }


# ==============================================================================
# 6. COTACAO DE FRETE EM TEMPO REAL (PAC, SEDEX, Retirada)
# ==============================================================================

def _calc_package(items: List[Dict], cfg: Dict) -> Dict:
    total_w = 0.0
    max_l = cfg.get("correios_default_length_cm") or 34
    max_w = cfg.get("correios_default_width_cm") or 14
    max_h = cfg.get("correios_default_height_cm") or 24
    for it in items:
        qty = int(it.get("quantity") or 1)
        w = float(it.get("weight") or 0) or 0.3
        total_w += w * qty
        L = float(it.get("length_cm") or 0) or max_l
        W = float(it.get("width_cm") or 0) or max_w
        H = float(it.get("height_cm") or 0) or max_h
        max_l = max(max_l, L)
        max_w = max(max_w, W)
        max_h = max(max_h, H)
    total_w = max(total_w, float(cfg.get("correios_min_weight_kg") or 0.3))
    return {
        "weight_kg": round(total_w, 3),
        "length_cm": max(int(max_l), 16),
        "width_cm": max(int(max_w), 11),
        "height_cm": max(int(max_h), 2),
    }


async def calculate_freight(db, cep_destination: str, items: List[Dict], declared_value: float = 0.0) -> Dict[str, Any]:
    """Calcula frete Correios CWS + opcoes ativas."""
    cep_dest = _normalize_cep(cep_destination)
    if len(cep_dest) != 8:
        return {"options": [], "package": None, "error": "CEP destino inválido"}

    cfg = await get_config(db)
    pkg = _calc_package(items, cfg)
    options: List[Dict[str, Any]] = []

    if not cfg.get("correios_enabled"):
        return {"options": options, "package": pkg}

    cep_orig = _normalize_cep(cfg.get("correios_origin_cep") or "87033370")
    if len(cep_orig) != 8:
        return {"options": options, "package": pkg, "error": "CEP de origem não configurado"}

    # Define codigos dos servicos ativados
    services = []
    if cfg.get("shipping_enable_pac", True):
        services.append({"code": "03298", "label": "PAC"})
    if cfg.get("shipping_enable_sedex", True):
        services.append({"code": "03220", "label": "SEDEX"})

    if not services:
        return {"options": options, "package": pkg}

    token = await get_correios_auth_token(db, cfg)
    env = cfg.get("correios_environment") or "producao"
    base_url = _api_base(env)

    if token:
        weight_grams = int(round(pkg["weight_kg"] * 1000))
        posting_date = datetime.now(timezone.utc).strftime("%d-%m-%Y")

        # 1. Preco Nacional
        price_params = []
        deadline_params = []
        for idx, s in enumerate(services):
            req_id = f"{idx+1:04d}"
            price_params.append({
                "coProduto": s["code"],
                "nuRequisicao": req_id,
                "cepOrigem": cep_orig,
                "cepDestino": cep_dest,
                "psObjeto": str(weight_grams),
                "tpObjeto": "2",
                "comprimento": str(pkg["length_cm"]),
                "largura": str(pkg["width_cm"]),
                "altura": str(pkg["height_cm"]),
                "nuContrato": cfg.get("correios_contract") or "",
            })
            deadline_params.append({
                "coProduto": s["code"],
                "nuRequisicao": req_id,
                "cepOrigem": cep_orig,
                "cepDestino": cep_dest,
                "dtEvento": posting_date,
            })

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=25.0) as client:
            try:
                res_price, res_deadline = await asyncio.gather(
                    client.post(f"{base_url}/preco/v1/nacional", json={"idLote": "1", "parametrosProduto": price_params}, headers=headers),
                    client.post(f"{base_url}/prazo/v1/nacional", json={"idLote": "1", "parametrosPrazo": deadline_params}, headers=headers),
                    return_exceptions=True,
                )

                prices_map = {}
                if not isinstance(res_price, Exception) and res_price.status_code == 200:
                    p_data = res_price.json()
                    p_items = p_data if isinstance(p_data, list) else (p_data.get("parametrosProduto") or [p_data])
                    for item in p_items:
                        c = item.get("coProduto") or ""
                        val = item.get("pcFinal") or item.get("vlCobrado") or item.get("pcBase") or 0
                        try:
                            price_val = float(str(val).replace(".", "").replace(",", ".")) if isinstance(val, str) else float(val)
                        except Exception:
                            price_val = 0.0
                        prices_map[c] = price_val

                deadlines_map = {}
                if not isinstance(res_deadline, Exception) and res_deadline.status_code == 200:
                    d_data = res_deadline.json()
                    d_items = d_data if isinstance(d_data, list) else (d_data.get("parametrosPrazo") or [d_data])
                    for item in d_items:
                        c = item.get("coProduto") or ""
                        deadlines_map[c] = int(item.get("prazoEntrega") or 0)

                for s in services:
                    c = s["code"]
                    pr = prices_map.get(c, 0.0)
                    dl = deadlines_map.get(c, 0)
                    if pr > 0:
                        options.append({
                            "code": c,
                            "label": s["label"],
                            "price": pr,
                            "deadline_days": dl,
                            "carrier": "Correios",
                        })
            except Exception as e:
                logger.error(f"Erro calculo CWS frete Correios: {e}")

    # Se a API CWS falhou ou retornou zerado, pode gerar estimativa amigavel
    if not options:
        options = [
            {"code": "03298", "label": "PAC", "price": 24.90, "deadline_days": 6, "carrier": "Correios"},
            {"code": "03220", "label": "SEDEX", "price": 42.50, "deadline_days": 2, "carrier": "Correios"},
        ]

    return {"options": options, "package": pkg}
