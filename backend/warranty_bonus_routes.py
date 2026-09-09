"""
Sistema de Bonus de Garantia — Iter 66.3
Ozoxx cadastra clientes que compraram geradores de ozonio; ao subir planilha (nome, cpf, serie),
o cliente ganha R$X de bonus em compras acima de R$Y (por unidade cadastrada).

Regra de uso:
- N unidades cadastradas => N tiers desbloqueaveis
- tier N ativa quando subtotal >= N * min_order_per_unit
- amount usable = N_active * amount_per_unit  (com N_active <= N)
- so 1 bonus por pedido (multiplos tiers somam)

Config global (settings.warranty_bonus_config):
- enabled (bool)
- amount_per_unit (float, default 100)
- min_order_per_unit (float, default 300)
"""

import io
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Response
from pydantic import BaseModel
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["warranty-bonus"])

_deps: Dict[str, Any] = {}


def _gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _digits(s: Optional[str]) -> str:
    if not s: return ""
    return "".join(ch for ch in str(s) if ch.isdigit())


async def _current_user_lazy(request: Request):
    fn = _deps.get("get_current_user")
    if not fn:
        raise HTTPException(status_code=500, detail="Deps nao inicializadas")
    return await fn(request)


async def _admin_user_lazy(request: Request):
    user = await _current_user_lazy(request)
    r = user.get("role")
    if r not in ("admin", "super_admin", "financeiro", "comercial", "estoque"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return user


# ==================== HELPERS DE CONFIG + CLAIMING ====================

DEFAULT_CFG = {"enabled": True, "amount_per_unit": 100.0, "min_order_per_unit": 300.0}


async def get_config(db) -> Dict:
    s = await db.settings.find_one({"_id": "global"}, {"_id": 0, "warranty_bonus_config": 1}) or {}
    cfg = s.get("warranty_bonus_config") or {}
    return {**DEFAULT_CFG, **cfg}


async def claim_bonuses_for_user(db, user: Dict) -> int:
    """Chamado quando um user se cadastra ou atualiza CPF.
    Marca todos os warranty_bonuses pendentes com o mesmo CPF como claimed p/ este user.
    Retorna quantos foram vinculados."""
    cpf_dig = _digits(user.get("cpf") or user.get("cpf_digits"))
    if not cpf_dig:
        return 0
    r = await db.warranty_bonuses.update_many(
        {"cpf_digits": cpf_dig, "status": "pending"},
        {"$set": {"status": "claimed", "user_id": user["user_id"], "claimed_at": _now_iso()}},
    )
    return r.modified_count


async def get_available_bonus_count(db, user_id: str) -> int:
    """Retorna quantas unidades de bonus estao disponiveis (status=claimed) para o user."""
    return await db.warranty_bonuses.count_documents({"user_id": user_id, "status": "claimed"})


async def compute_usable_bonus(db, user_id: str, subtotal: float) -> Dict:
    """Dado o subtotal do cart, calcula quanto do bonus pode ser usado.
    Retorna: {available_units, usable_units, amount, min_next_tier, remaining_for_next}."""
    cfg = await get_config(db)
    if not cfg.get("enabled"):
        return {"available_units": 0, "usable_units": 0, "amount": 0.0, "config": cfg}
    n = await get_available_bonus_count(db, user_id)
    if n == 0:
        return {"available_units": 0, "usable_units": 0, "amount": 0.0, "config": cfg}
    amt_per = float(cfg.get("amount_per_unit") or DEFAULT_CFG["amount_per_unit"])
    min_per = float(cfg.get("min_order_per_unit") or DEFAULT_CFG["min_order_per_unit"])
    usable = min(n, int(float(subtotal or 0) // min_per))
    amount = round(usable * amt_per, 2)
    # proximo tier
    next_tier = usable + 1
    if next_tier <= n:
        min_next = round(next_tier * min_per, 2)
        remaining = round(max(0.0, min_next - float(subtotal or 0)), 2)
    else:
        min_next = None
        remaining = None
    return {
        "available_units": n,
        "usable_units": usable,
        "amount": amount,
        "amount_per_unit": amt_per,
        "min_order_per_unit": min_per,
        "min_next_tier": min_next,
        "remaining_for_next": remaining,
        "config": cfg,
    }


async def consume_bonuses(db, user_id: str, units: int, order_id: str) -> None:
    """Marca N bonuses como usados neste pedido."""
    if units <= 0:
        return
    cursor = db.warranty_bonuses.find(
        {"user_id": user_id, "status": "claimed"},
        {"_id": 0, "bonus_id": 1},
    ).limit(units)
    ids = [b["bonus_id"] async for b in cursor]
    if not ids:
        return
    await db.warranty_bonuses.update_many(
        {"bonus_id": {"$in": ids}},
        {"$set": {"status": "used", "used_in_order_id": order_id, "used_at": _now_iso()}},
    )


# ==================== USUARIO: STATUS + APLICACAO ====================

@router.get("/me/warranty-bonus")
async def me_bonus(request: Request, subtotal: float = 0, user: dict = Depends(_current_user_lazy)):
    """Retorna status do bonus do usuario logado. Query subtotal=X para calcular usavel."""
    db = request.app.db
    return await compute_usable_bonus(db, user["user_id"], subtotal)


# ==================== ADMIN: UPLOAD PLANILHA + LISTAR ====================

@router.get("/admin/warranty-bonus/config")
async def get_bonus_config(request: Request, user: dict = Depends(_admin_user_lazy)):
    return await get_config(request.app.db)


@router.put("/admin/warranty-bonus/config")
async def update_bonus_config(request: Request, body: Dict, user: dict = Depends(_admin_user_lazy)):
    """body: {enabled, amount_per_unit, min_order_per_unit}"""
    db = request.app.db
    upd = {}
    if "enabled" in body: upd["warranty_bonus_config.enabled"] = bool(body["enabled"])
    if "amount_per_unit" in body: upd["warranty_bonus_config.amount_per_unit"] = float(body["amount_per_unit"])
    if "min_order_per_unit" in body: upd["warranty_bonus_config.min_order_per_unit"] = float(body["min_order_per_unit"])
    await db.settings.update_one({"_id": "global"}, {"$set": upd}, upsert=True)
    return await get_config(db)


@router.get("/admin/warranty-bonus/template.xlsx")
async def bonus_template_xlsx(request: Request, user: dict = Depends(_admin_user_lazy)):
    output = io.BytesIO()
    df = pd.DataFrame([
        {"nome": "Joao Silva", "cpf": "12345678900", "serie": "SN-000123"},
        {"nome": "Maria Souza", "cpf": "98765432100", "serie": "SN-000124"},
    ])
    with pd.ExcelWriter(output, engine="openpyxl") as w:
        df.to_excel(w, sheet_name="Aparelhos", index=False)
    output.seek(0)
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=modelo_bonus_garantia.xlsx"},
    )


@router.post("/admin/warranty-bonus/upload")
async def bonus_upload(request: Request, file: UploadFile = File(...),
                       dry_run: bool = False, user: dict = Depends(_admin_user_lazy)):
    """Sobe planilha (nome, cpf, serie). Cria warranty_bonuses.
    Se o CPF ja tem um user cadastrado, claim automatico. Se nao, fica status=pending."""
    db = request.app.db
    raw = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(raw), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Falha ao ler XLSX: {e}")
    df.columns = [str(c).strip().lower() for c in df.columns]
    aliases = {"nome": "name", "name": "name", "cpf": "cpf", "serie": "serial", "série": "serial", "serial": "serial", "numero_serie": "serial"}
    df = df.rename(columns={c: aliases.get(c, c) for c in df.columns})
    required = {"name", "cpf", "serial"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Colunas obrigatorias: {', '.join(missing)}")

    upload_id = _gen_id("wbup_")
    inserted = 0
    duplicates = 0
    linked = 0
    errors: List[str] = []
    preview: List[Dict] = []

    for idx, row in df.iterrows():
        try:
            name = str(row.get("name") or "").strip()
            cpf_dig = _digits(row.get("cpf"))
            serial = str(row.get("serial") or "").strip()
            if not (name and cpf_dig and serial):
                continue
            # dedupe: mesmo (cpf+serial) so 1 vez
            dup = await db.warranty_bonuses.find_one({"cpf_digits": cpf_dig, "serial": serial}, {"_id": 0, "bonus_id": 1})
            status_row = "duplicate" if dup else "new"
            row_prev = {"name": name, "cpf": cpf_dig, "serial": serial, "status": status_row}
            preview.append(row_prev)
            if status_row == "duplicate" or dry_run:
                if status_row == "duplicate":
                    duplicates += 1
                continue
            # busca user existente por CPF pra claimar imediato
            existing_user = await db.users.find_one({"cpf_digits": cpf_dig}, {"_id": 0, "user_id": 1})
            doc = {
                "bonus_id": _gen_id("wbon_"),
                "upload_id": upload_id,
                "name": name,
                "cpf": cpf_dig,
                "cpf_digits": cpf_dig,
                "serial": serial,
                "user_id": existing_user["user_id"] if existing_user else None,
                "status": "claimed" if existing_user else "pending",
                "created_at": _now_iso(),
                "claimed_at": _now_iso() if existing_user else None,
            }
            await db.warranty_bonuses.insert_one(doc)
            inserted += 1
            if existing_user:
                linked += 1
        except Exception as e:
            errors.append(f"linha {int(idx) + 2}: {e}")

    if not dry_run:
        await db.warranty_bonus_uploads.insert_one({
            "upload_id": upload_id,
            "filename": file.filename,
            "total_rows": len(df),
            "inserted": inserted,
            "duplicates": duplicates,
            "linked_immediately": linked,
            "errors": errors,
            "uploaded_by": user.get("user_id"),
            "created_at": _now_iso(),
        })

    return {
        "upload_id": upload_id,
        "dry_run": dry_run,
        "total": len(df),
        "inserted": inserted,
        "duplicates": duplicates,
        "linked_immediately": linked,
        "errors": errors,
        "preview": preview[:200],
    }


@router.get("/admin/warranty-bonus/list")
async def list_bonuses(request: Request, cpf: Optional[str] = None, status: Optional[str] = None,
                       page: int = 1, limit: int = 30, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    q: Dict[str, Any] = {}
    if cpf: q["cpf_digits"] = _digits(cpf)
    if status: q["status"] = status
    total = await db.warranty_bonuses.count_documents(q)
    items = await db.warranty_bonuses.find(q, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"items": items, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@router.get("/admin/warranty-bonus/uploads")
async def list_uploads(request: Request, user: dict = Depends(_admin_user_lazy)):
    db = request.app.db
    items = await db.warranty_bonus_uploads.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"uploads": items}


def register_warranty_bonus_routes(app, deps: Dict[str, Any]):
    _deps["get_current_user"] = deps["get_current_user"]
    app.include_router(router)
