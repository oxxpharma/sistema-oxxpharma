"""Modulo de envio de emails via Resend.

Resend API key e From sao armazenados em settings (MongoDB) e podem ser alterados
pelo admin via /backoffice/emails. Se email_enabled=False ou API key ausente, send_email
apenas loga e retorna sem erro (fallback silencioso).
"""
import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import resend

logger = logging.getLogger(__name__)


def render_template(text: str, ctx: Dict[str, Any]) -> str:
    """Substitui {{var}} e {{obj.campo}} por valores do contexto."""
    if not text:
        return ""

    def replacer(match):
        path = match.group(1).strip()
        parts = path.split(".")
        val = ctx
        for p in parts:
            if isinstance(val, dict):
                val = val.get(p)
            else:
                val = getattr(val, p, None)
            if val is None:
                break
        return "" if val is None else str(val)

    return re.sub(r"\{\{\s*([^}]+?)\s*\}\}", replacer, text)


async def get_template(db, slug: str) -> Optional[Dict]:
    return await db.email_templates.find_one({"slug": slug}, {"_id": 0})


async def send_email(db, to: List[str] | str, subject: str, html: str, text: Optional[str] = None, meta: Optional[Dict] = None) -> Dict:
    """Envia email via Resend. Tolerante a falhas: loga e retorna {sent:false, reason} em caso de erro."""
    from server import get_settings, now_iso  # evita circular
    settings = await get_settings(db)
    log_entry = {
        "log_id": f"mail_{uuid.uuid4().hex[:12]}",
        "to": [to] if isinstance(to, str) else to,
        "subject": subject,
        "created_at": now_iso(),
        "meta": meta or {},
    }

    if not settings.get("email_enabled"):
        log_entry.update({"sent": False, "reason": "emails_disabled"})
        await db.email_logs.insert_one(log_entry)
        return {"sent": False, "reason": "emails_disabled"}

    api_key = (settings.get("resend_api_key") or "").strip()
    if not api_key:
        log_entry.update({"sent": False, "reason": "no_api_key"})
        await db.email_logs.insert_one(log_entry)
        return {"sent": False, "reason": "no_api_key"}

    sender = settings.get("email_from") or "onboarding@resend.dev"
    to_list = [to] if isinstance(to, str) else list(to)
    to_list = [t for t in to_list if t]
    if not to_list:
        log_entry.update({"sent": False, "reason": "no_recipients"})
        await db.email_logs.insert_one(log_entry)
        return {"sent": False, "reason": "no_recipients"}

    params = {"from": sender, "to": to_list, "subject": subject, "html": html}
    if text:
        params["text"] = text

    try:
        resend.api_key = api_key
        result = await asyncio.to_thread(resend.Emails.send, params)
        log_entry.update({"sent": True, "email_id": (result or {}).get("id"), "from": sender})
        await db.email_logs.insert_one(log_entry)
        return {"sent": True, "email_id": (result or {}).get("id")}
    except Exception as e:
        logger.exception("Falha enviando email")
        log_entry.update({"sent": False, "reason": str(e)[:300], "from": sender})
        await db.email_logs.insert_one(log_entry)
        return {"sent": False, "reason": str(e)}


async def send_template(db, slug: str, to: List[str] | str, ctx: Dict, override_subject: Optional[str] = None, meta: Optional[Dict] = None):
    """Renderiza um template salvo no BD e envia. Se template nao existe, abort silencioso."""
    tmpl = await get_template(db, slug)
    if not tmpl or not tmpl.get("active", True):
        logger.info(f"Template '{slug}' ausente/inativo; email nao enviado")
        return {"sent": False, "reason": "template_missing"}
    subject = override_subject or render_template(tmpl.get("subject", ""), ctx)
    html = render_template(tmpl.get("body_html", ""), ctx)
    text = render_template(tmpl.get("body_text", ""), ctx) if tmpl.get("body_text") else None
    return await send_email(db, to, subject, html, text, meta={"slug": slug, **(meta or {})})


async def trigger(db, slug: str, to: List[str] | str, ctx: Dict, meta: Optional[Dict] = None):
    """Dispara um template gatilho se o trigger estiver ligado nas settings."""
    from server import get_settings
    settings = await get_settings(db)
    trigger_key = f"email_trigger_{slug}"
    if trigger_key in settings and not settings.get(trigger_key):
        return {"sent": False, "reason": "trigger_disabled"}
    return await send_template(db, slug, to, ctx, meta=meta)


# ==================== TEMPLATES DEFAULT ====================

DEFAULT_TEMPLATES = [
    {
        "slug": "welcome",
        "name": "Boas-vindas ao cliente",
        "subject": "Bem-vindo(a) a OxxPharma, {{user.name}}!",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="color:#E8731A;">Ola, {{user.name}}!</h1>
  <p>Que bom ter voce na <strong>OxxPharma</strong>. Voce ja pode navegar, comprar com entrega para todo o Brasil e ganhar <strong>8% de comissao</strong> em toda compra feita pelo seu link de indicacao.</p>
  <div style="background:#FEF3E8;border:1px solid #E8731A;border-radius:8px;padding:16px;margin:16px 0;">
    <div style="font-size:12px;color:#888;text-transform:uppercase;">Seu link de indicacao</div>
    <div style="font-family:monospace;word-break:break-all;color:#E8731A;font-weight:bold;">{{referral_link}}</div>
  </div>
  <p style="font-size:12px;color:#888;">Se voce nao criou esta conta, ignore este email.</p>
</div>""",
        "body_text": "Ola, {{user.name}}! Seu link de indicacao: {{referral_link}}",
        "active": True,
    },
    {
        "slug": "order_created",
        "name": "Pedido criado",
        "subject": "Recebemos seu pedido #{{order_short_id}}",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="color:#E8731A;">Pedido recebido!</h1>
  <p>Ola {{user.name}}, obrigado pela compra. Assim que confirmarmos o pagamento, seu pedido sera preparado para envio.</p>
  <p><strong>Numero do pedido:</strong> #{{order_short_id}}<br>
     <strong>Total:</strong> R$ {{order.total}}</p>
  <p><a href="{{order_link}}" style="background:#E8731A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Acompanhar pedido</a></p>
</div>""",
        "active": True,
    },
    {
        "slug": "order_paid",
        "name": "Pagamento confirmado",
        "subject": "Pagamento confirmado - Pedido #{{order_short_id}}",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="color:#10B981;">Pagamento confirmado</h1>
  <p>Ola {{user.name}}! Seu pedido <strong>#{{order_short_id}}</strong> foi pago. Em breve sera enviado.</p>
  <p>Nota de faturamento: <strong>{{order.invoice_number}}</strong></p>
  <p><a href="{{order_link}}" style="background:#E8731A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Ver detalhes</a></p>
</div>""",
        "active": True,
    },
    {
        "slug": "order_shipped",
        "name": "Pedido enviado",
        "subject": "Seu pedido #{{order_short_id}} foi enviado",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="color:#E8731A;">Saiu para entrega</h1>
  <p>Boas noticias, {{user.name}}! Seu pedido <strong>#{{order_short_id}}</strong> esta a caminho.</p>
  <p><a href="{{order_link}}" style="background:#E8731A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Acompanhar</a></p>
</div>""",
        "active": True,
    },
    {
        "slug": "order_delivered",
        "name": "Pedido entregue",
        "subject": "Pedido #{{order_short_id}} entregue!",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="color:#10B981;">Chegou!</h1>
  <p>{{user.name}}, seu pedido <strong>#{{order_short_id}}</strong> foi entregue. Esperamos que aproveite!</p>
  <p>Que tal indicar a OxxPharma para um amigo e <strong>ganhar 8%</strong>? <br><a href="{{referral_link}}">{{referral_link}}</a></p>
</div>""",
        "active": True,
    },
    {
        "slug": "commission_earned",
        "name": "Comissao ganha",
        "subject": "Voce ganhou R$ {{commission.amount}} em comissao!",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="color:#10B981;">Voce ganhou R$ {{commission.amount}}!</h1>
  <p>Ola {{user.name}}, boas noticias: <strong>{{customer_name}}</strong> acabou de comprar pela sua indicacao (pedido #{{order_short_id}} - R$ {{order.subtotal}}).</p>
  <p>Sua comissao ({{commission.rate_pct}}%) entra como <em>pendente</em> e liberara apos a confirmacao do pagamento do pedido.</p>
  <p><a href="{{referral_link}}" style="background:#E8731A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Ver minhas comissoes</a></p>
</div>""",
        "active": True,
    },
    {
        "slug": "admin_new_candidate",
        "name": "Admin: novo candidato a Propagandista",
        "subject": "[Admin] Novo candidato a Propagandista - {{candidate.name}}",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2>Novo candidato detectado</h2>
  <p><strong>{{candidate.name}}</strong> ({{candidate.email}}) atingiu <strong>{{candidate.referrals_in_period}}</strong> indicacoes nos ultimos {{period_days}} dias.</p>
  <p><a href="{{admin_link}}" style="background:#E8731A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Ver candidatos</a></p>
</div>""",
        "active": True,
    },
    {
        "slug": "admin_new_order",
        "name": "Admin: novo pedido",
        "subject": "[Admin] Novo pedido #{{order_short_id}} - R$ {{order.total}}",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2>Novo pedido recebido</h2>
  <p>Cliente: <strong>{{user.name}}</strong> ({{user.email}})<br>
     Total: <strong>R$ {{order.total}}</strong><br>
     Itens: {{items_count}}</p>
  <p><a href="{{admin_link}}" style="background:#E8731A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Abrir no painel</a></p>
</div>""",
        "active": True,
    },
    {
        "slug": "password_reset",
        "name": "Recuperacao de senha",
        "subject": "Recupere sua senha OxxPharma",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2>Recuperacao de senha</h2>
  <p>Ola {{user.name}}, recebemos uma solicitacao para redefinir sua senha.</p>
  <p><a href="{{reset_link}}" style="background:#E8731A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Definir nova senha</a></p>
  <p style="color:#666;font-size:12px;">O link expira em 60 minutos. Se voce nao pediu, ignore este email.</p>
</div>""",
        "active": True,
    },
    {
        "slug": "first_access",
        "name": "Primeiro acesso (importacao)",
        "subject": "Bem-vindo a OxxPharma - Crie sua senha",
        "body_html": """
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2>Bem-vindo, {{user.name}}!</h2>
  <p>Sua conta foi criada na OxxPharma. Para o primeiro acesso, defina sua senha clicando no botao abaixo:</p>
  <p><a href="{{reset_link}}" style="background:#E8731A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Criar minha senha</a></p>
  <p style="color:#666;font-size:12px;">O link expira em 7 dias.</p>
</div>""",
        "active": True,
    },
]


async def seed_default_templates(db):
    from server import now_iso
    for t in DEFAULT_TEMPLATES:
        existing = await db.email_templates.find_one({"slug": t["slug"]})
        if not existing:
            await db.email_templates.insert_one({
                "template_id": f"tpl_{uuid.uuid4().hex[:12]}",
                **t,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
