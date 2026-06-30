"""
Sistema de Perfis Personalizáveis para Controle de Páginas no Admin

Permite criar e gerenciar perfis (roles) com permissões granulares
sobre quais páginas cada perfil pode acessar no painel admin.

Estrutura:
{
  "profile_id": "prof_xxx",
  "name": "Gerenciador de Pedidos",
  "description": "Pode visualizar pedidos e usuários",
  "pages": ["orders", "users"],
  "created_by": "user_id_admin",
  "is_system": False,  # Se True, não pode ser deletado
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}

Páginas disponíveis do admin:
  - dashboard: Dashboard principal
  - orders: Gestão de Pedidos
  - users: Gestão de Usuários
  - commissions: Gestão de Comissões
  - financial: Relatórios Financeiros
  - shipping: Frete e Logística
  - products: Produtos
  - categories: Categorias
  - coupons: Cupons e Descontos
  - marketing: Marketing e Aparência
  - settings: Configurações do Sistema
  - payments: Configuração de Pagamentos
  - email: Templates de Email
  - roles: Gerenciamento de Perfis
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict

AVAILABLE_PAGES = {
    "dashboard": "Dashboard Principal",
    "orders": "Gestão de Pedidos",
    "users": "Gestão de Usuários",
    "commissions": "Gestão de Comissões",
    "financial": "Relatórios Financeiros",
    "shipping": "Frete e Logística",
    "products": "Produtos",
    "categories": "Categorias",
    "coupons": "Cupons e Descontos",
    "marketing": "Marketing e Aparência",
    "settings": "Configurações do Sistema",
    "payments": "Configuração de Pagamentos",
    "email": "Templates de Email",
    "roles": "Gerenciamento de Perfis",
}

# Perfis de sistema (não podem ser deletados, apenas editados)
SYSTEM_PROFILES = {
    "admin": {
        "name": "Administrador",
        "description": "Acesso completo ao painel admin",
        "pages": list(AVAILABLE_PAGES.keys()),
    },
    "super_admin": {
        "name": "Super Administrador",
        "description": "Acesso completo ao painel admin",
        "pages": list(AVAILABLE_PAGES.keys()),
    },
    "financeiro": {
        "name": "Financeiro",
        "description": "Acesso a relatórios e comissões",
        "pages": ["financial", "commissions", "orders", "payments"],
    },
    "comercial": {
        "name": "Comercial",
        "description": "Acesso a pedidos e usuários",
        "pages": ["orders", "users", "products", "marketing"],
    },
   "cliente": {
        "name": "Cliente",
        "description": "Acesso apenas à loja.",
        "pages": [],
    },
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def get_all_profiles(db):
    """Lista todos os perfis disponíveis (sistema + personalizados)."""
    custom = await db.role_profiles.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Combina com perfis de sistema
    result = []
    for profile_key, profile_data in SYSTEM_PROFILES.items():
        result.append({
            "profile_id": profile_key,
            "name": profile_data["name"],
            "description": profile_data["description"],
            "pages": profile_data["pages"],
            "is_system": True,
            "created_at": None,
        })
    
    # Adiciona personalizados
    result.extend(custom)
    return result


async def get_profile_pages(db, profile_id: str) -> List[str]:
    """Retorna as páginas permitidas para um perfil."""
    # Tenta no sistema primeiro
    if profile_id in SYSTEM_PROFILES:
        return SYSTEM_PROFILES[profile_id]["pages"]
    
    # Busca no banco
    profile = await db.role_profiles.find_one({"profile_id": profile_id}, {"_id": 0})
    if profile:
        return profile.get("pages", [])
    
    # Fallback para customer (sem acesso admin)
    if profile_id == "customer":
        return []
    
    # Padrão: super_admin tem acesso a tudo
    return list(AVAILABLE_PAGES.keys())


async def has_page_access(db, user: dict, page: str) -> bool:
    """Verifica se o usuário tem acesso a uma página específica."""
    role = user.get("role", "customer")
    
    # Super admin e admin têm acesso a tudo
    if role in ("super_admin", "admin"):
        return True
    
    # Customer não tem acesso a admin
    if role == "customer":
        return False
    
    # Verifica as páginas permitidas do perfil
    allowed_pages = await get_profile_pages(db, role)
    return page in allowed_pages


async def create_profile(db, name: str, description: str, pages: List[str], created_by: str, admin_access: bool = False):
    """Cria um novo perfil personalizado."""
    from uuid import uuid4
    
    # Valida páginas
    invalid = [p for p in pages if p not in AVAILABLE_PAGES]
    if invalid:
        raise ValueError(f"Páginas inválidas: {invalid}")
    
    profile = {
        "profile_id": f"prof_{uuid4().hex[:12]}",
        "name": name,
        "description": description,
        "pages": pages,
        "admin_access": admin_access,
        "created_by": created_by,
        "is_system": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    
    result = await db.role_profiles.insert_one(profile)
    # Remove _id do MongoDB para retornar (é um ObjectId não-serializável)
    profile.pop("_id", None)
    return profile


async def update_profile(db, profile_id: str, name: str = None, description: str = None, pages: List[str] = None, admin_access: bool = None):
    """Atualiza um perfil personalizado."""
    # Não permite atualizar perfis de sistema via essa função
    if profile_id in SYSTEM_PROFILES:
        raise ValueError("Não é possível atualizar perfis de sistema")
    
    update = {"updated_at": now_iso()}
    
    if name:
        update["name"] = name
    if description:
        update["description"] = description
    if admin_access is not None:
        update["admin_access"] = admin_access
    if pages:
        # Valida páginas
        invalid = [p for p in pages if p not in AVAILABLE_PAGES]
        if invalid:
            raise ValueError(f"Páginas inválidas: {invalid}")
        update["pages"] = pages
    
    result = await db.role_profiles.update_one(
        {"profile_id": profile_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise ValueError("Perfil não encontrado")
    
    return await db.role_profiles.find_one({"profile_id": profile_id}, {"_id": 0})


async def delete_profile(db, profile_id: str):
    """Deleta um perfil personalizado."""
    # Não permite deletar perfis de sistema
    if profile_id in SYSTEM_PROFILES:
        raise ValueError("Não é possível deletar perfis de sistema")
    
    # Verifica se há usuários usando esse perfil
    users_with_profile = await db.users.count_documents({"profile_id": profile_id})
    if users_with_profile > 0:
        raise ValueError(f"Não é possível deletar um perfil que está em uso por {users_with_profile} usuário(s)")
    
    result = await db.role_profiles.delete_one({"profile_id": profile_id})
    if result.deleted_count == 0:
        raise ValueError("Perfil não encontrado")
    
    return {"deleted": True}