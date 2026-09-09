"""
2FA (Two-Factor Auth) por email — Iter 66.4
Obrigatorio para roles sensiveis: company_admin, propagandista.

Fluxo:
1. Usuario faz login normal com email+senha.
2. Se role requer 2FA:
   - Se enviou X-Trusted-Device valido (nao expirado, do mesmo user) => libera direto.
   - Senao: gera codigo 6 digitos, salva com hash+expiry (10 min), envia por email.
     Retorna {requires_2fa: true, pending_token: <one-time nonce>} — o pending_token nao
     autentica nada sozinho; apenas amarra a proxima verificacao.
3. Frontend chama POST /api/auth/2fa/verify com {email, code, pending_token}.
   Backend valida e retorna JWT normal + trusted_device_token (7 dias) que o front
   envia em requests futuros no header X-Trusted-Device.
"""

import os
import hmac
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

import jwt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth/2fa", tags=["2fa"])

TWO_FA_ROLES = {"company_admin", "propagandista"}
CODE_TTL_MINUTES = 10
TRUSTED_DEVICE_TTL_DAYS = 7

_deps: Dict[str, Any] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_code(code: str, salt: str) -> str:
    return hmac.new(salt.encode(), code.encode(), hashlib.sha256).hexdigest()


def _make_trusted_token(user_id: str) -> str:
    secret = os.environ.get("JWT_SECRET") or "changeme"
    exp = _now() + timedelta(days=TRUSTED_DEVICE_TTL_DAYS)
    return jwt.encode({"sub": user_id, "kind": "trusted_device", "exp": exp}, secret, algorithm="HS256")


def verify_trusted_token(token: Optional[str], user_id: str) -> bool:
    if not token: return False
    secret = os.environ.get("JWT_SECRET") or "changeme"
    try:
        data = jwt.decode(token, secret, algorithms=["HS256"])
        return data.get("sub") == user_id and data.get("kind") == "trusted_device"
    except Exception:
        return False


async def start_challenge(db, user: Dict) -> Dict:
    """Cria codigo 6 digitos, salva, envia email. Retorna pending_token (nonce)."""
    import email_service
    code = f"{secrets.randbelow(1000000):06d}"
    pending_token = secrets.token_urlsafe(24)
    salt = os.environ.get("JWT_SECRET") or "changeme"
    doc = {
        "pending_token": pending_token,
        "user_id": user["user_id"],
        "email": user["email"].lower(),
        "code_hash": _hash_code(code, salt),
        "attempts": 0,
        "expires_at": (_now() + timedelta(minutes=CODE_TTL_MINUTES)).isoformat(),
        "created_at": _now().isoformat(),
    }
    await db.two_factor_challenges.insert_one(doc)
    subject = f"Seu codigo de acesso · {code}"
    html = f"""
<div style='font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:20px;background:#fff;border:1px solid #eee;border-radius:12px'>
  <h1 style='color:#ea580c;margin:0 0 8px'>Acesso seguro OxxPharma</h1>
  <p>Ola{f", <b>{user.get('name','').split()[0]}</b>" if user.get('name') else ''}!</p>
  <p>Voce esta tentando entrar em uma area restrita ({user.get('role')}). Use o codigo abaixo para continuar:</p>
  <div style='background:#fef3c7;border:2px solid #fbbf24;border-radius:8px;padding:20px;text-align:center;margin:20px 0'>
    <div style='font-size:36px;font-weight:900;letter-spacing:8px;color:#92400e'>{code}</div>
    <div style='color:#6b7280;font-size:12px;margin-top:8px'>Valido por {CODE_TTL_MINUTES} minutos</div>
  </div>
  <p style='color:#6b7280;font-size:12px'>Se voce nao tentou entrar, ignore este email e altere sua senha imediatamente.</p>
</div>"""
    try:
        await email_service.send_email(db, user["email"], subject, html)
    except Exception as e:
        logger.error(f"2fa send_email falhou: {e}")
    return {"pending_token": pending_token, "email_masked": _mask_email(user["email"])}


def _mask_email(email: str) -> str:
    try:
        u, d = email.split("@", 1)
        if len(u) <= 2: return f"{u[0]}***@{d}"
        return f"{u[:2]}***{u[-1]}@{d}"
    except Exception:
        return "***"


class VerifyIn(BaseModel):
    email: EmailStr
    code: str
    pending_token: str


@router.post("/verify")
async def verify_2fa(data: VerifyIn, request: Request):
    """Valida codigo e retorna JWT + trusted_device_token."""
    db = request.app.db
    ch = await db.two_factor_challenges.find_one(
        {"pending_token": data.pending_token, "email": data.email.lower()},
        {"_id": 0},
    )
    if not ch:
        raise HTTPException(status_code=400, detail="Codigo invalido ou expirado")
    if ch.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Solicite um novo codigo.")
    try:
        exp = datetime.fromisoformat(ch["expires_at"])
    except Exception:
        exp = _now() - timedelta(days=1)
    if _now() > exp:
        await db.two_factor_challenges.delete_one({"pending_token": data.pending_token})
        raise HTTPException(status_code=400, detail="Codigo expirado. Solicite um novo.")
    salt = os.environ.get("JWT_SECRET") or "changeme"
    expected = _hash_code(data.code.strip(), salt)
    if not hmac.compare_digest(expected, ch["code_hash"]):
        await db.two_factor_challenges.update_one({"pending_token": data.pending_token}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Codigo incorreto")
    # sucesso: apaga challenge, gera JWT do usuario + trusted_device
    await db.two_factor_challenges.delete_one({"pending_token": data.pending_token})
    user = await db.users.find_one({"user_id": ch["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    create_token_fn = _deps.get("create_token")
    if not create_token_fn:
        raise HTTPException(status_code=500, detail="deps nao configuradas")
    token = create_token_fn(user["user_id"], user["email"], user.get("role"))
    trusted = _make_trusted_token(user["user_id"])
    return {
        "token": token,
        "user": user,
        "trusted_device_token": trusted,
        "trusted_device_ttl_days": TRUSTED_DEVICE_TTL_DAYS,
    }


class ResendIn(BaseModel):
    email: EmailStr
    pending_token: str


@router.post("/resend")
async def resend_2fa(data: ResendIn, request: Request):
    """Reenvia um novo codigo (invalida o anterior)."""
    db = request.app.db
    ch = await db.two_factor_challenges.find_one({"pending_token": data.pending_token, "email": data.email.lower()}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=400, detail="Sessao invalida. Faca login novamente.")
    user = await db.users.find_one({"user_id": ch["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    # remove challenge antigo e gera novo
    await db.two_factor_challenges.delete_one({"pending_token": data.pending_token})
    return await start_challenge(db, user)


def register_2fa_routes(app, deps: Dict[str, Any]):
    _deps["create_token"] = deps["create_token"]
    app.include_router(router)
