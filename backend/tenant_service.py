"""Multi-tenant support (OxxPharma + Pharmakon).

Estrategia:
  - Um banco unico, isolamento por campo `tenant` em colecoes transacionais
    (orders, carts, commissions, points_log, payment_webhook_logs, coupons).
  - Recursos compartilhados: users, products, categories, network MMN, payments config.
  - Tema/identidade visual por tenant (colecao `tenants`).
  - Toggle global `brands_unified` (em settings._id="brands_unified") que forca
    todo trafego para o tenant primary (oxxpharma) — usado quando as marcas se
    fundirem.

Middleware le o Host header e determina o tenant via `db.tenants` (cache em memoria).
"""
import os
import logging
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Tenant primario (usado como fallback e como destino quando brands_unified=true)
DEFAULT_TENANT = "oxxpharma"

# Cache em memoria do mapa hostname -> tenant_id (carregado no startup)
_HOST_MAP: dict = {}
_BRANDS_UNIFIED: bool = False
_TENANTS_CACHE: dict = {}  # tenant_id -> doc


async def bootstrap_tenants(db) -> None:
    """Cria docs default de tenants se nao existirem e popula cache."""
    defaults = [
        {
            "tenant_id": "oxxpharma",
            "name": "OxxPharma",
            "short_name": "OxxPharma",
            "hostnames": ["www.oxxpharma.com.br", "oxxpharma.com.br", "localhost", "preview.emergentagent.com"],
            "is_primary": True,
            "active": True,
            "theme": {
                "primary_color": "#E8731A",
                "logo_url": "",
                "favicon_url": "",
            },
            "email": {
                "from_name": "OxxPharma",
                "from_email": "",
                "footer_text": "OxxPharma — Saude e bem-estar",
            },
            "benefits_program_label": "Programa de Beneficios",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "tenant_id": "pharmakon",
            "name": "Pharmakon",
            "short_name": "Pharmakon",
            "hostnames": ["www.pharmakon.com.br", "pharmakon.com.br"],
            "is_primary": False,
            "active": True,
            "theme": {
                "primary_color": "#1E88E5",
                "logo_url": "",
                "favicon_url": "",
            },
            "email": {
                "from_name": "Pharmakon",
                "from_email": "",
                "footer_text": "Pharmakon",
            },
            "benefits_program_label": "Clube Pharmakon",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    for d in defaults:
        await db.tenants.update_one(
            {"tenant_id": d["tenant_id"]},
            {"$setOnInsert": d},
            upsert=True,
        )
    await db.tenants.create_index("tenant_id", unique=True)
    await db.tenants.create_index("hostnames")
    await reload_cache(db)


async def reload_cache(db) -> None:
    """Atualiza caches (_HOST_MAP, _TENANTS_CACHE, _BRANDS_UNIFIED)."""
    global _HOST_MAP, _TENANTS_CACHE, _BRANDS_UNIFIED
    new_host_map = {}
    new_cache = {}
    async for t in db.tenants.find({"active": True}, {"_id": 0}):
        new_cache[t["tenant_id"]] = t
        for h in (t.get("hostnames") or []):
            new_host_map[h.lower().strip()] = t["tenant_id"]
    _HOST_MAP = new_host_map
    _TENANTS_CACHE = new_cache
    cfg = await db.settings.find_one({"_id": "brands_unified"})
    _BRANDS_UNIFIED = bool(cfg and cfg.get("enabled"))


def get_tenant_from_request(request) -> str:
    """Resolve tenant a partir do Request:
      1. Se brands_unified=true -> DEFAULT_TENANT (forca fusao).
      2. Header X-Tenant explicito (usado pelo backoffice / admin).
      3. Host header mapeado.
      4. DEFAULT_TENANT.
    """
    if _BRANDS_UNIFIED:
        return DEFAULT_TENANT
    # Override via header (backoffice escolhe tenant ativo)
    override = (request.headers.get("x-tenant") or "").strip().lower()
    if override and override in _TENANTS_CACHE:
        return override
    host = (request.headers.get("host") or "").split(":")[0].lower().strip()
    if host in _HOST_MAP:
        return _HOST_MAP[host]
    # Suporta wildcard *.preview.emergentagent.com (dev)
    for h in _HOST_MAP:
        if h.endswith(".preview.emergentagent.com") and host.endswith(".preview.emergentagent.com"):
            return _HOST_MAP[h]
    return DEFAULT_TENANT


def get_tenant(request) -> str:
    """Helper para handlers: pega tenant ja resolvido em request.state."""
    return getattr(request.state, "tenant", DEFAULT_TENANT)


def get_admin_tenant_filter(request, query_param: Optional[str] = None) -> dict:
    """Iter 43: helper para endpoints admin — retorna {tenant: X} ou {} (todos).
    Prioriza query param explicito, fallback para header X-Tenant. None/all/vazio = sem filtro."""
    sel = (query_param or request.headers.get("x-tenant") or "").strip().lower() or None
    if sel and sel in _TENANTS_CACHE:
        return {"tenant": sel}
    return {}


def get_tenant_doc(tenant_id: str) -> dict:
    """Retorna config completa do tenant (cached)."""
    return _TENANTS_CACHE.get(tenant_id) or _TENANTS_CACHE.get(DEFAULT_TENANT) or {}


def is_brands_unified() -> bool:
    return _BRANDS_UNIFIED


def list_active_tenants() -> list:
    return list(_TENANTS_CACHE.values())
