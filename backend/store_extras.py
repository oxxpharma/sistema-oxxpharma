"""
OxxPharma - Categorias de usuário + Cupons + Pricing tiers por contexto.

Modela e expõe APIs para:
1) user_categories: tags atribuíveis a usuários (multi). Coleção `user_categories`.
2) coupons: cupons de desconto. Coleção `coupons`.
3) pricing tiers: preços diferenciados por contexto (guest/logged/category) - campo
   `pricing_tiers` direto no produto (lista de regras).

A função `effective_price(product, user)` resolve o preço final.
"""
from __future__ import annotations
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from pydantic import BaseModel


# ==================== UTILS ====================

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def _slugify(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "categoria"


# ==================== MODELS (pydantic) ====================

class UserCategoryIn(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#E8731A"


class CouponIn(BaseModel):
    code: str
    type: str  # 'percent' | 'fixed'
    value: float
    min_subtotal: float = 0.0
    max_discount: Optional[float] = None  # cap para % (ex: 30% mas no maximo R$50)
    valid_from: Optional[str] = None  # ISO date
    valid_until: Optional[str] = None  # ISO date
    usage_limit: Optional[int] = None  # total de usos
    per_user_limit: Optional[int] = None  # por usuario
    requires_login: bool = False
    applicable_user_categories: List[str] = []  # category_ids; vazio = todos
    description: Optional[str] = ""
    active: bool = True


class PricingTierIn(BaseModel):
    type: str  # 'guest' | 'logged' | 'category'
    user_category_id: Optional[str] = None  # obrigatorio se type=='category'
    price: float
    label: Optional[str] = ""


# ==================== USER CATEGORIES ====================

async def list_user_categories(db) -> List[Dict[str, Any]]:
    cursor = db.user_categories.find({}, {"_id": 0}).sort("name", 1)
    return [c async for c in cursor]


async def create_user_category(db, payload: UserCategoryIn) -> Dict[str, Any]:
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nome obrigatório")
    slug = _slugify(name)
    if await db.user_categories.find_one({"slug": slug}):
        raise HTTPException(400, "Já existe uma categoria com esse nome")
    doc = {
        "category_id": _gen_id("ucat_"),
        "name": name,
        "slug": slug,
        "description": (payload.description or "").strip(),
        "color": (payload.color or "#E8731A").strip(),
        "created_at": _now_iso(),
    }
    await db.user_categories.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


async def update_user_category(db, category_id: str, payload: UserCategoryIn) -> Dict[str, Any]:
    cur = await db.user_categories.find_one({"category_id": category_id})
    if not cur:
        raise HTTPException(404, "Categoria não encontrada")
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Nome obrigatório")
    slug = _slugify(name)
    other = await db.user_categories.find_one({"slug": slug, "category_id": {"$ne": category_id}})
    if other:
        raise HTTPException(400, "Já existe uma categoria com esse nome")
    update = {
        "name": name,
        "slug": slug,
        "description": (payload.description or "").strip(),
        "color": (payload.color or "#E8731A").strip(),
        "updated_at": _now_iso(),
    }
    await db.user_categories.update_one({"category_id": category_id}, {"$set": update})
    out = await db.user_categories.find_one({"category_id": category_id}, {"_id": 0})
    return out


async def delete_user_category(db, category_id: str) -> Dict[str, Any]:
    res = await db.user_categories.delete_one({"category_id": category_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Categoria não encontrada")
    # remove do array em users
    await db.users.update_many(
        {"category_ids": category_id},
        {"$pull": {"category_ids": category_id}},
    )
    # remove de pricing_tiers de produtos
    await db.products.update_many(
        {"pricing_tiers.user_category_id": category_id},
        {"$pull": {"pricing_tiers": {"user_category_id": category_id}}},
    )
    return {"ok": True}


async def set_user_categories(db, user_id: str, category_ids: List[str]) -> Dict[str, Any]:
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(404, "Usuário não encontrado")
    # valida ids
    if category_ids:
        valid = await db.user_categories.find(
            {"category_id": {"$in": category_ids}}, {"category_id": 1, "_id": 0}
        ).to_list(length=None)
        valid_ids = {v["category_id"] for v in valid}
        category_ids = [c for c in category_ids if c in valid_ids]
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"category_ids": category_ids, "updated_at": _now_iso()}},
    )
    return {"user_id": user_id, "category_ids": category_ids}


# ==================== PRICING TIERS ====================

def effective_price(product: Dict[str, Any], user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Calcula o preço efetivo aplicado a um produto dado o usuario.

    Retorna {price, original_price, applied_tier|None}
      - price: valor a cobrar
      - original_price: preco base (sem tier; usa discount_price se houver)
      - applied_tier: copia da tier aplicada (None se nao tiver)
    """
    base_price = float(product.get("price") or 0)
    disc = product.get("discount_price")
    base_effective = float(disc) if (disc is not None and float(disc) > 0) else base_price

    tiers = product.get("pricing_tiers") or []
    if not tiers:
        return {"price": base_effective, "original_price": base_effective, "applied_tier": None}

    is_logged = bool(user)
    user_cat_ids = set(user.get("category_ids") or []) if user else set()
    user_network = (user.get("network_type") or "customer") if user else None  # None para guest
    user_has_referral = bool(user and user.get("referral_program_active"))
    candidates: List[Dict[str, Any]] = []

    for t in tiers:
        ttype = (t.get("type") or "").lower()
        try:
            tprice = float(t.get("price"))
        except (TypeError, ValueError):
            continue
        if tprice <= 0:
            continue
        if ttype == "guest" and not is_logged:
            candidates.append({**t, "price": tprice})
        elif ttype == "logged" and is_logged:
            candidates.append({**t, "price": tprice})
        elif ttype == "category" and is_logged and t.get("user_category_id") in user_cat_ids:
            candidates.append({**t, "price": tprice})
        elif ttype == "network" and is_logged and t.get("network_type") == user_network:
            candidates.append({**t, "price": tprice})
        elif ttype == "referral_active" and user_has_referral:
            candidates.append({**t, "price": tprice})

    if not candidates:
        return {"price": base_effective, "original_price": base_effective, "applied_tier": None}

    # menor preço entre os candidatos válidos
    best = min(candidates, key=lambda c: c["price"])
    return {
        "price": float(best["price"]),
        "original_price": base_effective,
        "applied_tier": {
            "type": best.get("type"),
            "user_category_id": best.get("user_category_id"),
            "network_type": best.get("network_type"),
            "label": best.get("label") or "",
            "price": best["price"],
        },
    }


def apply_pricing_to_product(product: Dict[str, Any], user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Decora o produto com 'effective_price' e 'tier_applied' sem mutar o documento original.

    Iter 39: tambem expoe `club_price` (menor preco para tier `referral_active`),
    sempre visivel mesmo para visitantes/clientes nao-aderidos, para incentivar
    inscricao no Clube de Beneficios.
    """
    p = {**product}
    p.pop("_id", None)
    info = effective_price(product, user)
    p["effective_price"] = info["price"]
    p["original_price"] = info["original_price"]
    p["tier_applied"] = info["applied_tier"]

    # club_price: menor preco entre tiers do tipo `referral_active`
    club_candidates = []
    for t in (product.get("pricing_tiers") or []):
        if (t.get("type") or "").lower() == "referral_active":
            try:
                tp = float(t.get("price"))
                if tp > 0:
                    club_candidates.append(tp)
            except (TypeError, ValueError):
                continue
    p["club_price"] = min(club_candidates) if club_candidates else None
    return p


# ==================== COUPONS ====================

async def list_coupons(db) -> List[Dict[str, Any]]:
    cursor = db.coupons.find({}, {"_id": 0}).sort("created_at", -1)
    return [c async for c in cursor]


async def get_coupon_by_code(db, code: str) -> Optional[Dict[str, Any]]:
    if not code:
        return None
    return await db.coupons.find_one({"code": code.strip().upper()}, {"_id": 0})


def _parse_iso(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        # aceita 'YYYY-MM-DD' ou ISO completa
        if "T" not in date_str:
            return datetime.fromisoformat(date_str + "T00:00:00+00:00")
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        return None


async def create_coupon(db, payload: CouponIn) -> Dict[str, Any]:
    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Código obrigatório")
    if payload.type not in ("percent", "fixed"):
        raise HTTPException(400, "Tipo deve ser 'percent' ou 'fixed'")
    if payload.value <= 0:
        raise HTTPException(400, "Valor do desconto deve ser maior que zero")
    if payload.type == "percent" and payload.value > 100:
        raise HTTPException(400, "Percentual não pode ser maior que 100")
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(400, "Já existe um cupom com esse código")

    doc = {
        "coupon_id": _gen_id("cpn_"),
        "code": code,
        "type": payload.type,
        "value": float(payload.value),
        "min_subtotal": float(payload.min_subtotal or 0),
        "max_discount": float(payload.max_discount) if payload.max_discount else None,
        "valid_from": payload.valid_from or None,
        "valid_until": payload.valid_until or None,
        "usage_limit": int(payload.usage_limit) if payload.usage_limit else None,
        "per_user_limit": int(payload.per_user_limit) if payload.per_user_limit else None,
        "requires_login": bool(payload.requires_login),
        "applicable_user_categories": list(payload.applicable_user_categories or []),
        "description": payload.description or "",
        "active": bool(payload.active),
        "usage_count": 0,
        "created_at": _now_iso(),
    }
    await db.coupons.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


async def update_coupon(db, coupon_id: str, payload: CouponIn) -> Dict[str, Any]:
    cur = await db.coupons.find_one({"coupon_id": coupon_id})
    if not cur:
        raise HTTPException(404, "Cupom não encontrado")
    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Código obrigatório")
    other = await db.coupons.find_one({"code": code, "coupon_id": {"$ne": coupon_id}})
    if other:
        raise HTTPException(400, "Já existe um cupom com esse código")
    if payload.type not in ("percent", "fixed"):
        raise HTTPException(400, "Tipo inválido")
    if payload.value <= 0:
        raise HTTPException(400, "Valor inválido")
    update = {
        "code": code,
        "type": payload.type,
        "value": float(payload.value),
        "min_subtotal": float(payload.min_subtotal or 0),
        "max_discount": float(payload.max_discount) if payload.max_discount else None,
        "valid_from": payload.valid_from or None,
        "valid_until": payload.valid_until or None,
        "usage_limit": int(payload.usage_limit) if payload.usage_limit else None,
        "per_user_limit": int(payload.per_user_limit) if payload.per_user_limit else None,
        "requires_login": bool(payload.requires_login),
        "applicable_user_categories": list(payload.applicable_user_categories or []),
        "description": payload.description or "",
        "active": bool(payload.active),
        "updated_at": _now_iso(),
    }
    await db.coupons.update_one({"coupon_id": coupon_id}, {"$set": update})
    return await db.coupons.find_one({"coupon_id": coupon_id}, {"_id": 0})


async def delete_coupon(db, coupon_id: str) -> Dict[str, Any]:
    res = await db.coupons.delete_one({"coupon_id": coupon_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Cupom não encontrado")
    return {"ok": True}


async def validate_coupon(
    db,
    code: str,
    subtotal: float,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Valida e calcula o desconto. Retorna dict com:
      { valid: bool, reason?: str, discount: float, coupon: dict|None }
    """
    coupon = await get_coupon_by_code(db, code)
    if not coupon:
        return {"valid": False, "reason": "Cupom inválido", "discount": 0, "coupon": None}
    if not coupon.get("active"):
        return {"valid": False, "reason": "Cupom inativo", "discount": 0, "coupon": None}

    now = datetime.now(timezone.utc)
    vf = _parse_iso(coupon.get("valid_from"))
    vu = _parse_iso(coupon.get("valid_until"))
    if vf and now < vf:
        return {"valid": False, "reason": "Cupom ainda não está válido", "discount": 0, "coupon": None}
    if vu and now > vu:
        return {"valid": False, "reason": "Cupom expirou", "discount": 0, "coupon": None}

    if coupon.get("requires_login") and not user:
        return {"valid": False, "reason": "Faça login para usar este cupom", "discount": 0, "coupon": None}

    cats_required = coupon.get("applicable_user_categories") or []
    if cats_required:
        if not user:
            return {"valid": False, "reason": "Cupom restrito a categorias de usuários", "discount": 0, "coupon": None}
        user_cats = set(user.get("category_ids") or [])
        if not user_cats.intersection(cats_required):
            return {"valid": False, "reason": "Você não pertence a uma categoria autorizada", "discount": 0, "coupon": None}

    if subtotal < float(coupon.get("min_subtotal") or 0):
        return {
            "valid": False,
            "reason": f"Subtotal mínimo de R$ {coupon['min_subtotal']:.2f}",
            "discount": 0,
            "coupon": None,
        }

    if coupon.get("usage_limit") and coupon.get("usage_count", 0) >= coupon["usage_limit"]:
        return {"valid": False, "reason": "Cupom esgotado", "discount": 0, "coupon": None}

    if user and coupon.get("per_user_limit"):
        used = await db.orders.count_documents({
            "user_id": user["user_id"],
            "coupon_code": coupon["code"],
        })
        if used >= coupon["per_user_limit"]:
            return {"valid": False, "reason": "Você já atingiu o limite de uso deste cupom", "discount": 0, "coupon": None}

    # calcula desconto
    if coupon["type"] == "percent":
        discount = subtotal * (float(coupon["value"]) / 100.0)
        if coupon.get("max_discount"):
            discount = min(discount, float(coupon["max_discount"]))
    else:  # fixed
        discount = float(coupon["value"])
    discount = round(min(discount, subtotal), 2)

    return {"valid": True, "discount": discount, "coupon": coupon}


async def increment_coupon_usage(db, coupon_id: str):
    await db.coupons.update_one({"coupon_id": coupon_id}, {"$inc": {"usage_count": 1}})
