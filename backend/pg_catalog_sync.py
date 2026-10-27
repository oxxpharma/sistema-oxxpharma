"""
Serviço de sincronização de catálogo de produtos com banco PostgreSQL.
Alimenta automaticamente a tabela `products_catalog` para que agências de tráfego,
anúncios (Meta Ads, Google Shopping, TikTok) e sistemas externos consumam os dados
e fotos em tempo real com credenciais exclusivas de leitura.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

try:
    import asyncpg
except ImportError:
    asyncpg = None

logger = logging.getLogger(__name__)

DEFAULT_PG_URL = "postgresql://oxx_backend:OxxBackend2026@Sync@127.0.0.1:5432/oxxpharma_catalog"

_pg_pool: Optional[Any] = None
_last_connection_error: Optional[str] = None


async def get_pg_url(db=None) -> str:
    """Busca URL do PostgreSQL na coleção settings ou fallback para env / default."""
    if db is not None:
        try:
            cfg = await db.settings.find_one({"_id": "postgres_catalog"})
            if cfg and cfg.get("host") and cfg.get("user") and cfg.get("password") and cfg.get("database"):
                host = str(cfg["host"]).strip()
                if host in ("localhost", "127.0.0.1"):
                    host = "127.0.0.1"
                port = int(cfg.get("port") or 5432)
                user = str(cfg["user"]).strip()
                pwd = str(cfg["password"]).strip()
                database = str(cfg["database"]).strip()
                return f"postgresql://{user}:{pwd}@{host}:{port}/{database}"
        except Exception as e:
            logger.warning(f"Erro ao buscar configuracao postgres_catalog no settings: {e}")

    raw_url = os.environ.get("POSTGRES_CATALOG_URL") or DEFAULT_PG_URL
    if "@localhost:" in raw_url:
        raw_url = raw_url.replace("@localhost:", "@127.0.0.1:")
    return raw_url


async def reset_pool():
    """Fecha o pool atual para forçar reconexão com novas credenciais."""
    global _pg_pool
    if _pg_pool is not None:
        try:
            await _pg_pool.close()
        except Exception:
            pass
        _pg_pool = None


async def get_pool(db=None):
    """Retorna o pool de conexões com o PostgreSQL ou None se inacessível."""
    global _pg_pool, _last_connection_error
    if asyncpg is None:
        _last_connection_error = "Biblioteca 'asyncpg' não instalada no ambiente Python do backend (/backend/.venv). Rode: /var/www/oxxpharma/backend/.venv/bin/pip install asyncpg"
        logger.warning(f"[Postgres Catalog] {_last_connection_error}")
        return None

    if _pg_pool is not None and not _pg_pool._closed:
        return _pg_pool

    url = await get_pg_url(db)
    try:
        _pg_pool = await asyncpg.create_pool(
            dsn=url,
            min_size=1,
            max_size=10,
            command_timeout=15.0,
            timeout=10.0,
        )
        logger.info(f"Pool PostgreSQL de catálogo conectado com sucesso.")
        _last_connection_error = None
        await ensure_table(_pg_pool)
        return _pg_pool
    except Exception as e:
        _last_connection_error = f"{type(e).__name__}: {str(e)}"
        logger.warning(f"Não foi possível conectar ao PostgreSQL de catálogo: {_last_connection_error}")
        return None


async def ensure_table(pool: Any):
    """Garante que a tabela products_catalog e os índices existam."""
    sql = """
    CREATE TABLE IF NOT EXISTS products_catalog (
        product_id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255),
        product_url TEXT,
        main_image TEXT,
        all_images JSONB DEFAULT '[]'::jsonb,
        sku VARCHAR(100),
        ean_gtin VARCHAR(100),
        brand VARCHAR(100),
        category VARCHAR(150),
        categories JSONB DEFAULT '[]'::jsonb,
        subcategories JSONB DEFAULT '[]'::jsonb,
        price NUMERIC(12,2) DEFAULT 0,
        discount_price NUMERIC(12,2),
        effective_price NUMERIC(12,2) DEFAULT 0,
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_featured BOOLEAN DEFAULT false,
        description TEXT,
        features JSONB DEFAULT '[]'::jsonb,
        weight_kg NUMERIC(8,3),
        length_cm NUMERIC(8,2),
        width_cm NUMERIC(8,2),
        height_cm NUMERIC(8,2),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_products_active ON products_catalog (is_active);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products_catalog (sku);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products_catalog (category);
    """
    try:
        async with pool.acquire() as conn:
            await conn.execute(sql)
    except Exception as e:
        logger.warning(f"Erro ao verificar/criar tabela products_catalog no PostgreSQL: {e}")


def _normalize_product_payload(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Normaliza o documento do MongoDB para os tipos e colunas do PostgreSQL."""
    pid = str(doc.get("product_id") or "")
    slug = str(doc.get("slug") or pid or "").strip()
    name = str(doc.get("name") or "Produto sem nome").strip()[:255]

    images_raw = doc.get("images") or []
    if isinstance(images_raw, str):
        images_list = [images_raw]
    elif isinstance(images_raw, list):
        images_list = [str(x) for x in images_raw if x]
    else:
        images_list = []

    main_image = images_list[0] if len(images_list) > 0 else None

    try:
        price = float(doc.get("price") or 0.0)
    except (ValueError, TypeError):
        price = 0.0

    discount_price = None
    if doc.get("discount_price") is not None:
        try:
            dp = float(doc.get("discount_price"))
            if dp > 0:
                discount_price = dp
        except (ValueError, TypeError):
            discount_price = None

    effective_price = discount_price if (discount_price and discount_price > 0) else price

    try:
        stock = int(doc.get("stock") if doc.get("stock") is not None else 0)
    except (ValueError, TypeError):
        stock = 0

    is_active = bool(doc.get("active", True))
    is_featured = bool(doc.get("featured", False))

    category = str(doc.get("category") or "").strip() or None
    categories = doc.get("categories") or ([category] if category else [])
    subcategories = doc.get("subcategories") or ([doc.get("subcategory")] if doc.get("subcategory") else [])
    features = doc.get("features") or []

    def _to_float(v):
        try:
            return float(v) if v is not None else None
        except (ValueError, TypeError):
            return None

    weight_kg = _to_float(doc.get("weight"))
    length_cm = _to_float(doc.get("length_cm"))
    width_cm = _to_float(doc.get("width_cm"))
    height_cm = _to_float(doc.get("height_cm"))

    product_url = f"https://oxxpharma.com.br/produto/{slug}"

    return {
        "product_id": pid,
        "name": name,
        "slug": slug,
        "product_url": product_url,
        "main_image": main_image,
        "all_images": json.dumps(images_list),
        "sku": str(doc.get("sku") or "").strip() or None,
        "ean_gtin": str(doc.get("ean") or doc.get("ean_gtin") or "").strip() or None,
        "brand": str(doc.get("brand") or "OxxPharma").strip()[:100],
        "category": category,
        "categories": json.dumps(categories),
        "subcategories": json.dumps(subcategories),
        "price": price,
        "discount_price": discount_price,
        "effective_price": effective_price,
        "stock": stock,
        "is_active": is_active,
        "is_featured": is_featured,
        "description": str(doc.get("description") or "").strip(),
        "features": json.dumps(features),
        "weight_kg": weight_kg,
        "length_cm": length_cm,
        "width_cm": width_cm,
        "height_cm": height_cm,
        "updated_at": datetime.now(timezone.utc),
    }


async def sync_product_to_pg(product_doc: Dict[str, Any], db=None) -> bool:
    """Insere ou atualiza um produto no banco PostgreSQL."""
    if not product_doc or not product_doc.get("product_id"):
        return False

    pool = await get_pool(db)
    if not pool:
        return False

    data = _normalize_product_payload(product_doc)

    upsert_sql = """
    INSERT INTO products_catalog (
        product_id, name, slug, product_url, main_image, all_images,
        sku, ean_gtin, brand, category, categories, subcategories,
        price, discount_price, effective_price, stock, is_active,
        is_featured, description, features, weight_kg, length_cm,
        width_cm, height_cm, updated_at
    ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb,
        $7, $8, $9, $10, $11::jsonb, $12::jsonb,
        $13, $14, $15, $16, $17,
        $18, $19, $20::jsonb, $21, $22,
        $23, $24, $25
    )
    ON CONFLICT (product_id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        product_url = EXCLUDED.product_url,
        main_image = EXCLUDED.main_image,
        all_images = EXCLUDED.all_images,
        sku = EXCLUDED.sku,
        ean_gtin = EXCLUDED.ean_gtin,
        brand = EXCLUDED.brand,
        category = EXCLUDED.category,
        categories = EXCLUDED.categories,
        subcategories = EXCLUDED.subcategories,
        price = EXCLUDED.price,
        discount_price = EXCLUDED.discount_price,
        effective_price = EXCLUDED.effective_price,
        stock = EXCLUDED.stock,
        is_active = EXCLUDED.is_active,
        is_featured = EXCLUDED.is_featured,
        description = EXCLUDED.description,
        features = EXCLUDED.features,
        weight_kg = EXCLUDED.weight_kg,
        length_cm = EXCLUDED.length_cm,
        width_cm = EXCLUDED.width_cm,
        height_cm = EXCLUDED.height_cm,
        updated_at = EXCLUDED.updated_at;
    """

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                upsert_sql,
                data["product_id"],
                data["name"],
                data["slug"],
                data["product_url"],
                data["main_image"],
                data["all_images"],
                data["sku"],
                data["ean_gtin"],
                data["brand"],
                data["category"],
                data["categories"],
                data["subcategories"],
                data["price"],
                data["discount_price"],
                data["effective_price"],
                data["stock"],
                data["is_active"],
                data["is_featured"],
                data["description"],
                data["features"],
                data["weight_kg"],
                data["length_cm"],
                data["width_cm"],
                data["height_cm"],
                data["updated_at"],
            )
        logger.info(f"[Postgres Catalog] Produto sincronizado: {data['product_id']} ({data['name']})")
        return True
    except Exception as e:
        logger.error(f"[Postgres Catalog] Falha ao sincronizar produto {data['product_id']}: {e}")
        return False


async def delete_product_from_pg(product_id: str, db=None) -> bool:
    """Remove produto do catálogo no PostgreSQL."""
    if not product_id:
        return False

    pool = await get_pool(db)
    if not pool:
        return False

    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM products_catalog WHERE product_id = $1;", str(product_id))
        logger.info(f"[Postgres Catalog] Produto removido do PostgreSQL: {product_id}")
        return True
    except Exception as e:
        logger.error(f"[Postgres Catalog] Falha ao remover produto {product_id} no PostgreSQL: {e}")
        return False


async def bulk_sync_all_products(mongo_db) -> Dict[str, Any]:
    """Varre todos os produtos do MongoDB e sincroniza com o PostgreSQL."""
    pool = await get_pool(mongo_db)
    if not pool:
        err_detail = _last_connection_error or "Verifique as credenciais e se o serviço PostgreSQL está ativo."
        return {
            "success": False,
            "error": f"Falha na conexão com PostgreSQL: {err_detail}",
            "total_mongo": 0,
            "synced": 0,
        }

    try:
        cursor = mongo_db.products.find({})
        products = await cursor.to_list(length=5000)
        total = len(products)
        synced = 0
        errors = 0

        for p in products:
            ok = await sync_product_to_pg(p, db=mongo_db)
            if ok:
                synced += 1
            else:
                errors += 1

        sync_info = {
            "at": datetime.now(timezone.utc).isoformat(),
            "synced": synced,
            "errors": errors,
            "total": total,
        }

        # Salva o registro da última sincronização
        try:
            await mongo_db.settings.update_one(
                {"_id": "postgres_catalog"},
                {"$set": {"last_sync": sync_info}},
                upsert=True
            )
        except Exception:
            pass

        return {
            "success": True,
            "total_mongo": total,
            "synced": synced,
            "errors": errors,
            "message": f"{synced} produtos sincronizados com sucesso no PostgreSQL de anúncios.",
            "last_sync": sync_info,
        }
    except Exception as e:
        logger.exception(f"Erro durante bulk_sync_all_products: {e}")
        return {
            "success": False,
            "error": str(e),
            "total_mongo": 0,
            "synced": 0,
        }


async def test_pg_connection(params: Dict[str, Any]) -> Dict[str, Any]:
    """Testa a conexão com o PostgreSQL usando os parâmetros fornecidos."""
    if asyncpg is None:
        return {
            "success": False,
            "error": "Biblioteca 'asyncpg' não instalada no ambiente Python.",
        }

    host = str(params.get("host") or "127.0.0.1").strip()
    if host in ("localhost", "127.0.0.1"):
        host = "127.0.0.1"
    port = int(params.get("port") or 5432)
    database = str(params.get("database") or "oxxpharma_catalog").strip()
    user = str(params.get("user") or "oxx_backend").strip()
    password = str(params.get("password") or "").strip()

    dsn = f"postgresql://{user}:{password}@{host}:{port}/{database}"

    try:
        conn = await asyncpg.connect(dsn, timeout=5.0)
        try:
            version_str = await conn.fetchval("SELECT version();")
            table_check = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'products_catalog'
                );
            """)
            return {
                "success": True,
                "version": version_str.split(",")[0] if version_str else "PostgreSQL",
                "table_exists": bool(table_check),
                "message": "Conexão com PostgreSQL estabelecida com sucesso!",
            }
        finally:
            await conn.close()
    except Exception as e:
        return {
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}",
        }


async def get_pg_config(db) -> Dict[str, Any]:
    """Retorna a configuração atual do PostgreSQL (com senha mascarada) e credenciais da agência."""
    doc = await db.settings.find_one({"_id": "postgres_catalog"}) or {}

    host = doc.get("host") or "127.0.0.1"
    port = int(doc.get("port") or 5432)
    database = doc.get("database") or "oxxpharma_catalog"
    user = doc.get("user") or "oxx_backend"
    has_pwd = bool(doc.get("password") or os.environ.get("POSTGRES_CATALOG_URL"))

    agency_user = doc.get("agency_user") or "ads_agency"
    agency_pwd = doc.get("agency_password") or "AgenciaOxxAds#2026"

    return {
        "host": host,
        "port": port,
        "database": database,
        "user": user,
        "has_password": has_pwd,
        "password_masked": "••••••••••••" if has_pwd else "",
        "agency_user": agency_user,
        "agency_password": agency_pwd,
        "updated_at": doc.get("updated_at"),
    }


async def update_pg_config(db, data: Dict[str, Any]) -> Dict[str, Any]:
    """Atualiza as credenciais de conexão do PostgreSQL e reseta o pool."""
    doc = await db.settings.find_one({"_id": "postgres_catalog"}) or {}

    host = str(data.get("host") or doc.get("host") or "127.0.0.1").strip()
    port = int(data.get("port") or doc.get("port") or 5432)
    database = str(data.get("database") or doc.get("database") or "oxxpharma_catalog").strip()
    user = str(data.get("user") or doc.get("user") or "oxx_backend").strip()

    # Só altera a senha se foi enviada uma nova
    new_pwd = data.get("password")
    if new_pwd and str(new_pwd).strip() and not str(new_pwd).startswith("••••"):
        password = str(new_pwd).strip()
    else:
        password = doc.get("password") or "OxxBackend2026@Sync"

    agency_user = str(data.get("agency_user") or doc.get("agency_user") or "ads_agency").strip()
    agency_pwd = str(data.get("agency_password") or doc.get("agency_password") or "AgenciaOxxAds#2026").strip()

    now = datetime.now(timezone.utc).isoformat()
    update_doc = {
        "host": host,
        "port": port,
        "database": database,
        "user": user,
        "password": password,
        "agency_user": agency_user,
        "agency_password": agency_pwd,
        "updated_at": now,
    }

    await db.settings.update_one({"_id": "postgres_catalog"}, {"$set": update_doc}, upsert=True)
    await reset_pool()

    # Testa a nova conexão imediatamente
    test_res = await test_pg_connection(update_doc)

    return {
        "success": True,
        "message": "Configurações do PostgreSQL salvas com sucesso!",
        "test": test_res,
        "config": await get_pg_config(db),
    }


async def get_sync_status(mongo_db) -> Dict[str, Any]:
    """Retorna o status detalhado da conexão e sincronização."""
    pool = await get_pool(mongo_db)
    pg_connected = pool is not None

    pg_count = 0
    pg_version = ""
    table_exists = False

    if pg_connected:
        try:
            async with pool.acquire() as conn:
                v = await conn.fetchval("SELECT version();")
                pg_version = v.split(",")[0] if v else "PostgreSQL"
                table_check = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'products_catalog'
                    );
                """)
                table_exists = bool(table_check)
                if table_exists:
                    val = await conn.fetchval("SELECT COUNT(*) FROM products_catalog;")
                    pg_count = int(val or 0)
        except Exception as e:
            logger.warning(f"Erro ao obter status no PostgreSQL: {e}")
            pg_connected = False

    mongo_count = 0
    try:
        mongo_count = await mongo_db.products.count_documents({})
    except Exception:
        pass

    doc = await mongo_db.settings.find_one({"_id": "postgres_catalog"}) or {}
    last_sync = doc.get("last_sync")

    return {
        "pg_connected": pg_connected,
        "pg_version": pg_version,
        "table_exists": table_exists,
        "pg_count": pg_count,
        "mongo_count": mongo_count,
        "in_sync": (pg_connected and pg_count >= mongo_count and mongo_count > 0),
        "last_sync": last_sync,
        "error": _last_connection_error if not pg_connected else None,
    }


async def list_pg_products(db, page: int = 1, limit: int = 20, search: str = "") -> Dict[str, Any]:
    """Consulta os produtos diretamente da tabela products_catalog no PostgreSQL."""
    pool = await get_pool(db)
    if not pool:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "pages": 1,
            "error": _last_connection_error or "PostgreSQL desconectado",
        }

    offset = (page - 1) * limit
    search_term = f"%{search.strip()}%" if search and search.strip() else None

    try:
        async with pool.acquire() as conn:
            if search_term:
                count_sql = """
                    SELECT COUNT(*) FROM products_catalog
                    WHERE name ILIKE $1 OR sku ILIKE $1 OR ean_gtin ILIKE $1 OR product_id ILIKE $1;
                """
                total = await conn.fetchval(count_sql, search_term)

                query_sql = """
                    SELECT product_id, name, slug, product_url, main_image, all_images,
                           sku, ean_gtin, brand, category, categories, price, discount_price,
                           effective_price, stock, is_active, is_featured, updated_at
                    FROM products_catalog
                    WHERE name ILIKE $1 OR sku ILIKE $1 OR ean_gtin ILIKE $1 OR product_id ILIKE $1
                    ORDER BY updated_at DESC
                    LIMIT $2 OFFSET $3;
                """
                rows = await conn.fetch(query_sql, search_term, limit, offset)
            else:
                total = await conn.fetchval("SELECT COUNT(*) FROM products_catalog;")
                query_sql = """
                    SELECT product_id, name, slug, product_url, main_image, all_images,
                           sku, ean_gtin, brand, category, categories, price, discount_price,
                           effective_price, stock, is_active, is_featured, updated_at
                    FROM products_catalog
                    ORDER BY updated_at DESC
                    LIMIT $1 OFFSET $2;
                """
                rows = await conn.fetch(query_sql, limit, offset)

            items = []
            for r in rows:
                d = dict(r)
                if isinstance(d.get("updated_at"), datetime):
                    d["updated_at"] = d["updated_at"].isoformat()
                # Parse all_images json if string
                if isinstance(d.get("all_images"), str):
                    try:
                        d["all_images"] = json.loads(d["all_images"])
                    except Exception:
                        d["all_images"] = []
                items.append(d)

            total_val = int(total or 0)
            pages = max(1, (total_val + limit - 1) // limit) if total_val > 0 else 1

            return {
                "items": items,
                "total": total_val,
                "page": page,
                "pages": pages,
            }
    except Exception as e:
        logger.exception(f"Erro ao listar produtos do PostgreSQL: {e}")
        return {
            "items": [],
            "total": 0,
            "page": page,
            "pages": 1,
            "error": str(e),
        }
