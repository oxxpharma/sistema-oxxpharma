"""
Gera DANFE (PDF) a partir do XML NF-e (padrao SEFAZ nacional).
Usa brazilfiscalreport. Se o XML nao for compativel, retorna None e o caller
deve mostrar o XML bruto com aviso 'PDF indisponivel'.
"""
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def render_danfe_pdf(xml_content: str) -> Optional[bytes]:
    """Recebe XML NF-e SEFAZ e retorna bytes do PDF (DANFE) ou None se falhar."""
    if not xml_content or not xml_content.strip():
        return None
    try:
        from brazilfiscalreport.danfe import Danfe
        danfe = Danfe(xml=xml_content)
        buf = io.BytesIO()
        danfe.output(buf)
        return buf.getvalue()
    except Exception as e:
        logger.warning(f"opery_nf.render_danfe_pdf falhou: {e}")
        return None
