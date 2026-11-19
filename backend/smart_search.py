# -*- coding: utf-8 -*-
"""
Smart Search Engine para OxxPharma (estilo SmartHint)
- Tolerância total a acentos e cedilha (ex: 'magnesio' encontra 'magnésio', 'oleo' encontra 'óleo')
- Tolerância fonética e ortográfica PT-BR (ex: 'magnezio' <-> 'magnésio', 's'/'z', 'ph'/'f', consoantes duplas)
- Dicionário de Sinônimos e Equivalências da área farmacêutica / suplementos / dermocosméticos
- Tolerância a erros de digitação (typo tolerance / fuzzy matching) com sugestão "Você quis dizer"
- Suporte a sinônimos personalizados configuráveis pelo lojista no Admin
"""

import re
import unicodedata
import difflib
from typing import Dict, List, Set, Optional, Tuple, Any

# Mapa de expansão fonética e de acentuação para Regex
CHAR_REGEX_MAP = {
    'a': '[aáàãâäAÁÀÃÂÄ]',
    'e': '[eéèêëEÉÈÊË]',
    'i': '[iíìîïyIÍÌÎÏY]',
    'o': '[oóòõôöOÓÒÕÔÖ]',
    'u': '[uúùûüUÚÙÛÜ]',
    'c': '[cçkCÇK]',
    'k': '[cçkCÇK]',
    's': '[szSZ]',
    'z': '[szSZ]',
}

# Dicionário padrão de sinônimos e termos equivalentes no nicho da OxxPharma
DEFAULT_SEARCH_SYNONYMS: Dict[str, List[str]] = {
    # Magnésios & Sono
    "magnesio": [
        "magnésio", "magnesio", "magnezio", "mag duo", "mag day", "mag night",
        "dimalato", "treonato", "bisglicinato", "quelato", "cloreto", "taurato", "malato"
    ],
    "magnezio": [
        "magnésio", "magnesio", "magnezio", "mag duo", "mag day", "mag night",
        "dimalato", "treonato", "bisglicinato", "quelato"
    ],
    "dimalato": ["magnésio dimalato", "mag day", "mag duo", "magnésio"],
    "treonato": ["magnésio treonato", "mag night", "mag duo", "magnésio"],
    "bisglicinato": ["magnésio bisglicinato", "quelato", "magnésio"],
    "quelato": ["magnésio quelato", "mag night", "sleep dream", "magnésio"],
    
    # Óleos Ozonizados & Ozonoterapia
    "oleo": ["óleo", "oleos", "óleos", "ozonizado", "ozonizados", "ozoxx", "spa"],
    "oleos": ["óleo", "oleos", "óleos", "ozonizado", "ozonizados", "ozoxx", "spa"],
    "oleo ozonizado": ["óleo ozonizado", "ozoxx", "spa", "ozonio"],
    "oleos ozonizados": ["óleo ozonizado", "ozoxx", "spa", "ozonio"],
    "ozonio": ["ozônio", "ozonio", "ozonizado", "ozonizados", "ozoxx", "óleo ozonizado", "spa"],
    "ozonizado": ["óleo ozonizado", "ozoxx", "ozonio", "spa"],
    "ozonizados": ["óleo ozonizado", "ozoxx", "ozonio", "spa"],
    "ozoxx": ["óleo ozonizado", "ozonio", "spa", "ozonizado"],

    # Sono, Dormir e Relaxamento
    "sono": ["sleep dream", "mag night", "serenny", "melatonina", "relaxamento", "dormir", "insonia", "noite"],
    "dormir": ["sleep dream", "mag night", "serenny", "melatonina", "sono", "insonia"],
    "insonia": ["sleep dream", "mag night", "serenny", "melatonina", "sono", "relaxamento"],
    "melatonina": ["sleep dream", "sono", "dormir", "mag night"],
    "relaxar": ["serenny", "sleep dream", "relaxamento", "ansiedade", "mag night"],
    "relaxamento": ["serenny", "sleep dream", "relaxar", "mag night"],
    "ansiedade": ["serenny", "relaxamento", "estresse", "triptofano", "calmante"],
    "estresse": ["serenny", "relaxamento", "ansiedade"],

    # Emagrecimento, Apetite, Queima de Gordura
    "emagrecer": [
        "duo control", "sweet control", "appetite control", "blocker", "less",
        "progo", "morosil", "cactin", "slim", "detox", "emagrecimento"
    ],
    "emagrecimento": [
        "duo control", "sweet control", "appetite control", "blocker", "less",
        "progo", "morosil", "cactin", "slim", "detox"
    ],
    "perder peso": ["duo control", "sweet control", "appetite control", "blocker", "less", "progo", "slim"],
    "apetite": ["appetite control", "sweet control", "duo control", "saciedade"],
    "saciedade": ["appetite control", "sweet control", "saciedade", "progo"],
    "doces": ["sweet control", "duo control", "vontade de doces"],
    "doce": ["sweet control", "duo control", "vontade de doces"],
    "gordura": ["blocker", "less", "morosil", "queima de gordura"],
    "seca barriga": ["less", "morosil", "detox", "blocker", "progo"],
    "morosil": ["less", "emagrecimento", "cactin"],
    "cactin": ["less", "detox", "drenagem"],
    "detox": ["detox", "retenção", "digestivo", "drenagem"],

    # Performance, Creatina, Massa Muscular
    "creatina": ["creatina monohidratada", "creatina em brigadeiro", "creatina em caramelo", "creatine", "força", "energia"],
    "creatine": ["creatina monohidratada", "creatina em brigadeiro", "creatina em caramelo", "creatina"],
    "glutamina": ["glutamina", "l-glutamina", "saúde intestinal", "imunidade"],
    "massa muscular": ["creatina", "glutamina", "performance"],
    "forca": ["creatina", "alpha power", "performance"],

    # Saúde Intestinal / Digestão
    "intestino": ["corebiome", "gastroshield", "biointestil", "ibs care", "glutamina", "intest booster", "probiotico"],
    "estomago": ["gastroshield", "digestao", "gastrite", "refluxo"],
    "gastrite": ["gastroshield", "saúde gástrica"],
    "probiotico": ["ibs care", "corebiome", "biointestil", "intest booster"],
    "probioticos": ["ibs care", "corebiome", "biointestil", "intest booster"],
    "refluxo": ["gastroshield", "estomago"],
    "digestao": ["gastroshield", "detox", "intest booster"],

    # Gestantes / Maternidade
    "gestante": ["kit mom care", "nutri mom", "repellent mom", "sun mom", "glow mom", "mousse mom", "body mom", "estrias", "gravidez"],
    "gestantes": ["kit mom care", "nutri mom", "repellent mom", "sun mom", "glow mom", "mousse mom", "body mom", "estrias", "gravidez"],
    "gravida": ["kit mom care", "nutri mom", "repellent mom", "sun mom", "glow mom", "mousse mom", "body mom", "estrias"],
    "gravidas": ["kit mom care", "nutri mom", "repellent mom", "sun mom", "glow mom", "mousse mom", "body mom", "estrias"],
    "gravidez": ["kit mom care", "nutri mom", "repellent mom", "sun mom", "glow mom", "mousse mom", "body mom"],
    "estria": ["nutri mom", "body mom", "estrias", "colageno"],
    "estrias": ["nutri mom", "body mom", "antiestrias"],
    "repelente": ["repellent mom"],

    # Skincare, Pele, Rosto, Clareador
    "skincare": ["skin essentials", "skin ghk-cu", "skinrefine pads", "skinclean", "glow mom", "pele"],
    "pele": ["skin essentials", "skin ghk-cu", "skinrefine", "skinclean", "colageno", "oxx bronze"],
    "manchas": ["glow mom", "clareador", "clareamento", "melasma"],
    "clareador": ["glow mom", "manchas", "clareamento", "acido"],
    "melasma": ["glow mom", "protetor solar", "clareador"],
    "rugas": ["skin ghk-cu", "colageno", "rejuvenescimento"],
    "protetor solar": ["sun mom", "protetor solar hidratante fps 30", "oxx bronze"],
    "bronze": ["oxx bronze", "loção bronzeadora", "manteiga bronzeadora", "iluminador corporal", "cápsula bronzeadora"],
    "bronzeador": ["oxx bronze", "loção bronzeadora", "manteiga bronzeadora", "cápsula bronzeadora"],

    # Articulação, Dores, Colágeno
    "articulacao": ["articulare", "colágeno tipo ii", "canela-de-velho", "sucupira", "msm", "dor"],
    "articulacoes": ["articulare", "colágeno tipo ii", "dor nas juntas"],
    "colageno": ["articulare", "colágeno tipo ii", "pele", "firmeza"],
    "colageno tipo 2": ["articulare", "colágeno tipo ii"],
    "dor": ["articulare", "canela-de-velho", "ozoxx spa sport"],

    # Foco, Cérebro, Memória
    "foco": ["concentra", "memória", "cognição", "concentracao"],
    "memoria": ["concentra", "foco", "cognição"],
    "cognicao": ["concentra", "foco", "memória"],

    # Libido, Vitalidade
    "libido": ["alpha power", "femme power", "duo power", "vitalidade", "desejo"],
    "vitalidade": ["alpha power", "femme power", "duo power"],
    "potencia": ["alpha power", "vitalidade masculina"],
    "feminino": ["femme power", "duo power"],
    "masculino": ["alpha power", "duo power"],
}


def remove_accents(text: str) -> str:
    """Remove marcas diacríticas / acentos de um texto mantendo caracteres base."""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFD', text)
    return ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')


def build_accent_tolerant_regex(term: str) -> str:
    """
    Gera padrão Regex para busca com tolerância a acentos, cedilhas, s/z,
    consoantes duplas e plurais comuns no português.
    Ex: 'magnesio' ou 'magnezio' -> m[aáàãâä]gn[eéèêë][sz][iíìîïy][oóòõôö](?:s|es)?
    """
    clean = term.strip().lower()
    if not clean:
        return ""

    norm = remove_accents(clean)

    # Verifica plural simples
    is_plural = False
    if len(norm) > 3 and norm.endswith('s'):
        norm = norm[:-1]
        is_plural = True

    parts = []
    i = 0
    while i < len(norm):
        ch = norm[i]
        # Consoantes duplas
        if i + 1 < len(norm) and norm[i:i+2] in ('ss', 'rr', 'll', 'mm', 'nn', 'tt', 'pp', 'cc'):
            c = norm[i]
            parts.append(f"{c}+")
            i += 2
            continue
        # ph -> f
        elif i + 1 < len(norm) and norm[i:i+2] == 'ph':
            parts.append("(?:ph|f)")
            i += 2
            continue
        elif ch in CHAR_REGEX_MAP:
            parts.append(CHAR_REGEX_MAP[ch])
        elif ch.isalnum():
            parts.append(re.escape(ch))
        elif ch.isspace():
            parts.append(r'\s+')
        else:
            parts.append(re.escape(ch))
        i += 1

    pat = "".join(parts)
    pat += r"(?:s|es)?"
    return pat


def get_synonyms_for_term(term: str, custom_synonyms: Optional[Dict[str, List[str]]] = None) -> List[str]:
    """Retorna lista de sinônimos/equivalências cadastradas para o termo."""
    clean_term = remove_accents(term.strip().lower())
    if not clean_term:
        return []

    results: Set[str] = set()

    # 1. Customizados do lojista (prioridade)
    if custom_synonyms and isinstance(custom_synonyms, dict):
        for k, v in custom_synonyms.items():
            if remove_accents(k.lower()) == clean_term or clean_term in remove_accents(k.lower()):
                if isinstance(v, list):
                    results.update(v)
                elif isinstance(v, str):
                    results.add(v)

    # 2. Dicionário nativo
    for k, v in DEFAULT_SEARCH_SYNONYMS.items():
        if remove_accents(k) == clean_term or clean_term == remove_accents(k):
            results.update(v)

    # 3. Se não achou exato, busca se termo está contido em chaves compostas
    if not results:
        for k, v in DEFAULT_SEARCH_SYNONYMS.items():
            if clean_term in remove_accents(k):
                results.update(v)

    return [s for s in results if s and remove_accents(s.lower()) != clean_term]


def build_vocabulary_from_db_items(products: List[Dict], categories: List[Dict], subcategories: List[Dict], custom_synonyms: Optional[Dict] = None) -> Set[str]:
    """Extrai palavras de vocabulário para correção ortográfica (typo correction)."""
    vocab: Set[str] = set()

    # De produtos
    for p in products:
        for field in ("name", "brand", "category", "seo_keywords"):
            val = p.get(field)
            if isinstance(val, str):
                tokens = re.findall(r'[a-zA-ZáàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ]{3,}', val)
                for t in tokens:
                    vocab.add(t.strip())

    # De categorias e subcategorias
    for c in categories:
        name = c.get("name")
        if name:
            for t in re.findall(r'[a-zA-ZáàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ]{3,}', name):
                vocab.add(t.strip())

    for s in subcategories:
        name = s.get("name")
        if name:
            for t in re.findall(r'[a-zA-ZáàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ]{3,}', name):
                vocab.add(t.strip())

    # De sinônimos
    for k in DEFAULT_SEARCH_SYNONYMS.keys():
        for t in re.findall(r'[a-zA-ZáàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ]{3,}', k):
            vocab.add(t.strip())

    if custom_synonyms:
        for k in custom_synonyms.keys():
            for t in re.findall(r'[a-zA-ZáàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ]{3,}', k):
                vocab.add(t.strip())

    return vocab


def suggest_correction(query: str, vocabulary: Set[str]) -> Optional[str]:
    """
    Verifica se a query digitada possui erros de digitação e sugere correção.
    Ex: 'magneso' -> 'magnésio', 'ozonx' -> 'ozoxx', 'cretina' -> 'creatina'.
    Retorna a string corrigida ou None se não houver sugestão forte.
    """
    query_str = query.strip()
    if not query_str or len(query_str) < 3:
        return None

    # Mapeia vocabulário normalizado sem acento -> forma original
    norm_to_orig: Dict[str, str] = {}
    for word in vocabulary:
        nw = remove_accents(word.lower())
        if nw not in norm_to_orig or len(word) > len(norm_to_orig[nw]):
            norm_to_orig[nw] = word

    vocab_keys = list(norm_to_orig.keys())
    tokens = re.findall(r'[a-zA-ZáàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ0-9]+', query_str)
    if not tokens:
        return None

    changed = False
    corrected_tokens = []

    for tok in tokens:
        clean_tok = remove_accents(tok.lower())
        if len(clean_tok) < 3:
            corrected_tokens.append(tok)
            continue

        # Se já existe exatamente no vocabulário, mantém
        if clean_tok in norm_to_orig:
            corrected_tokens.append(norm_to_orig[clean_tok])
            continue

        # Procura match próximo
        matches = difflib.get_close_matches(clean_tok, vocab_keys, n=1, cutoff=0.72)
        if matches:
            best_match = norm_to_orig[matches[0]]
            corrected_tokens.append(best_match)
            changed = True
        else:
            corrected_tokens.append(tok)

    if changed:
        suggestion = " ".join(corrected_tokens)
        if remove_accents(suggestion.lower()) != remove_accents(query_str.lower()):
            return suggestion

    return None


def generate_search_regex_list(query: str, custom_synonyms: Optional[Dict[str, List[str]]] = None) -> Tuple[List[str], List[str]]:
    """
    Gera lista de padrões Regex tolerantes para a query e para seus sinônimos.
    Retorna: (query_patterns, synonym_patterns)
    """
    clean_query = query.strip()
    if not clean_query:
        return ([], [])

    query_patterns = []
    # 1. Padrão completo da frase
    full_pattern = build_accent_tolerant_regex(clean_query)
    if full_pattern:
        query_patterns.append(full_pattern)

    # 2. Padrões por palavra individual (se tiver mais de uma)
    words = clean_query.split()
    if len(words) > 1:
        for w in words:
            if len(w) >= 3:
                wp = build_accent_tolerant_regex(w)
                if wp and wp not in query_patterns:
                    query_patterns.append(wp)

    # 3. Padrões de sinônimos
    synonyms = get_synonyms_for_term(clean_query, custom_synonyms=custom_synonyms)
    # Também busca sinônimos para palavras individuais
    for w in words:
        if len(w) >= 3:
            w_syns = get_synonyms_for_term(w, custom_synonyms=custom_synonyms)
            for ws in w_syns:
                if ws not in synonyms:
                    synonyms.append(ws)

    synonym_patterns = []
    for s in synonyms[:15]:  # limita para manter performance
        sp = build_accent_tolerant_regex(s)
        if sp and sp not in query_patterns and sp not in synonym_patterns:
            synonym_patterns.append(sp)

    return (query_patterns, synonym_patterns)
