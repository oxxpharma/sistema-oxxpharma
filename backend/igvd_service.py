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
from typing import Any, Dict, Optional


def _clean_cpf(v: Any) -> str:
    return re.sub(r"\D", "", str(v or ""))


def _pick_first(d: Dict, *keys: str) -> Any:
    """Retorna o primeiro valor nao-vazio entre as chaves informadas."""
    for k in keys:
        v = d.get(k) if isinstance(d, dict) else None
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        return v
    return None


def _normalize_lic_address(addr: Dict) -> Dict:
    """Iter 52: aceita chaves em varios idiomas (pt-BR + en). Retorna dict
    padronizado com street/number/complement/neighborhood/city/state/zip_code."""
    if not isinstance(addr, dict):
        return {}
    state = str(_pick_first(addr, "state", "uf", "estado") or "").strip().upper()[:2]
    zip_raw = _clean_cpf(_pick_first(addr, "zip_code", "zipcode", "cep", "postal_code", "postalCode"))
    return {
        "street": str(_pick_first(addr, "street", "logradouro", "rua", "endereco") or "").strip(),
        "number": str(_pick_first(addr, "number", "numero") or "").strip(),
        "complement": str(_pick_first(addr, "complement", "complemento") or "").strip(),
        "neighborhood": str(_pick_first(addr, "neighborhood", "bairro") or "").strip(),
        "city": str(_pick_first(addr, "city", "cidade", "municipio") or "").strip(),
        "state": state,
        "zip_code": (f"{zip_raw[:5]}-{zip_raw[5:]}" if len(zip_raw) == 8 else str(_pick_first(addr, "zip_code", "cep", "postal_code") or "").strip()),
        "zip_digits": zip_raw if len(zip_raw) == 8 else "",
    }


def _normalize_lic(lic: Dict) -> Dict:
    """Iter 52: aceita variacoes comuns de campos vindos da IGVD."""
    if not isinstance(lic, dict):
        return {}
    cpf_raw = _pick_first(lic, "cpf", "cpf_digits", "document", "documento", "document_number", "cpfCnpj", "cpf_cnpj")
    cpf_digits = _clean_cpf(cpf_raw)
    return {
        "cpf_raw": cpf_raw,
        "cpf_digits": cpf_digits if len(cpf_digits) == 11 else "",
        "email": str(_pick_first(lic, "email", "e_mail", "mail") or "").strip().lower(),
        "full_name": str(_pick_first(lic, "full_name", "name", "nome", "nome_completo") or "").strip(),
        "phone": str(_pick_first(lic, "phone", "telefone", "celular", "mobile") or "").strip(),
        "birth_date": _pick_first(lic, "birth_date", "birthdate", "data_nascimento", "nascimento"),
        "address": _normalize_lic_address(_pick_first(lic, "address", "endereco") or {}),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_indexes(db) -> None:
    await db.igvd_vouchers.create_index("voucher_code", unique=True, sparse=True)
    await db.igvd_vouchers.create_index("idempotency_key", unique=True, sparse=True)
    await db.igvd_vouchers.create_index("licenciado_cpf_digits")
    await db.igvd_vouchers.create_index("licenciado_email")
    await db.igvd_vouchers.create_index("status")
    # Iter 48b: pedidos gerados pela integracao IGVD (idempotencia por voucher + user)
    await db.orders.create_index("igvd_voucher_code", sparse=True)


async def get_config(db) -> Dict:
    s = await db.settings.find_one({"_id": "global"}) or {}
    return {
        "igvd_voucher_enabled": bool(s.get("igvd_voucher_enabled")),
        "igvd_voucher_secret": s.get("igvd_voucher_secret") or "",
    }


async def lookup_user_by_email(db, email: str) -> Dict:
    """Iter 56: retorna user_id + lider (sponsor) do usuario pelo e-mail.
    Nao expoe dados sensiveis (senha, endereco, CPF). O `leader` privilegia
    `network_sponsor_id` (patrocinador MMN); cai para `sponsor_id` se ausente.

    Iter 57: `user_id` na resposta usa o `external_id` (ID legado numerico,
    ex.: "5180") quando disponivel, com fallback para o `user_id` interno.
    A IGVD depende do ID legado para reconciliar cadastros historicos.
    """
    if not email:
        return {"found": False, "user": None, "leader": None, "sponsor_source": None}
    q = (email or "").strip().lower()
    projection = {
        "_id": 0, "user_id": 1, "external_id": 1, "name": 1, "email": 1,
        "network_type": 1, "sponsor_id": 1, "network_sponsor_id": 1,
    }
    user = await db.users.find_one(
        {"email": {"$regex": f"^{re.escape(q)}$", "$options": "i"}},
        projection,
    )
    if not user:
        return {"found": False, "user": None, "leader": None, "sponsor_source": None}

    def _legacy_id(doc: Dict) -> Optional[str]:
        raw = doc.get("external_id")
        if raw is None or raw == "":
            raw = doc.get("user_id")
        return str(raw) if raw is not None else None

    leader_doc = None
    src = None
    leader_projection = {"_id": 0, "user_id": 1, "external_id": 1, "name": 1, "email": 1, "network_type": 1}
    net_sp = user.get("network_sponsor_id")
    sp = user.get("sponsor_id")
    if net_sp:
        leader_doc = await db.users.find_one({"user_id": net_sp}, leader_projection)
        if leader_doc:
            src = "network_sponsor_id"
    if not leader_doc and sp:
        leader_doc = await db.users.find_one({"user_id": sp}, leader_projection)
        if leader_doc:
            src = "sponsor_id"

    leader_payload = None
    if leader_doc:
        leader_payload = {
            "user_id": _legacy_id(leader_doc),
            "name": leader_doc.get("name"),
            "email": leader_doc.get("email"),
            "network_type": leader_doc.get("network_type"),
        }

    return {
        "found": True,
        "user": {
            "user_id": _legacy_id(user),
            "name": user.get("name"),
            "email": user.get("email"),
            "network_type": user.get("network_type"),
        },
        "leader": leader_payload,
        "sponsor_source": src,
    }


async def _find_user(db, email: str, cpf_digits: str) -> Optional[Dict]:
    """Busca user por CPF (varios formatos) e por e-mail (case-insensitive).
    Iter 48d: pega users antigos que so tem `cpf` formatado (sem `cpf_digits`)
    e emails salvos com case diferente."""
    if cpf_digits and len(cpf_digits) == 11:
        cpf_fmt = f"{cpf_digits[:3]}.{cpf_digits[3:6]}.{cpf_digits[6:9]}-{cpf_digits[9:]}"
        u = await db.users.find_one(
            {"$or": [
                {"cpf_digits": cpf_digits},
                {"cpf": cpf_digits},
                {"cpf": cpf_fmt},
            ]},
            {"_id": 0, "user_id": 1, "email": 1},
        )
        if u:
            return u
    if email:
        pattern = f"^{re.escape(email.strip())}$"
        u = await db.users.find_one({"email": {"$regex": pattern, "$options": "i"}}, {"_id": 0, "user_id": 1, "email": 1})
        if u:
            return u
    return None


async def _load_kit_config(db) -> Dict:
    """Le a configuracao do Kit de Adesao IGVD (produtos)."""
    s = await db.settings.find_one({"_id": "global"}) or {}
    return {
        "kit_items": list(s.get("igvd_kit_items") or []),  # [{product_id, quantity}]
    }


def _gen_order_id() -> str:
    import secrets
    return "ord_" + secrets.token_hex(6)


async def _enrich_user_from_igvd(db, user_doc: Dict, voucher_doc: Dict) -> Dict:
    """Iter 48e: completa CPF e endereco do user com dados vindos da IGVD, caso
    o user esteja com esses campos vazios. Retorna a versao atualizada do user.
    Iter 52: sempre pega dados via `_normalize_lic` (aceita chaves aliadas).
    Persiste tambem CEP em endereco default existente quando o user ja tem
    endereco mas sem CEP."""
    updates: Dict = {}

    # CPF: preencher se user nao tem
    user_cpf_digits = _clean_cpf(user_doc.get("cpf_digits") or user_doc.get("cpf") or "")
    if len(user_cpf_digits) < 11:
        lic_cpf = voucher_doc.get("licenciado_cpf_digits") or ""
        if len(lic_cpf) == 11:
            updates["cpf"] = f"{lic_cpf[:3]}.{lic_cpf[3:6]}.{lic_cpf[6:9]}-{lic_cpf[9:]}"
            updates["cpf_digits"] = lic_cpf

    # Telefone: preencher se user nao tem
    if not (user_doc.get("phone") or "").strip():
        lic_phone = (voucher_doc.get("licenciado_phone") or "").strip()
        if lic_phone:
            updates["phone"] = lic_phone

    # Iter 52: endereco IGVD ja normalizado no ingest (fields em ingles + zip_digits).
    lic_addr = voucher_doc.get("licenciado_address") or {}

    addrs = list(user_doc.get("addresses") or [])
    if not addrs:
        # Cria endereco default a partir do payload IGVD
        if lic_addr.get("street") or lic_addr.get("city") or lic_addr.get("zip_digits"):
            import secrets
            zip_d = lic_addr.get("zip_digits") or ""
            new_addr = {
                "address_id": "addr_" + secrets.token_hex(6),
                "label": "Adesão IGVD",
                "name": user_doc.get("name") or voucher_doc.get("licenciado_name") or "",
                "street": lic_addr.get("street") or "",
                "number": lic_addr.get("number") or "S/N",
                "complement": lic_addr.get("complement") or "",
                "neighborhood": lic_addr.get("neighborhood") or "",
                "city": lic_addr.get("city") or "",
                "state": lic_addr.get("state") or "",
                "zip_code": (f"{zip_d[:5]}-{zip_d[5:]}" if len(zip_d) == 8 else (lic_addr.get("zip_code") or "")),
                "is_default": True,
            }
            updates["addresses"] = [new_addr]
    else:
        # Iter 52: se ja tem endereco default sem CEP/campos, preenche com o payload IGVD
        # e persiste no perfil (nao so no pedido) para nao gerar novo pedido sem CEP.
        default_idx = next((i for i, a in enumerate(addrs) if a.get("is_default")), 0)
        cur = dict(addrs[default_idx])
        changed = False
        cur_zip_digits = re.sub(r"\D", "", str(cur.get("zip_code") or ""))
        lic_zip = lic_addr.get("zip_digits") or ""
        if len(cur_zip_digits) != 8 and len(lic_zip) == 8:
            cur["zip_code"] = f"{lic_zip[:5]}-{lic_zip[5:]}"
            changed = True
        for k in ("street", "number", "neighborhood", "city", "state", "complement"):
            if not (cur.get(k) or "").strip() and (lic_addr.get(k) or "").strip():
                cur[k] = lic_addr[k]
                changed = True
        if changed:
            addrs[default_idx] = cur
            updates["addresses"] = addrs

    if updates:
        await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": updates})
        user_doc = {**user_doc, **updates}
    return user_doc


async def _create_paid_kit_order(db, voucher_doc: Dict, user_doc: Dict) -> Dict:
    """Cria um pedido JA PAGO no cadastro do user com os produtos do Kit
    configurados no admin. Idempotente: 1 pedido por voucher_code E no maximo
    1 pedido IGVD por user. Retorna dict com order_id ou reason quando nao criou."""
    user_id = user_doc["user_id"]

    # Idempotencia 1: ja existe pedido gerado por este voucher?
    existing_by_voucher = await db.orders.find_one({"igvd_voucher_code": voucher_doc["voucher_code"]}, {"_id": 0, "order_id": 1})
    if existing_by_voucher:
        return {"order_id": existing_by_voucher["order_id"], "reason": None}

    # Idempotencia 2: usuario ja recebeu um pedido IGVD? (regra: 1 vez por conta)
    existing_by_user = await db.orders.find_one({"user_id": user_id, "igvd_voucher_code": {"$ne": None}}, {"_id": 0, "order_id": 1, "igvd_voucher_code": 1})
    if existing_by_user:
        return {"order_id": None, "reason": f"user_ja_tem_pedido_igvd:{existing_by_user['order_id']}"}

    cfg = await _load_kit_config(db)
    kit_items = cfg["kit_items"]
    if not kit_items:
        return {"order_id": None, "reason": "kit_nao_configurado"}

    # Enriquece os itens com dados atuais dos produtos
    pids = [str(k.get("product_id")) for k in kit_items if k.get("product_id")]
    prod_map = {}
    async for p in db.products.find({"product_id": {"$in": pids}}, {"_id": 0}):
        prod_map[p["product_id"]] = p
    order_items = []
    subtotal = 0.0
    for k in kit_items:
        pid = str(k.get("product_id"))
        qty = int(k.get("quantity") or 1)
        p = prod_map.get(pid)
        if not p:
            continue  # produto foi apagado; ignora
        # Iter 52: `unit_price` do kit override o preco base do produto. Isso e' critico
        # para o calculo correto de cashback e para a fatura (evita cobrar/creditar
        # em cima do preco cheio da vitrine quando a IGVD tem valor especial).
        override = k.get("unit_price")
        try:
            unit_price = float(override) if override is not None and str(override).strip() != "" else float(p.get("price") or 0)
        except (TypeError, ValueError):
            unit_price = float(p.get("price") or 0)
        item_total = round(unit_price * qty, 2)
        subtotal += item_total
        order_items.append({
            "product_id": pid,
            "name": p.get("name"),
            "price": unit_price,
            "quantity": qty,
            "total": item_total,
            "sku": p.get("sku") or "",
            "ean": p.get("ean") or "",
            # Iter 48f: preserva points_value do produto para gerar cashback
            # do sponsor via register_points_from_order.
            "points_value": float(p.get("points_value") or 0),
        })
    if not order_items:
        return {"order_id": None, "reason": "produtos_do_kit_nao_existem_mais"}

    # Endereco de entrega: prioriza endereco default do user; se nao tiver,
    # constroi a partir dos dados do licenciado enviados pela IGVD.
    addrs = user_doc.get("addresses") or []
    default_addr = next((a for a in addrs if a.get("is_default")), addrs[0] if addrs else None)
    lic_addr = voucher_doc.get("licenciado_address") or {}
    lic_zip_digits = lic_addr.get("zip_digits") or re.sub(r"\D", "", str(lic_addr.get("zip_code") or ""))

    if default_addr:
        # Iter 48f: preenche lacunas do endereco default com dados do payload
        # (comum: user cadastrou sem CEP, IGVD envia CEP completo).
        merged = dict(default_addr)
        cur_zip_digits = re.sub(r"\D", "", str(merged.get("zip_code") or ""))
        if len(cur_zip_digits) != 8 and len(lic_zip_digits) == 8:
            merged["zip_code"] = f"{lic_zip_digits[:5]}-{lic_zip_digits[5:]}"
        for k in ("street", "number", "neighborhood", "city", "state", "complement"):
            if not (merged.get(k) or "").strip() and (lic_addr.get(k) or "").strip():
                merged[k] = lic_addr[k].strip() if k != "state" else lic_addr[k].strip().upper()[:2]
        ship_addr = merged
    else:
        # Snapshot minimo a partir do payload IGVD
        ship_addr = {
            "address_id": "igvd_snapshot",
            "label": "Endereço IGVD",
            "name": user_doc.get("name") or voucher_doc.get("licenciado_name") or "",
            "street": lic_addr.get("street") or "",
            "number": lic_addr.get("number") or "",
            "complement": lic_addr.get("complement") or "",
            "neighborhood": lic_addr.get("neighborhood") or "",
            "city": lic_addr.get("city") or "",
            "state": lic_addr.get("state") or "",
            "zip_code": (f"{lic_zip_digits[:5]}-{lic_zip_digits[5:]}" if len(lic_zip_digits) == 8 else (lic_addr.get("zip_code") or "")),
        }

    now = _now_iso()
    amount_brl = float(voucher_doc.get("amount_brl") or 0)
    # Iter 52: CPF do pedido — SEMPRE cai no CPF do payload IGVD se o user nao
    # tiver (garante que a fatura sai com CPF mesmo se o enrich falhou por race).
    lic_cpf_digits = voucher_doc.get("licenciado_cpf_digits") or ""
    order_cpf_digits = _clean_cpf(user_doc.get("cpf_digits") or user_doc.get("cpf") or "") or lic_cpf_digits
    if len(order_cpf_digits) == 11 and not (user_doc.get("cpf") or "").strip():
        order_cpf_fmt = f"{order_cpf_digits[:3]}.{order_cpf_digits[3:6]}.{order_cpf_digits[6:9]}-{order_cpf_digits[9:]}"
    else:
        order_cpf_fmt = user_doc.get("cpf") or (f"{lic_cpf_digits[:3]}.{lic_cpf_digits[3:6]}.{lic_cpf_digits[6:9]}-{lic_cpf_digits[9:]}" if len(lic_cpf_digits) == 11 else "")
    order = {
        "order_id": _gen_order_id(),
        "user_id": user_id,
        "customer_name": user_doc.get("name") or voucher_doc.get("licenciado_name") or "",
        "customer_email": user_doc.get("email") or voucher_doc.get("licenciado_email") or "",
        "customer_cpf": order_cpf_fmt,
        "customer_cpf_digits": order_cpf_digits if len(order_cpf_digits) == 11 else "",
        "customer_phone": user_doc.get("phone") or voucher_doc.get("licenciado_phone") or "",
        "items": order_items,
        "subtotal": round(subtotal, 2),
        # Iter 48c: pedido IGVD eh de ENVIO (nao retirada). Frete zerado pois esta
        # coberto pelo valor pago na adesao.
        "shipping_cost": 0.0,
        "shipping_service_name": "Envio Kit IGVD",
        "shipping_carrier": "IGVD",
        "shipping_service_id": "igvd_kit_shipping",
        "shipping_delivery_days": None,
        "discount_amount": 0.0,
        "coupon_code": None,
        "voucher_used": 0.0,
        # Iter 52: `total` = subtotal (source of truth = kit config no admin, com
        # `unit_price` override respeitado). O `amount_brl` do payload IGVD fica
        # apenas como referencia em `igvd_amount_brl`, mas nao dita o total do
        # pedido para evitar cashback/fatura com valor cheio quando o admin ja
        # configurou o preco contextual correto.
        "total": round(subtotal, 2),
        "total_before_voucher": round(subtotal, 2),
        "igvd_amount_brl": amount_brl if amount_brl > 0 else None,
        "shipping_address": ship_addr,
        "is_pickup": False,
        "pickup_snapshot": None,
        "payment_method": "igvd_voucher",
        "payment_status": "paid",  # ja pago pela IGVD
        "order_status": "paid",
        "paid_at": now,
        "igvd_voucher_code": voucher_doc["voucher_code"],
        "igvd_adesao_id": voucher_doc.get("adesao_id"),
        "created_at": now,
        "updated_at": now,
    }
    # Tenant default (kit sempre no tenant principal)
    order["tenant"] = "oxxpharma"
    await db.orders.insert_one(order)
    return {"order_id": order["order_id"], "reason": None}


async def _apply_voucher_to_user(db, voucher_doc: Dict, user_id: str) -> Dict:
    """Aplica o voucher IGVD: gera o pedido pago com o Kit de Adesao configurado."""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return {"success": False, "voucher_code": voucher_doc["voucher_code"], "status": "pending", "message": "User nao encontrado"}
    # Iter 48e: enriquece o user com CPF/endereco/telefone vindos da IGVD (se faltarem)
    user = await _enrich_user_from_igvd(db, user, voucher_doc)
    r = await _create_paid_kit_order(db, voucher_doc, user)
    order_id = r.get("order_id")
    reason = r.get("reason")
    if not order_id:
        # Nao criou o pedido — grava motivo detalhado e mantem pending
        friendly = {
            "kit_nao_configurado": "Kit de Adesao nao configurado no admin",
            "produtos_do_kit_nao_existem_mais": "Produtos do Kit foram removidos do catalogo",
        }.get(reason, reason or "Erro desconhecido")
        if reason and reason.startswith("user_ja_tem_pedido_igvd"):
            friendly = f"User ja recebeu pedido IGVD anterior ({reason.split(':')[1]})"
        await db.igvd_vouchers.update_one(
            {"voucher_code": voucher_doc["voucher_code"]},
            {"$set": {"status": "pending", "note": friendly}},
        )
        return {
            "success": True,
            "user_id": user_id,
            "voucher_code": voucher_doc["voucher_code"],
            "status": "pending",
            "message": friendly,
        }
    await db.igvd_vouchers.update_one(
        {"voucher_code": voucher_doc["voucher_code"]},
        {"$set": {
            "status": "applied",
            "applied_user_id": user_id,
            "applied_at": _now_iso(),
            "generated_order_id": order_id,
            "note": None,
        }},
    )
    return {
        "success": True,
        "user_id": user_id,
        "voucher_code": voucher_doc["voucher_code"],
        "order_id": order_id,
        "credited_amount_cents": int(round(float(voucher_doc.get("amount_brl") or 0) * 100)),
        "status": "applied",
    }


async def ingest_voucher(db, payload: Dict, idempotency_key: Optional[str]) -> Dict:
    """Persiste o voucher recebido e aplica imediatamente se houver user.
    Retorna o body de resposta seguindo o contrato."""
    voucher = payload.get("voucher") or {}
    # Iter 52: aceita `licenciado` OU `customer` OU `user` como container
    lic_raw = payload.get("licenciado") or payload.get("customer") or payload.get("user") or {}
    lic = _normalize_lic(lic_raw)
    code = (voucher.get("code") or "").strip()
    if not code:
        raise ValueError("voucher.code obrigatorio")
    amount_cents = int(voucher.get("amount_cents") or 0)
    amount_brl = float(voucher.get("amount_brl") or (amount_cents / 100.0))
    cpf_digits = lic["cpf_digits"]
    email = lic["email"]

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
        "licenciado_name": lic["full_name"],
        "licenciado_email": email,
        "licenciado_cpf_digits": cpf_digits,
        "licenciado_phone": lic["phone"],
        "licenciado_birth_date": lic["birth_date"],
        "licenciado_address": lic["address"],
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


async def apply_pending_for_user(db, user_id: str, email: Optional[str], cpf: Optional[str]) -> list:
    """Hook chamado no register/admin-create: aplica todos vouchers pending que
    casem com o CPF ou e-mail recebidos. Retorna a lista de order_ids gerados
    (para que o caller dispare faturas)."""
    cpf_digits = _clean_cpf(cpf or "")
    or_conditions = []
    if cpf_digits and len(cpf_digits) == 11:
        or_conditions.append({"licenciado_cpf_digits": cpf_digits})
    if email:
        or_conditions.append({"licenciado_email": {"$regex": f"^{re.escape(email.strip())}$", "$options": "i"}})
    if not or_conditions:
        return []
    pending = await db.igvd_vouchers.find(
        {"status": "pending", "$or": or_conditions},
        {"_id": 0},
    ).to_list(50)
    generated: list = []
    for v in pending:
        r = await _apply_voucher_to_user(db, v, user_id)
        if r.get("status") == "applied" and r.get("order_id"):
            generated.append(r["order_id"])
    return generated
