"""IGVD Voucher Service — Iter 48
Recebe vouchers da IGVD (POST /api/integrations/igvd/voucher) com dados do
licenciado que comprou o kit de adesão. Concede saldo de voucher na OxxPharma
para o user identificado por CPF ou e-mail.

Fluxo:
  IGVD ------(webhook)----->  OxxPharma  /api/integrations/igvd/voucher
                                    |
                                    +--> Se acha user (CPF/email) -> aplica saldo
                                    +--> Caso contrario -> guarda pendente
                                    +--> Hook em register() processa pendentes

Idempotencia: pelo header `Idempotency-Key` (ex: `adesao-{adesao_id}-oxx`) ou
pelo `voucher.code`. Indice unico em `igvd_vouchers.voucher_code`.
"""

import re
from datetime import datetime, timezone
from typing import Dict, Optional


def _clean_cpf(v: str) -> str:
    return re.sub(r"\D", "", v or "")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_indexes(db) -> None:
    await db.igvd_vouchers.create_index("voucher_code", unique=True, sparse=True)
    await db.igvd_vouchers.create_index("idempotency_key", unique=True, sparse=True)
    await db.igvd_vouchers.create_index("licenciado_cpf_digits")
    await db.igvd_vouchers.create_index("licenciado_email")
    await db.igvd_vouchers.create_index("status")


async def get_config(db) -> Dict:
    s = await db.settings.find_one({"_id": "global"}) or {}
    return {
        "igvd_voucher_enabled": bool(s.get("igvd_voucher_enabled")),
        "igvd_voucher_secret": s.get("igvd_voucher_secret") or "",
    }


async def _find_user(db, email: str, cpf_digits: str) -> Optional[Dict]:
    """Busca user por CPF (mais robusto) e em seguida por email."""
    if cpf_digits and len(cpf_digits) == 11:
        u = await db.users.find_one({"cpf_digits": cpf_digits}, {"_id": 0, "user_id": 1, "email": 1})
        if u:
            return u
    if email:
        u = await db.users.find_one({"email": email.lower()}, {"_id": 0, "user_id": 1, "email": 1})
        if u:
            return u
    return None


async def _apply_voucher_to_user(db, voucher_doc: Dict, user_id: str) -> Dict:
    """Credita amount_brl no voucher_balance do user, marca voucher como aplicado,
    grava entrada no voucher_log para auditoria."""
    amount_brl = float(voucher_doc.get("amount_brl") or 0)
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"voucher_balance": amount_brl}},
    )
    await db.voucher_log.insert_one({
        "log_id": "vlog_igvd_" + voucher_doc["voucher_code"],
        "user_id": user_id,
        "delta": amount_brl,
        "reason": f"Adesão IGVD · voucher {voucher_doc['voucher_code']}",
        "source": "igvd_voucher",
        "voucher_code": voucher_doc["voucher_code"],
        "created_at": _now_iso(),
    })
    await db.igvd_vouchers.update_one(
        {"voucher_code": voucher_doc["voucher_code"]},
        {"$set": {
            "status": "applied",
            "applied_user_id": user_id,
            "applied_at": _now_iso(),
        }},
    )
    return {
        "success": True,
        "user_id": user_id,
        "voucher_code": voucher_doc["voucher_code"],
        "credited_amount_cents": int(round(amount_brl * 100)),
        "status": "applied",
    }


async def ingest_voucher(db, payload: Dict, idempotency_key: Optional[str]) -> Dict:
    """Persiste o voucher recebido e aplica imediatamente se houver user.
    Retorna o body de resposta seguindo o contrato."""
    voucher = payload.get("voucher") or {}
    lic = payload.get("licenciado") or {}
    addr = (lic.get("address") or {})
    code = (voucher.get("code") or "").strip()
    if not code:
        raise ValueError("voucher.code obrigatorio")
    amount_cents = int(voucher.get("amount_cents") or 0)
    amount_brl = float(voucher.get("amount_brl") or (amount_cents / 100.0))
    cpf_digits = _clean_cpf(lic.get("cpf"))
    email = (lic.get("email") or "").strip().lower()

    # Idempotencia: se ja existe voucher com mesmo code OU idempotency_key
    existing = None
    if idempotency_key:
        existing = await db.igvd_vouchers.find_one({"idempotency_key": idempotency_key}, {"_id": 0})
    if not existing:
        existing = await db.igvd_vouchers.find_one({"voucher_code": code}, {"_id": 0})

    if existing:
        # Se ja aplicado, retorna 200 OK (idempotente)
        return {
            "success": True,
            "user_id": existing.get("applied_user_id") or None,
            "voucher_code": code,
            "credited_amount_cents": int(round(float(existing.get("amount_brl") or 0) * 100)),
            "status": existing.get("status"),
            "duplicate": True,
        }

    doc = {
        "voucher_code": code,
        "idempotency_key": idempotency_key,
        "adesao_id": payload.get("adesao_id"),
        "source": payload.get("source") or "igvd",
        "amount_brl": amount_brl,
        "amount_cents": amount_cents,
        "issued_at": voucher.get("issued_at"),
        "licenciado_name": lic.get("full_name"),
        "licenciado_email": email,
        "licenciado_cpf_digits": cpf_digits,
        "licenciado_phone": lic.get("phone"),
        "licenciado_birth_date": lic.get("birth_date"),
        "licenciado_address": addr,
        "raw_payload": payload,
        "received_at": _now_iso(),
        "status": "pending",
        "applied_user_id": None,
        "applied_at": None,
    }
    await db.igvd_vouchers.insert_one(doc)

    user = await _find_user(db, email, cpf_digits)
    if user:
        return await _apply_voucher_to_user(db, doc, user["user_id"])
    return {
        "success": True,
        "user_id": None,
        "voucher_code": code,
        "credited_amount_cents": amount_cents,
        "status": "pending",
        "message": "Voucher salvo e aguardando cadastro do licenciado",
    }


async def apply_pending_for_user(db, user_id: str, email: Optional[str], cpf: Optional[str]) -> int:
    """Hook chamado no register/admin-create: aplica todos vouchers pending que
    casem com o CPF ou e-mail recebidos. Retorna a quantidade aplicada."""
    cpf_digits = _clean_cpf(cpf or "")
    or_conditions = []
    if cpf_digits and len(cpf_digits) == 11:
        or_conditions.append({"licenciado_cpf_digits": cpf_digits})
    if email:
        or_conditions.append({"licenciado_email": email.lower()})
    if not or_conditions:
        return 0
    pending = await db.igvd_vouchers.find(
        {"status": "pending", "$or": or_conditions},
        {"_id": 0},
    ).to_list(50)
    applied = 0
    for v in pending:
        await _apply_voucher_to_user(db, v, user_id)
        applied += 1
    return applied
