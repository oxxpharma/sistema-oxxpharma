"""Supressao mensal da rede MMN (Iter 59).

Ozoxx cancela cadastros com >6 meses de inatividade. Todo mes o admin da
OxxPharma sobe um relatorio `.xls/.xlsx` de cancelados e aplica a mesma
supressao aqui — suspende o `network_type` do usuario e reparenta os filhos
diretos dele para o upline ativo mais proximo.

Coleções:
  - `network_suppression_batches`  metadados do lote (status: draft|applied|reverted)
  - `network_suppression_entries`  1 linha por email no arquivo, com match + reparenting

Regras (confirmadas com o dono do produto):
  - Match: por e-mail case-insensitive (`user.email`).
  - Raiz sem upline: filhos ficam com `network_sponsor_id=null` (nao entra em nenhum lugar).
  - Suprimir: seta `suppressed=true`, `network_type='customer'`, guarda snapshot em
    `pre_suppression_*` para permitir revert. Login continua funcionando, pedidos ficam
    consultaveis.
  - Comissoes ja lancadas para o suprimido: NAO mexe. Admin decide manualmente.
  - Revert: soh permitido no MESMO MES em que foi aplicado (proximo mes = fechamento).
  - Cascata: 2 fases — marca todo lote como `pending_suppression`, depois reparent
    resolve `resolve_active_upline` pulando quem ja esta no set do lote.
"""
from __future__ import annotations

import io
import logging
import os
import re
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("network_suppression")


# --------------------------------------------------------------------------- #
# Constantes / helpers                                                        #
# --------------------------------------------------------------------------- #

DEFAULT_TENANT = "oxxpharma"

CANONICAL_COLUMNS = {
    # canonical_name : [aliases]  (aliases sao normalizados p/ upper + sem punct)
    "email": ["EMAIL", "E MAIL", "E MAIL LICENCIADO", "EMAIL LICENCIADO", "EMAIL CADASTRO"],
    "nome": ["NOME", "NOME LICENCIADO", "RAZAO SOCIAL"],
    "cpf": ["CPF CNPJ", "CPF", "CNPJ", "DOCUMENTO"],
    "telefone": ["TELEFONE", "CELULAR", "FONE"],
    "cancelamento": [
        "DATA CANCELAMENTO", "DT CANCELAMENTO", "CANCELAMENTO", "DATA CANCELADO",
    ],
    "ativacao": ["DATA ATIVACAO", "ATIVACAO", "DT ATIVACAO"],
    "cadastro": ["DATA CADASTRO", "DT CADASTRO", "CADASTRO"],
}


def _norm_col(x: str) -> str:
    """Normaliza header: UPPER, remove acentos, remove barra/pontos."""
    if not isinstance(x, str):
        return ""
    import unicodedata
    s = unicodedata.normalize("NFD", x)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.upper().strip()
    s = re.sub(r"[/\.\-_]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s


def _norm_email(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip().lower()
    # Remove chars invisiveis / zero-width
    s = re.sub(r"[\u200b-\u200f\ufeff]", "", s)
    if s in ("nan", "none", "null"):
        return ""
    return s


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _batch_id() -> str:
    return "sup_" + uuid.uuid4().hex[:12]


def _entry_id() -> str:
    return "supe_" + uuid.uuid4().hex[:10]


# --------------------------------------------------------------------------- #
# Excel parsing                                                               #
# --------------------------------------------------------------------------- #

def _convert_xls_to_xlsx(xls_bytes: bytes) -> bytes:
    """Converte .xls (BIFF/OLE) para .xlsx via LibreOffice CLI.
    Pandas 2+ + xlrd 2.0.1 nao le mais .xls binario; conversao offline eh o caminho seguro.
    Iter 66.5: se `soffice` nao esta instalado (comum em prod sem libreoffice),
    tenta fallback via `xlrd` + `openpyxl`.
    """
    # Tentativa 1: soffice (mais robusto para formatos legados/complexos)
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "input.xls")
        with open(src, "wb") as f:
            f.write(xls_bytes)
        try:
            proc = subprocess.run(
                ["soffice", "--headless", "--convert-to", "xlsx", "--outdir", tmp, src],
                capture_output=True, timeout=60,
            )
            if proc.returncode == 0:
                out = os.path.join(tmp, "input.xlsx")
                if os.path.exists(out):
                    with open(out, "rb") as f:
                        return f.read()
        except (FileNotFoundError, PermissionError) as e:
            logger.warning(f"soffice indisponivel ({e}); tentando fallback xlrd")
        except subprocess.TimeoutExpired:
            logger.warning("soffice timeout; tentando fallback xlrd")
        # Fallback: xlrd + openpyxl (funciona para .xls simples BIFF5/BIFF8)
        try:
            import xlrd
            from openpyxl import Workbook
            book = xlrd.open_workbook(file_contents=xls_bytes)
            wb = Workbook()
            wb.remove(wb.active)
            for sheet_name in book.sheet_names():
                sheet = book.sheet_by_name(sheet_name)
                ws = wb.create_sheet(title=sheet_name[:31] or "Sheet1")
                for r in range(sheet.nrows):
                    for c in range(sheet.ncols):
                        val = sheet.cell_value(r, c)
                        ws.cell(row=r + 1, column=c + 1, value=val)
            buf = io.BytesIO()
            wb.save(buf)
            return buf.getvalue()
        except Exception as e2:
            raise ValueError(
                f"Nao consegui converter .xls (nem via soffice nem via xlrd). Salve como .xlsx no Excel/LibreOffice e reenvie. Detalhe: {e2}"
            )


def parse_workbook(file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Le o arquivo enviado pelo admin e retorna:
      - rows: [{email, nome, cpf, telefone, cancelamento, ativacao, cadastro, __raw}]
      - column_map: dict canonical_name -> nome real da coluna encontrada
    Aceita .xls (OLE binario) e .xlsx.
    """
    import pandas as pd

    name = (filename or "").lower()
    if name.endswith(".xls"):
        try:
            file_bytes = _convert_xls_to_xlsx(file_bytes)
        except Exception as e:
            raise ValueError(
                f"Nao foi possivel processar .xls. Reenvie salvo como .xlsx no Excel/LibreOffice. Detalhe: {e}"
            )
    # Pandas le xlsx diretamente com openpyxl
    df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl", dtype=object)

    # Detecta colunas
    col_lookup = {_norm_col(c): c for c in df.columns}
    column_map: Dict[str, str] = {}
    for canonical, aliases in CANONICAL_COLUMNS.items():
        for alias in aliases:
            norm = _norm_col(alias)
            if norm in col_lookup:
                column_map[canonical] = col_lookup[norm]
                break
    if "email" not in column_map:
        raise ValueError(
            f"Coluna de e-mail nao encontrada na planilha. Colunas detectadas: {list(df.columns)}"
        )

    rows: List[Dict[str, Any]] = []
    for idx, r in df.iterrows():
        email = _norm_email(r.get(column_map["email"]))
        if not email or "@" not in email:
            continue  # ignora linhas sem email valido
        row = {
            "__row": int(idx) + 2,  # +2 pra bater com linha do Excel (header + 1-index)
            "email": email,
            "nome": (str(r.get(column_map["nome"])).strip() if column_map.get("nome") else ""),
            "cpf": (str(r.get(column_map["cpf"])).strip() if column_map.get("cpf") else ""),
            "telefone": (str(r.get(column_map["telefone"])).strip() if column_map.get("telefone") else ""),
            "cancelamento": (str(r.get(column_map["cancelamento"])).strip() if column_map.get("cancelamento") else ""),
        }
        rows.append(row)
    return rows, column_map


# --------------------------------------------------------------------------- #
# Ensure indexes                                                              #
# --------------------------------------------------------------------------- #

async def ensure_indexes(db) -> None:
    await db.network_suppression_batches.create_index("batch_id", unique=True)
    await db.network_suppression_batches.create_index([("uploaded_at", -1)])
    await db.network_suppression_batches.create_index([("reference_month", 1), ("filename", 1)])
    await db.network_suppression_entries.create_index("entry_id", unique=True)
    await db.network_suppression_entries.create_index("batch_id")
    await db.network_suppression_entries.create_index([("batch_id", 1), ("email", 1)])


# --------------------------------------------------------------------------- #
# Preview                                                                     #
# --------------------------------------------------------------------------- #

async def _find_users_by_emails(db, emails: List[str]) -> Dict[str, List[Dict]]:
    """Retorna { email_lower: [users...] } — pode ter mais de um user por email.
    Iter 66.5: emails ja sao lowercase no cadastro (server.py line 850/865/929), entao
    usamos `$in` direto — evita regex gigante que quebra em producao (>1000 emails)."""
    if not emails:
        return {}
    result: Dict[str, List[Dict]] = {e: [] for e in emails}
    # Batching pra evitar queries gigantes (BSON limit 16MB, mas ate 5000 e OK)
    BATCH = 500
    for i in range(0, len(emails), BATCH):
        chunk = emails[i:i + BATCH]
        cursor = db.users.find(
            {"email": {"$in": chunk}},
            {"_id": 0, "password_hash": 0},
        )
        async for u in cursor:
            key = (u.get("email") or "").strip().lower()
            if key in result:
                result[key].append(u)
    # Fallback: para os que nao bateram, tenta case-insensitive individual (poucos, seguro)
    unmatched = [e for e, us in result.items() if not us]
    if unmatched and len(unmatched) < 200:
        for e in unmatched:
            u = await db.users.find_one(
                {"email": {"$regex": f"^{re.escape(e)}$", "$options": "i"}},
                {"_id": 0, "password_hash": 0},
            )
            if u:
                result[e].append(u)
    return result


def _resolve_upline(
    user: Dict,
    users_by_id: Dict[str, Dict],
    suppressed_ids: Set[str],
) -> Tuple[Optional[str], List[str]]:
    """Sobe a arvore ate achar um upline que NAO esteja no set de supressao.
    Retorna (novo_sponsor_id, cadeia_percorrida).
    Se chegar em raiz sem upline valido, retorna (None, cadeia).
    Prioriza `network_sponsor_id` (MMN); fallback para `sponsor_id`.
    """
    chain: List[str] = []
    visited: Set[str] = set()
    current_sponsor = user.get("network_sponsor_id") or user.get("sponsor_id")
    while current_sponsor and current_sponsor not in visited:
        visited.add(current_sponsor)
        chain.append(current_sponsor)
        if current_sponsor not in suppressed_ids:
            return current_sponsor, chain
        parent = users_by_id.get(current_sponsor)
        if not parent:
            return None, chain
        current_sponsor = parent.get("network_sponsor_id") or parent.get("sponsor_id")
    return None, chain


async def build_preview(
    db,
    file_bytes: bytes,
    filename: str,
    admin_user: Dict,
    reference_month: Optional[str] = None,
) -> Dict[str, Any]:
    """Faz upload -> parse -> resolve -> cria lote com status=draft.

    Retorna resumo + entries (leia via list endpoint depois).
    """
    rows, column_map = parse_workbook(file_bytes, filename)
    if not rows:
        raise ValueError("Nenhuma linha valida encontrada (sem coluna EMAIL preenchida).")

    # Referencia mensal — default ao "mais frequente" na coluna cancelamento se houver,
    # senao mes vigente.
    if not reference_month:
        reference_month = datetime.now(timezone.utc).strftime("%Y-%m")

    emails = list({r["email"] for r in rows})
    users_map = await _find_users_by_emails(db, emails)

    matched_user_ids: Set[str] = set()
    for us in users_map.values():
        for u in us:
            if u.get("user_id"):
                matched_user_ids.add(u["user_id"])

    users_by_id: Dict[str, Dict] = {}
    if matched_user_ids:
        cursor = db.users.find({"user_id": {"$in": list(matched_user_ids)}}, {"_id": 0, "password_hash": 0})
        async for u in cursor:
            users_by_id[u["user_id"]] = u

    # Fase 1: monta o set de user_ids do lote (todos que sao matched e ainda nao suprimidos)
    to_suppress_ids: Set[str] = set()
    for email, users in users_map.items():
        if len(users) == 1 and not users[0].get("suppressed"):
            to_suppress_ids.add(users[0]["user_id"])

    # Fase 2: resolve reparenting p/ cada entry
    batch_id = _batch_id()
    entries_docs: List[Dict[str, Any]] = []
    summary = {
        "matched": 0,
        "not_found": 0,
        "already_cancelled": 0,
        "email_ambiguous": 0,
        "total_rows": len(rows),
        "children_to_reassign": 0,
    }

    # Pre-conta filhos por user_id do lote (uma unica agregacao).
    # Iter 59: exclui filhos que TAMBEM estao no lote — eles serao suprimidos
    # tambem, entao nao contam como "reassign".
    children_count_by_parent: Dict[str, int] = {}
    if to_suppress_ids:
        cursor = db.users.find(
            {"network_sponsor_id": {"$in": list(to_suppress_ids)},
             "suppressed": {"$ne": True},
             "user_id": {"$nin": list(to_suppress_ids)}},
            {"_id": 0, "user_id": 1, "network_sponsor_id": 1, "sponsor_id": 1},
        )
        async for u in cursor:
            p = u.get("network_sponsor_id")
            children_count_by_parent[p] = children_count_by_parent.get(p, 0) + 1

    for row in rows:
        email = row["email"]
        users = users_map.get(email, [])
        entry: Dict[str, Any] = {
            "entry_id": _entry_id(),
            "batch_id": batch_id,
            "row": row["__row"],
            "email": email,
            "nome_planilha": row.get("nome") or "",
            "cpf_planilha": row.get("cpf") or "",
            "cancelamento_planilha": row.get("cancelamento") or "",
            "match_status": "not_found",
            "matched_user_id": None,
            "matched_user_name": None,
            "matched_user_network_type": None,
            "old_network_sponsor_id": None,
            "new_network_sponsor_id": None,
            "upline_resolution_chain": [],
            "children_count": 0,
            "notes": "",
        }
        if not users:
            entry["match_status"] = "not_found"
            summary["not_found"] += 1
        elif len(users) > 1:
            entry["match_status"] = "email_ambiguous"
            entry["notes"] = f"{len(users)} usuarios com mesmo email: " + ", ".join(u["user_id"] for u in users)
            summary["email_ambiguous"] += 1
        else:
            u = users[0]
            entry["matched_user_id"] = u["user_id"]
            entry["matched_user_name"] = u.get("name")
            entry["matched_user_network_type"] = u.get("network_type")
            entry["old_network_sponsor_id"] = u.get("network_sponsor_id") or u.get("sponsor_id")
            if u.get("suppressed"):
                entry["match_status"] = "already_cancelled"
                entry["notes"] = f"Ja foi suprimido em lote anterior ({u.get('suppressed_batch_id')})"
                summary["already_cancelled"] += 1
            else:
                entry["match_status"] = "matched"
                summary["matched"] += 1
                # Reparenting: pula quem ta no set do proprio lote
                new_up, chain = _resolve_upline(u, users_by_id, to_suppress_ids)
                entry["new_network_sponsor_id"] = new_up
                entry["upline_resolution_chain"] = chain
                entry["children_count"] = children_count_by_parent.get(u["user_id"], 0)
                summary["children_to_reassign"] += entry["children_count"]
        entries_docs.append(entry)

    batch_doc = {
        "batch_id": batch_id,
        "filename": filename,
        "reference_month": reference_month,
        "uploaded_by": admin_user.get("user_id"),
        "uploaded_by_name": admin_user.get("name") or admin_user.get("email"),
        "uploaded_at": now_iso(),
        "status": "draft",
        "column_map": column_map,
        "summary": summary,
        "applied_at": None,
        "applied_by": None,
        "reverted_at": None,
        "reverted_by": None,
        "tenant": DEFAULT_TENANT,
    }
    await db.network_suppression_batches.insert_one(batch_doc)
    if entries_docs:
        await db.network_suppression_entries.insert_many(entries_docs)
    return {"batch_id": batch_id, "summary": summary, "column_map": column_map}


# --------------------------------------------------------------------------- #
# Apply / Revert                                                              #
# --------------------------------------------------------------------------- #

async def apply_batch(db, batch_id: str, admin_user: Dict) -> Dict[str, Any]:
    batch = await db.network_suppression_batches.find_one({"batch_id": batch_id}, {"_id": 0})
    if not batch:
        raise ValueError("Lote nao encontrado")
    if batch["status"] != "draft":
        raise ValueError(f"Lote ja foi aplicado (status={batch['status']}). Nao pode reaplicar.")

    entries = await db.network_suppression_entries.find({"batch_id": batch_id}, {"_id": 0}).to_list(50000)
    matched = [e for e in entries if e["match_status"] == "matched"]
    if not matched:
        # Nada a fazer, mas marca como applied vazio pra evitar reprocesso.
        await db.network_suppression_batches.update_one(
            {"batch_id": batch_id},
            {"$set": {"status": "applied", "applied_at": now_iso(), "applied_by": admin_user.get("user_id")}},
        )
        return {"applied": 0, "reassigned_children": 0}

    now = now_iso()
    to_suppress_ids = [e["matched_user_id"] for e in matched]

    # Fase 1: marca todos como suprimidos (guarda snapshot p/ revert)
    #
    # Iter 60: Ao suprimir, o antigo `network_sponsor_id` (lider da Equipe) vira o novo
    # `sponsor_id` (afiliado permanente) — o usuario passa a ser "cliente direto" do
    # ex-lider. Comissoes futuras do suprimido geram 8% de afiliado para o ex-lider.
    # `network_sponsor_id` eh limpo (usuario nao esta mais em nenhuma rede MMN).
    # Snapshot pre-suppression permite revert completo.
    for uid in to_suppress_ids:
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "network_type": 1, "network_sponsor_id": 1, "sponsor_id": 1})
        if not u:
            continue
        old_net_sponsor = u.get("network_sponsor_id")
        set_doc = {
            "suppressed": True,
            "suppressed_at": now,
            "suppressed_batch_id": batch_id,
            "suppressed_reason": f"Cancelamento Ozoxx — lote {batch_id}",
            "pre_suppression_network_type": u.get("network_type"),
            "pre_suppression_network_sponsor_id": old_net_sponsor,
            "pre_suppression_sponsor_id": u.get("sponsor_id"),
            "network_type": "customer",
            "network_sponsor_id": None,
            "updated_at": now,
        }
        # Se tinha lider Equipe, promove pra Patrocinador (afiliado). Se nao tinha
        # lider Equipe, deixa o sponsor_id atual intacto.
        if old_net_sponsor:
            set_doc["sponsor_id"] = old_net_sponsor
            set_doc["sponsor_promoted_from_network_at"] = now
            set_doc["sponsor_promoted_batch_id"] = batch_id
        await db.users.update_one({"user_id": uid}, {"$set": set_doc})

    # Fase 2: reparent — para cada suprimido, filhos diretos vao pro new_network_sponsor_id
    reassigned_total = 0
    reassigned_details_by_entry: Dict[str, List[str]] = {}
    for e in matched:
        parent_id = e["matched_user_id"]
        new_upline = e.get("new_network_sponsor_id")
        # Busca filhos que apontam pra esse parent E que NAO estao suprimidos
        children = await db.users.find(
            {"network_sponsor_id": parent_id, "suppressed": {"$ne": True}},
            {"_id": 0, "user_id": 1},
        ).to_list(10000)
        child_ids = [c["user_id"] for c in children]
        if child_ids:
            await db.users.update_many(
                {"user_id": {"$in": child_ids}},
                {"$set": {
                    "network_sponsor_id": new_upline,  # pode ser None se raiz
                    "network_reassigned_at": now,
                    "network_reassigned_batch_id": batch_id,
                    "network_reassigned_from": parent_id,
                    "updated_at": now,
                }},
            )
            reassigned_total += len(child_ids)
            reassigned_details_by_entry[e["entry_id"]] = child_ids

    # Persiste detalhes de reparent nas entries
    for entry_id, kids in reassigned_details_by_entry.items():
        await db.network_suppression_entries.update_one(
            {"entry_id": entry_id},
            {"$set": {"children_reassigned": kids, "children_reassigned_count": len(kids)}},
        )

    # Fecha o lote
    await db.network_suppression_batches.update_one(
        {"batch_id": batch_id},
        {"$set": {
            "status": "applied",
            "applied_at": now,
            "applied_by": admin_user.get("user_id"),
            "applied_by_name": admin_user.get("name") or admin_user.get("email"),
            "apply_stats": {
                "suppressed_users": len(to_suppress_ids),
                "reassigned_children": reassigned_total,
            },
        }},
    )
    return {"applied": len(to_suppress_ids), "reassigned_children": reassigned_total}


def _same_month(iso_ts: Optional[str]) -> bool:
    """True se o timestamp esta dentro do mes atual (UTC)."""
    if not iso_ts:
        return False
    try:
        dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    except Exception:
        return False
    now = datetime.now(timezone.utc)
    return dt.year == now.year and dt.month == now.month


async def revert_batch(db, batch_id: str, admin_user: Dict) -> Dict[str, Any]:
    batch = await db.network_suppression_batches.find_one({"batch_id": batch_id}, {"_id": 0})
    if not batch:
        raise ValueError("Lote nao encontrado")
    if batch["status"] != "applied":
        raise ValueError(f"So se reverte lote com status=applied (atual={batch['status']}).")
    if not _same_month(batch.get("applied_at")):
        raise ValueError(
            "Revert nao permitido: lote foi aplicado em um mes anterior. "
            "Reversao depois do fechamento mensal precisa ser feita manualmente."
        )

    entries = await db.network_suppression_entries.find(
        {"batch_id": batch_id, "match_status": "matched"}, {"_id": 0}
    ).to_list(50000)
    now = now_iso()
    restored = 0
    unassigned = 0
    for e in entries:
        uid = e["matched_user_id"]
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "pre_suppression_network_type": 1, "pre_suppression_network_sponsor_id": 1, "pre_suppression_sponsor_id": 1})
        if not u:
            continue
        await db.users.update_one(
            {"user_id": uid, "suppressed_batch_id": batch_id},
            {"$set": {
                "suppressed": False,
                "suppressed_reverted_at": now,
                "network_type": u.get("pre_suppression_network_type"),
                "network_sponsor_id": u.get("pre_suppression_network_sponsor_id"),
                "sponsor_id": u.get("pre_suppression_sponsor_id"),
                "updated_at": now,
            }},
        )
        restored += 1

        # Restaura filhos reatribuidos por esse lote de volta pro parent original
        kids = e.get("children_reassigned") or []
        if kids:
            await db.users.update_many(
                {"user_id": {"$in": kids}, "network_reassigned_batch_id": batch_id},
                {"$set": {
                    "network_sponsor_id": uid,
                    "network_reassigned_reverted_at": now,
                    "updated_at": now,
                }},
            )
            unassigned += len(kids)

    await db.network_suppression_batches.update_one(
        {"batch_id": batch_id},
        {"$set": {
            "status": "reverted",
            "reverted_at": now,
            "reverted_by": admin_user.get("user_id"),
            "reverted_by_name": admin_user.get("name") or admin_user.get("email"),
            "revert_stats": {"restored_users": restored, "restored_children": unassigned},
        }},
    )
    return {"restored": restored, "restored_children": unassigned}


# --------------------------------------------------------------------------- #
# Listagem                                                                    #
# --------------------------------------------------------------------------- #

async def list_batches(db, page: int = 1, limit: int = 30) -> Dict[str, Any]:
    total = await db.network_suppression_batches.count_documents({})
    items = await db.network_suppression_batches.find({}, {"_id": 0}).sort("uploaded_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"total": total, "page": page, "limit": limit, "items": items}


async def get_batch_detail(db, batch_id: str) -> Optional[Dict[str, Any]]:
    batch = await db.network_suppression_batches.find_one({"batch_id": batch_id}, {"_id": 0})
    if not batch:
        return None
    entries = await db.network_suppression_entries.find({"batch_id": batch_id}, {"_id": 0}).sort("row", 1).to_list(50000)
    return {"batch": batch, "entries": entries}


async def delete_draft(db, batch_id: str) -> bool:
    b = await db.network_suppression_batches.find_one({"batch_id": batch_id}, {"_id": 0})
    if not b:
        return False
    if b["status"] != "draft":
        raise ValueError("So se pode deletar lote em status=draft.")
    await db.network_suppression_entries.delete_many({"batch_id": batch_id})
    await db.network_suppression_batches.delete_one({"batch_id": batch_id})
    return True
