"""Multiplier Campaign Service (Iter 54)

Campanha promocional que MULTIPLICA as porcentagens de comissao MMN das
geracoes 3 em diante para usuarios que baterem a meta mensal de vendas na
1a geracao (soma de orders.total pagos dos indicados diretos do sponsor).

Regras (confirmadas com o cliente):
- Escopo: usuarios com rede MMN (network_1 OU network_2).
- Meta = soma de orders.total onde payment_status='paid' AND
  order_status != 'cancelled' AND user_id em downline_gen1(sponsor)
  AND paid_at dentro do mes.
- Timezone: America/Sao_Paulo (o mes fecha 23:59:59 do ultimo dia).
- Mes de arranque (multiplier_campaign_started_at): TODOS entram ativados.
- Mes N -> N+1: se bateu em N, ativa em N+1; se nao bateu, desativa em N+1.
- Meta ausente para um mes: multiplicador DESATIVA (meta considerada
  inatingivel; nao ha bonus de graca fora do 1o mes).
- Aplica-se APENAS sobre a taxa de comissao das geracoes 3-6.
- Comissoes ja criadas nao sao alteradas retroativamente.

Estrutura da coleccao `multiplier_status`:
  {user_id, month: 'YYYY-MM', active: bool, goal: float,
   sales_gen1: float, hit_goal: bool, streak_months: int,
   evaluated_at: iso}
  Indice unico: (user_id, month).
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

TZ_BR = ZoneInfo("America/Sao_Paulo")


def month_key(dt: Optional[datetime] = None) -> str:
    """YYYY-MM em fuso BR."""
    d = (dt or datetime.now(timezone.utc)).astimezone(TZ_BR)
    return f"{d.year:04d}-{d.month:02d}"


def prev_month_key(mk: str) -> str:
    y, m = int(mk[:4]), int(mk[5:7])
    m -= 1
    if m == 0:
        m = 12
        y -= 1
    return f"{y:04d}-{m:02d}"


def month_range(mk: str) -> Tuple[str, str]:
    """Retorna (start_iso, end_iso) do mes em fuso BR, exclusivo no fim."""
    y, m = int(mk[:4]), int(mk[5:7])
    start = datetime(y, m, 1, 0, 0, 0, tzinfo=TZ_BR)
    if m == 12:
        end = datetime(y + 1, 1, 1, 0, 0, 0, tzinfo=TZ_BR)
    else:
        end = datetime(y, m + 1, 1, 0, 0, 0, tzinfo=TZ_BR)
    # Convertemos para ISO string em UTC para comparar contra orders.paid_at/created_at
    return start.astimezone(timezone.utc).isoformat(), end.astimezone(timezone.utc).isoformat()


def now_iso_br() -> str:
    return datetime.now(TZ_BR).isoformat()


async def _load_campaign_cfg(db) -> Dict[str, Any]:
    s = await db.settings.find_one({"_id": "global"}) or {}
    return {
        "enabled": bool(s.get("multiplier_campaign_enabled", False)),
        "value": float(s.get("multiplier_campaign_value") or 2.0),
        "goals": s.get("multiplier_campaign_goals") or {},  # {"YYYY-MM": float}
        "started_at": s.get("multiplier_campaign_started_at"),  # iso date
        "start_month": (s.get("multiplier_campaign_started_at") or "")[:7],
    }


async def get_gen1_users(db, sponsor_user_id: str) -> List[str]:
    """Iter 31 style: user_ids de gen 1 do sponsor (sponsor_id OR network_sponsor_id).
    Nao inclui o proprio sponsor."""
    users = await db.users.find(
        {"$or": [
            {"sponsor_id": sponsor_user_id},
            {"network_sponsor_id": sponsor_user_id},
        ], "user_id": {"$ne": sponsor_user_id}},
        {"_id": 0, "user_id": 1}
    ).to_list(5000)
    return [u["user_id"] for u in users]


async def compute_gen1_sales(db, sponsor_user_id: str, mk: str) -> float:
    """Soma orders.total de gen1 no mes, respeitando payment_status/order_status."""
    gen1_ids = await get_gen1_users(db, sponsor_user_id)
    if not gen1_ids:
        return 0.0
    start_iso, end_iso = month_range(mk)
    # Filtro: paid + nao cancelado + no periodo
    match: Dict = {
        "user_id": {"$in": gen1_ids},
        "payment_status": "paid",
        "order_status": {"$ne": "cancelled"},
        # Usamos paid_at OU created_at (fallback) para o filtro de mes
        "$or": [
            {"paid_at": {"$gte": start_iso, "$lt": end_iso}},
            {"$and": [
                {"paid_at": {"$in": [None, ""]}},
                {"created_at": {"$gte": start_iso, "$lt": end_iso}},
            ]},
        ],
    }
    agg = await db.orders.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]).to_list(1)
    return round(float(agg[0]["total"]) if agg else 0.0, 2)


async def _mmn_users(db) -> List[Dict]:
    """Todos os usuarios com rede MMN (network_1 OU network_2)."""
    users = await db.users.find(
        {"network_type": {"$in": ["network_1", "network_2"]}},
        {"_id": 0, "user_id": 1, "network_type": 1, "name": 1, "email": 1}
    ).to_list(50000)
    return users


async def evaluate_month(db, mk: str) -> Dict[str, Any]:
    """Roda a avaliacao para o mes `mk` (YYYY-MM), decidindo quem ativa
    o multiplicador NESTE mes com base no mes anterior. Idempotente.

    Regras:
    - Se campanha desativada → todo mundo fica active=False.
    - Se mk == start_month → ativa todos (bootstrap).
    - Senao → pra cada user MMN: sales_gen1_prev = compute_gen1_sales(user, mk-1),
      goal_prev = goals[mk-1]. hit_goal = sales >= goal_prev (goal>0). active =
      hit_goal. streak vem do mes anterior + 1 (se hit) ou 0.
    """
    cfg = await _load_campaign_cfg(db)
    users = await _mmn_users(db)
    prev = prev_month_key(mk)
    goals = cfg["goals"] or {}
    goal_prev = float(goals.get(prev) or 0)
    is_bootstrap = bool(cfg.get("start_month") and cfg["start_month"] == mk)
    updates: List[Dict] = []
    activated = 0
    deactivated = 0
    for u in users:
        uid = u["user_id"]
        if not cfg["enabled"]:
            active = False
            hit_goal = False
            sales_gen1 = 0.0
            streak = 0
        elif is_bootstrap:
            active = True
            hit_goal = False  # ainda nao teve mes anterior
            sales_gen1 = 0.0
            streak = 0
        else:
            sales_gen1 = await compute_gen1_sales(db, uid, prev)
            hit_goal = bool(goal_prev > 0 and sales_gen1 >= goal_prev)
            active = hit_goal
            # streak: se hit, pega streak do mes anterior +1; senao 0.
            prev_doc = await db.multiplier_status.find_one({"user_id": uid, "month": prev}, {"_id": 0}) or {}
            streak = (int(prev_doc.get("streak_months") or 0) + 1) if hit_goal else 0
        if active:
            activated += 1
        else:
            deactivated += 1
        doc = {
            "user_id": uid,
            "month": mk,
            "active": active,
            "goal": goal_prev if not is_bootstrap else 0.0,
            "sales_gen1": sales_gen1,
            "hit_goal": hit_goal,
            "streak_months": streak,
            "network_type": u.get("network_type"),
            "evaluated_at": now_iso_br(),
        }
        updates.append(doc)
    # Batch upsert
    if updates:
        for doc in updates:
            await db.multiplier_status.update_one(
                {"user_id": doc["user_id"], "month": doc["month"]},
                {"$set": doc},
                upsert=True,
            )
    return {
        "month": mk,
        "campaign_enabled": cfg["enabled"],
        "bootstrap": is_bootstrap,
        "prev_month": prev,
        "prev_goal": goal_prev,
        "evaluated": len(updates),
        "activated": activated,
        "deactivated": deactivated,
    }


async def is_active_for(db, user_id: str, mk: Optional[str] = None) -> Tuple[bool, float]:
    """Retorna (active, multiplier_value). Se inativo, multiplier=1.0.
    Faz lazy-init: se nao ha status registrado para o mes atual, avalia agora."""
    cfg = await _load_campaign_cfg(db)
    if not cfg["enabled"]:
        return False, 1.0
    mk = mk or month_key()
    doc = await db.multiplier_status.find_one({"user_id": user_id, "month": mk}, {"_id": 0})
    if not doc:
        # Lazy init pontual para 1 user — barato porque so 1 doc.
        # Se e' o mes de bootstrap, ativa direto sem consultar sales.
        prev = prev_month_key(mk)
        is_bootstrap = bool(cfg.get("start_month") and cfg["start_month"] == mk)
        if is_bootstrap:
            active = True
            sales = 0.0
            hit = False
            goal_prev = 0.0
            streak = 0
        else:
            goal_prev = float((cfg["goals"] or {}).get(prev) or 0)
            sales = await compute_gen1_sales(db, user_id, prev)
            hit = bool(goal_prev > 0 and sales >= goal_prev)
            active = hit
            prev_doc = await db.multiplier_status.find_one({"user_id": user_id, "month": prev}, {"_id": 0}) or {}
            streak = (int(prev_doc.get("streak_months") or 0) + 1) if hit else 0
        doc = {
            "user_id": user_id, "month": mk, "active": active, "goal": goal_prev if not is_bootstrap else 0.0,
            "sales_gen1": sales, "hit_goal": hit, "streak_months": streak, "evaluated_at": now_iso_br(),
        }
        await db.multiplier_status.update_one({"user_id": user_id, "month": mk}, {"$set": doc}, upsert=True)
    return bool(doc.get("active")), (cfg["value"] if doc.get("active") else 1.0)


async def user_snapshot(db, user_id: str) -> Dict[str, Any]:
    """Payload consumido por /api/users/me/multiplier — inclui progresso do
    mes CORRENTE (sales_gen1 correntes vs meta corrente) e status ativo/inativo
    baseado no mes anterior."""
    cfg = await _load_campaign_cfg(db)
    mk = month_key()
    active, mult_val = await is_active_for(db, user_id, mk)
    goals = cfg["goals"] or {}
    goal_curr = float(goals.get(mk) or 0)
    # Vendas gen1 correntes (progresso vivo do mes)
    sales_curr = await compute_gen1_sales(db, user_id, mk)
    status_doc = await db.multiplier_status.find_one({"user_id": user_id, "month": mk}, {"_id": 0}) or {}
    return {
        "campaign_enabled": cfg["enabled"],
        "multiplier_value": cfg["value"],
        "start_month": cfg.get("start_month"),
        "month": mk,
        "active": active,
        "sales_gen1_current_month": sales_curr,
        "goal_current_month": goal_curr,
        "progress_pct": round(min(100.0, (sales_curr / goal_curr * 100) if goal_curr > 0 else 0.0), 1),
        "hit_goal_last_month": bool(status_doc.get("hit_goal")),
        "sales_gen1_last_month": float(status_doc.get("sales_gen1") or 0),
        "goal_last_month": float(status_doc.get("goal") or 0),
        "streak_months": int(status_doc.get("streak_months") or 0),
        "applicable_generations": [3, 4, 5, 6],
    }


async def admin_stats(db, mk: Optional[str] = None) -> Dict[str, Any]:
    """Metricas agregadas para o painel admin."""
    cfg = await _load_campaign_cfg(db)
    mk = mk or month_key()
    total_mmn = await db.users.count_documents({"network_type": {"$in": ["network_1", "network_2"]}})
    active_count = await db.multiplier_status.count_documents({"month": mk, "active": True})
    hit_count = await db.multiplier_status.count_documents({"month": mk, "hit_goal": True})
    # Top streak
    top_streak = await db.multiplier_status.find(
        {"month": mk, "streak_months": {"$gt": 0}},
        {"_id": 0, "user_id": 1, "streak_months": 1, "sales_gen1": 1},
    ).sort("streak_months", -1).limit(5).to_list(5)
    # Enrich names
    if top_streak:
        uids = [t["user_id"] for t in top_streak]
        users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1})}
        for t in top_streak:
            u = users.get(t["user_id"], {})
            t["name"] = u.get("name")
            t["email"] = u.get("email")
    # Ativados por mes historico (12 ultimos)
    history = await db.multiplier_status.aggregate([
        {"$match": {"active": True}},
        {"$group": {"_id": "$month", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 12},
    ]).to_list(12)
    history.reverse()
    # Progress buckets (mes corrente)
    goal_curr = float((cfg.get("goals") or {}).get(mk) or 0)
    buckets_agg = await db.multiplier_status.find(
        {"month": mk}, {"_id": 0, "sales_gen1": 1, "active": 1}
    ).to_list(50000)
    buckets = {"0-25": 0, "25-50": 0, "50-75": 0, "75-100": 0, "100+": 0}
    if goal_curr > 0:
        for b in buckets_agg:
            pct = (float(b.get("sales_gen1") or 0) / goal_curr) * 100
            if pct >= 100: buckets["100+"] += 1
            elif pct >= 75: buckets["75-100"] += 1
            elif pct >= 50: buckets["50-75"] += 1
            elif pct >= 25: buckets["25-50"] += 1
            else: buckets["0-25"] += 1
    return {
        "month": mk,
        "campaign_enabled": cfg["enabled"],
        "multiplier_value": cfg["value"],
        "total_mmn_users": total_mmn,
        "active_count": active_count,
        "hit_last_month_count": hit_count,
        "goal_current": goal_curr,
        "top_streak": top_streak,
        "history": history,
        "progress_buckets": buckets,
    }


async def admin_list_users(db, mk: Optional[str] = None, filter_key: str = "all", search: Optional[str] = None, limit: int = 100) -> List[Dict]:
    """Lista de usuarios com status do mes para a tabela do admin."""
    mk = mk or month_key()
    match: Dict = {"month": mk}
    if filter_key == "active":
        match["active"] = True
    elif filter_key == "inactive":
        match["active"] = False
    elif filter_key == "hit":
        match["hit_goal"] = True
    rows = await db.multiplier_status.find(match, {"_id": 0}).sort([("active", -1), ("sales_gen1", -1)]).limit(limit).to_list(limit)
    # Enrich with user name
    uids = [r["user_id"] for r in rows]
    users = {u["user_id"]: u async for u in db.users.find({"user_id": {"$in": uids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1})}
    filtered = []
    q = (search or "").strip().lower()
    for r in rows:
        u = users.get(r["user_id"], {})
        r["name"] = u.get("name") or "(deletado)"
        r["email"] = u.get("email") or ""
        if q and q not in (r["name"] or "").lower() and q not in (r["email"] or "").lower():
            continue
        filtered.append(r)
    return filtered
