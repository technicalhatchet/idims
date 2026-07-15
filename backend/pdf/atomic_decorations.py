"""Page frame, honeycomb overlays, watermark, and header chrome."""

from __future__ import annotations

import math
import os
from typing import Optional

from reportlab.lib.utils import ImageReader

from pdf import atomic_theme as theme
from pdf.atomic_fonts import title_display_font
from pdf.atomic_panels import draw_plain_panel
from pdf.atomic_theme import (
    BORDER_WIDTH,
    CHAMFER,
    CYAN,
    FONT_BOLD,
    FONT_REGULAR,
    GREEN,
    HEADER_HEIGHT,
    MARGIN_BOTTOM,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    ORANGE,
    PAGE_HEIGHT,
    PAGE_WIDTH,
    safe_text,
    text_width,
)

# Brand assets — bundled under backend/pdf/assets for production deploys (Railway
# builds from backend/ only; frontend/public is not available there).
_PDF_DIR = os.path.dirname(__file__)
_ASSETS_DIR = os.path.join(_PDF_DIR, "assets")
_REPO_ROOT = os.path.normpath(os.path.join(_PDF_DIR, "..", ".."))


def _resolve_asset(bundled_name: str, repo_relative: str) -> str:
    bundled = os.path.join(_ASSETS_DIR, bundled_name)
    if os.path.isfile(bundled):
        return bundled
    return os.path.join(_REPO_ROOT, repo_relative)


DEFAULT_HEADER_LOGO_PATH = _resolve_asset(
    "arblockdetail.png",
    os.path.join("frontend", "public", "arblockdetail.png"),
)
DEFAULT_WATERMARK_LOGO_PATH = _resolve_asset(
    "atomwrenches.png",
    os.path.join("frontend", "public", "atomwrenches.png"),
)
HEADER_LOGO_FILL_FRAC = 0.80
HEADER_LOGO_SCALE = 1.70
# ReportLab uses points (pt), not screen px — ~6pt left, ~8pt up
HEADER_LOGO_OFFSET_X = -17
HEADER_LOGO_OFFSET_Y = -1

HEX_FADE_MID_T = 0.5  # diagonal position (patch center) where mid opacity should land
# Drives diagonal progression + erosion dropout — keep fixed so the chipped edge stays stable
HEX_FADE_ACCEL = 1.5


def _hex_fade_power() -> float:
    """
    Opacity uses ``peak * (1 - t) ** k`` so mid hits ``HEX_FADE_MID_ALPHA`` while
    ``t`` (and erosion) still run on ``HEX_FADE_ACCEL``.
    """
    t_mid = min(0.999, HEX_FADE_MID_T * HEX_FADE_ACCEL)
    if t_mid >= 1.0 or theme.HEX_FADE_PEAK_ALPHA <= 0:
        return 1.0
    ratio = theme.HEX_FADE_MID_ALPHA / theme.HEX_FADE_PEAK_ALPHA
    remain = 1.0 - t_mid
    if remain <= 1e-6 or ratio <= 0:
        return 1.0
    return math.log(ratio) / math.log(remain)


def _chamfered_frame_path(canvas, x, y, width, height, chamfer=CHAMFER):
    path = canvas.beginPath()
    path.moveTo(x + chamfer, y)
    path.lineTo(x + width - chamfer, y)
    path.lineTo(x + width, y + chamfer)
    path.lineTo(x + width, y + height - chamfer)
    path.lineTo(x + width - chamfer, y + height)
    path.lineTo(x + chamfer, y + height)
    path.lineTo(x, y + height - chamfer)
    path.lineTo(x, y + chamfer)
    path.close()
    return path


def draw_atomic_frame(canvas):
    """Full-page dark fill and outer chamfered cyan frame."""
    canvas.saveState()
    canvas.setFillColor(theme.BLACK)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)

    inset = 14
    frame_w = PAGE_WIDTH - inset * 2
    frame_h = PAGE_HEIGHT - inset * 2
    canvas.setFillColor(theme.DARK_BLUE)
    canvas.drawPath(_chamfered_frame_path(canvas, inset, inset, frame_w, frame_h), stroke=0, fill=1)

    from reportlab.lib import colors as rl_colors

    glow = rl_colors.Color(CYAN.red, CYAN.green, CYAN.blue, alpha=theme.FRAME_GLOW_ALPHA)
    canvas.setStrokeColor(glow)
    canvas.setLineWidth(4)
    canvas.drawPath(_chamfered_frame_path(canvas, inset, inset, frame_w, frame_h), stroke=1, fill=0)
    canvas.setStrokeColor(CYAN)
    canvas.setLineWidth(BORDER_WIDTH)
    canvas.drawPath(_chamfered_frame_path(canvas, inset, inset, frame_w, frame_h), stroke=1, fill=0)
    canvas.restoreState()


def _hex_path(canvas, cx: float, cy: float, r: float):
    """Flat-top hexagon centered at (cx, cy)."""
    p = canvas.beginPath()
    for i in range(6):
        angle = math.pi / 3 * i + math.pi / 6
        px = cx + r * math.cos(angle)
        py = cy + r * math.sin(angle)
        if i == 0:
            p.moveTo(px, py)
        else:
            p.lineTo(px, py)
    p.close()
    return p


def _hex_erosion_noise(u: float, v: float) -> float:
    """Deterministic waviness so the fade edge erodes instead of a ruler-straight line."""
    return (
        0.09 * math.sin(6.8 * u + 4.2 * v)
        + 0.06 * math.sin(14.3 * u - 9.7 * v + 1.2)
        + 0.04 * math.cos(21.0 * u + 15.5 * v)
        + 0.03 * math.sin(33.0 * u + 11.0 * v + 2.4)
    )


def _hex_dropout_hash(cx: float, cy: float) -> float:
    return (math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453) % 1.0


def _hex_alpha_at(
    cx: float,
    cy: float,
    region_x: float,
    region_y: float,
    region_w: float,
    region_h: float,
    alpha_bl: float | None = None,
    alpha_tr: float = 0.0,
    flip_h: bool = False,
    flip_v: bool = False,
) -> float:
    """
    Diagonal fade: strong at the start corner (``alpha_bl``), ~20% near center,
    zero at the far corner. Erosion noise warps the boundary.
    ``flip_h`` / ``flip_v`` mirror the fade (for top-right corner symmetry).
    """
    if alpha_bl is None:
        alpha_bl = theme.HEX_FADE_PEAK_ALPHA
    u = (cx - region_x) / max(region_w, 1.0)
    v = (cy - region_y) / max(region_h, 1.0)
    if flip_h:
        u = 1.0 - u
    if flip_v:
        v = 1.0 - v
    t_raw = (u + v) / 2.0 + _hex_erosion_noise(u, v)
    t = max(0.0, min(1.0, t_raw * HEX_FADE_ACCEL))
    alpha = alpha_bl * ((1.0 - t) ** _hex_fade_power())

    # Sparse hex dropout toward the faded corner — chipped / eroding edge
    dropout_start = 0.42 / HEX_FADE_ACCEL
    if t > dropout_start:
        dropout = ((t - dropout_start) / (1.0 - dropout_start)) ** 1.35
        if _hex_dropout_hash(cx, cy) < dropout * 0.82:
            return 0.0

    return max(0.0, alpha)


def draw_honeycomb_pattern(
    canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    accent=CYAN,
    alpha: float | None = None,
    flip_h: bool = False,
    flip_v: bool = False,
):
    """
    Hex grid with per-cell opacity fading bottom-left → top-right.

    ``alpha`` is the peak opacity at the fade start corner.
    Mid-field reads ~36%; top-right erodes to 0%.
    Pass ``flip_h`` + ``flip_v`` to mirror the fade for the top-right corner.
    """
    if alpha is None:
        alpha = theme.HEX_FADE_PEAK_ALPHA
    canvas.saveState()
    from reportlab.lib import colors as rl_colors

    clip = canvas.beginPath()
    clip.rect(x, y, width, height)
    canvas.clipPath(clip, stroke=0, fill=0)

    canvas.setLineWidth(0.45)
    canvas.setLineJoin(1)  # round joins — cleaner at low opacity

    hex_r = 8.5
    pitch_x = math.sqrt(3) * hex_r
    pitch_y = 1.5 * hex_r
    cols = int(width / pitch_x) + 3
    rows = int(height / pitch_y) + 3

    for row in range(rows):
        row_offset = pitch_x / 2 if row % 2 else 0
        cy = y + row * pitch_y + hex_r * 0.5
        for col in range(cols):
            cx = x + col * pitch_x + row_offset
            cell_alpha = _hex_alpha_at(
                cx,
                cy,
                x,
                y,
                width,
                height,
                alpha_bl=alpha,
                alpha_tr=0.0,
                flip_h=flip_h,
                flip_v=flip_v,
            )
            if cell_alpha < 0.025:
                continue
            canvas.setStrokeColor(
                rl_colors.Color(accent.red, accent.green, accent.blue, alpha=cell_alpha)
            )
            canvas.drawPath(_hex_path(canvas, cx, cy, hex_r), stroke=1, fill=0)

    canvas.restoreState()


def draw_watermark(canvas, logo_path: Optional[str]):
    """Large faint logo watermark in lower-left content area."""
    path = logo_path or DEFAULT_WATERMARK_LOGO_PATH
    if not os.path.isfile(path):
        _draw_vector_watermark(canvas)
        return

    canvas.saveState()
    try:
        img = ImageReader(path)
        iw, ih = img.getSize()
        target_w = 2.55 * 72
        target_h = target_w * (ih / iw)
        x = MARGIN_LEFT + 4
        y = MARGIN_BOTTOM + 18
        canvas.setFillAlpha(theme.WATERMARK_ALPHA)
        canvas.drawImage(img, x, y, width=target_w, height=target_h, mask="auto")
    except Exception:
        _draw_vector_watermark(canvas)
    finally:
        canvas.setFillAlpha(1)
        canvas.restoreState()


def _draw_vector_watermark(canvas):
    """Fallback wireframe wrench watermark when no logo file is present."""
    canvas.saveState()
    from reportlab.lib import colors as rl_colors

    cx = MARGIN_LEFT + 95
    cy = MARGIN_BOTTOM + 95
    color = rl_colors.Color(CYAN.red, CYAN.green, CYAN.blue, alpha=theme.WATERMARK_ALPHA)
    canvas.setStrokeColor(color)
    canvas.setLineWidth(2.5)
    canvas.line(cx - 55, cy - 30, cx + 55, cy + 30)
    canvas.line(cx - 55, cy + 30, cx + 55, cy - 30)
    canvas.circle(cx, cy, 18, stroke=1, fill=0)
    canvas.setFont(FONT_BOLD, 28)
    canvas.setFillColor(color)
    canvas.drawCentredString(cx, cy - 58, "ATOMIC")
    canvas.restoreState()


def draw_corner_honeycombs(canvas, accent=CYAN, peak_alpha: float | None = None):
    peak_alpha = theme.HEX_FADE_PEAK_ALPHA if peak_alpha is None else peak_alpha
    """
    Small corner accents only — each patch fades BL → TR with erosion inside its bounds.
    Top-right and bottom-left (original layout); they do not overlap.
    """
    draw_honeycomb_pattern(
        canvas,
        PAGE_WIDTH - 170,
        PAGE_HEIGHT - 150,
        150,
        130,
        accent=accent,
        alpha=peak_alpha,
        flip_h=True,
        flip_v=True,
    )
    draw_honeycomb_pattern(canvas, 18, 18, 140, 120, accent=accent, alpha=peak_alpha)


def draw_page_decorations(canvas, watermark_path: Optional[str] = None):
    """Frame, corner honeycombs, and watermark — call from page callbacks."""
    draw_atomic_frame(canvas)
    draw_corner_honeycombs(canvas)
    draw_watermark(canvas, watermark_path)


DOC_TITLE_SIZE = 28
DOC_TITLE_MIN_SIZE = 16
DOC_TITLE_BASELINE = 26
HEADER_LOGO_RESERVE = MARGIN_LEFT + PAGE_WIDTH * 0.37
TITLE_SIDE_GAP = 14
DOC_BADGE_GAP = 8
DOC_BADGE_DROP = 3
DOC_BADGE_PAD_X = 5
DOC_BADGE_PAD_Y = 4
DOC_BADGE_LINE_H = 8
DOC_BADGE_NO_SIZE = 8
DOC_BADGE_DATE_SIZE = 7.5
DOC_BADGE_CHAMFER = 3
DOC_BADGE_GLOW = 1.5
DOC_BADGE_TEXT_DROP = 4

HEADER_STATUS_FONT_SIZE = 9.5
HEADER_STATUS_PAD_X = 14
HEADER_STATUS_PAD_Y = 7
HEADER_STATUS_CHAMFER = 4
HEADER_STATUS_GLOW = 1.5


def _draw_header_status_banner(canvas, top_y: float, message: str, tone: str = "due"):
    """Centered chip between logo and document title (paid vs due)."""
    message = safe_text(message)
    if not message:
        return

    accent = GREEN if tone == "paid" else ORANGE
    font_size = HEADER_STATUS_FONT_SIZE
    canvas.setFont(FONT_BOLD, font_size)
    text_w = canvas.stringWidth(message, FONT_BOLD, font_size)
    chip_w = text_w + HEADER_STATUS_PAD_X * 2
    chip_h = font_size + HEADER_STATUS_PAD_Y * 2
    chip_x = (PAGE_WIDTH - chip_w) / 2
    chip_y = top_y - HEADER_HEIGHT + (HEADER_HEIGHT - chip_h) / 2

    draw_plain_panel(
        canvas,
        chip_x,
        chip_y,
        chip_w,
        chip_h,
        accent,
        chamfer=HEADER_STATUS_CHAMFER,
        glow_width=HEADER_STATUS_GLOW,
    )
    canvas.setFillColor(accent)
    canvas.drawCentredString(PAGE_WIDTH / 2, chip_y + HEADER_STATUS_PAD_Y + 1, message)


def _fit_document_title_size(title: str, max_width: float) -> float:
    """Shrink display title so long labels (e.g. DIAGNOSTIC REPORT) clear the logo."""
    font_name = title_display_font()
    size = float(DOC_TITLE_SIZE)
    while size > DOC_TITLE_MIN_SIZE and text_width(title, font_name, size) > max_width:
        size -= 0.5
    return size


def _draw_document_title_block(canvas, right_x: float, top_y: float, title: str, doc_no: str, doc_date: str):
    """Right-aligned title with a right-aligned meta badge tucked underneath."""
    title_max_w = max(120.0, right_x - HEADER_LOGO_RESERVE - TITLE_SIDE_GAP)
    title_size = _fit_document_title_size(title, title_max_w)
    title_y = top_y - DOC_TITLE_BASELINE
    canvas.setFont(title_display_font(), title_size)
    canvas.setFillColor(CYAN)
    canvas.drawRightString(right_x, title_y, title)

    no_text = f"#{doc_no}"
    badge_w = (
        max(
            text_width(no_text, FONT_REGULAR, DOC_BADGE_NO_SIZE),
            text_width(doc_date, FONT_REGULAR, DOC_BADGE_DATE_SIZE),
        )
        + DOC_BADGE_PAD_X * 2
    )
    badge_h = DOC_BADGE_PAD_Y * 2 + DOC_BADGE_LINE_H * 2
    badge_x = right_x - badge_w
    badge_bottom = title_y - DOC_BADGE_GAP - DOC_BADGE_DROP - badge_h

    draw_plain_panel(
        canvas,
        badge_x,
        badge_bottom,
        badge_w,
        badge_h,
        CYAN,
        chamfer=DOC_BADGE_CHAMFER,
        glow_width=DOC_BADGE_GLOW,
    )

    text_right = right_x - DOC_BADGE_PAD_X
    line1_y = badge_bottom + DOC_BADGE_PAD_Y + DOC_BADGE_NO_SIZE * 0.85 - DOC_BADGE_TEXT_DROP
    canvas.setFont(FONT_REGULAR, DOC_BADGE_NO_SIZE)
    canvas.setFillColor(theme.INK)
    canvas.drawRightString(text_right, line1_y, no_text)
    canvas.setFont(FONT_REGULAR, DOC_BADGE_DATE_SIZE)
    canvas.setFillColor(theme.MUTED)
    canvas.drawRightString(text_right, line1_y + DOC_BADGE_LINE_H, doc_date)


def _draw_document_header_logo(canvas, top_y: float, header_logo_path: Optional[str] = None):
    logo_path = header_logo_path or DEFAULT_HEADER_LOGO_PATH
    if not os.path.isfile(logo_path):
        return

    try:
        img = ImageReader(logo_path)
        iw, ih = img.getSize()
        aspect = iw / ih
        avail_h = HEADER_HEIGHT * HEADER_LOGO_FILL_FRAC
        avail_w = (PAGE_WIDTH * 0.34 - MARGIN_LEFT) * HEADER_LOGO_FILL_FRAC
        if avail_w / aspect <= avail_h:
            logo_w = avail_w
            logo_h = avail_w / aspect
        else:
            logo_h = avail_h
            logo_w = avail_h * aspect
        logo_w *= HEADER_LOGO_SCALE
        logo_h *= HEADER_LOGO_SCALE
        logo_x = MARGIN_LEFT + HEADER_LOGO_OFFSET_X
        logo_y = top_y - HEADER_HEIGHT + (HEADER_HEIGHT - logo_h) / 2 + HEADER_LOGO_OFFSET_Y
        canvas.drawImage(
            img,
            logo_x,
            logo_y,
            width=logo_w,
            height=logo_h,
            mask="auto",
        )
    except Exception:
        pass


def draw_document_header(
    canvas,
    doc: dict,
    *,
    title: str,
    number_key: str,
    date_key: str = "date",
    header_logo_path: Optional[str] = None,
):
    """Header band: logo + document title and compact meta badge."""
    top_y = PAGE_HEIGHT - MARGIN_TOP
    content_bottom = top_y - HEADER_HEIGHT
    _draw_document_header_logo(canvas, top_y, header_logo_path)

    right_x = PAGE_WIDTH - MARGIN_RIGHT
    doc_no = safe_text(doc.get(number_key), "—")
    doc_date = safe_text(doc.get(date_key), "—")
    _draw_header_status_banner(
        canvas,
        top_y,
        doc.get("header_status_message"),
        tone=safe_text(doc.get("header_status_tone")) or "due",
    )
    _draw_document_title_block(canvas, right_x, top_y, title, doc_no, doc_date)

    return content_bottom


def draw_estimate_header(canvas, estimate: dict, header_logo_path: Optional[str] = None):
    """Header band: logo (includes company contact) + ESTIMATE meta."""
    return draw_document_header(
        canvas,
        estimate,
        title="ESTIMATE",
        number_key="estimate_number",
        header_logo_path=header_logo_path,
    )


def draw_invoice_header(canvas, invoice: dict, header_logo_path: Optional[str] = None):
    """Header band: logo + INVOICE meta."""
    return draw_document_header(
        canvas,
        invoice,
        title="INVOICE",
        number_key="invoice_number",
        header_logo_path=header_logo_path,
    )


def draw_diagnostic_header(canvas, report: dict, header_logo_path: Optional[str] = None):
    """Header band: logo + DIAGNOSIS meta (shorter title avoids logo overlap)."""
    return draw_document_header(
        canvas,
        report,
        title="DIAGNOSIS",
        number_key="report_number",
        header_logo_path=header_logo_path,
    )
