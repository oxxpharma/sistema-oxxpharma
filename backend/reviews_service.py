"""Modulo de Avaliacoes (Reviews) de Produtos.

Permite que clientes avaliem produtos com 1 a 5 estrelas e um comentario de texto.
As avaliacoes passam por moderacao no painel administrativo antes de serem publicadas na loja.
Suporta verificacao de compra a partir de pedidos realizados.
"""
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends, Query


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def register_reviews_routes(app, deps: Dict[str, Any]):
    router = APIRouter(tags=["Reviews"])
    get_optional_user = deps["get_optional_user"]
    require_admin = deps["require_admin"]

    @router.get("/api/products/{product_id}/reviews")
    async def get_product_reviews(request: Request, product_id: str):
        db = request.app.db
        # Procura tanto por ID quanto por slug para compatibilidade
        prod = await db.products.find_one({"$or": [{"product_id": product_id}, {"slug": product_id}]}, {"_id": 0, "product_id": 1, "name": 1})
        real_id = prod["product_id"] if prod else product_id

        # Busca apenas aprovadas
        reviews = await db.reviews.find(
            {"product_id": real_id, "status": "approved"},
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(100)

        total = len(reviews)
        if total > 0:
            avg = round(sum(r.get("rating", 5) for r in reviews) / total, 1)
        else:
            avg = 5.0

        return {
            "reviews": reviews,
            "average": avg,
            "count": total,
        }

    @router.post("/api/products/{product_id}/reviews")
    async def create_product_review(request: Request, product_id: str):
        db = request.app.db
        body = await request.json()

        rating = int(body.get("rating") or 5)
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail="A avaliação deve ser entre 1 e 5 estrelas")

        comment = (body.get("comment") or "").strip()
        if not comment or len(comment) < 3:
            raise HTTPException(status_code=400, detail="Escreva um breve comentário sobre o produto")
        if len(comment) > 1500:
            raise HTTPException(status_code=400, detail="Comentário muito longo (máximo 1500 caracteres)")

        prod = await db.products.find_one({"$or": [{"product_id": product_id}, {"slug": product_id}]}, {"_id": 0, "product_id": 1, "name": 1})
        if not prod:
            raise HTTPException(status_code=404, detail="Produto não encontrado")

        real_pid = prod["product_id"]
        prod_name = prod.get("name") or "Produto"

        user = await get_optional_user(request)
        user_name = (body.get("user_name") or (user.get("name") if user else "") or "").strip()
        user_email = (body.get("user_email") or (user.get("email") if user else "") or "").strip()

        if not user_name:
            raise HTTPException(status_code=400, detail="Informe seu nome para a avaliação")

        order_id = body.get("order_id")
        verified_purchase = False

        if order_id:
            order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "items": 1, "status": 1})
            if order and any(it.get("product_id") == real_pid for it in (order.get("items") or [])):
                verified_purchase = True
        elif user and user.get("user_id"):
            has_order = await db.orders.find_one(
                {"user_id": user["user_id"], "status": {"$in": ["paid", "delivered", "shipped", "completed"]}, "items.product_id": real_pid},
                {"_id": 0, "order_id": 1}
            )
            if has_order:
                verified_purchase = True

        review_id = f"rev_{uuid.uuid4().hex[:12]}"
        review_doc = {
            "review_id": review_id,
            "product_id": real_pid,
            "product_name": prod_name,
            "user_id": user.get("user_id") if user else None,
            "user_name": user_name,
            "user_email": user_email,
            "rating": rating,
            "comment": comment,
            "order_id": order_id,
            "verified_purchase": verified_purchase,
            "status": "pending",  # Requer aprovação do admin
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }

        await db.reviews.insert_one(review_doc)

        return {
            "ok": True,
            "review_id": review_id,
            "message": "Avaliação enviada com sucesso! Ela ficará visível na loja após a aprovação do moderador."
        }

    @router.get("/api/reviews/order/{order_id}")
    async def get_order_review_info(request: Request, order_id: str):
        """Retorna os produtos de um pedido para a tela de avaliacao via link do email."""
        db = request.app.db
        order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")

        items = order.get("items") or []
        enriched_items = []
        for it in items:
            pid = it.get("product_id")
            prod = await db.products.find_one({"product_id": pid}, {"_id": 0, "name": 1, "images": 1, "slug": 1})
            enriched_items.append({
                "product_id": pid,
                "name": (prod.get("name") if prod else None) or it.get("name") or it.get("product_name"),
                "image": (prod.get("images") or [None])[0] if prod else None,
                "slug": prod.get("slug") if prod else None,
            })

        user_name = order.get("customer_name") or order.get("shipping_address", {}).get("name") or ""
        user_email = order.get("customer_email") or ""

        return {
            "order_id": order_id,
            "customer_name": user_name,
            "customer_email": user_email,
            "items": enriched_items,
        }

    # ==================== ADMIN ROUTES ====================

    @router.get("/api/admin/reviews")
    async def admin_list_reviews(
        request: Request,
        status: Optional[str] = "all",
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 30,
        user: dict = Depends(require_admin()),
    ):
        db = request.app.db
        q = {}
        if status and status != "all":
            q["status"] = status
        if search:
            s_regex = {"$regex": re.escape(search.strip()), "$options": "i"}
            q["$or"] = [
                {"product_name": s_regex},
                {"user_name": s_regex},
                {"user_email": s_regex},
                {"comment": s_regex},
            ]

        total = await db.reviews.count_documents(q)
        pending_count = await db.reviews.count_documents({"status": "pending"})
        approved_count = await db.reviews.count_documents({"status": "approved"})
        rejected_count = await db.reviews.count_documents({"status": "rejected"})

        reviews = await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)

        return {
            "reviews": reviews,
            "total": total,
            "pending_count": pending_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "page": page,
            "pages": max(1, (total + limit - 1) // limit),
        }

    @router.put("/api/admin/reviews/{review_id}/status")
    async def admin_update_review_status(
        request: Request,
        review_id: str,
        user: dict = Depends(require_admin()),
    ):
        db = request.app.db
        body = await request.json()
        new_status = body.get("status")
        if new_status not in ("approved", "rejected", "pending"):
            raise HTTPException(status_code=400, detail="Status inválido")

        res = await db.reviews.update_one(
            {"review_id": review_id},
            {"$set": {"status": new_status, "moderated_by": user.get("email"), "updated_at": now_iso()}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Avaliação não encontrada")

        return {"ok": True, "review_id": review_id, "status": new_status}

    @router.delete("/api/admin/reviews/{review_id}")
    async def admin_delete_review(
        request: Request,
        review_id: str,
        user: dict = Depends(require_admin()),
    ):
        db = request.app.db
        res = await db.reviews.delete_one({"review_id": review_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Avaliação não encontrada")
        return {"ok": True, "deleted": review_id}

    app.include_router(router)
