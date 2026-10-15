"""
Módulo de Integração D4Sign e Geração de Contratos de Convênio
OxxPharma Magistral
"""
import io
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple, List
import requests

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

logger = logging.getLogger(__name__)

D4SIGN_PROD_URL = "https://secure.d4sign.com.br/api/v1"
D4SIGN_SANDBOX_URL = "https://sandbox.d4sign.com.br/api/v1"


def _format_cnpj(cnpj_raw: Optional[str]) -> str:
    if not cnpj_raw:
        return "Não informado"
    d = "".join(ch for ch in str(cnpj_raw) if ch.isdigit())
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return str(cnpj_raw)


def _format_cpf(cpf_raw: Optional[str]) -> str:
    if not cpf_raw:
        return "Não informado"
    d = "".join(ch for ch in str(cpf_raw) if ch.isdigit())
    if len(d) == 11:
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    return str(cpf_raw)


def _format_phone(phone_raw: Optional[str]) -> str:
    if not phone_raw:
        return "Não informado"
    d = "".join(ch for ch in str(phone_raw) if ch.isdigit())
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    elif len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return str(phone_raw)


def _format_address(addr: Optional[Dict[str, Any]]) -> str:
    if not addr or not isinstance(addr, dict):
        return "Endereço não cadastrado"
    parts = []
    street = addr.get("street") or ""
    number = addr.get("number") or "S/N"
    comp = addr.get("complement") or ""
    bairro = addr.get("neighborhood") or ""
    city = addr.get("city") or ""
    state = addr.get("state") or ""
    cep = addr.get("cep") or addr.get("zip") or ""

    if street:
        line1 = f"{street}, nº {number}"
        if comp:
            line1 += f" ({comp})"
        parts.append(line1)
    if bairro:
        parts.append(f"Bairro {bairro}")
    if city or state:
        parts.append(f"{city}/{state}")
    if cep:
        parts.append(f"CEP: {cep}")

    return " - ".join(parts) if parts else "Endereço não informado"


class NumberedCanvas:
    """Canvas de duas passadas para numeração de páginas 'Página X de Y' e cabeçalho/rodapé."""
    def __init__(self, *args, **kwargs):
        from reportlab.pdfgen import canvas
        self._canvas_class = canvas.Canvas
        self.canvas = None

    # Implementado via onFirstPage/onLaterPages para compatibilidade com SimpleDocTemplate


def build_contract_pdf(company: Dict[str, Any], settings: Optional[Dict[str, Any]] = None) -> bytes:
    """Gera o documento PDF formal do Contrato de Convênio Comercial pronto para assinatura.
    
    Retorna os bytes do PDF.
    """
    settings = settings or {}
    buffer = io.BytesIO()

    # Document setup (margens de 2cm)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=45,
        leftMargin=45,
        topMargin=50,
        bottomMargin=50,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_color = colors.HexColor("#D9531E")       # Laranja OxxPharma
    dark_text = colors.HexColor("#1E293B")         # Slate 800
    gray_text = colors.HexColor("#475569")         # Slate 600
    bg_light = colors.HexColor("#F8FAFC")          # Slate 50
    border_color = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        "ContractTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=brand_color,
        alignment=1, # Centralizado
        spaceAfter=14,
    )

    subtitle_style = ParagraphStyle(
        "ContractSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=gray_text,
        alignment=1,
        spaceAfter=16,
    )

    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=brand_color,
        spaceBefore=10,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        "ContractBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=dark_text,
        alignment=4, # Justificado
        spaceAfter=6,
    )

    body_bold = ParagraphStyle(
        "ContractBodyBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )

    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#334155"),
    )

    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=dark_text,
    )

    story = []

    # 1. Cabeçalho Oficial
    story.append(Paragraph("OXX PHARMA MAGISTRAL", title_style))
    story.append(Paragraph(
        "INSTRUMENTO PARTICULAR DE CONVÊNIO COMERCIAL, BENEFÍCIOS CORPORATIVOS<br/>"
        "E AUTORIZAÇÃO DE DESCONTO EM FOLHA DE PAGAMENTO",
        title_style
    ))
    story.append(Paragraph(
        "Documento emitido eletronicamente para formalização e assinatura digital via D4Sign",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_color, spaceAfter=14))

    # Dados das Partes
    comp_name = company.get("name") or "Empresa Conveniada"
    comp_cnpj = _format_cnpj(company.get("cnpj") or company.get("cnpj_digits"))
    comp_ie = company.get("ie") or "Isento"
    comp_addr = _format_address(company.get("address"))
    comp_email = company.get("email") or company.get("rep_email") or ""
    comp_phone = _format_phone(company.get("whatsapp") or company.get("rep_phone"))

    rep_name = company.get("rep_name") or company.get("contact_name") or "Representante Legal"
    rep_cpf = _format_cpf(company.get("rep_cpf"))
    rep_rg = company.get("rep_rg") or "Não informado"
    rep_role = company.get("rep_role") or "Representante Legal"
    rep_email = company.get("rep_email") or comp_email

    disc_pct = float(company.get("discount_percent") or company.get("employee_discount_pct") or 0.0)
    payroll_active = bool(company.get("payroll_enabled", True))
    payroll_limit = float(company.get("payroll_limit_percent") or 35.0)

    # Box de Identificação das Partes
    story.append(Paragraph("<b>DAS PARTES CONTRATANTES</b>", section_heading))
    partes_text = (
        f"<b>CONTRATADA:</b> <b>OXX PHARMA MAGISTRAL LTDA.</b>, pessoa jurídica de direito privado, "
        f"inscrita no CNPJ/MF sob o nº <b>03.446.178/0001-59</b>, com sede na cidade de Maringá, Estado do Paraná, "
        f"doravante denominada simplesmente <b>OXX PHARMA</b> ou <b>CONTRATADA</b>.<br/><br/>"
        f"<b>CONVENIADA:</b> <b>{comp_name}</b>, pessoa jurídica de direito privado, "
        f"inscrita no CNPJ/MF sob o nº <b>{comp_cnpj}</b>, Inscrição Estadual: <b>{comp_ie}</b>, "
        f"com sede no endereço: <i>{comp_addr}</i>, telefone: {comp_phone}, e-mail: {comp_email}, "
        f"neste ato representada na forma de seus atos constitutivos por seu(sua) representante legal, "
        f"<b>{rep_name}</b>, portador(a) do CPF nº <b>{rep_cpf}</b>, RG nº <b>{rep_rg}</b>, "
        f"exercendo o cargo de <b>{rep_role}</b>, e-mail: {rep_email}, "
        f"doravante denominada simplesmente <b>CONVENIADA</b>."
    )
    story.append(Paragraph(partes_text, body_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "Têm entre si, justo e acordado, o presente <b>CONTRATO DE CONVÊNIO COMERCIAL E BENEFÍCIOS CORPORATIVOS</b>, "
        "o qual se regerá pelas cláusulas e condições seguintes:",
        body_style
    ))
    story.append(Spacer(1, 8))

    # CLÁUSULA PRIMEIRA
    story.append(Paragraph("<b>CLÁUSULA PRIMEIRA — DO OBJETO</b>", section_heading))
    story.append(Paragraph(
        "<b>1.1.</b> O presente instrumento tem por objeto a celebração de parceria e convênio comercial entre a <b>OXX PHARMA</b> "
        "e a <b>CONVENIADA</b>, visando a disponibilização de condições comerciais vantajosas, facilidades e descontos exclusivos "
        "aos empregados, colaboradores devidamente cadastrados e respectivos dependentes da <b>CONVENIADA</b> na aquisição de "
        "fórmulas magistrais manipuladas, medicamentos, suplementos nutricionais, vitaminas e dermocosméticos comercializados pela <b>OXX PHARMA</b>.",
        body_style
    ))
    story.append(Paragraph(
        "<b>1.2.</b> A adesão dos colaboradores da CONVENIADA ao presente Convênio é de caráter estritamente voluntário e facultativo, "
        "não constituindo qualquer obrigação de compra de produtos, tampouco condição para vínculo empregatício.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # CLÁUSULA SEGUNDA
    story.append(Paragraph("<b>CLÁUSULA SEGUNDA — DAS CONDIÇÕES COMERCIAIS E DESCONTOS</b>", section_heading))
    story.append(Paragraph(
        f"<b>2.1.</b> A <b>OXX PHARMA</b> concederá aos funcionários da <b>CONVENIADA</b> ativos no sistema o percentual de desconto "
        f"diferenciado de <b>{disc_pct:.1f}% ({disc_pct:.1f} por cento)</b> sobre os valores dos produtos elegíveis da plataforma.",
        body_style
    ))
    story.append(Paragraph(
        "<b>2.2.</b> As aquisições poderão ser realizadas através da plataforma digital (site/loja virtual e aplicativo) da OXX PHARMA, "
        "com entrega no endereço cadastrado pelo colaborador ou conforme política de frete e prazos informados no ato do pedido.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # CLÁUSULA TERCEIRA
    story.append(Paragraph("<b>CLÁUSULA TERCEIRA — DO DESCONTO EM FOLHA DE PAGAMENTO (CONSIGNADO)</b>", section_heading))
    if payroll_active:
        story.append(Paragraph(
            f"<b>3.1.</b> Fica expressamente <b>HABILITADA</b> a modalidade de pagamento mediante <b>Desconto em Folha de Pagamento</b>. "
            f"Nesta modalidade, os colaboradores da <b>CONVENIADA</b> poderão optar pelo parcelamento de suas compras com desconto "
            f"direto em holerite, respeitada a margem consignável máxima pactuada de <b>{payroll_limit:.0f}% ({payroll_limit:.0f} por cento)</b> "
            f"da remuneração líquida do colaborador.",
            body_style
        ))
        story.append(Paragraph(
            "<b>3.2.</b> Toda transação realizada na modalidade de Desconto em Folha dependerá de aceite eletrônico prévio, específico e individual "
            "do colaborador através do Termo de Adesão e Autorização de Desconto em Folha (Anexo I), gerado eletronicamente no ato da compra "
            "com registro de IP, data/hora e hash de segurança.",
            body_style
        ))
        story.append(Paragraph(
            "<b>3.3.</b> A <b>CONVENIADA</b> obriga-se a efetuar as devidas retenções na folha de pagamento de seus funcionários e repassar os valores "
            "integrais devidos à <b>OXX PHARMA</b> conforme cronograma e fechamento mensal disponibilizado.",
            body_style
        ))
    else:
        story.append(Paragraph(
            "<b>3.1.</b> A modalidade de Desconto em Folha encontra-se <b>DESABILITADA</b> no momento da contratação, realizando-se as compras "
            "mediante cartão de crédito, PIX ou outros meios de pagamento diretos disponibilizados na plataforma.",
            body_style
        ))
    story.append(Spacer(1, 6))

    # CLÁUSULA QUARTA
    story.append(Paragraph("<b>CLÁUSULA QUARTA — DA GESTÃO E DO PAINEL CORPORATIVO</b>", section_heading))
    story.append(Paragraph(
        "<b>4.1.</b> A <b>OXX PHARMA</b> disponibilizará à <b>CONVENIADA</b> acesso seguro e exclusivo ao <b>Painel Empresa</b> "
        "para gestão de funcionários, inclusão ou inativação de colaboradores, consulta de faturamentos, extratos e relatórios mensais.",
        body_style
    ))
    story.append(Paragraph(
        "<b>4.2.</b> É de responsabilidade exclusiva da <b>CONVENIADA</b> manter o cadastro de seus colaboradores atualizado no sistema, "
        "providenciando a inativação imediata de funcionários em caso de rescisão contratual ou desligamento da empresa.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # CLÁUSULA QUINTA
    story.append(Paragraph("<b>CLÁUSULA QUINTA — DA PROTEÇÃO DE DADOS (LGPD)</b>", section_heading))
    story.append(Paragraph(
        "<b>5.1.</b> As PARTES comprometem-se a cumprir rigorosamente as disposições da Lei Federal nº 13.709/2018 (Lei Geral de Proteção de "
        "Dados Pessoais — LGPD), coletando, armazenando e compartilhando dados pessoais única e exclusivamente para a operacionalização "
        "do presente Convênio Comercial e emissão dos respectivos documentos fiscais e contábeis.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # CLÁUSULA SEXTA
    story.append(Paragraph("<b>CLÁUSULA SEXTA — DA VIGÊNCIA E RESCISÃO</b>", section_heading))
    story.append(Paragraph(
        "<b>6.1.</b> O presente contrato vigorará pelo prazo determinado de <b>12 (doze) meses</b> a contar da data de sua assinatura digital, "
        "sendo renovado automaticamente por iguais períodos, caso não haja manifestação expressa em contrário.",
        body_style
    ))
    story.append(Paragraph(
        "<b>6.2.</b> Qualquer das partes poderá rescindir o presente instrumento a qualquer momento, sem ônus ou multa rescisória, "
        "mediante aviso prévio formal por escrito com antecedência mínima de <b>30 (trinta) dias</b>, ficando resguardada a quitação de todas "
        "as compras e repasses pendentes já constituídos até a data efetiva da rescisão.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # CLÁUSULA SÉTIMA
    story.append(Paragraph("<b>CLÁUSULA SÉTIMA — DA ASSINATURA ELETRÔNICA E DO FORO</b>", section_heading))
    story.append(Paragraph(
        "<b>7.1.</b> As PARTES reconhecem a plena validade jurídica, integridade, autenticidade e eficácia da assinatura eletrônica "
        "realizada através da plataforma <b>D4Sign</b>, nos termos do art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e da Lei Federal nº 14.063/2020.",
        body_style
    ))
    story.append(Paragraph(
        "<b>7.2.</b> Para dirimir eventuais litígios ou controvérsias decorrentes deste contrato, as partes elegem expressamente o Foro da "
        "Comarca de <b>Maringá, Estado do Paraná</b>, com renúncia a qualquer outro, por mais privilegiado que seja.",
        body_style
    ))
    story.append(Spacer(1, 14))

    # Data de celebração
    hoje = datetime.now()
    meses_pt = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ]
    data_formatada = f"Maringá/PR, {hoje.day} de {meses_pt[hoje.month - 1]} de {hoje.year}."
    story.append(Paragraph(f"<b>{data_formatada}</b>", ParagraphStyle(
        "DateLine",
        parent=body_style,
        alignment=1, # Centralizado
        fontName="Helvetica-Bold",
        fontSize=9,
        spaceAfter=20,
    )))

    # Blocos de Assinatura (lado a lado em tabela)
    sign_box_oxx = [
        Paragraph("<b>PELA CONTRATADA:</b>", meta_label),
        Spacer(1, 35), # Espaço para carimbo / assinatura digital
        Paragraph("________________________________________", meta_label),
        Paragraph("<b>OXX PHARMA MAGISTRAL LTDA.</b>", meta_label),
        Paragraph("CNPJ: 03.446.178/0001-59", meta_val),
        Paragraph("<i>Assinado Eletronicamente</i>", meta_val),
    ]

    sign_box_empresa = [
        Paragraph("<b>PELA CONVENIADA:</b>", meta_label),
        Spacer(1, 35),
        Paragraph("________________________________________", meta_label),
        Paragraph(f"<b>{rep_name}</b>", meta_label),
        Paragraph(f"Cargo: {rep_role}", meta_val),
        Paragraph(f"CPF: {rep_cpf}", meta_val),
        Paragraph(f"<b>{comp_name}</b>", meta_val),
    ]

    sig_table = Table(
        [[sign_box_oxx, sign_box_empresa]],
        colWidths=[250, 250],
    )
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND", (0, 0), (-1, -1), bg_light),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))

    story.append(KeepTogether([sig_table]))

    # Rodapé legal do D4Sign
    story.append(Spacer(1, 15))
    story.append(Paragraph(
        "<i>Este documento é assinado digitalmente através da plataforma D4Sign em conformidade com a MP 2.200-2/2001 e Lei 14.063/2020. "
        "A integridade e validade das assinaturas podem ser verificadas via QR Code e protocolo digital emitidos pelo D4Sign.</i>",
        ParagraphStyle(
            "LegalFooter",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=6.5,
            leading=8.5,
            textColor=colors.HexColor("#64748B"),
            alignment=1,
        )
    ))

    # Compilação do PDF
    doc.build(story)
    return buffer.getvalue()


class D4SignService:
    """Cliente HTTP completo para a API V1 do D4Sign."""

    def __init__(self, token_api: str, crypt_key: str, environment: str = "production"):
        self.token_api = (token_api or "").strip()
        self.crypt_key = (crypt_key or "").strip()
        self.environment = (environment or "production").strip().lower()
        self.base_url = D4SIGN_SANDBOX_URL if self.environment == "sandbox" else D4SIGN_PROD_URL

    @property
    def is_configured(self) -> bool:
        return bool(self.token_api and self.crypt_key)

    def _auth_params(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        params = {"tokenAPI": self.token_api, "cryptKey": self.crypt_key}
        if extra:
            params.update(extra)
        return params

    def test_connection(self) -> Dict[str, Any]:
        """Testa se as credenciais do D4Sign são válidas e retorna a lista de cofres (safes)."""
        if not self.is_configured:
            return {"ok": False, "message": "Token API e CryptKey não configurados."}
        try:
            url = f"{self.base_url}/safes"
            resp = requests.get(url, params=self._auth_params(), timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                safes = []
                if isinstance(data, list):
                    safes = data
                elif isinstance(data, dict) and "message" in data:
                    safes = data.get("safes") or []
                return {
                    "ok": True,
                    "message": "Conexão com D4Sign realizada com sucesso!",
                    "safes_count": len(safes),
                    "safes": safes,
                    "environment": self.environment,
                }
            else:
                return {
                    "ok": False,
                    "status_code": resp.status_code,
                    "message": f"Erro do D4Sign: {resp.text}",
                }
        except Exception as e:
            logger.error(f"Erro ao testar conexao D4Sign: {e}")
            return {"ok": False, "message": f"Falha de conexão com D4Sign: {str(e)}"}

    def list_safes(self) -> List[Dict[str, Any]]:
        """Lista os cofres disponíveis na conta do D4Sign."""
        if not self.is_configured:
            return []
        try:
            url = f"{self.base_url}/safes"
            resp = requests.get(url, params=self._auth_params(), timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Erro ao listar cofres D4Sign: {e}")
        return []

    def upload_document(
        self,
        pdf_bytes: bytes,
        file_name: str,
        safe_uuid: str,
        folder_uuid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Faz o upload do PDF para o Cofre (Safe) especificado no D4Sign.
        
        Retorna: {"ok": bool, "document_uuid": str, "name": str, ...}
        """
        if not self.is_configured:
            raise RuntimeError("Credenciais do D4Sign não configuradas.")
        if not safe_uuid:
            raise ValueError("UUID do Cofre (safe_uuid) é obrigatório.")

        url = f"{self.base_url}/documents/{safe_uuid}/upload"
        params = self._auth_params()
        files = {
            "file": (file_name, pdf_bytes, "application/pdf")
        }
        data = {}
        if folder_uuid:
            data["folder_uuid"] = folder_uuid

        resp = requests.post(url, params=params, files=files, data=data, timeout=60)
        if resp.status_code not in (200, 201):
            logger.error(f"D4Sign upload falhou ({resp.status_code}): {resp.text}")
            raise RuntimeError(f"Erro no upload do documento para D4Sign: {resp.text}")

        res_json = resp.json()
        doc_uuid = res_json.get("uuid") or (res_json.get("message") if isinstance(res_json.get("message"), dict) else {}).get("uuid")
        if not doc_uuid and isinstance(res_json, dict):
            # Fallback para parsing de chaves variantes
            doc_uuid = res_json.get("uuid_document") or res_json.get("uuidDocument")

        return {
            "ok": True,
            "document_uuid": doc_uuid,
            "raw": res_json,
        }

    def add_signers(self, document_uuid: str, signers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Cadastra a lista de signatários no documento do D4Sign.
        
        Cada signatário:
        {"email": str, "act": "1" (assinar), "foreign": "0", "auth_mode": "email", "name": str, "cpf": str}
        """
        if not self.is_configured:
            raise RuntimeError("Credenciais do D4Sign não configuradas.")

        url = f"{self.base_url}/documents/{document_uuid}/createlist"
        params = self._auth_params()
        payload = {"signers": signers}

        resp = requests.post(url, params=params, json=payload, timeout=30)
        if resp.status_code not in (200, 201):
            logger.error(f"D4Sign createlist falhou ({resp.status_code}): {resp.text}")
            raise RuntimeError(f"Erro ao cadastrar signatários no D4Sign: {resp.text}")

        return resp.json()

    def send_to_signers(
        self,
        document_uuid: str,
        message: str = "Prezado(a), segue Contrato de Convênio Comercial OxxPharma para assinatura digital."
    ) -> Dict[str, Any]:
        """Dispara o documento para assinatura aos signatários cadastrados."""
        if not self.is_configured:
            raise RuntimeError("Credenciais do D4Sign não configuradas.")

        url = f"{self.base_url}/documents/{document_uuid}/sendtosigner"
        params = self._auth_params()
        payload = {
            "message": message,
            "skip_email": "0",
            "workflow": "0",
        }

        resp = requests.post(url, params=params, json=payload, timeout=30)
        if resp.status_code not in (200, 201):
            logger.error(f"D4Sign sendtosigner falhou ({resp.status_code}): {resp.text}")
            raise RuntimeError(f"Erro ao disparar documento para assinatura no D4Sign: {resp.text}")

        return resp.json()

    def get_document(self, document_uuid: str) -> Dict[str, Any]:
        """Consulta os dados e status atual do documento no D4Sign."""
        if not self.is_configured:
            raise RuntimeError("Credenciais do D4Sign não configuradas.")

        url = f"{self.base_url}/documents/{document_uuid}"
        resp = requests.get(url, params=self._auth_params(), timeout=25)
        if resp.status_code != 200:
            logger.error(f"D4Sign get_document falhou ({resp.status_code}): {resp.text}")
            raise RuntimeError(f"Erro ao consultar documento no D4Sign: {resp.text}")

        data = resp.json()
        doc_data = data[0] if isinstance(data, list) and len(data) > 0 else data

        # Status D4Sign:
        # 1: Iniciado
        # 2: Aguardando Assinaturas
        # 3: Aguardando Validação
        # 4: Finalizado / Concluído (Todos assinaram)
        # 5: Arquivado
        # 6: Cancelado
        status_id = str(doc_data.get("statusId") or doc_data.get("status_id") or "")
        status_name = doc_data.get("statusName") or doc_data.get("status_name") or ""

        is_signed = status_id == "4" or "finalizado" in status_name.lower() or "concluido" in status_name.lower()

        return {
            "document_uuid": document_uuid,
            "status_id": status_id,
            "status_name": status_name,
            "is_signed": is_signed,
            "raw": doc_data,
        }

    def get_signing_link(self, document_uuid: str, signer_email: str) -> Optional[str]:
        """Gera ou obtém o link de assinatura direta para o signatário especificado."""
        if not self.is_configured:
            return None

        # 1. Tenta endpoint direto /documents/{uuid}/signlink
        try:
            url = f"{self.base_url}/documents/{document_uuid}/signlink"
            params = self._auth_params()
            resp = requests.post(url, params=params, json={"email": signer_email}, timeout=15)
            if resp.status_code == 200:
                res_data = resp.json()
                if isinstance(res_data, dict) and res_data.get("url"):
                    return res_data["url"]
        except Exception as e:
            logger.warning(f"Não foi possível obter signlink via API: {e}")

        # 2. Fallback: URL de acesso ao documento ou portal
        base_web = "https://sandbox.d4sign.com.br" if self.environment == "sandbox" else "https://secure.d4sign.com.br"
        return f"{base_web}/verificar/{document_uuid}"

    def download_signed_pdf(self, document_uuid: str) -> Optional[bytes]:
        """Faz o download do PDF assinado oficial com os certificados e protocolos do D4Sign."""
        if not self.is_configured:
            raise RuntimeError("Credenciais do D4Sign não configuradas.")

        url = f"{self.base_url}/documents/{document_uuid}/download"
        params = self._auth_params()
        payload = {"type": "pdf"}

        resp = requests.post(url, params=params, json=payload, timeout=40)
        if resp.status_code != 200:
            logger.error(f"D4Sign download falhou ({resp.status_code}): {resp.text}")
            raise RuntimeError(f"Erro ao requisitar download do contrato assinado no D4Sign: {resp.text}")

        res_json = resp.json()
        file_url = res_json.get("url")
        if not file_url:
            raise RuntimeError("D4Sign não retornou a URL para download do arquivo.")

        # Baixa os bytes do arquivo assinado
        file_resp = requests.get(file_url, timeout=60)
        if file_resp.status_code != 200:
            raise RuntimeError("Falha ao efetuar o download do PDF a partir da URL do D4Sign.")

        return file_resp.content


def get_d4sign_client_from_settings(settings: Dict[str, Any]) -> D4SignService:
    """Instancia o D4SignService a partir das configurações salvas no banco ou variáveis de ambiente."""
    token = settings.get("d4sign_token_api") or os.environ.get("D4SIGN_TOKEN_API") or ""
    crypt = settings.get("d4sign_crypt_key") or os.environ.get("D4SIGN_CRYPT_KEY") or ""
    env = settings.get("d4sign_environment") or os.environ.get("D4SIGN_ENVIRONMENT") or "production"
    return D4SignService(token_api=token, crypt_key=crypt, environment=env)
