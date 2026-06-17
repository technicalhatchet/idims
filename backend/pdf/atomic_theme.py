"""Color palette, typography, and layout constants for Atomic PDF templates."""

from __future__ import annotations

from typing import Literal

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth

PdfVariant = Literal["dark", "light"]

# ---------------------------------------------------------------------------
# Brand accents (shared across variants)
# ---------------------------------------------------------------------------
CYAN_HEX = "#00D8FF"
ORANGE_HEX = "#FF9800"
GREEN_HEX = "#7CFF00"
CYAN = colors.HexColor(CYAN_HEX)
ORANGE = colors.HexColor(ORANGE_HEX)
GREEN = colors.HexColor(GREEN_HEX)

CYAN_GLOW = colors.HexColor("#00D8FF33")
ORANGE_GLOW = colors.HexColor("#FF980033")

TABLE_HEADER_CYAN_HEX = "#007A94"
TABLE_HEADER_ORANGE_HEX = "#B35F00"
TABLE_HEADER_CYAN = colors.HexColor(TABLE_HEADER_CYAN_HEX)
TABLE_HEADER_ORANGE = colors.HexColor(TABLE_HEADER_ORANGE_HEX)

# Text on colored surfaces (table headers, status badges, chips)
WHITE_HEX = "#FFFFFF"
WHITE = colors.HexColor(WHITE_HEX)

# ---------------------------------------------------------------------------
# Variant palettes
# ---------------------------------------------------------------------------
_VARIANTS: dict[str, dict] = {
    "dark": {
        "page_outer_hex": "#000814",
        "page_inner_hex": "#02111F",
        "surface_hex": "#041A2E",
        "row_alt_hex": "#031525",
        "ink_hex": "#FFFFFF",
        "title_on_surface_hex": "#FFFFFF",
        "muted_hex": "#8BA4B8",
        "watermark_alpha": 0.33,
        "hex_fade_peak": 0.22,
        "hex_fade_mid": 0.12,
        "frame_glow_alpha": 0.22,
        "glow_width": 3.5,
        "table_grid_alpha": 0.35,
    },
    "light": {
        "page_outer_hex": "#E2E8F0",
        "page_inner_hex": "#FFFFFF",
        "surface_hex": "#F8FAFC",
        "row_alt_hex": "#F1F5F9",
        "ink_hex": "#111827",
        "title_on_surface_hex": "#111827",
        "muted_hex": "#6B7280",
        "watermark_alpha": 0.10,
        "hex_fade_peak": 0.09,
        "hex_fade_mid": 0.04,
        "frame_glow_alpha": 0.14,
        "glow_width": 2.0,
        "table_grid_alpha": 0.22,
    },
}

_current_variant: PdfVariant = "dark"

# Semantic colors — updated by set_pdf_variant()
BLACK_HEX = _VARIANTS["dark"]["page_outer_hex"]
DARK_BLUE_HEX = _VARIANTS["dark"]["page_inner_hex"]
PANEL_FILL_HEX = _VARIANTS["dark"]["surface_hex"]
ROW_ALT_HEX = _VARIANTS["dark"]["row_alt_hex"]
INK_HEX = _VARIANTS["dark"]["ink_hex"]
TITLE_ON_SURFACE_HEX = _VARIANTS["dark"]["title_on_surface_hex"]
MUTED_HEX = _VARIANTS["dark"]["muted_hex"]

BLACK = colors.HexColor(BLACK_HEX)
DARK_BLUE = colors.HexColor(DARK_BLUE_HEX)
PANEL_FILL = colors.HexColor(PANEL_FILL_HEX)
ROW_ALT = colors.HexColor(ROW_ALT_HEX)
INK = colors.HexColor(INK_HEX)
TITLE_ON_SURFACE = colors.HexColor(TITLE_ON_SURFACE_HEX)
MUTED = colors.HexColor(MUTED_HEX)

WATERMARK_ALPHA = _VARIANTS["dark"]["watermark_alpha"]
HEX_FADE_PEAK_ALPHA = _VARIANTS["dark"]["hex_fade_peak"]
HEX_FADE_MID_ALPHA = _VARIANTS["dark"]["hex_fade_mid"]
FRAME_GLOW_ALPHA = _VARIANTS["dark"]["frame_glow_alpha"]
GLOW_WIDTH = _VARIANTS["dark"]["glow_width"]
TABLE_GRID_ALPHA = _VARIANTS["dark"]["table_grid_alpha"]

# ---------------------------------------------------------------------------
# Page geometry (US Letter)
# ---------------------------------------------------------------------------
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 0.55 * inch
MARGIN_RIGHT = 0.55 * inch
MARGIN_TOP = 0.45 * inch
MARGIN_BOTTOM = 0.5 * inch
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

HEADER_HEIGHT = 1.15 * inch
FOOTER_RESERVED = 0.35 * inch
CHAMFER = 10
BORDER_WIDTH = 1.25

PANEL_GAP = 10
SECTION_GAP = 14
TABLE_ROW_HEIGHT = 22
TABLE_HEADER_HEIGHT = 26

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

# Paragraph styles — rebuilt when variant changes
STYLE_ESTIMATE_TITLE = None
STYLE_DOC_META = None
STYLE_COMPANY_NAME = None
STYLE_COMPANY_LINE = None
STYLE_PANEL_TITLE = None
STYLE_PANEL_BODY = None
STYLE_PANEL_BODY_COMPACT = None
STYLE_PANEL_LABEL = None
STYLE_SECTION_LABEL = None
STYLE_SECTION_LABEL_ORANGE = None
STYLE_TABLE_HEADER = None
STYLE_TABLE_CELL = None
STYLE_TABLE_CELL_RIGHT = None
STYLE_TABLE_CELL_CENTER = None
STYLE_TOTAL_LABEL = None
STYLE_TOTAL_VALUE = None
STYLE_TOTAL_GRAND_LABEL = None
STYLE_TOTAL_GRAND_VALUE = None
STYLE_DISCOUNT = None
STYLE_TERMS = None
STYLE_PAID = None


def get_pdf_variant() -> PdfVariant:
    return _current_variant


def set_pdf_variant(variant: PdfVariant = "dark") -> None:
    """Switch dark / light palette for the next PDF build."""
    global _current_variant
    global BLACK_HEX, DARK_BLUE_HEX, PANEL_FILL_HEX, ROW_ALT_HEX, INK_HEX, TITLE_ON_SURFACE_HEX, MUTED_HEX
    global BLACK, DARK_BLUE, PANEL_FILL, ROW_ALT, INK, TITLE_ON_SURFACE, MUTED
    global WATERMARK_ALPHA, HEX_FADE_PEAK_ALPHA, HEX_FADE_MID_ALPHA
    global FRAME_GLOW_ALPHA, GLOW_WIDTH, TABLE_GRID_ALPHA

    if variant not in _VARIANTS:
        raise ValueError(f"Unknown PDF variant: {variant!r}")

    _current_variant = variant
    palette = _VARIANTS[variant]

    BLACK_HEX = palette["page_outer_hex"]
    DARK_BLUE_HEX = palette["page_inner_hex"]
    PANEL_FILL_HEX = palette["surface_hex"]
    ROW_ALT_HEX = palette["row_alt_hex"]
    INK_HEX = palette["ink_hex"]
    TITLE_ON_SURFACE_HEX = palette["title_on_surface_hex"]
    MUTED_HEX = palette["muted_hex"]

    BLACK = colors.HexColor(BLACK_HEX)
    DARK_BLUE = colors.HexColor(DARK_BLUE_HEX)
    PANEL_FILL = colors.HexColor(PANEL_FILL_HEX)
    ROW_ALT = colors.HexColor(ROW_ALT_HEX)
    INK = colors.HexColor(INK_HEX)
    TITLE_ON_SURFACE = colors.HexColor(TITLE_ON_SURFACE_HEX)
    MUTED = colors.HexColor(MUTED_HEX)

    WATERMARK_ALPHA = palette["watermark_alpha"]
    HEX_FADE_PEAK_ALPHA = palette["hex_fade_peak"]
    HEX_FADE_MID_ALPHA = palette["hex_fade_mid"]
    FRAME_GLOW_ALPHA = palette["frame_glow_alpha"]
    GLOW_WIDTH = palette["glow_width"]
    TABLE_GRID_ALPHA = palette["table_grid_alpha"]

    _rebuild_paragraph_styles()


def _rebuild_paragraph_styles() -> None:
    global STYLE_ESTIMATE_TITLE, STYLE_DOC_META, STYLE_COMPANY_NAME, STYLE_COMPANY_LINE
    global STYLE_PANEL_TITLE, STYLE_PANEL_BODY, STYLE_PANEL_BODY_COMPACT, STYLE_PANEL_LABEL
    global STYLE_SECTION_LABEL, STYLE_SECTION_LABEL_ORANGE
    global STYLE_TABLE_HEADER, STYLE_TABLE_CELL, STYLE_TABLE_CELL_RIGHT, STYLE_TABLE_CELL_CENTER
    global STYLE_TOTAL_LABEL, STYLE_TOTAL_VALUE, STYLE_TOTAL_GRAND_LABEL, STYLE_TOTAL_GRAND_VALUE
    global STYLE_DISCOUNT, STYLE_TERMS, STYLE_PAID

    STYLE_ESTIMATE_TITLE = ParagraphStyle(
        "AtomicEstimateTitle",
        fontName=FONT_BOLD,
        fontSize=28,
        leading=30,
        textColor=CYAN,
        alignment=TA_RIGHT,
        spaceAfter=2,
    )

    STYLE_DOC_META = ParagraphStyle(
        "AtomicDocMeta",
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=12,
        textColor=INK,
        alignment=TA_RIGHT,
    )

    STYLE_COMPANY_NAME = ParagraphStyle(
        "AtomicCompanyName",
        fontName=FONT_BOLD,
        fontSize=14,
        leading=16,
        textColor=CYAN,
        alignment=TA_CENTER,
    )

    STYLE_COMPANY_LINE = ParagraphStyle(
        "AtomicCompanyLine",
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=11,
        textColor=MUTED,
        alignment=TA_CENTER,
    )

    STYLE_PANEL_TITLE = ParagraphStyle(
        "AtomicPanelTitle",
        fontName=FONT_BOLD,
        fontSize=9,
        leading=11,
        textColor=CYAN,
        alignment=TA_LEFT,
        spaceAfter=4,
    )

    STYLE_PANEL_BODY = ParagraphStyle(
        "AtomicPanelBody",
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=12,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=2,
    )

    STYLE_PANEL_BODY_COMPACT = ParagraphStyle(
        "AtomicPanelBodyCompact",
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=10,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=0,
    )

    STYLE_PANEL_LABEL = ParagraphStyle(
        "AtomicPanelLabel",
        fontName=FONT_BOLD,
        fontSize=8,
        leading=10,
        textColor=MUTED,
        alignment=TA_LEFT,
    )

    STYLE_SECTION_LABEL = ParagraphStyle(
        "AtomicSectionLabel",
        fontName=FONT_BOLD,
        fontSize=10,
        leading=12,
        textColor=CYAN,
        alignment=TA_LEFT,
        spaceAfter=6,
        spaceBefore=4,
    )

    STYLE_SECTION_LABEL_ORANGE = ParagraphStyle(
        "AtomicSectionLabelOrange",
        parent=STYLE_SECTION_LABEL,
        textColor=ORANGE,
    )

    STYLE_TABLE_HEADER = ParagraphStyle(
        "AtomicTableHeader",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=9,
        textColor=WHITE,
        alignment=TA_CENTER,
    )

    STYLE_TABLE_CELL = ParagraphStyle(
        "AtomicTableCell",
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=10,
        textColor=INK,
        alignment=TA_LEFT,
    )

    STYLE_TABLE_CELL_RIGHT = ParagraphStyle(
        "AtomicTableCellRight",
        parent=STYLE_TABLE_CELL,
        alignment=TA_RIGHT,
    )

    STYLE_TABLE_CELL_CENTER = ParagraphStyle(
        "AtomicTableCellCenter",
        parent=STYLE_TABLE_CELL,
        alignment=TA_CENTER,
    )

    STYLE_TOTAL_LABEL = ParagraphStyle(
        "AtomicTotalLabel",
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=11,
        textColor=MUTED,
        alignment=TA_LEFT,
    )

    STYLE_TOTAL_VALUE = ParagraphStyle(
        "AtomicTotalValue",
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=11,
        textColor=INK,
        alignment=TA_RIGHT,
    )

    STYLE_TOTAL_GRAND_LABEL = ParagraphStyle(
        "AtomicTotalGrandLabel",
        fontName=FONT_BOLD,
        fontSize=16,
        leading=18,
        textColor=CYAN,
        alignment=TA_LEFT,
    )

    STYLE_TOTAL_GRAND_VALUE = ParagraphStyle(
        "AtomicTotalGrandValue",
        fontName=FONT_BOLD,
        fontSize=16,
        leading=18,
        textColor=INK,
        alignment=TA_RIGHT,
    )

    STYLE_DISCOUNT = ParagraphStyle(
        "AtomicDiscount",
        parent=STYLE_TOTAL_LABEL,
        textColor=CYAN,
    )

    STYLE_TERMS = ParagraphStyle(
        "AtomicTerms",
        fontName=FONT_REGULAR,
        fontSize=7.5,
        leading=10,
        textColor=MUTED,
        alignment=TA_LEFT,
    )

    STYLE_PAID = ParagraphStyle(
        "AtomicPaid",
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=11,
        textColor=MUTED,
        alignment=TA_LEFT,
    )


_rebuild_paragraph_styles()


def money(value) -> str:
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        amount = 0.0
    if amount < 0:
        return f"-${abs(amount):,.2f}"
    return f"${amount:,.2f}"


def safe_text(value, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def accent_color(name: str):
    if name == "orange":
        return ORANGE
    if name == "green":
        return GREEN
    return CYAN


def accent_hex(name: str) -> str:
    if name == "orange":
        return ORANGE_HEX
    if name == "green":
        return GREEN_HEX
    return CYAN_HEX


def text_width(text: str, font_name: str = FONT_REGULAR, font_size: float = 9) -> float:
    return stringWidth(text, font_name, font_size)
