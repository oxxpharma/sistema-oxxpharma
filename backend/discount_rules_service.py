"""
Serviço de Regras de Desconto Dinâmicas (OxxPharma)
Permite configurar e avaliar regras de desconto por:
- Usuário específico (ou lista de usuários)
- Categoria de usuário (tags em user_categories)
- Funcionário (apenas funcionários, apenas não funcionários, ou todos)
- Região do Brasil (Sul, Sudeste, etc.) e/ou Estados (UFs)
- Primeira compra
- Escopo de produtos: Todos, Categorias, Subcategorias ou SKUs específicos
- Exceções: "Todos os produtos MENOS X, Y, Z produtos" (excluded_products)
- Critérios extras: Subtotal mín/máx, Qtd mínima de itens, Forma de pagamento, Vigência, Limite de usos, Acúmulo com cupom.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

# Mapeamento oficial de Regiões do Brasil para UFs
BRAZIL_REGIONS = {
    "sul": ["PR", "SC", "RS"],
    "sudeste": ["SP", "RJ", "MG", "ES"],
    "centro_oeste": ["MS", "MT", "GO", "DF"],
    "nordeste": ["BA", "PE", "CE", "MA", "PB", "RN", "AL", "SE", "PI"],
    "norte": ["AM", "PA", "RO", "TO", "AC", "AP", "RR"],
}

ALL_BRAZILIAN_STATES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
]

# Mapa de prefixo de CEP para UF (caso não tenha state explícito)
CEP_PREFIX_TO_STATE = [
    (range(1000, 20000), "SP"),
    (range(20000, 29000), "RJ"),
    (range(29000, 30000), "ES"),
    (range(30000, 40000), "MG"),
    (range(40000, 49000), "BA"),
    (range(49000, 50000), "SE"),
    (range(50000, 57000), "PE"),
    (range(57000, 58000), "AL"),
    (range(58000, 59000), "PB"),
    (range(59000, 60000), "RN"),
    (range(60000, 64000), "CE"),
    (range(64000, 65000), "PI"),
    (range(65000, 66000), "MA"),
    (range(66000, 68900), "PA"),
    (range(68900, 69300), "AP"),
    (range(69300, 69400), "RR"),
    (range(69400, 69900), "AM"),
    (range(69900, 70000), "AC"),
    (range(70000, 73700), "DF"),
    (range(73700, 76800), "GO"),
    (range(76800, 77000), "RO"),
    (range(77000, 78000), "TO"),
    (range(78000, 79000), "MT"),
    (range(79000, 80000), "MS"),
    (range(80000, 88000), "PR"),
    (range(88000, 90000), "SC"),
    (range(90000, 100000), "RS"),
]


def _gen_id(prefix="disc_"):
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(val: Optional[str]) -> Optional[datetime]:
    if not val:
        return None
    try:
        raw = str(val).replace("Z", "+00:00")
        if len(raw) == 10:
            raw += "T00:00:00+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def extract_state_from_address_or_cep(address: Optional[Dict[str, Any]] = None, cep: Optional[str] = None) -> Optional[str]:
    """Extrai a UF em 2 letras (ex: 'PR', 'SP') a partir do endereço ou CEP."""
    if address:
        st = str(address.get("state") or address.get("uf") or "").strip().upper()
        if len(st) == 2 and st in ALL_BRAZILIAN_STATES:
            return st
        # Mapeamento por nome de estado por extenso
        st_lower = st.lower()
        state_names = {
            "paraná": "PR", "parana": "PR", "são paulo": "SP", "sao paulo": "SP",
            "rio de janeiro": "RJ", "minas gerais": "MG", "santa catarina": "SC",
            "rio grande do sul": "RS", "bahia": "BA", "goiás": "GO", "goias": "GO",
            "distrito federal": "DF", "espírito santo": "ES", "espirito santo": "ES",
            "mato grosso": "MT", "mato grosso do sul": "MS", "ceará": "CE", "ceara": "CE",
            "pernambuco": "PE", "paraíba": "PB", "paraiba": "PB", "maranhão": "MA",
            "maranhao": "MA", "pará": "PA", "para": "PA", "amazonas": "AM",
        }
        if st_lower in state_names:
            return state_names[st_lower]
        cep = cep or address.get("zip") or address.get("cep")

    if cep:
        digits = "".join([c for c in str(cep) if c.isdigit()])
        if len(digits) >= 5:
            try:
                first5 = int(digits[:5])
                for r, uf in CEP_PREFIX_TO_STATE:
                    if first5 in r:
                        return uf
            except Exception:
                pass
    return None


async def is_user_employee(db, user: Optional[Dict[str, Any]]) -> bool:
    """Verifica se o usuário é funcionário por flag, por categoria ou vínculo corporativo."""
    if not user:
        return False
    if user.get("is_employee") or user.get("employee"):
        return True
    # Checa categorias de usuário atribuídas
    user_cats = user.get("category_ids") or []
    if user_cats:
        cats_found = await db.user_categories.find(
            {"category_id": {"$in": user_cats}},
            {"_id": 0, "name": 1, "slug": 1}
        ).to_list(20)
        for c in cats_found:
            slug = (c.get("slug") or "").lower()
            name = (c.get("name") or "").lower()
            if "func" in slug or "func" in name or "colaborador" in slug or "colaborador" in name:
                return True
    # Checa se está registrado na coleção company_employees
    user_id = user.get("user_id")
    email = user.get("email")
    q = []
    if user_id:
        q.append({"user_id": user_id})
    if email:
        q.append({"email": email})
    if q:
        emp = await db.company_employees.find_one({"$or": q}, {"_id": 1})
        if emp:
            return True
    return False


async def is_first_purchase(db, user: Optional[Dict[str, Any]]) -> bool:
    """Verifica se o cliente nunca concluiu uma compra paga anterior."""
    if not user:
        return True  # Visitante é elegível à primeira compra
    user_id = user.get("user_id")
    email = user.get("email")
    cpf = "".join([c for c in str(user.get("cpf") or "") if c.isdigit()])

    conds = []
    if user_id:
        conds.append({"user_id": user_id})
    if email:
        conds.append({"customer_email": email})
    if cpf and len(cpf) >= 11:
        conds.append({"customer_cpf_digits": cpf})

    if not conds:
        return True

    paid_orders_count = await db.orders.count_documents({
        "$or": conds,
        "payment_status": "paid"
    })
    return paid_orders_count == 0


async def list_discount_rules(db, only_active: bool = False) -> List[Dict[str, Any]]:
    """Lista todas as regras de desconto configuradas."""
    q = {}
    if only_active:
        q["active"] = True
    cursor = db.discount_rules.find(q, {"_id": 0}).sort([("priority", -1), ("created_at", -1)])
    return await cursor.to_list(500)


async def get_discount_rule(db, rule_id: str) -> Optional[Dict[str, Any]]:
    return await db.discount_rules.find_one({"rule_id": rule_id}, {"_id": 0})


async def create_discount_rule(db, data: Dict[str, Any], author: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    rule_id = _gen_id("disc_")
    now = _now_iso()

    doc = {
        "rule_id": rule_id,
        "name": (data.get("name") or "Nova Regra de Desconto").strip(),
        "description": (data.get("description") or "").strip(),
        "badge_text": (data.get("badge_text") or "").strip(),  # Ex: '15% OFF Funcionários'
        "active": bool(data.get("active", True)),
        "priority": int(data.get("priority") or 0),  # Maior número = maior prioridade

        # Tipo e valor de desconto
        "discount_type": data.get("discount_type", "percent"),  # "percent" ou "fixed"
        "discount_value": float(data.get("discount_value") or 0),
        "max_discount": float(data["max_discount"]) if data.get("max_discount") not in (None, "") else None,

        # 1. Critérios de Público
        "target_audience": data.get("target_audience", "all"),  # "all", "specific_users", "user_categories"
        "target_user_ids": list(data.get("target_user_ids") or []),
        "target_user_emails": [e.strip().lower() for e in (data.get("target_user_emails") or []) if e],
        "target_user_categories": list(data.get("target_user_categories") or []),

        # 2. Critério de Funcionário
        "employee_criteria": data.get("employee_criteria", "all"),  # "all", "only_employees", "exclude_employees"

        # 3. Critério de 1ª Compra
        "only_first_purchase": bool(data.get("only_first_purchase", False)),

        # 4. Critério Regional (Brasil)
        "target_regions": list(data.get("target_regions") or []),  # ['sul', 'sudeste', etc.]
        "target_states": [st.upper() for st in (data.get("target_states") or []) if st],  # ['PR', 'SP', etc.]

        # 5. Escopo de Produtos
        "product_scope": data.get("product_scope", "all"),  # "all", "categories", "subcategories", "products"
        "applicable_categories": list(data.get("applicable_categories") or []),
        "applicable_subcategories": list(data.get("applicable_subcategories") or []),
        "applicable_products": list(data.get("applicable_products") or []),

        # 6. EXCEÇÕES: "Todos os produtos MENOS X, Y, Z produtos"
        "excluded_products": list(data.get("excluded_products") or []),
        "exclude_on_sale": bool(data.get("exclude_on_sale", False)),

        # 7. Condições Adicionais / Sugeridas
        "min_subtotal": float(data.get("min_subtotal") or 0),
        "max_subtotal": float(data["max_subtotal"]) if data.get("max_subtotal") not in (None, "") else None,
        "min_quantity": int(data.get("min_quantity") or 0),  # Qtd mínima de itens elegíveis
        "payment_methods": list(data.get("payment_methods") or []),  # ['pix', 'credit_card', 'boleto']; vazio = todas
        "valid_from": data.get("valid_from"),
        "valid_until": data.get("valid_until"),
        "usage_limit": int(data["usage_limit"]) if data.get("usage_limit") not in (None, "") else None,
        "per_user_limit": int(data["per_user_limit"]) if data.get("per_user_limit") not in (None, "") else None,
        "allow_cumulative_coupon": bool(data.get("allow_cumulative_coupon", True)),

        # Estatísticas
        "times_used": 0,
        "total_discount_given": 0.0,
        "created_at": now,
        "updated_at": now,
        "created_by": author.get("email") if author else None,
    }

    await db.discount_rules.insert_one(doc)
    return await get_discount_rule(db, rule_id)


async def update_discount_rule(db, rule_id: str, data: Dict[str, Any], author: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    existing = await get_discount_rule(db, rule_id)
    if not existing:
        return None

    update: Dict[str, Any] = {"updated_at": _now_iso()}
    fields = [
        "name", "description", "badge_text", "active", "priority",
        "discount_type", "discount_value", "target_audience",
        "target_user_ids", "target_user_emails", "target_user_categories",
        "employee_criteria", "only_first_purchase", "target_regions", "target_states",
        "product_scope", "applicable_categories", "applicable_subcategories",
        "applicable_products", "excluded_products", "exclude_on_sale",
        "min_subtotal", "min_quantity", "payment_methods",
        "valid_from", "valid_until", "allow_cumulative_coupon"
    ]
    for f in fields:
        if f in data:
            update[f] = data[f]

    # Campos que podem ser limpos para None
    for opt_field in ["max_discount", "max_subtotal", "usage_limit", "per_user_limit"]:
        if opt_field in data:
            val = data[opt_field]
            if val in (None, "", "null"):
                update[opt_field] = None
            else:
                update[opt_field] = float(val) if "subtotal" in opt_field or "discount" in opt_field else int(val)

    if author:
        update["updated_by"] = author.get("email")

    await db.discount_rules.update_one({"rule_id": rule_id}, {"$set": update})
    return await get_discount_rule(db, rule_id)


async def delete_discount_rule(db, rule_id: str) -> bool:
    res = await db.discount_rules.delete_one({"rule_id": rule_id})
    return res.deleted_count > 0


async def toggle_discount_rule(db, rule_id: str) -> Optional[Dict[str, Any]]:
    existing = await get_discount_rule(db, rule_id)
    if not existing:
        return None
    new_status = not existing.get("active", True)
    await db.discount_rules.update_one({"rule_id": rule_id}, {"$set": {"active": new_status, "updated_at": _now_iso()}})
    return await get_discount_rule(db, rule_id)


async def evaluate_discount_rules(
    db,
    items: List[Dict[str, Any]],
    user: Optional[Dict[str, Any]] = None,
    shipping_address: Optional[Dict[str, Any]] = None,
    payment_method: Optional[str] = None,
    coupon_applied: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Avalia todas as regras de desconto ativas para os itens e contexto do pedido.
    Retorna o desconto total calculado, as regras aplicadas e os itens elegíveis.
    """
    if not items:
        return {"total_discount": 0.0, "rules_applied": [], "all_eligible_items": [], "excluded_items": []}

    active_rules = await list_discount_rules(db, only_active=True)
    if not active_rules:
        return {"total_discount": 0.0, "rules_applied": [], "all_eligible_items": [], "excluded_items": []}

    # Pré-carrega metadados de produtos
    pids = [it.get("product_id") for it in items if it.get("product_id")]
    prods_map = {}
    if pids:
        async for p in db.products.find(
            {"product_id": {"$in": pids}},
            {"_id": 0, "product_id": 1, "name": 1, "sku": 1, "category": 1, "categories": 1, "subcategory": 1, "subcategories": 1, "sale_price": 1, "price": 1}
        ):
            prods_map[p["product_id"]] = p

    # Dicionários de equivalência ID <-> Nome para categorias e subcategorias
    cat_id_to_name, cat_name_to_id = {}, {}
    async for c in db.categories.find({}, {"_id": 0, "category_id": 1, "name": 1}):
        if c.get("category_id") and c.get("name"):
            cat_id_to_name[c["category_id"]] = c["name"]
            cat_name_to_id[c["name"]] = c["category_id"]

    sub_id_to_name, sub_name_to_id = {}, {}
    async for s in db.subcategories.find({}, {"_id": 0, "subcategory_id": 1, "name": 1}):
        if s.get("subcategory_id") and s.get("name"):
            sub_id_to_name[s["subcategory_id"]] = s["name"]
            sub_name_to_id[s["name"]] = s["subcategory_id"]

    now = datetime.now(timezone.utc)
    user_state = extract_state_from_address_or_cep(shipping_address)

    # Cache de checagens de usuário para evitar queries repetidas
    cached_is_employee: Optional[bool] = None
    cached_first_purchase: Optional[bool] = None

    rules_applied = []
    total_discount_accum = 0.0

    cart_subtotal = sum(float(it.get("price") or 0) * int(it.get("quantity", 1) or 1) for it in items)

    for rule in active_rules:
        # 1. Vigência (datas de validade)
        vf = _parse_iso(rule.get("valid_from"))
        vu = _parse_iso(rule.get("valid_until"))
        if vf and now < vf:
            continue
        if vu and now > vu:
            continue

        # 2. Acúmulo com cupom
        if coupon_applied and not rule.get("allow_cumulative_coupon", True):
            continue

        # 3. Limite total de usos
        if rule.get("usage_limit") and int(rule.get("times_used") or 0) >= int(rule["usage_limit"]):
            continue

        # 4. Limite de usos por usuário
        if rule.get("per_user_limit") and user and user.get("user_id"):
            u_uses = await db.orders.count_documents({
                "user_id": user["user_id"],
                "discount_rules_applied.rule_id": rule["rule_id"],
                "payment_status": "paid",
            })
            if u_uses >= int(rule["per_user_limit"]):
                continue

        # 5. Critério de Público (Público-Alvo)
        target_aud = rule.get("target_audience", "all")
        if target_aud == "specific_users":
            if not user:
                continue
            u_id = user.get("user_id")
            u_email = (user.get("email") or "").lower()
            allowed_ids = set(rule.get("target_user_ids") or [])
            allowed_emails = set([e.lower() for e in (rule.get("target_user_emails") or [])])
            if u_id not in allowed_ids and u_email not in allowed_emails:
                continue

        elif target_aud == "user_categories":
            if not user:
                continue
            user_cats = set(user.get("category_ids") or [])
            rule_cats = set(rule.get("target_user_categories") or [])
            if not user_cats.intersection(rule_cats):
                continue

        # 6. Critério de Funcionário
        emp_crit = rule.get("employee_criteria", "all")
        if emp_crit != "all":
            if cached_is_employee is None:
                cached_is_employee = await is_user_employee(db, user)
            if emp_crit == "only_employees" and not cached_is_employee:
                continue
            if emp_crit == "exclude_employees" and cached_is_employee:
                continue

        # 7. Critério de Primeira Compra
        if rule.get("only_first_purchase"):
            if cached_first_purchase is None:
                cached_first_purchase = await is_first_purchase(db, user)
            if not cached_first_purchase:
                continue

        # 8. Critério Regional (Brasil / UF)
        target_regions = set([r.lower() for r in (rule.get("target_regions") or [])])
        target_states = set([s.upper() for s in (rule.get("target_states") or [])])

        if target_regions or target_states:
            # Requer validação do estado
            if not user_state:
                # Se ainda não temos o estado da entrega, não aplica a regra regional
                continue
            state_match = user_state in target_states
            region_match = False
            for reg in target_regions:
                states_in_reg = BRAZIL_REGIONS.get(reg, [])
                if user_state in states_in_reg:
                    region_match = True
                    break
            if not (state_match or region_match):
                continue

        # 9. Condições de Subtotal
        if rule.get("min_subtotal") and cart_subtotal < float(rule["min_subtotal"]):
            continue
        if rule.get("max_subtotal") and cart_subtotal > float(rule["max_subtotal"]):
            continue

        # 10. Forma de Pagamento
        pay_methods = set([pm.lower() for pm in (rule.get("payment_methods") or [])])
        if pay_methods and payment_method:
            pm_norm = payment_method.lower()
            if pm_norm in ("card", "credit_card"):
                pm_check = "credit_card"
            else:
                pm_check = pm_norm
            if pm_check not in pay_methods and pm_norm not in pay_methods:
                continue

        # 11. Escopo de Produtos & Exceções ("Todos os produtos MENOS X, Y, Z")
        scope = rule.get("product_scope", "all")
        excluded_pids = set(rule.get("excluded_products") or [])
        exclude_on_sale = bool(rule.get("exclude_on_sale", False))

        app_cats = set(rule.get("applicable_categories") or [])
        # Expande nomes e IDs de categorias
        for c in list(app_cats):
            if c in cat_id_to_name:
                app_cats.add(cat_id_to_name[c])
            if c in cat_name_to_id:
                app_cats.add(cat_name_to_id[c])

        app_subs = set(rule.get("applicable_subcategories") or [])
        # Expande nomes e IDs de subcategorias
        for s in list(app_subs):
            if s in sub_id_to_name:
                app_subs.add(sub_id_to_name[s])
            if s in sub_name_to_id:
                app_subs.add(sub_name_to_id[s])

        app_prods = set(rule.get("applicable_products") or [])

        rule_eligible_items = []
        rule_excluded_items = []

        for it in items:
            pid = it.get("product_id")
            prod = prods_map.get(pid)
            it_name = it.get("name") or (prod.get("name") if prod else pid)

            # EXCEÇÃO PRIORITÁRIA: Se está na lista de produtos excluídos, descarta imediatamente
            if pid in excluded_pids:
                rule_excluded_items.append({"product_id": pid, "name": it_name, "reason": "Produto excluído da regra"})
                continue

            # EXCEÇÃO: Produto em promoção
            if exclude_on_sale and prod and prod.get("sale_price") and float(prod["sale_price"]) < float(prod.get("price") or 0):
                rule_excluded_items.append({"product_id": pid, "name": it_name, "reason": "Produto já em promoção"})
                continue

            # Avalia escopo
            is_match = False
            if scope == "all":
                is_match = True
            elif scope == "products":
                is_match = pid in app_prods
            elif scope == "categories":
                if prod:
                    p_cats = set(prod.get("categories") or [])
                    if prod.get("category"):
                        p_cats.add(prod["category"])
                    # Expande
                    for pc in list(p_cats):
                        if pc in cat_id_to_name:
                            p_cats.add(cat_id_to_name[pc])
                        if pc in cat_name_to_id:
                            p_cats.add(cat_name_to_id[pc])
                    if p_cats.intersection(app_cats):
                        is_match = True
            elif scope == "subcategories":
                if prod:
                    p_subs = set(prod.get("subcategories") or [])
                    if prod.get("subcategory"):
                        p_subs.add(prod["subcategory"])
                    for ps in list(p_subs):
                        if ps in sub_id_to_name:
                            p_subs.add(sub_id_to_name[ps])
                        if ps in sub_name_to_id:
                            p_subs.add(sub_name_to_id[ps])
                    if p_subs.intersection(app_subs):
                        is_match = True

            if is_match:
                rule_eligible_items.append(it)
            else:
                rule_excluded_items.append({"product_id": pid, "name": it_name, "reason": "Fora do escopo da regra"})

        if not rule_eligible_items:
            continue

        # 12. Quantidade mínima de itens elegíveis
        total_eligible_qty = sum(int(it.get("quantity", 1) or 1) for it in rule_eligible_items)
        if rule.get("min_quantity") and total_eligible_qty < int(rule["min_quantity"]):
            continue

        # 13. Cálculo do Desconto sobre os itens elegíveis
        eligible_subtotal = sum(float(it.get("price") or 0) * int(it.get("quantity", 1) or 1) for it in rule_eligible_items)
        dtype = rule.get("discount_type", "percent")
        dval = float(rule.get("discount_value") or 0)

        calc_discount = 0.0
        if dtype == "percent":
            calc_discount = round(eligible_subtotal * (dval / 100.0), 2)
        elif dtype == "fixed":
            calc_discount = round(min(dval, eligible_subtotal), 2)

        # Respeita o teto máximo de desconto se configurado
        if rule.get("max_discount") is not None and calc_discount > float(rule["max_discount"]):
            calc_discount = round(float(rule["max_discount"]), 2)

        # Não permite desconto negativo ou que supere o subtotal elegível
        calc_discount = max(0.0, min(calc_discount, eligible_subtotal))

        if calc_discount > 0:
            rules_applied.append({
                "rule_id": rule["rule_id"],
                "name": rule["name"],
                "badge_text": rule.get("badge_text") or rule["name"],
                "discount_type": dtype,
                "discount_value": dval,
                "discount_amount": calc_discount,
                "eligible_subtotal": eligible_subtotal,
                "eligible_items_count": len(rule_eligible_items),
                "eligible_products": [it.get("product_id") for it in rule_eligible_items],
            })
            total_discount_accum += calc_discount

    total_discount_accum = round(min(total_discount_accum, cart_subtotal), 2)

    return {
        "total_discount": total_discount_accum,
        "rules_applied": rules_applied,
        "active_rules_count": len(active_rules),
    }


async def record_discount_rules_usage(db, rules_applied: List[Dict[str, Any]]) -> None:
    """Incrementa contadores de uso quando o pedido é finalizado."""
    for r in rules_applied:
        rule_id = r.get("rule_id")
        amount = float(r.get("discount_amount") or 0)
        if rule_id:
            await db.discount_rules.update_one(
                {"rule_id": rule_id},
                {
                    "$inc": {"times_used": 1, "total_discount_given": amount},
                    "$set": {"last_used_at": _now_iso()}
                }
            )
