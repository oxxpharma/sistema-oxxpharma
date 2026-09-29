"""
Gera DANFE (PDF) a partir do XML NF-e (padrao SEFAZ nacional).
Usa brazilfiscalreport. Se o XML nao for compativel, retorna None e o caller
deve mostrar o XML bruto com aviso 'PDF indisponivel'.
"""
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _clean_xml_string(xml_content: str) -> str:
    """Higieniza a string XML desfazendo escapes de aspas (ex: \\\"), entidades HTML e BOM."""
    if not xml_content or not isinstance(xml_content, str):
        return ""
    s = xml_content.strip()
    # Remove BOM se presente
    if s.startswith("\ufeff"):
        s = s[1:]
    # Desfaz escapes de aspas vindos de JSON/HTTP
    s = s.replace(r'\"', '"').replace(r'\"', '"')
    # Se veio codificado com entidades HTML (&lt;nfeProc... &gt;)
    if "&lt;" in s and "&gt;" in s and "<nfeProc" not in s and "<NFe" not in s:
        import html
        s = html.unescape(s)
    return s.strip()


def render_danfe_pdf_with_error(xml_content: str) -> tuple[Optional[bytes], Optional[str]]:
    """Recebe XML NF-e SEFAZ e retorna tupla (pdf_bytes, error_message)."""
    if not xml_content or not xml_content.strip():
        return None, "XML ausente ou vazio."
    
    clean_xml = _clean_xml_string(xml_content)
    try:
        from brazilfiscalreport.danfe import Danfe
        danfe = Danfe(xml=clean_xml)
        buf = io.BytesIO()
        danfe.output(buf)
        return buf.getvalue(), None
    except Exception as e:
        err_msg = f"Erro no parser da DANFE: {e}"
        logger.warning(f"opery_nf.render_danfe_pdf falhou: {err_msg}")
        return None, err_msg


def render_danfe_pdf(xml_content: str) -> Optional[bytes]:
    """Recebe XML NF-e SEFAZ e retorna bytes do PDF (DANFE) ou None se falhar."""
    pdf_bytes, _ = render_danfe_pdf_with_error(xml_content)
    return pdf_bytes
