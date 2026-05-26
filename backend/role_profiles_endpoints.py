
# ==================== ADMIN ROLE PROFILES - GESTÃO PERSONALIZADA DE PERFIS ====================

class RoleProfileCreate(BaseModel):
    """Modelo para criar um novo perfil personalizado."""
    name: str
    description: Optional[str] = None
    pages: List[str]  # Lista de páginas que o perfil pode acessar


class RoleProfileUpdate(BaseModel):
    """Modelo para atualizar um perfil."""
    name: Optional[str] = None
    description: Optional[str] = None
    pages: Optional[List[str]] = None


@app.get("/api/admin/role-profiles/pages")
async def admin_get_available_pages(request: Request, user: dict = Depends(require_super_admin())):
    """Retorna a lista de páginas disponíveis para os perfis."""
    return {
        "pages": role_profiles.AVAILABLE_PAGES,
        "system_profiles": role_profiles.SYSTEM_PROFILES,
    }


@app.get("/api/admin/role-profiles")
async def admin_list_role_profiles(request: Request, user: dict = Depends(require_super_admin())):
    """Lista todos os perfis disponíveis (sistema + personalizados)."""
    db = request.app.db
    all_profiles = await role_profiles.get_all_profiles(db)
    return {"profiles": all_profiles}


@app.get("/api/admin/role-profiles/{profile_id}")
async def admin_get_role_profile(request: Request, profile_id: str, user: dict = Depends(require_super_admin())):
    """Retorna detalhes de um perfil específico."""
    db = request.app.db
    
    # Tenta buscar nos perfis de sistema
    if profile_id in role_profiles.SYSTEM_PROFILES:
        profile_data = role_profiles.SYSTEM_PROFILES[profile_id]
        return {
            "profile_id": profile_id,
            "name": profile_data["name"],
            "description": profile_data["description"],
            "pages": profile_data["pages"],
            "is_system": True,
            "created_at": None,
            "updated_at": None,
        }
    
    # Tenta buscar no banco
    profile = await db.role_profiles.find_one({"profile_id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    return profile


@app.post("/api/admin/role-profiles")
async def admin_create_role_profile(request: Request, data: RoleProfileCreate, user: dict = Depends(require_super_admin())):
    """Cria um novo perfil personalizado."""
    db = request.app.db
    
    # Valida páginas
    invalid_pages = [p for p in data.pages if p not in role_profiles.AVAILABLE_PAGES]
    if invalid_pages:
        raise HTTPException(status_code=400, detail=f"Páginas inválidas: {invalid_pages}")
    
    try:
        profile = await role_profiles.create_profile(
            db,
            name=data.name,
            description=data.description or "",
            pages=data.pages,
            created_by=user["user_id"]
        )
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/admin/role-profiles/{profile_id}")
async def admin_update_role_profile(request: Request, profile_id: str, data: RoleProfileUpdate, user: dict = Depends(require_super_admin())):
    """Atualiza um perfil personalizado."""
    db = request.app.db
    
    # Não permite editar perfis de sistema (exceto para super_admin, mas será bloqueado abaixo)
    if profile_id in role_profiles.SYSTEM_PROFILES:
        # Sistema permite editar o nome/descrição dos perfis de sistema, mas não as páginas
        if data.pages is not None:
            raise HTTPException(status_code=400, detail="Não é permitido alterar as páginas de um perfil de sistema")
    
    # Valida páginas se fornecidas
    if data.pages:
        invalid_pages = [p for p in data.pages if p not in role_profiles.AVAILABLE_PAGES]
        if invalid_pages:
            raise HTTPException(status_code=400, detail=f"Páginas inválidas: {invalid_pages}")
    
    try:
        updated_profile = await role_profiles.update_profile(
            db,
            profile_id=profile_id,
            name=data.name,
            description=data.description,
            pages=data.pages
        )
        return updated_profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/admin/role-profiles/{profile_id}")
async def admin_delete_role_profile(request: Request, profile_id: str, user: dict = Depends(require_super_admin())):
    """Deleta um perfil personalizado."""
    db = request.app.db
    
    try:
        await role_profiles.delete_profile(db, profile_id)
        return {"message": "Perfil deletado com sucesso"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/admin/role-profiles/{profile_id}/users")
async def admin_get_profile_users(request: Request, profile_id: str, user: dict = Depends(require_super_admin())):
    """Lista todos os usuários que possuem um perfil específico."""
    db = request.app.db
    
    # Verifica se o perfil existe
    if profile_id not in role_profiles.SYSTEM_PROFILES:
        profile = await db.role_profiles.find_one({"profile_id": profile_id})
        if not profile:
            raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    # Lista usuários com esse perfil
    users = await db.users.find(
        {"role": profile_id},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "profile_id": profile_id,
        "users_count": len(users),
        "users": users,
    }


@app.post("/api/admin/role-profiles/{profile_id}/assign-user")
async def admin_assign_user_to_profile(request: Request, profile_id: str, user: dict = Depends(require_super_admin())):
    """Atribui um usuário a um perfil (muda seu role)."""
    db = request.app.db
    body = await request.json() or {}
    
    target_user_id = body.get("user_id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="user_id é obrigatório")
    
    # Valida se o perfil existe
    if profile_id not in role_profiles.SYSTEM_PROFILES:
        profile = await db.role_profiles.find_one({"profile_id": profile_id})
        if not profile:
            raise HTTPException(status_code=404, detail="Perfil não encontrado")
    
    # Atualiza o usuário
    result = await db.users.update_one(
        {"user_id": target_user_id},
        {"$set": {"role": profile_id, "updated_at": now_iso()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    target_user = await db.users.find_one({"user_id": target_user_id}, {"_id": 0})
    return {
        "message": f"Usuário {target_user.get('name')} atribuído ao perfil {profile_id}",
        "user": target_user,
    }


@app.post("/api/admin/role-profiles/reset-to-default")
async def admin_reset_profiles_to_default(request: Request, user: dict = Depends(require_super_admin())):
    """Reseta todos os perfis personalizados para o padrão do sistema.
    Todos os usuários com perfis personalizados serão reassignados para 'customer'.
    """
    db = request.app.db
    
    # Backup dos perfis personalizados antes de deletar
    custom_profiles = await db.role_profiles.find({}, {"_id": 0}).to_list(100)
    
    # Reassigna usuários com perfis personalizados para 'customer'
    result = await db.users.update_many(
        {"role": {"$nin": list(role_profiles.SYSTEM_PROFILES.keys()) + ["customer"]}},
        {"$set": {"role": "customer", "updated_at": now_iso()}}
    )
    
    # Deleta todos os perfis personalizados
    await db.role_profiles.delete_many({})
    
    # Cria um log do reset
    await db.migrations.insert_one({
        "_id": f"profile_reset_{uuid.uuid4().hex[:8]}",
        "performed_at": now_iso(),
        "performed_by": user.get("user_id"),
        "backed_up_profiles": custom_profiles,
        "users_reassigned": result.modified_count,
    })
    
    return {
        "message": "Perfis resetados para o padrão",
        "users_reassigned": result.modified_count,
        "backed_up_profiles_count": len(custom_profiles),
    }


# ==================== USER - CHECK PAGE ACCESS ====================

@app.get("/api/admin/check-access/{page}")
async def check_page_access(request: Request, page: str, user: dict = Depends(get_current_user)):
    """Verifica se o usuário tem acesso a uma página específica do admin."""
    db = request.app.db
    
    has_access = await role_profiles.has_page_access(db, user, page)
    
    return {
        "page": page,
        "has_access": has_access,
        "user_role": user.get("role"),
        "available_pages": await role_profiles.get_profile_pages(db, user.get("role", "customer")),
    }


# ==================== END ROLE PROFILES ====================
