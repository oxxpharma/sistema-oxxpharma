import base64
import io
import re
import logging
from PIL import Image, ImageOps

logger = logging.getLogger("image_optimizer")

def optimize_image_bytes(
    raw_bytes: bytes,
    max_width: int = 1920,
    max_height: int = 1200,
    quality: int = 82,
    output_format: str = "WEBP"
) -> tuple[bytes, str, dict]:
    """
    Otimiza bytes de uma imagem usando Pillow:
    - Corrige orientação EXIF (fotos de celular/câmera).
    - Preserva canal alfa (transparência) para WebP/PNG.
    - Redimensiona proporcionalmente se maior que max_width x max_height com filtro LANCZOS.
    - Converte para WebP de alta eficiência.
    - Retorna (optimized_bytes, mime_type, stats_dict).
    """
    orig_len = len(raw_bytes)
    try:
        img = Image.open(io.BytesIO(raw_bytes))
    except Exception as e:
        logger.warning(f"Falha ao abrir imagem com PIL: {e}")
        return raw_bytes, "image/jpeg", {"original_bytes": orig_len, "optimized_bytes": orig_len, "saved_percent": 0}

    # Corrige orientação de rotação EXIF
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    orig_w, orig_h = img.size

    # Redimensiona proporcionalmente mantendo proporção original se ultrapassar os limites
    scale_w = max_width / orig_w if orig_w > max_width else 1.0
    scale_h = max_height / orig_h if orig_h > max_height else 1.0
    scale = min(scale_w, scale_h)

    if scale < 1.0:
        new_w = max(1, int(round(orig_w * scale)))
        new_h = max(1, int(round(orig_h * scale)))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    else:
        new_w, new_h = orig_w, orig_h

    # Formatos e canais de cor
    out_format = output_format.upper()
    if out_format == "WEBP":
        mime_type = "image/webp"
        # WebP suporta RGB e RGBA nativamente
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "transparency" in img.info or img.mode == "P" else "RGB")
    elif out_format == "JPEG" or out_format == "JPG":
        mime_type = "image/jpeg"
        if img.mode != "RGB":
            # Converte com fundo branco se tiver transparência
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                bg.paste(img, mask=img.split()[3])
            else:
                bg.paste(img.convert("RGB"))
            img = bg
    else:
        mime_type = "image/png"
        out_format = "PNG"

    out_buf = io.BytesIO()
    if out_format == "WEBP":
        img.save(out_buf, format="WEBP", quality=quality, method=6)
    elif out_format in ("JPEG", "JPG"):
        img.save(out_buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    else:
        img.save(out_buf, format="PNG", optimize=True)

    opt_bytes = out_buf.getvalue()
    opt_len = len(opt_bytes)

    # Se por alguma razão o WebP ficou maior que o original (ex: ícone PNG 2x2px), mantém o original
    if opt_len >= orig_len and orig_len > 0:
        return raw_bytes, mime_type, {
            "original_bytes": orig_len,
            "optimized_bytes": orig_len,
            "saved_percent": 0.0,
            "width": orig_w,
            "height": orig_h,
        }

    saved_pct = round((1.0 - (opt_len / orig_len)) * 100.0, 1) if orig_len > 0 else 0.0

    return opt_bytes, mime_type, {
        "original_bytes": orig_len,
        "optimized_bytes": opt_len,
        "saved_percent": saved_pct,
        "width": new_w,
        "height": new_h,
    }


def optimize_image_data_url(
    data_url: str,
    max_width: int = 1920,
    max_height: int = 1200,
    quality: int = 82,
    output_format: str = "WEBP"
) -> tuple[str, dict]:
    """
    Recebe uma data URL (ex: data:image/png;base64,iVBORw0KGgo...)
    e retorna uma nova data URL WebP otimizada com os metadados de redução.
    Preserva SVG e URLs http(s).
    """
    if not data_url or not isinstance(data_url, str):
        return data_url, {}

    # URLs externas comuns não são data URLs
    if data_url.startswith(("http://", "https://", "/")):
        return data_url, {}

    # SVGs vetoriais são nativamente leves e não devem ser rasterizados
    if "image/svg" in data_url or data_url.startswith("data:image/svg"):
        return data_url, {"format": "svg", "saved_percent": 0}

    # Formato data: mime;base64,...
    match = re.match(r"^data:([^;]+);base64,(.+)$", data_url, re.DOTALL)
    if not match:
        return data_url, {}

    _orig_mime, b64_str = match.groups()
    try:
        raw_bytes = base64.b64decode(b64_str)
    except Exception as e:
        logger.warning(f"Erro ao decodificar base64: {e}")
        return data_url, {}

    opt_bytes, mime_type, stats = optimize_image_bytes(
        raw_bytes,
        max_width=max_width,
        max_height=max_height,
        quality=quality,
        output_format=output_format
    )

    new_b64 = base64.b64encode(opt_bytes).decode("ascii")
    new_data_url = f"data:{mime_type};base64,{new_b64}"

    return new_data_url, stats
