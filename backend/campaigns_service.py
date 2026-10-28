"""Modulo de Campanhas de Recompra e Pos-Venda Automatizadas.

Permite configurar campanhas baseadas em:
1. Tempo de consumo de produtos (aviso de formula acabando antes do termino estimado).
2. Dias apos a compra (solicitacao de avaliacao apos 15 dias).
3. Dias sem comprar (reativacao de clientes inativos).

Controle total no painel admin: criar, editar, pausar, testar e visualizar o historico
completo de todos os emails disparados.
"""
import uuid
import re
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends, Query

import email_service

logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_date(date_str: Any) -> Optional[datetime]:
    if not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str if date_str.tzinfo else date_str.replace(tzinfo=timezone.utc)
    try:
        # Tenta formatos ISO
        dt = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass
    try:
        dt = datetime.strptime(str(date_str)[:19], "%Y-%m-%d %H:%M:%S")
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


DEFAULT_CAMPAIGNS = [
    {
        "campaign_id": "camp_consumption_alert",
        "name": "Reposição por Tempo de Consumo (Fórmula Acabando)",
        "type": "consumption_time",
        "days_offset": 5,  # 5 dias antes de acabar o consumo do produto
        "active": True,
        "subject": "{customer_name}, seu {product_name} está acabando! Hora de repor 🌿",
        "headline": "Não interrompa seus resultados e seu tratamento",
        "body_text": (
            "Olá, {customer_name}!\n\n"
            "Notamos que de acordo com o tempo de consumo estimado, o seu {product_name} deve estar quase no fim.\n\n"
            "Para não interromper sua rotina de cuidados e manter os melhores resultados, preparamos uma reposição rápida para você.\n\n"
            "Clique no botão abaixo para garantir seu próximo frasco com envio prioritário:"
        ),
        "cta_text": "Garantir Meu Próximo Frasco",
        "coupon_code": "",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "stats": {"sent_count": 0, "last_run": None},
    },
    {
        "campaign_id": "camp_review_request",
        "name": "Solicitação de Avaliação (15 dias pós-compra)",
        "type": "days_after_purchase",
        "days_offset": 15,  # 15 dias após a compra
        "active": True,
        "subject": "Como está sua experiência com {product_name}? Deixe sua avaliação ⭐",
        "headline": "Sua opinião é muito importante para nós",
        "body_text": (
            "Olá, {customer_name}!\n\n"
            "Já se passaram 15 dias desde o recebimento do seu pedido. Como tem sido sua experiência com o {product_name}?\n\n"
            "Queremos muito ouvir sua opinião! Leva menos de 1 minuto para deixar uma avaliação rápida e ajudar outras pessoas que buscam mais saúde e bem-estar."
        ),
        "cta_text": "Avaliar Meu Produto",
        "coupon_code": "",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "stats": {"sent_count": 0, "last_run": None},
    },
    {
        "campaign_id": "camp_inactive_winback",
        "name": "Reativação de Clientes (60 dias sem comprar)",
        "type": "inactive_customer",
        "days_offset": 60,  # 60 dias sem pedidos
        "active": True,
        "subject": "{customer_name}, sentimos sua falta! Presente exclusivo para você 🎁",
        "headline": "Faz tempo que não cuidamos de você",
        "body_text": (
            "Olá, {customer_name}!\n\n"
            "Faz mais de 60 dias desde seu último pedido na OxxPharma e sentimos sua falta na nossa comunidade!\n\n"
            "Para te incentivar a retomar seus cuidados com a sua saúde e vitalidade, liberamos um cupom especial de 10% de desconto na sua próxima compra: {coupon_code}."
        ),
        "cta_text": "Aproveitar Meu Desconto",
        "coupon_code": "VOLTEI10",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "stats": {"sent_count": 0, "last_run": None},
    },
]


async def ensure_default_campaigns(db):
    """Garante que as campanhas padrão existam no banco."""
    count = await db.email_campaigns.count_documents({})
    if count == 0:
        for c in DEFAULT_CAMPAIGNS:
            doc = dict(c)
            doc["created_at"] = now_iso()
            doc["updated_at"] = now_iso()
            await db.email_campaigns.insert_one(doc)


def render_campaign_email_html(
    headline: str,
    body_text: str,
    cta_text: str,
    cta_url: str,
    coupon_code: Optional[str] = None,
    product_image: Optional[str] = None,
) -> str:
    """Gera o HTML interno do email com visual elegante e responsivo."""
    paragraphs = [p.strip() for p in body_text.split("\n\n") if p.strip()]
    paragraphs_html = "".join(
        f'<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;margin:0 0 16px 0;">{p.replace(chr(10), "<br>")}</p>'
        for p in paragraphs
    )

    coupon_block = ""
    if coupon_code:
        coupon_block = f"""
        <div style="background:#FFF8F0;border:2px dashed #E8731A;border-radius:10px;padding:16px;text-align:center;margin:24px 0;">
          <div style="font-size:12px;font-family:Arial,sans-serif;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:bold;margin-bottom:6px;">Cupom de Desconto Exclusivo</div>
          <div style="font-size:24px;font-family:Arial,sans-serif;font-weight:900;color:#E8731A;letter-spacing:2px;">{coupon_code}</div>
        </div>
        """

    img_block = ""
    if product_image:
        img_block = f"""
        <div style="text-align:center;margin:20px 0;">
          <img src="{product_image}" alt="" style="max-height:180px;max-width:240px;object-fit:contain;border-radius:8px;" />
        </div>
        """

    return f"""
    <div style="padding:28px 24px;">
      <h1 style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#111;margin:0 0 20px 0;line-height:1.3;">
        {headline}
      </h1>
      {img_block}
      {paragraphs_html}
      {coupon_block}
      <div style="text-align:center;margin:32px 0 16px 0;">
        <a href="{cta_url}" style="background:#E8731A;color:#FFFFFF;font-family:Arial,sans-serif;font-weight:bold;font-size:16px;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;box-shadow:0 2px 8px rgba(232,115,26,0.3);">
          {cta_text}
        </a>
      </div>
    </div>
    """


async def run_all_campaigns(db) -> Dict[str, Any]:
    """Varre os pedidos e clientes para disparar as campanhas ativas aplicáveis."""
    await ensure_default_campaigns(db)

    campaigns = await db.email_campaigns.find({"active": True}, {"_id": 0}).to_list(100)
    now = datetime.now(timezone.utc)
    total_dispatched = 0
    errors = []

    app_url = os.environ.get("APP_URL") or os.environ.get("FRONTEND_URL") or "https://oxxpharma.com"
    app_url = app_url.rstrip("/")

    for camp in campaigns:
        camp_id = camp["campaign_id"]
        camp_type = camp.get("type")
        days_offset = int(camp.get("days_offset") or 0)
        dispatched_for_this_camp = 0

        # =========================================================================
        # 1. TEMPO DE CONSUMO: dias antes do fim estimado do frasco
        # =========================================================================
        if camp_type == "consumption_time":
            # Pedidos pagos/concluidos
            orders = await db.orders.find(
                {"status": {"$in": ["paid", "delivered", "shipped", "completed"]}},
                {"_id": 0, "order_id": 1, "items": 1, "customer_name": 1, "customer_email": 1, "created_at": 1, "paid_at": 1, "shipping_address": 1}
            ).sort("created_at", -1).limit(500).to_list(500)

            for ord_data in orders:
                ord_id = ord_data["order_id"]
                c_email = (ord_data.get("customer_email") or "").strip()
                if not c_email:
                    continue
                c_name = ord_data.get("customer_name") or ord_data.get("shipping_address", {}).get("name") or "Cliente"
                first_name = c_name.split()[0] if c_name else "Cliente"

                ord_dt = parse_date(ord_data.get("paid_at") or ord_data.get("created_at"))
                if not ord_dt:
                    continue

                for it in ord_data.get("items") or []:
                    pid = it.get("product_id")
                    p_name = it.get("name") or it.get("product_name") or "Produto"
                    qty = int(it.get("quantity") or 1)

                    # Busca tempo de consumo do produto
                    p_doc = await db.products.find_one({"product_id": pid}, {"_id": 0, "consumption_days": 1, "images": 1, "slug": 1, "name": 1})
                    c_days = (p_doc.get("consumption_days") if p_doc else None) or 30
                    if not c_days or c_days <= 0:
                        continue

                    # Total de dias cobertos pela compra
                    total_supply_days = c_days * qty
                    depletion_date = ord_dt + timedelta(days=total_supply_days)
                    notify_date = depletion_date - timedelta(days=days_offset)

                    # Janela de envio: a partir da data de aviso ate no maximo 10 dias apos acabar
                    if notify_date <= now <= (depletion_date + timedelta(days=10)):
                        # Verifica se ja enviou para este pedido + produto nesta campanha
                        already = await db.campaign_email_logs.find_one({
                            "campaign_id": camp_id,
                            "order_id": ord_id,
                            "product_id": pid,
                            "status": "sent"
                        })
                        if already:
                            continue

                        # Prepara o conteudo
                        p_slug = (p_doc.get("slug") if p_doc else None) or pid
                        product_url = f"{app_url}/produto/{p_slug}"
                        p_img = ((p_doc.get("images") or []) if p_doc else [None])[0]

                        subject = (camp.get("subject") or "").replace("{customer_name}", first_name).replace("{product_name}", p_name).replace("{store_name}", "OxxPharma")
                        headline = (camp.get("headline") or "").replace("{customer_name}", first_name).replace("{product_name}", p_name)
                        body_txt = (camp.get("body_text") or "").replace("{customer_name}", first_name).replace("{product_name}", p_name).replace("{store_name}", "OxxPharma")
                        cta_text = camp.get("cta_text") or "Garantir Próximo Frasco"

                        inner_html = render_campaign_email_html(
                            headline=headline,
                            body_text=body_txt,
                            cta_text=cta_text,
                            cta_url=product_url,
                            coupon_code=camp.get("coupon_code"),
                            product_image=p_img,
                        )
                        full_html = await email_service.wrap_email_html(db, inner_html)

                        res = await email_service.send_email(
                            db,
                            to=c_email,
                            subject=subject,
                            html=full_html,
                            meta={"campaign_id": camp_id, "order_id": ord_id, "product_id": pid}
                        )

                        log_entry = {
                            "log_id": f"cmlog_{uuid.uuid4().hex[:12]}",
                            "campaign_id": camp_id,
                            "campaign_name": camp.get("name"),
                            "order_id": ord_id,
                            "product_id": pid,
                            "product_name": p_name,
                            "customer_name": c_name,
                            "customer_email": c_email,
                            "subject": subject,
                            "sent_at": now_iso(),
                            "status": "sent" if res.get("sent") else "failed",
                            "reason": res.get("reason"),
                        }
                        await db.campaign_email_logs.insert_one(log_entry)

                        if res.get("sent"):
                            dispatched_for_this_camp += 1
                            total_dispatched += 1

        # =========================================================================
        # 2. DIAS APOS A COMPRA (Ex: 15 dias -> solicitacao de avaliacao)
        # =========================================================================
        elif camp_type == "days_after_purchase":
            orders = await db.orders.find(
                {"status": {"$in": ["paid", "delivered", "shipped", "completed"]}},
                {"_id": 0, "order_id": 1, "items": 1, "customer_name": 1, "customer_email": 1, "created_at": 1, "paid_at": 1, "shipping_address": 1}
            ).sort("created_at", -1).limit(500).to_list(500)

            for ord_data in orders:
                ord_id = ord_data["order_id"]
                c_email = (ord_data.get("customer_email") or "").strip()
                if not c_email:
                    continue
                c_name = ord_data.get("customer_name") or ord_data.get("shipping_address", {}).get("name") or "Cliente"
                first_name = c_name.split()[0] if c_name else "Cliente"

                ord_dt = parse_date(ord_data.get("paid_at") or ord_data.get("created_at"))
                if not ord_dt:
                    continue

                trigger_date = ord_dt + timedelta(days=days_offset)
                # Janela de envio: a partir de trigger_date ate no maximo 15 dias depois
                if trigger_date <= now <= (trigger_date + timedelta(days=15)):
                    already = await db.campaign_email_logs.find_one({
                        "campaign_id": camp_id,
                        "order_id": ord_id,
                        "status": "sent"
                    })
                    if already:
                        continue

                    items = ord_data.get("items") or []
                    first_item_name = (items[0].get("name") if items else None) or "sua compra"
                    review_url = f"{app_url}/avaliar/{ord_id}"

                    subject = (camp.get("subject") or "").replace("{customer_name}", first_name).replace("{product_name}", first_item_name).replace("{store_name}", "OxxPharma")
                    headline = (camp.get("headline") or "").replace("{customer_name}", first_name).replace("{product_name}", first_item_name)
                    body_txt = (camp.get("body_text") or "").replace("{customer_name}", first_name).replace("{product_name}", first_item_name).replace("{store_name}", "OxxPharma")
                    cta_text = camp.get("cta_text") or "Avaliar Meu Produto"

                    inner_html = render_campaign_email_html(
                        headline=headline,
                        body_text=body_txt,
                        cta_text=cta_text,
                        cta_url=review_url,
                        coupon_code=camp.get("coupon_code"),
                    )
                    full_html = await email_service.wrap_email_html(db, inner_html)

                    res = await email_service.send_email(
                        db,
                        to=c_email,
                        subject=subject,
                        html=full_html,
                        meta={"campaign_id": camp_id, "order_id": ord_id}
                    )

                    log_entry = {
                        "log_id": f"cmlog_{uuid.uuid4().hex[:12]}",
                        "campaign_id": camp_id,
                        "campaign_name": camp.get("name"),
                        "order_id": ord_id,
                        "product_name": first_item_name,
                        "customer_name": c_name,
                        "customer_email": c_email,
                        "subject": subject,
                        "sent_at": now_iso(),
                        "status": "sent" if res.get("sent") else "failed",
                        "reason": res.get("reason"),
                    }
                    await db.campaign_email_logs.insert_one(log_entry)

                    if res.get("sent"):
                        dispatched_for_this_camp += 1
                        total_dispatched += 1

        # =========================================================================
        # 3. CLIENTE INATIVO (Ex: 60 dias sem comprar)
        # =========================================================================
        elif camp_type == "inactive_customer":
            users = await db.users.find({"role": "customer"}, {"_id": 0, "user_id": 1, "name": 1, "email": 1}).to_list(1000)
            threshold_date = now - timedelta(days=days_offset)

            for u in users:
                u_email = (u.get("email") or "").strip()
                if not u_email:
                    continue
                u_name = u.get("name") or "Cliente"
                first_name = u_name.split()[0] if u_name else "Cliente"

                # Verifica data do ultimo pedido pago
                last_order = await db.orders.find_one(
                    {"user_id": u.get("user_id"), "status": {"$in": ["paid", "delivered", "completed"]}},
                    {"_id": 0, "created_at": 1, "paid_at": 1},
                    sort=[("created_at", -1)]
                )
                if not last_order:
                    continue

                last_dt = parse_date(last_order.get("paid_at") or last_order.get("created_at"))
                if not last_dt or last_dt > threshold_date:
                    continue

                # Evita enviar mais de uma vez a cada 45 dias
                recent_sent = await db.campaign_email_logs.find_one({
                    "campaign_id": camp_id,
                    "customer_email": u_email,
                    "status": "sent",
                    "sent_at": {"$gte": (now - timedelta(days=45)).isoformat()}
                })
                if recent_sent:
                    continue

                subject = (camp.get("subject") or "").replace("{customer_name}", first_name).replace("{store_name}", "OxxPharma")
                headline = (camp.get("headline") or "").replace("{customer_name}", first_name)
                body_txt = (camp.get("body_text") or "").replace("{customer_name}", first_name).replace("{coupon_code}", camp.get("coupon_code") or "").replace("{store_name}", "OxxPharma")
                cta_text = camp.get("cta_text") or "Aproveitar Meu Desconto"

                inner_html = render_campaign_email_html(
                    headline=headline,
                    body_text=body_txt,
                    cta_text=cta_text,
                    cta_url=app_url,
                    coupon_code=camp.get("coupon_code"),
                )
                full_html = await email_service.wrap_email_html(db, inner_html)

                res = await email_service.send_email(
                    db,
                    to=u_email,
                    subject=subject,
                    html=full_html,
                    meta={"campaign_id": camp_id, "user_id": u.get("user_id")}
                )

                log_entry = {
                    "log_id": f"cmlog_{uuid.uuid4().hex[:12]}",
                    "campaign_id": camp_id,
                    "campaign_name": camp.get("name"),
                    "customer_name": u_name,
                    "customer_email": u_email,
                    "subject": subject,
                    "sent_at": now_iso(),
                    "status": "sent" if res.get("sent") else "failed",
                    "reason": res.get("reason"),
                }
                await db.campaign_email_logs.insert_one(log_entry)

                if res.get("sent"):
                    dispatched_for_this_camp += 1
                    total_dispatched += 1

        # Atualiza contadores da campanha
        await db.email_campaigns.update_one(
            {"campaign_id": camp_id},
            {
                "$inc": {"stats.sent_count": dispatched_for_this_camp},
                "$set": {"stats.last_run": now_iso(), "updated_at": now_iso()}
            }
        )

    return {
        "ok": True,
        "total_dispatched": total_dispatched,
        "checked_at": now_iso(),
        "message": f"Execução concluída. {total_dispatched} emails disparados." if total_dispatched > 0 else "Nenhum novo disparo pendente no momento."
    }


def register_campaigns_routes(app, deps: Dict[str, Any]):
    router = APIRouter(prefix="/api/admin/campaigns", tags=["Campanhas de Email"])
    require_admin = deps["require_admin"]

    @router.get("")
    async def list_campaigns(request: Request, user: dict = Depends(require_admin())):
        db = request.app.db
        await ensure_default_campaigns(db)

        campaigns = await db.email_campaigns.find({}, {"_id": 0}).sort("created_at", 1).to_list(100)
        total_logs = await db.campaign_email_logs.count_documents({})
        sent_logs = await db.campaign_email_logs.count_documents({"status": "sent"})

        return {
            "campaigns": campaigns,
            "stats": {
                "total_campaigns": len(campaigns),
                "active_campaigns": sum(1 for c in campaigns if c.get("active")),
                "total_emails_sent": sent_logs,
                "total_attempts": total_logs,
            }
        }

    @router.post("")
    async def create_campaign(request: Request, user: dict = Depends(require_admin())):
        db = request.app.db
        body = await request.json()

        name = (body.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Nome da campanha é obrigatório")

        c_type = body.get("type") or "consumption_time"
        if c_type not in ("consumption_time", "days_after_purchase", "inactive_customer"):
            raise HTTPException(status_code=400, detail="Tipo de campanha inválido")

        camp_id = f"camp_{uuid.uuid4().hex[:10]}"
        doc = {
            "campaign_id": camp_id,
            "name": name,
            "type": c_type,
            "days_offset": int(body.get("days_offset") or 5),
            "active": bool(body.get("active", True)),
            "subject": body.get("subject") or "Novidades para você!",
            "headline": body.get("headline") or "Cuidado e bem-estar contínuos",
            "body_text": body.get("body_text") or "",
            "cta_text": body.get("cta_text") or "Acessar Loja",
            "coupon_code": (body.get("coupon_code") or "").strip().upper(),
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "stats": {"sent_count": 0, "last_run": None},
        }

        await db.email_campaigns.insert_one(doc)
        doc.pop("_id", None)
        return {"ok": True, "campaign": doc}

    @router.put("/{campaign_id}")
    async def update_campaign(request: Request, campaign_id: str, user: dict = Depends(require_admin())):
        db = request.app.db
        body = await request.json()

        update_fields = {}
        for k in ("name", "type", "days_offset", "active", "subject", "headline", "body_text", "cta_text", "coupon_code"):
            if k in body:
                if k == "days_offset":
                    update_fields[k] = int(body[k])
                elif k == "active":
                    update_fields[k] = bool(body[k])
                elif k == "coupon_code":
                    update_fields[k] = (body[k] or "").strip().upper()
                else:
                    update_fields[k] = body[k]

        update_fields["updated_at"] = now_iso()

        res = await db.email_campaigns.update_one({"campaign_id": campaign_id}, {"$set": update_fields})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Campanha não encontrada")

        updated = await db.email_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
        return {"ok": True, "campaign": updated}

    @router.delete("/{campaign_id}")
    async def delete_campaign(request: Request, campaign_id: str, user: dict = Depends(require_admin())):
        db = request.app.db
        res = await db.email_campaigns.delete_one({"campaign_id": campaign_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Campanha não encontrada")
        return {"ok": True, "deleted": campaign_id}

    @router.post("/{campaign_id}/test")
    async def send_test_campaign_email(
        request: Request,
        campaign_id: str,
        user: dict = Depends(require_admin()),
    ):
        """Envia um email de teste da campanha para o endereço fornecido pelo admin."""
        db = request.app.db
        body = await request.json()
        target_email = (body.get("email") or user.get("email") or "").strip()
        if not target_email or "@" not in target_email:
            raise HTTPException(status_code=400, detail="Informe um endereço de e-mail válido para o teste")

        camp = await db.email_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
        if not camp:
            raise HTTPException(status_code=404, detail="Campanha não encontrada")

        app_url = os.environ.get("APP_URL") or os.environ.get("FRONTEND_URL") or "https://oxxpharma.com"
        app_url = app_url.rstrip("/")

        # Amostra de produto para o teste
        sample_prod = await db.products.find_one({"active": True}, {"_id": 0, "name": 1, "images": 1, "slug": 1})
        sample_pname = (sample_prod.get("name") if sample_prod else None) or "Ozoxx SPA Corpo 60ml"
        sample_slug = (sample_prod.get("slug") if sample_prod else None) or "produto-exemplo"
        sample_img = ((sample_prod.get("images") or []) if sample_prod else [None])[0]

        subject = (camp.get("subject") or "").replace("{customer_name}", "Cliente (Teste)").replace("{product_name}", sample_pname).replace("{store_name}", "OxxPharma")
        headline = (camp.get("headline") or "").replace("{customer_name}", "Cliente (Teste)").replace("{product_name}", sample_pname)
        body_txt = (camp.get("body_text") or "").replace("{customer_name}", "Cliente (Teste)").replace("{product_name}", sample_pname).replace("{coupon_code}", camp.get("coupon_code") or "PROMO10").replace("{store_name}", "OxxPharma")

        if camp.get("type") == "days_after_purchase":
            cta_url = f"{app_url}/avaliar/EXEMPLO-12345"
        elif camp.get("type") == "consumption_time":
            cta_url = f"{app_url}/produto/{sample_slug}"
        else:
            cta_url = app_url

        inner_html = render_campaign_email_html(
            headline=headline,
            body_text=body_txt,
            cta_text=camp.get("cta_text") or "Acessar Loja",
            cta_url=cta_url,
            coupon_code=camp.get("coupon_code"),
            product_image=sample_img if camp.get("type") == "consumption_time" else None,
        )
        full_html = await email_service.wrap_email_html(db, inner_html)

        res = await email_service.send_email(
            db,
            to=target_email,
            subject=f"[TESTE] {subject}",
            html=full_html,
            meta={"is_test": True, "campaign_id": campaign_id}
        )

        if not res.get("sent"):
            reason = res.get("reason")
            raise HTTPException(status_code=400, detail=f"Falha ao enviar email de teste ({reason}). Verifique a chave de API do Resend em Configurações.")

        return {
            "ok": True,
            "message": f"Email de teste enviado com sucesso para {target_email}!"
        }

    @router.post("/run")
    async def execute_campaigns_now(request: Request, user: dict = Depends(require_admin())):
        """Dispara a execução imediata das campanhas."""
        db = request.app.db
        result = await run_all_campaigns(db)
        return result

    @router.get("/logs")
    async def list_campaign_logs(
        request: Request,
        campaign_id: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 40,
        user: dict = Depends(require_admin()),
    ):
        db = request.app.db
        q = {}
        if campaign_id and campaign_id != "all":
            q["campaign_id"] = campaign_id
        if search:
            s_reg = {"$regex": re.escape(search.strip()), "$options": "i"}
            q["$or"] = [
                {"customer_name": s_reg},
                {"customer_email": s_reg},
                {"product_name": s_reg},
                {"subject": s_reg},
            ]

        total = await db.campaign_email_logs.count_documents(q)
        logs = await db.campaign_email_logs.find(q, {"_id": 0}).sort("sent_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)

        return {
            "logs": logs,
            "total": total,
            "page": page,
            "pages": max(1, (total + limit - 1) // limit),
        }

    app.include_router(router)
