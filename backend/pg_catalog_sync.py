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

DEFAULT_PG_URL = "postgresql://oxx_backend:OxxBackend2026@Sync@localhost:5432/oxxpharma_catalog"

_pg_pool: Optional[Any] = None


def get_pg_url() -> str:
    return os.environ.get("POSTGRES_CATALOG_URL") or DEFAULT_PG_URL


async def get_pool():
    """Retorna o pool de conexões com o PostgreSQL ou None se inacessível."""
    global _pg_pool
    if asyncpg is None:
        logger.warning("[Postgres Catalog] Biblioteca 'asyncpg' não instalada no ambiente Python. Sincronização inativa.")
        return None

    if _pg_pool is not None and not _pg_pool._closed:
        return _pg_pool

    url = get_pg_url()
    try:
        _pg_pool = await asyncpg.create_pool(
            dsn=url,
            min_size=1,
            max_size=10,
            command_timeout=15.0,
            timeout=10.0,
        )
        logger.info(f"Pool PostgreSQL de catálogo inicializado com sucesso.")
        await ensure_table(_pg_pool)
        return _pg_pool
    except Exception as e:
        logger.warning(f"Não foi possível conectar ao PostgreSQL de catálogo ({url}): {e}")
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

    # Imagens
    images_raw = doc.get("images") or []
    if isinstance(images_raw, str):
        images_list = [images_raw]
    elif isinstance(images_raw, list):
        images_list = [str(x) for x in images_raw if x]
    else:
        images_list = []

    main_image = images_list[0] if len(images_list) > 0 else None

    # Preços
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

    # Estoque e status
    try:
        stock = int(doc.get("stock") if doc.get("stock") is not None else 0)
    except (ValueError, TypeError):
        stock = 0

    is_active = bool(doc.get("active", True))
    is_featured = bool(doc.get("featured", False))

    # Categorias e Subcategorias
    category = str(doc.get("category") or "").strip() or None
    categories = doc.get("categories") or ([category] if category else [])
    subcategories = doc.get("subcategories") or ([doc.get("subcategory")] if doc.get("subcategory") else [])

    # Features / Benefícios
    features = doc.get("features") or []

    # Peso e Dimensões
    def _to_float(v):
        try:
            return float(v) if v is not None else None
        except (ValueError, TypeError):
            return None

    weight_kg = _to_float(doc.get("weight"))
    length_cm = _to_float(doc.get("length_cm"))
    width_cm = _to_float(doc.get("width_cm"))
    height_cm = _to_float(doc.get("height_cm"))

    # Link completo do produto para anúncios
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


async def sync_product_to_pg(product_doc: Dict[str, Any]) -> bool:
    """Insere ou atualiza um produto no banco PostgreSQL."""
    if not product_doc or not product_doc.get("product_id"):
        return False

    pool = await get_pool()
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
        logger.info(f"[Postgres Catalog] Produto sincronizado com sucesso: {data['product_id']} ({data['name']})")
        return True
    except Exception as e:
        logger.error(f"[Postgres Catalog] Falha ao sincronizar produto {data['product_id']}: {e}")
        return False


async def delete_product_from_pg(product_id: str) -> bool:
    """Remove produto do catálogo no PostgreSQL."""
    if not product_id:
        return False

    pool = await get_pool()
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
    pool = await get_pool()
    if not pool:
        return {
            "success": False,
            "error": "Não foi possível conectar ao banco PostgreSQL. Verifique se o serviço está rodando e a porta 5432 liberada.",
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
            ok = await sync_product_to_pg(p)
            if ok:
                synced += 1
            else:
                errors += 1

        return {
            "success": True,
            "total_mongo": total,
            "synced": synced,
            "errors": errors,
            "message": f"{synced} produtos sincronizados com sucesso no PostgreSQL de anúncios.",
        }
    except Exception as e:
        logger.exception(f"Erro durante bulk_sync_all_products: {e}")
        return {
            "success": False,
            "error": str(e),
            "total_mongo": 0,
            "synced": 0,
        }


async def get_sync_status(mongo_db) -> Dict[str, Any]:
    """Retorna o status da sincronização e contagem de produtos."""
    pool = await get_pool()
    pg_connected = pool is not None

    pg_count = 0
    if pg_connected:
        try:
            async with pool.acquire() as conn:
                val = await conn.fetchval("SELECT COUNT(*) FROM products_catalog;")
                pg_count = int(val or 0)
        except Exception as e:
            logger.warning(f"Erro ao contar produtos no PostgreSQL: {e}")
            pg_connected = False

    mongo_count = 0
    try:
        mongo_count = await mongo_db.products.count_documents({})
    except Exception:
        pass

    return {
        "pg_connected": pg_connected,
        "pg_count": pg_count,
        "mongo_count": mongo_count,
        "in_sync": (pg_connected and pg_count == mongo_count),
    }
