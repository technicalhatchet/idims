"""
LoGiT field observation report PDF v2 — isolated corporate report template.

    from pdf.logit_template_v2 import build_logit_pdf_v2, sample_logit_report
    pdf_bytes = build_logit_pdf_v2(sample_logit_report(), variant="light")

Preview:

    cd backend
    python -m pdf.logit_template_v2
"""

from __future__ import annotations

import math
import os
from datetime import datetime, timedelta
from io import BytesIO
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.utils import ImageReader

from app.services.logit_pdf_data import (
    CATEGORY_LABELS,
    FREQUENCY_LABELS,
    PRIORITY_KEYS,
    TYPE_KEYS,
    TYPE_LABELS,
    PRIORITY_LABELS,
    enrich_summary_percentages,
)
from pdf.atomic_theme import CONTENT_WIDTH, safe_text

PdfVariant = Literal["light", "dark"]

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 0.55 * inch
MARGIN_RIGHT = 0.55 * inch
MARGIN_TOP = 0.45 * inch
MARGIN_BOTTOM = 0.55 * inch
FOOTER_HEIGHT = 0.32 * inch

# Layout grid — all sections share these widths for consistent alignment
HEADER_LEFT_W = 1.55 * inch
HEADER_RIGHT_W = 1.25 * inch
HEADER_CENTER_W = CONTENT_WIDTH - HEADER_LEFT_W - HEADER_RIGHT_W
HEADER_TOTAL_CARD_H = 0.68 * inch
SUMMARY_BAND_LEFT_W = CONTENT_WIDTH * 0.50
SUMMARY_BAND_RIGHT_W = CONTENT_WIDTH - SUMMARY_BAND_LEFT_W
SUMMARY_ROW_H = 0.66 * inch
MATRIX_TITLE_GAP = 8
SECTION_TITLE_GAP = 8
MATRIX_HEADER_ROW_H = 0.30 * inch
MATRIX_DATA_ROW_H = 0.40 * inch
BADGE_COL_W = 0.88 * inch
ICON_COL_W = 0.28 * inch
MATRIX_LABEL_W = 1.05 * inch
FINDING_TEXT_W = CONTENT_WIDTH - ICON_COL_W - BADGE_COL_W

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_PDF_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
DEFAULT_LOGIT_LOGO_PATH = os.path.join(_PDF_ASSETS_DIR, "logitlogo.png")


def _resolve_logit_logo_path(logo_path: Optional[str] = None) -> str:
    if logo_path and os.path.isfile(logo_path):
        return logo_path
    for candidate in (
        os.path.join(_PDF_ASSETS_DIR, "logitlogo.png"),
        os.path.join(_REPO_ROOT, "frontend", "public", "logitlogo.png"),
    ):
        if os.path.isfile(candidate):
            return candidate
    return DEFAULT_LOGIT_LOGO_PATH

# LoGiT semantic colors (local — do not modify atomic_theme)
LOGIT_CRITICAL = colors.HexColor("#EF4444")
LOGIT_MAJOR = colors.HexColor("#F97316")
LOGIT_MODERATE = colors.HexColor("#EAB308")
LOGIT_MINOR = colors.HexColor("#22C55E")
LOGIT_CYAN = colors.HexColor("#0891B2")
LOGIT_CYAN_LIGHT = colors.HexColor("#E0F2FE")
LOGIT_NAVY = colors.HexColor("#0A0F1E")
LOGIT_STRENGTH = colors.HexColor("#16A34A")

PRIORITY_COLORS = {
    "critical": LOGIT_CRITICAL,
    "major": LOGIT_MAJOR,
    "moderate": LOGIT_MODERATE,
    "minor": LOGIT_MINOR,
}

TYPE_COLORS = {
    "problem": LOGIT_CRITICAL,
    "idea": LOGIT_MODERATE,
    "blocker": LOGIT_MAJOR,
    "positive": LOGIT_STRENGTH,
}

PALETTES: Dict[str, Dict[str, Any]] = {
    "light": {
        "page_bg": colors.HexColor("#FFFFFF"),
        "surface": colors.HexColor("#F8FAFC"),
        "surface_alt": colors.HexColor("#F1F5F9"),
        "border": colors.HexColor("#E2E8F0"),
        "ink": colors.HexColor("#111827"),
        "muted": colors.HexColor("#6B7280"),
        "section": colors.HexColor("#0369A1"),
        "card_border": colors.HexColor("#CBD5E1"),
        "original_bg": colors.HexColor("#FFF7ED"),
        "original_border": colors.HexColor("#FDBA74"),
    },
    "dark": {
        "page_bg": colors.HexColor("#0A0F1E"),
        "surface": colors.HexColor("#111827"),
        "surface_alt": colors.HexColor("#1F2937"),
        "border": colors.HexColor("#374151"),
        "ink": colors.HexColor("#F9FAFB"),
        "muted": colors.HexColor("#9CA3AF"),
        "section": colors.HexColor("#22D3EE"),
        "card_border": colors.HexColor("#4B5563"),
        "original_bg": colors.HexColor("#1C1917"),
        "original_border": colors.HexColor("#F97316"),
    },
}


def _palette(variant: PdfVariant) -> Dict[str, Any]:
    return PALETTES[variant]


def _esc(text: str) -> str:
    return (
        safe_text(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def _para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(_esc(text) or "—", style)


def _build_styles(variant: PdfVariant) -> Dict[str, ParagraphStyle]:
    p = _palette(variant)
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "LogitTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=p["ink"],
            alignment=TA_LEFT,
        ),
        "title_center": ParagraphStyle(
            "LogitTitleCenter",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=p["ink"],
            alignment=TA_CENTER,
        ),
        "subtitle": ParagraphStyle(
            "LogitSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=13,
            textColor=p["muted"],
            alignment=TA_LEFT,
        ),
        "subtitle_center": ParagraphStyle(
            "LogitSubtitleCenter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=13,
            textColor=p["muted"],
            alignment=TA_CENTER,
        ),
        "meta": ParagraphStyle(
            "LogitMeta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=p["muted"],
            alignment=TA_LEFT,
        ),
        "meta_center": ParagraphStyle(
            "LogitMetaCenter",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=p["muted"],
            alignment=TA_CENTER,
        ),
        "logo_tag": ParagraphStyle(
            "LogitLogoTag",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=8,
            textColor=p["muted"],
            alignment=TA_LEFT,
            letterSpacing=1.2,
        ),
        "section": ParagraphStyle(
            "LogitSection",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=10,
            textColor=p["section"],
            spaceBefore=6,
            spaceAfter=4,
            letterSpacing=1.0,
        ),
        "section_tight": ParagraphStyle(
            "LogitSectionTight",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=10,
            textColor=p["section"],
            spaceBefore=0,
            spaceAfter=4,
            letterSpacing=1.0,
        ),
        "body": ParagraphStyle(
            "LogitBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
            textColor=p["ink"],
            spaceAfter=0,
        ),
        "body_small": ParagraphStyle(
            "LogitBodySmall",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=p["ink"],
        ),
        "label": ParagraphStyle(
            "LogitLabel",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=p["muted"],
            spaceBefore=4,
            spaceAfter=2,
        ),
        "original": ParagraphStyle(
            "LogitOriginal",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8.5,
            leading=11,
            textColor=p["ink"],
            leftIndent=6,
            rightIndent=6,
        ),
        "finding_title": ParagraphStyle(
            "LogitFindingTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=11,
            textColor=p["ink"],
            spaceAfter=1,
        ),
        "finding_body": ParagraphStyle(
            "LogitFindingBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=10,
            textColor=p["ink"],
            spaceAfter=0,
        ),
        "table_header": ParagraphStyle(
            "LogitTableHeader",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            textColor=p["ink"],
            alignment=TA_CENTER,
        ),
        "table_cell": ParagraphStyle(
            "LogitTableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=p["ink"],
            alignment=TA_CENTER,
        ),
        "table_cell_left": ParagraphStyle(
            "LogitTableCellLeft",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=p["ink"],
            alignment=TA_LEFT,
        ),
        "obs_title": ParagraphStyle(
            "LogitObsTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=p["ink"],
        ),
        "badge": ParagraphStyle(
            "LogitBadge",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=6.5,
            leading=8,
            textColor=colors.white,
            alignment=TA_CENTER,
        ),
        "type_label": ParagraphStyle(
            "LogitTypeLabel",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=p["ink"],
            alignment=TA_LEFT,
        ),
        "type_count": ParagraphStyle(
            "LogitTypeCount",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=p["ink"],
            alignment=TA_RIGHT,
        ),
        "type_pct": ParagraphStyle(
            "LogitTypePct",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=p["muted"],
            alignment=TA_RIGHT,
        ),
        "total_big": ParagraphStyle(
            "LogitTotalBig",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=24,
            textColor=p["ink"],
            alignment=TA_CENTER,
        ),
    }


def _table_pad() -> TableStyle:
    return TableStyle(
        [
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]
    )


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas so footers can show Page X of Y."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: List[dict] = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(total)
            super().showPage()
        super().save()

    def _draw_footer(self, page_count: int):
        variant = getattr(self, "_logit_variant", "light")
        p = _palette(variant)
        self.saveState()
        y = 0.34 * inch
        self.setStrokeColor(p["border"])
        self.setLineWidth(0.5)
        self.line(MARGIN_LEFT, y + 10, PAGE_WIDTH - MARGIN_RIGHT, y + 10)
        self.setFillColor(p["muted"])
        self.setFont("Helvetica", 7.5)
        self.drawString(MARGIN_LEFT, y - 2, "LoGiT · Generated report")
        self.drawRightString(
            PAGE_WIDTH - MARGIN_RIGHT,
            y - 2,
            f"Page {self._pageNumber} of {page_count}",
        )
        self.restoreState()


class PriorityDotFlowable(Flowable):
    def __init__(self, priority: str, size: float = 8):
        super().__init__()
        self.priority = priority
        self.size = size
        self.width = size
        self.height = size

    def draw(self):
        c = self.canv
        color = PRIORITY_COLORS.get(self.priority, LOGIT_MODERATE)
        c.setFillColor(color)
        c.circle(self.size / 2, self.size / 2, self.size / 2, fill=1, stroke=0)


class PriorityLabelFlowable(Flowable):
    """Priority dot + label, vertically centered for matrix rows."""

    def __init__(self, priority: str, variant: PdfVariant, width: float = 0.95 * inch):
        super().__init__()
        self.priority = priority
        self.variant = variant
        self.width = width
        self.height = 14

    def draw(self):
        c = self.canv
        p = _palette(self.variant)
        color = PRIORITY_COLORS.get(self.priority, LOGIT_MODERATE)
        c.setFillColor(color)
        c.circle(4, 7, 3.5, fill=1, stroke=0)
        c.setFillColor(p["ink"])
        c.setFont("Helvetica", 8)
        c.drawString(12, 4, PRIORITY_LABELS.get(self.priority, self.priority))


class TypeSummaryRowFlowable(Flowable):
    """Icon + label with dot leaders + count + percent."""

    def __init__(
        self,
        obs_type: str,
        label: str,
        count: int,
        percent: int,
        variant: PdfVariant,
        width: float,
    ):
        super().__init__()
        self.obs_type = obs_type
        self.label = label
        self.count = count
        self.percent = percent
        self.variant = variant
        self.width = width
        self.height = 16

    def draw(self):
        c = self.canv
        p = _palette(self.variant)
        icon = TypeIconFlowable(self.obs_type, 10)
        icon.canv = c
        icon.draw()

        label_x = 16
        c.setFont("Helvetica", 8)
        c.setFillColor(p["ink"])
        c.drawString(label_x, 4, self.label)
        label_w = stringWidth(self.label, "Helvetica", 8)

        count_text = str(self.count)
        pct_text = f"{self.percent}%"
        count_w = stringWidth(count_text, "Helvetica-Bold", 8)
        pct_w = stringWidth(pct_text, "Helvetica", 8)
        right_x = self.width
        pct_x = right_x - pct_w
        count_x = pct_x - count_w - 8

        dot_start = label_x + label_w + 4
        dot_end = count_x - 4
        c.setFillColor(p["border"])
        c.setFont("Helvetica", 8)
        x = dot_start
        while x < dot_end:
            c.drawString(x, 4, ".")
            x += 3

        c.setFillColor(p["ink"])
        c.setFont("Helvetica-Bold", 8)
        c.drawString(count_x, 4, count_text)
        c.setFont("Helvetica", 8)
        c.setFillColor(p["muted"])
        c.drawString(pct_x, 4, pct_text)


class TypeIconFlowable(Flowable):
    """Simple vector icons for observation types."""

    def __init__(self, obs_type: str, size: float = 12):
        super().__init__()
        self.obs_type = obs_type
        self.size = size
        self.width = size
        self.height = size

    def draw(self):
        c = self.canv
        s = self.size
        color = TYPE_COLORS.get(self.obs_type, LOGIT_CYAN)
        c.setStrokeColor(color)
        c.setFillColor(color)
        if self.obs_type == "problem":
            c.ellipse(s * 0.15, s * 0.35, s * 0.85, s * 0.9, fill=1, stroke=0)
            for i in range(6):
                angle = i * 60
                rad = math.radians(angle)
                x1 = s * 0.5 + math.cos(rad) * s * 0.22
                y1 = s * 0.55 + math.sin(rad) * s * 0.22
                x2 = s * 0.5 + math.cos(rad) * s * 0.42
                y2 = s * 0.55 + math.sin(rad) * s * 0.42
                c.setStrokeColor(color)
                c.setLineWidth(1)
                c.line(x1, y1, x2, y2)
        elif self.obs_type == "idea":
            c.circle(s * 0.5, s * 0.62, s * 0.28, fill=1, stroke=0)
            c.rect(s * 0.42, s * 0.12, s * 0.16, s * 0.22, fill=1, stroke=0)
        elif self.obs_type == "blocker":
            c.setFillColor(color)
            path = c.beginPath()
            path.moveTo(s * 0.5, s * 0.88)
            path.lineTo(s * 0.92, s * 0.12)
            path.lineTo(s * 0.08, s * 0.12)
            path.close()
            c.drawPath(path, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", s * 0.55)
            c.drawCentredString(s * 0.5, s * 0.28, "!")
        elif self.obs_type == "positive":
            c.setFillColor(color)
            r = s * 0.205
            c.circle(s * 0.355, s * 0.66, r, fill=1, stroke=0)
            c.circle(s * 0.645, s * 0.66, r, fill=1, stroke=0)
            path = c.beginPath()
            path.moveTo(s * 0.13, s * 0.58)
            path.lineTo(s * 0.5, s * 0.16)
            path.lineTo(s * 0.87, s * 0.58)
            path.close()
            c.drawPath(path, fill=1, stroke=0)


class PriorityRingFlowable(Flowable):
    def __init__(
        self,
        priority: str,
        count: int,
        percent: int,
        variant: PdfVariant,
        width: float = 1.0 * inch,
        height: float = 1.05 * inch,
    ):
        super().__init__()
        self.priority = priority
        self.count = count
        self.percent = percent
        self.variant = variant
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        p = _palette(self.variant)
        color = PRIORITY_COLORS.get(self.priority, LOGIT_MODERATE)
        cx = self.width / 2
        cy = self.height * 0.55
        radius = min(self.width, self.height) * 0.22
        c.setStrokeColor(color)
        c.setLineWidth(2.25)
        c.circle(cx, cy, radius, fill=0, stroke=1)
        c.setFillColor(p["ink"])
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(cx, cy - 4, str(self.count))
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(color)
        c.drawCentredString(cx, cy - radius - 8, PRIORITY_LABELS.get(self.priority, self.priority).upper())
        c.setFillColor(p["muted"])
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(cx, cy - radius - 16, f"{self.percent}%")


class TypeStatFlowable(Flowable):
    """Type indicator: icon left, count + label + % stacked on the right."""

    def __init__(
        self,
        obs_type: str,
        count: int,
        percent: int,
        variant: PdfVariant,
        width: float,
        height: float = SUMMARY_ROW_H,
    ):
        super().__init__()
        self.obs_type = obs_type
        self.count = count
        self.percent = percent
        self.variant = variant
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        p = _palette(self.variant)
        color = TYPE_COLORS.get(self.obs_type, LOGIT_CYAN)
        icon_size = 11
        icon_x = 2
        icon_y = self.height / 2 - icon_size / 2

        icon = TypeIconFlowable(self.obs_type, icon_size)
        icon.canv = c
        c.saveState()
        c.translate(icon_x, icon_y)
        icon.draw()
        c.restoreState()

        text_x = icon_x + icon_size + 6
        label = TYPE_LABELS.get(self.obs_type, self.obs_type).upper()
        if self.obs_type == "positive":
            label = "GOOD STUFF"

        count_y = self.height * 0.58
        label_y = count_y - 11
        pct_y = label_y - 9

        c.setFillColor(p["ink"])
        c.setFont("Helvetica-Bold", 12)
        c.drawString(text_x, count_y, str(self.count))
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(color)
        c.drawString(text_x, label_y, label)
        c.setFillColor(p["muted"])
        c.setFont("Helvetica", 6.5)
        c.drawString(text_x, pct_y, f"{self.percent}%")


class CategoryBarFlowable(Flowable):
    def __init__(self, label: str, count: int, percent: int, variant: PdfVariant, width: float):
        super().__init__()
        self.label = label
        self.count = count
        self.percent = percent
        self.variant = variant
        self.width = width
        self.height = 14

    def draw(self):
        c = self.canv
        p = _palette(self.variant)
        c.setFillColor(p["ink"])
        c.setFont("Helvetica", 8)
        c.drawString(0, 3, f"{self.label}")
        label_w = c.stringWidth(f"{self.label}", "Helvetica", 8)
        bar_x = label_w + 8
        bar_w = self.width - bar_x - 52
        c.setFillColor(p["surface_alt"])
        c.roundRect(bar_x, 2, max(bar_w, 20), 8, 2, fill=1, stroke=0)
        fill_w = max(4, bar_w * (self.percent / 100.0))
        c.setFillColor(LOGIT_CYAN)
        c.roundRect(bar_x, 2, fill_w, 8, 2, fill=1, stroke=0)
        c.setFillColor(p["muted"])
        c.setFont("Helvetica", 7.5)
        c.drawRightString(self.width, 3, f"{self.count} · {self.percent}%")


class LogitDocTemplate(BaseDocTemplate):
    def __init__(self, buffer, report: dict, variant: PdfVariant = "light", logo_path: Optional[str] = None, **kwargs):
        self.report_data = report
        self.variant = variant
        self.logo_path = logo_path or DEFAULT_LOGIT_LOGO_PATH
        super().__init__(buffer, pagesize=letter, **kwargs)
        frame_h = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - FOOTER_HEIGHT
        frame = Frame(
            MARGIN_LEFT,
            MARGIN_BOTTOM + FOOTER_HEIGHT,
            CONTENT_WIDTH,
            frame_h,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id="logit_body",
        )
        template = PageTemplate(id="logit", frames=[frame], onPage=self._on_page)
        self.addPageTemplates([template])

    def _on_page(self, canvas_obj, doc):
        canvas_obj._logit_variant = self.variant
        p = _palette(self.variant)
        canvas_obj.saveState()
        canvas_obj.setFillColor(p["page_bg"])
        canvas_obj.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
        canvas_obj.restoreState()


def _format_period(report_meta: dict) -> str:
    start = report_meta.get("period_start")
    end = report_meta.get("period_end")
    if isinstance(start, datetime):
        start_s = start.strftime("%b %d")
    else:
        start_s = safe_text(start, "—")
    if isinstance(end, datetime):
        end_s = end.strftime("%b %d, %Y")
    else:
        end_s = safe_text(end, "—")
    return f"{start_s} – {end_s}"


def _format_generated(report_meta: dict) -> str:
    generated = report_meta.get("generated_at")
    if isinstance(generated, datetime):
        hour = generated.strftime("%I").lstrip("0") or "12"
        return generated.strftime(f"%b %d, %Y at {hour}:%M %p")
    return safe_text(generated, "—")


def _format_obs_date(value: Any) -> str:
    if isinstance(value, datetime):
        hour = value.strftime("%I").lstrip("0") or "12"
        return value.strftime(f"%b %d, %Y · {hour}:%M %p")
    return safe_text(value, "—")


def _section_rule(variant: PdfVariant) -> List[Any]:
    p = _palette(variant)
    return [Spacer(1, 6), HRFlowable(width="100%", thickness=0.5, color=p["border"]), Spacer(1, 8)]


def _empty_cell() -> Paragraph:
    return Paragraph(" ", ParagraphStyle("Empty", fontSize=1, leading=1))


def _build_report_header(report: dict, styles: Dict[str, ParagraphStyle], variant: PdfVariant, logo_path: str) -> List[Any]:
    p = _palette(variant)
    project = report.get("project") or {}
    meta = report.get("report") or {}
    total = report.get("totals", {}).get("observations", 0)
    resolved_logo = _resolve_logit_logo_path(logo_path)

    logo_cell: Any = Spacer(1, 0.02 * inch)
    if os.path.isfile(resolved_logo):
        try:
            reader = ImageReader(resolved_logo)
            iw, ih = reader.getSize()
            logo_h = 0.44 * inch
            logo_w = logo_h * (iw / ih)
            from reportlab.platypus import Image as RLImage
            logo_cell = RLImage(resolved_logo, width=logo_w, height=logo_h)
        except Exception:
            logo_cell = Spacer(1, 0.02 * inch)

    left_block = Table(
        [[logo_cell], [_para("OBSERVATION REPORT", styles["logo_tag"])]],
        colWidths=[HEADER_LEFT_W],
    )
    left_block.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (0, 0), 2),
                ("BOTTOMPADDING", (0, 1), (0, 1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    center_block = Table(
        [
            [_para(project.get("name", "LoGiT Project"), styles["title_center"])],
            [_para(meta.get("title", "Field Observation Report"), styles["subtitle_center"])],
            [Spacer(1, 2)],
            [_para(f"Reporting Period: {_format_period(meta)}", styles["meta_center"])],
            [_para(f"Generated: {_format_generated(meta)}", styles["meta_center"])],
        ],
        colWidths=[HEADER_CENTER_W],
    )
    center_block.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    total_inner = Table(
        [
            [_para("Total Observations", styles["meta_center"])],
            [_para(str(total), styles["total_big"])],
        ],
        colWidths=[HEADER_RIGHT_W - 0.12 * inch],
    )
    total_inner.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (0, 0), 1),
                ("BOTTOMPADDING", (0, 1), (0, 1), 0),
                ("TOPPADDING", (0, 1), (0, 1), 0),
            ]
        )
    )

    total_card = Table([[total_inner]], colWidths=[HEADER_RIGHT_W], rowHeights=[HEADER_TOTAL_CARD_H])
    total_card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), p["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.75, p["card_border"]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )

    header_table = Table(
        [[left_block, center_block, total_card]],
        colWidths=[HEADER_LEFT_W, HEADER_CENTER_W, HEADER_RIGHT_W],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [header_table, Spacer(1, 8), HRFlowable(width="100%", thickness=0.5, color=p["border"]), Spacer(1, 6)]


def _priority_row_table(
    report: dict,
    variant: PdfVariant,
    band_width: float,
) -> Table:
    priority_summary = report.get("priority_summary") or {}
    priority_pct = report.get("priority_summary_pct") or {}
    cell_w = band_width / 4
    rings = [
        PriorityRingFlowable(
            k,
            priority_summary.get(k, 0),
            priority_pct.get(k, 0),
            variant,
            width=cell_w,
            height=SUMMARY_ROW_H,
        )
        for k in PRIORITY_KEYS
    ]
    tbl = Table([rings], colWidths=[cell_w] * 4)
    tbl.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return tbl


def _type_row_table(
    report: dict,
    variant: PdfVariant,
    band_width: float,
) -> Table:
    type_summary = report.get("type_summary") or {}
    type_pct = report.get("type_summary_pct") or {}
    cell_w = band_width / 4
    stats = [
        TypeStatFlowable(
            k,
            type_summary.get(k, 0),
            type_pct.get(k, 0),
            variant,
            width=cell_w,
            height=SUMMARY_ROW_H,
        )
        for k in TYPE_KEYS
    ]
    tbl = Table([stats], colWidths=[cell_w] * 4)
    tbl.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return tbl


def _matrix_table(
    report: dict,
    styles: Dict[str, ParagraphStyle],
    variant: PdfVariant,
    table_width: float,
) -> Table:
    p = _palette(variant)
    matrix = report.get("matrix") or {}
    label_w = min(0.72 * inch, table_width * 0.24)
    data_col_w = (table_width - label_w) / 5
    col_widths = [label_w] + [data_col_w] * 5

    headers = ["", "Problem", "Idea", "Blocker", "Good Stuff", "Total"]
    rows: List[List[Any]] = [[_para(h, styles["table_header"]) for h in headers]]

    row_totals = {t: 0 for t in TYPE_KEYS}
    grand = 0

    for pr in PRIORITY_KEYS:
        data_cells: List[Any] = []
        row_sum = 0
        for tp in TYPE_KEYS:
            val = (matrix.get(pr) or {}).get(tp, 0)
            row_sum += val
            row_totals[tp] += val
            data_cells.append(_para(str(val), styles["table_cell"]))
        grand += row_sum
        rows.append(
            [PriorityLabelFlowable(pr, variant, label_w - 0.08 * inch)]
            + data_cells
            + [_para(str(row_sum), styles["table_cell"])]
        )

    total_row: List[Any] = [_para("Total", styles["table_header"])]
    for tp in TYPE_KEYS:
        total_row.append(_para(str(row_totals[tp]), styles["table_cell"]))
    total_row.append(_para(str(grand), styles["table_cell"]))
    rows.append(total_row)

    row_heights = [MATRIX_HEADER_ROW_H] + [MATRIX_DATA_ROW_H] * len(PRIORITY_KEYS) + [MATRIX_DATA_ROW_H]
    table = Table(rows, colWidths=col_widths, rowHeights=row_heights, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), p["surface_alt"]),
                ("BACKGROUND", (0, -1), (-1, -1), p["surface_alt"]),
                ("BOX", (0, 0), (-1, -1), 0.5, p["border"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, p["border"]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("ALIGN", (0, 1), (0, -2), "LEFT"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def _build_summary_matrix_band(
    report: dict,
    styles: Dict[str, ParagraphStyle],
    variant: PdfVariant,
) -> List[Any]:
    """Left half: exec summary + priority + type. Right half: observation matrix."""
    left_w = SUMMARY_BAND_LEFT_W
    right_w = SUMMARY_BAND_RIGHT_W

    left_panel = Table(
        [
            [_para("EXECUTIVE SUMMARY", styles["section_tight"])],
            [Spacer(1, SECTION_TITLE_GAP)],
            [_para(report.get("executive_summary", ""), styles["body"])],
            [Spacer(1, 4)],
            [_para("BY PRIORITY", styles["section_tight"])],
            [_priority_row_table(report, variant, left_w)],
            [Spacer(1, 3)],
            [_para("BY TYPE", styles["section_tight"])],
            [_type_row_table(report, variant, left_w)],
        ],
        colWidths=[left_w],
    )
    left_panel.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    right_panel = Table(
        [
            [_para("OBSERVATION MATRIX", styles["section_tight"])],
            [Spacer(1, MATRIX_TITLE_GAP)],
            [_matrix_table(report, styles, variant, right_w)],
        ],
        colWidths=[right_w],
    )
    right_panel.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    band = Table([[left_panel, right_panel]], colWidths=[left_w, right_w])
    band.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [band, Spacer(1, 5)]


def _key_finding_row(
    item: dict,
    styles: Dict[str, ParagraphStyle],
    variant: PdfVariant,
    band_width: float,
) -> Table:
    """Finding row: icon | title + summary | badge (title row, summary below)."""
    p = _palette(variant)
    icon_w = min(0.24 * inch, band_width * 0.09)
    badge_w = min(0.76 * inch, band_width * 0.24)
    text_w = band_width - icon_w - badge_w
    priority = item.get("priority", "moderate")
    if priority == "positive":
        badge_label = "STRENGTH"
        color = LOGIT_STRENGTH
    else:
        badge_label = PRIORITY_LABELS.get(priority, priority).upper()
        color = PRIORITY_COLORS.get(priority, LOGIT_MODERATE)

    badge = Table(
        [[_para(badge_label, styles["badge"])]],
        colWidths=[badge_w - 4],
    )
    badge.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )

    row = Table(
        [
            [
                TypeIconFlowable(item.get("type", "problem"), 11),
                _para(item.get("title", ""), styles["finding_title"]),
                badge,
            ],
            [
                _empty_cell(),
                _para(item.get("summary", ""), styles["finding_body"]),
                _empty_cell(),
            ],
        ],
        colWidths=[icon_w, text_w, badge_w],
    )
    row.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (0, 1)),
                ("VALIGN", (0, 0), (0, 1), "TOP"),
                ("VALIGN", (1, 0), (1, 0), "TOP"),
                ("VALIGN", (1, 1), (1, 1), "TOP"),
                ("VALIGN", (2, 0), (2, 0), "TOP"),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("LINEBELOW", (0, 1), (-1, 1), 0.5, p["border"]),
            ]
        )
    )
    return row


def _build_findings_talking_band(
    report: dict,
    styles: Dict[str, ParagraphStyle],
    variant: PdfVariant,
) -> List[Any]:
    """Left half: key findings. Right half: suggested talking points."""
    left_w = SUMMARY_BAND_LEFT_W
    right_w = SUMMARY_BAND_RIGHT_W
    findings = report.get("key_findings") or []
    points = report.get("talking_points") or []

    left_rows: List[List[Any]] = [[_para("KEY FINDINGS", styles["section_tight"])]]
    for item in findings:
        left_rows.append([_key_finding_row(item, styles, variant, left_w)])

    left_panel = Table(left_rows, colWidths=[left_w])
    left_panel.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    right_rows: List[List[Any]] = [
        [_para("SUGGESTED TALKING POINTS", styles["section_tight"])],
        [Spacer(1, SECTION_TITLE_GAP)],
    ]
    for idx, point in enumerate(points, start=1):
        right_rows.append([_talking_point_card(idx, point, styles, variant, right_w)])
        if idx < len(points):
            right_rows.append([Spacer(1, 3)])

    right_panel = Table(right_rows, colWidths=[right_w])
    right_panel.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    band = Table([[left_panel, right_panel]], colWidths=[left_w, right_w])
    band.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [band]


def _talking_point_card(
    idx: int,
    point: dict,
    styles: Dict[str, ParagraphStyle],
    variant: PdfVariant,
    band_width: float,
) -> Table:
    p = _palette(variant)
    priority = point.get("priority", "moderate")
    color = PRIORITY_COLORS.get(priority, LOGIT_CYAN)
    num_w = min(0.28 * inch, band_width * 0.12)
    content_w = band_width - num_w

    body = Table(
        [
            [_para(point.get("title", ""), styles["finding_title"])],
            [_para(point.get("body", ""), styles["finding_body"])],
        ],
        colWidths=[content_w - 10],
    )
    body.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    card = Table(
        [[str(idx), body]],
        colWidths=[num_w, content_w],
    )
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), color),
                ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (0, 0), 8.5),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("VALIGN", (0, 0), (0, 0), "MIDDLE"),
                ("BACKGROUND", (1, 0), (1, 0), p["surface"]),
                ("BOX", (0, 0), (-1, -1), 0.5, p["border"]),
                ("VALIGN", (1, 0), (1, 0), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
            ]
        )
    )
    return card


def _category_column_panel(rows: List[dict], variant: PdfVariant, col_width: float) -> Table:
    col_rows: List[List[Any]] = []
    for row in rows:
        col_rows.append(
            [
                CategoryBarFlowable(
                    row.get("label", ""),
                    row.get("count", 0),
                    row.get("percent", 0),
                    variant,
                    col_width,
                )
            ]
        )
        col_rows.append([Spacer(1, 2)])

    panel = Table(col_rows, colWidths=[col_width])
    panel.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return panel


def _build_category_breakdown(report: dict, styles: Dict[str, ParagraphStyle], variant: PdfVariant) -> List[Any]:
    rows = report.get("category_breakdown") or []
    if not rows:
        return []

    left_w = SUMMARY_BAND_LEFT_W
    right_w = SUMMARY_BAND_RIGHT_W
    split_at = (len(rows) + 1) // 2
    left_panel = _category_column_panel(rows[:split_at], variant, left_w)
    right_panel = _category_column_panel(rows[split_at:], variant, right_w)

    band = Table([[left_panel, right_panel]], colWidths=[left_w, right_w])
    band.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 6),
                ("LEFTPADDING", (1, 0), (1, 0), 6),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    return [
        _para("CATEGORY BREAKDOWN", styles["section_tight"]),
        Spacer(1, SECTION_TITLE_GAP),
        band,
    ]


def _observation_header_row(obs: dict, styles: Dict[str, ParagraphStyle]) -> Table:
    category = CATEGORY_LABELS.get(obs.get("category", ""), obs.get("category", ""))
    frequency = FREQUENCY_LABELS.get(obs.get("frequency", ""), obs.get("frequency", ""))
    meta_line = f"Category: {category}   ·   Frequency: {frequency}   ·   Date: {_format_obs_date(obs.get('created_at'))}"
    row = Table(
        [
            [
                PriorityDotFlowable(obs.get("priority", "moderate"), 9),
                TypeIconFlowable(obs.get("type", "problem"), 11),
                Table(
                    [
                        [_para(obs.get("title", ""), styles["obs_title"])],
                        [_para(meta_line, styles["meta"])],
                    ],
                    colWidths=[CONTENT_WIDTH - ICON_COL_W - 0.24 * inch],
                ),
            ]
        ],
        colWidths=[0.14 * inch, ICON_COL_W - 0.04 * inch, CONTENT_WIDTH - ICON_COL_W - 0.1 * inch],
    )
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 2)]))
    return row


def _observation_field(label: str, text: str, styles: Dict[str, ParagraphStyle]) -> List[Any]:
    if not safe_text(text):
        return []
    return [_para(label, styles["label"]), _para(text, styles["body_small"]), Spacer(1, 2)]


def _resolve_include_original_transcripts(report: dict, include_original_transcripts: Optional[bool]) -> bool:
    if include_original_transcripts is not None:
        return include_original_transcripts
    return bool((report.get("options") or {}).get("include_original_transcripts", False))


def _build_observation_entries(
    report: dict,
    styles: Dict[str, ParagraphStyle],
    variant: PdfVariant,
    *,
    include_original_transcripts: bool = False,
) -> List[Any]:
    p = _palette(variant)
    observations = report.get("observations") or []
    total = len(observations)
    flow: List[Any] = [
        PageBreak(),
        _para(f"COMPLETE OBSERVATION LOG (All {total})", styles["section"]),
        Spacer(1, 6),
    ]

    for obs in observations:
        entry_parts: List[Any] = [
            _observation_header_row(obs, styles),
            Spacer(1, 4),
        ]
        entry_parts.extend(_observation_field("OBSERVATION", obs.get("description", ""), styles))
        entry_parts.extend(_observation_field("IMPACT", obs.get("impact", ""), styles))
        entry_parts.extend(_observation_field("SUGGESTED FIX", obs.get("suggested_fix", ""), styles))
        transcript = safe_text(obs.get("original_transcript"))
        if include_original_transcripts and transcript:
            entry_parts.append(_para("ORIGINAL NOTE", styles["label"]))
            original_box = Table([[_para(f'"{transcript}"', styles["original"])]], colWidths=[CONTENT_WIDTH - 8])
            original_box.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), p["original_bg"]),
                        ("BOX", (0, 0), (-1, -1), 0.5, p["original_border"]),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            entry_parts.append(original_box)
        entry_parts.append(Spacer(1, 3))
        entry_parts.append(HRFlowable(width="100%", thickness=0.5, color=p["border"], spaceBefore=2, spaceAfter=8))
        flow.extend(entry_parts)
    return flow


def _build_story(
    report: dict,
    variant: PdfVariant,
    logo_path: str,
    *,
    include_original_transcripts: bool = False,
) -> List[Any]:
    styles = _build_styles(variant)
    summary_page: List[Any] = []
    summary_page.extend(_build_report_header(report, styles, variant, logo_path))
    summary_page.extend(_build_summary_matrix_band(report, styles, variant))
    summary_page.extend(_section_rule(variant))
    summary_page.extend(_build_findings_talking_band(report, styles, variant))
    summary_page.extend(_section_rule(variant))
    summary_page.extend(_build_category_breakdown(report, styles, variant))

    story: List[Any] = [KeepTogether(summary_page)]
    story.extend(
        _build_observation_entries(
            report,
            styles,
            variant,
            include_original_transcripts=include_original_transcripts,
        )
    )
    return story


def build_logit_pdf_v2(
    report_dict: dict,
    variant: PdfVariant = "light",
    logo_path: Optional[str] = None,
    include_original_transcripts: Optional[bool] = None,
) -> bytes:
    """Render LoGiT observation report PDF bytes.

    ``include_original_transcripts`` defaults to False. Pass True to include the
    raw original note block in the observation log, or set
    ``report_dict["options"]["include_original_transcripts"]``.
    """
    report = enrich_summary_percentages(dict(report_dict))
    include_transcripts = _resolve_include_original_transcripts(report, include_original_transcripts)
    buffer = BytesIO()
    logo = _resolve_logit_logo_path(logo_path)
    doc = LogitDocTemplate(
        buffer,
        report,
        variant=variant,
        logo_path=logo,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    story = _build_story(report, variant, logo, include_original_transcripts=include_transcripts)
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


def sample_logit_report() -> dict:
    """Realistic sample report with 47 observations for PDF preview."""
    period_start = datetime(2026, 8, 28)
    period_end = datetime(2026, 9, 12, 19, 30)
    generated_at = datetime(2026, 9, 12, 19, 30)

    matrix_plan: List[Tuple[str, str]] = []
    cells = {
        ("critical", "problem"): 2,
        ("critical", "blocker"): 4,
        ("major", "problem"): 5,
        ("major", "idea"): 2,
        ("major", "blocker"): 4,
        ("moderate", "problem"): 8,
        ("moderate", "idea"): 6,
        ("moderate", "blocker"): 3,
        ("moderate", "positive"): 1,
        ("minor", "problem"): 2,
        ("minor", "idea"): 7,
        ("minor", "positive"): 3,
    }
    for (priority, obs_type), count in cells.items():
        matrix_plan.extend([(priority, obs_type)] * count)

    category_targets = {
        "diagnostics": 12,
        "parts": 9,
        "ui_ux": 8,
        "job_details": 6,
        "photos": 4,
        "performance": 3,
        "customer": 3,
        "other": 2,
    }
    category_queue: List[str] = []
    for key, count in category_targets.items():
        category_queue.extend([key] * count)

    handcrafted: Dict[Tuple[str, str], List[dict]] = {
        ("critical", "problem"): [
            {
                "title": "Diagnostic state lost during navigation",
                "description": "When navigating back from the diagnostic screen, the information already entered is gone.",
                "impact": "Technicians may have to repeat diagnostic work and lose confidence in the tool.",
                "suggested_fix": "Persist the active diagnostic session across navigation and restore field values on return.",
                "original_transcript": "This fucking thing keeps losing everything when I go back to the job screen.",
                "category": "diagnostics",
                "frequency": "frequent",
            },
            {
                "title": "Estimate totals reset after refresh",
                "description": "Refreshing the work order screen clears in-progress estimate line items.",
                "impact": "Billing rework and customer-facing delays.",
                "suggested_fix": "Autosave estimate drafts locally and restore on reload.",
                "original_transcript": "I refreshed once and the whole estimate vanished.",
                "category": "job_details",
                "frequency": "occasional",
            },
        ],
        ("critical", "blocker"): [
            {
                "title": "Parts lookup stalls active jobs",
                "description": "Searching for parts during an active job frequently hangs or returns incomplete results.",
                "impact": "Technicians leave the app, call the office, or delay repairs.",
                "suggested_fix": "Improve parts search responsiveness and cache recent lookups per job.",
                "original_transcript": "I can't finish the call if parts search keeps spinning forever.",
                "category": "parts",
                "frequency": "frequent",
            },
            {
                "title": "Cannot submit job without office unlock",
                "description": "Some completed jobs remain locked until office staff manually releases them.",
                "impact": "Technicians cannot close jobs on site.",
                "suggested_fix": "Allow field completion with async office review.",
                "original_transcript": "I'm standing in the customer's kitchen waiting on the office again.",
                "category": "job_details",
                "frequency": "frequent",
            },
            {
                "title": "Signature capture fails on first attempt",
                "description": "Customer signature pad often ignores the first stroke.",
                "impact": "Awkward customer interactions and repeated attempts.",
                "suggested_fix": "Fix touch event handling on signature canvas.",
                "original_transcript": "Customer tried three times before it took the signature.",
                "category": "customer",
                "frequency": "occasional",
            },
            {
                "title": "Payment screen blocks completion",
                "description": "Payment step appears even when billing is handled by the office.",
                "impact": "Technicians cannot mark jobs complete in the field.",
                "suggested_fix": "Respect billing workflow settings per job type.",
                "original_transcript": "Why am I stuck on payment when AR handles this?",
                "category": "job_details",
                "frequency": "frequent",
            },
        ],
        ("minor", "positive"): [
            {
                "title": "Strong photo workflow",
                "description": "Technicians consistently praised the speed and reliability of capturing and attaching photos.",
                "impact": "Reduces follow-up documentation time and improves record quality.",
                "suggested_fix": "Preserve the current photo flow; avoid adding extra confirmation steps.",
                "original_transcript": "Photos are the one thing that just works every time. Don't mess with it.",
                "category": "photos",
                "frequency": "every_time",
            },
            {
                "title": "LoGiT capture flow is fast",
                "description": "Voice capture and review felt quick during busy routes.",
                "impact": "Encourages more field feedback without slowing technicians down.",
                "suggested_fix": "Keep the hold-to-talk interaction lightweight.",
                "original_transcript": "I can log something in like ten seconds between calls.",
                "category": "ui_ux",
                "frequency": "frequent",
            },
            {
                "title": "Priority picker is intuitive",
                "description": "Color-coded severity circles were understood immediately.",
                "impact": "Less training required for pilot participants.",
                "suggested_fix": "Maintain color + label pairing for accessibility.",
                "original_transcript": "Even the new guys got the green yellow orange red thing right away.",
                "category": "ui_ux",
                "frequency": "occasional",
            },
        ],
    }

    observations: List[dict] = []
    used_handcrafted: Dict[Tuple[str, str], int] = {}
    for i, (pr, tp) in enumerate(matrix_plan):
        key = (pr, tp)
        idx = used_handcrafted.get(key, 0)
        crafted_list = handcrafted.get(key, [])
        if idx < len(crafted_list):
            payload = dict(crafted_list[idx])
            used_handcrafted[key] = idx + 1
        else:
            cat = category_queue[i] if i < len(category_queue) else "other"
            payload = {
                "title": f"{TYPE_LABELS.get(tp, tp)} — {PRIORITY_LABELS.get(pr, pr)} ({i + 1})",
                "description": f"Technicians reported a {PRIORITY_LABELS.get(pr, pr).lower()} {TYPE_LABELS.get(tp, tp).lower()} affecting {CATEGORY_LABELS.get(cat, cat)} during field use.",
                "impact": "Adds friction to routine workflow and increases time on site.",
                "suggested_fix": "Review this area with product and prioritize based on frequency and severity.",
                "original_transcript": f"Field note {i + 1}: yeah this keeps happening on {CATEGORY_LABELS.get(cat, cat).lower()} jobs.",
                "category": cat,
                "frequency": ["frequent", "occasional", "once", "every_time"][i % 4],
            }
        observations.append(
            {
                "id": f"obs-{i + 1:03d}",
                "type": tp,
                "priority": pr,
                "category": payload.get("category", category_queue[i] if i < len(category_queue) else "other"),
                "frequency": payload.get("frequency", "occasional"),
                "title": payload["title"],
                "description": payload["description"],
                "impact": payload["impact"],
                "suggested_fix": payload["suggested_fix"],
                "original_transcript": payload["original_transcript"],
                "created_at": period_start + timedelta(days=i % 15, hours=(i * 2) % 12 + 8, minutes=(i * 7) % 60),
            }
        )

    from app.services.logit_pdf_data import build_logit_report_dict

    report = build_logit_report_dict(
        project={
            "name": "Corporate App Pilot",
            "context": "Appliance repair technician field feedback",
            "icon": "📝",
        },
        observations=observations,
        executive_summary=(
            "LoGiT captured 47 observations from appliance repair technicians using the Corporate App Pilot in the field. "
            "Technicians reported a mix of critical workflow blockers, important improvements, and positive feedback. "
            "Diagnostic persistence and parts lookup emerged as the highest-impact friction points, while photo capture "
            "and the LoGiT voice workflow were consistently praised."
        ),
        key_findings=[
            {
                "type": "problem",
                "priority": "critical",
                "title": "Diagnostic state persistence",
                "summary": "Multiple observations indicate diagnostic information is lost when navigating between screens, causing repeated work and lost time.",
            },
            {
                "type": "blocker",
                "priority": "major",
                "title": "Parts lookup workflow",
                "summary": "Technicians reported significant friction and interruptions when searching for parts during an active job.",
            },
            {
                "type": "idea",
                "priority": "moderate",
                "title": "UI efficiency opportunities",
                "summary": "Several moderate-priority ideas suggest small UI changes could meaningfully reduce taps and scrolling during common tasks.",
            },
            {
                "type": "positive",
                "priority": "positive",
                "title": "Strong photo workflow",
                "summary": "Technicians consistently praised the speed, reliability, and ease of capturing and attaching photos.",
            },
        ],
        talking_points=[
            {
                "priority": "critical",
                "title": "Address diagnostic state persistence before wider deployment.",
                "body": "Repeated data loss undermines trust and creates rework in the field.",
            },
            {
                "priority": "major",
                "title": "Parts lookup is a major source of workflow friction.",
                "body": "Search performance and result quality should be treated as release blockers for some teams.",
            },
            {
                "priority": "moderate",
                "title": "Several UI changes could significantly improve efficiency.",
                "body": "Quick wins in navigation, filters, and checklist interactions were frequently suggested.",
            },
            {
                "priority": "minor",
                "title": "The photo workflow is a strength and should be preserved.",
                "body": "Avoid regressions in photo capture when refactoring adjacent job flows.",
            },
        ],
        period_start=period_start,
        period_end=period_end,
        generated_at=generated_at,
    )
    return report


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate LoGiT PDF v2 previews")
    parser.add_argument(
        "--include-original-transcripts",
        action="store_true",
        help="Include raw original note blocks in the observation log",
    )
    args = parser.parse_args()

    base = os.path.dirname(__file__)
    report = sample_logit_report()
    outputs = (
        ("sample_logit_v2_preview.pdf", "light"),
        ("sample_logit_v2_preview_dark.pdf", "dark"),
        ("sample_logit_v2_preview_layout.pdf", "light"),
    )
    for name, variant in outputs:
        out = os.path.join(base, name)
        try:
            with open(out, "wb") as fh:
                fh.write(
                    build_logit_pdf_v2(
                        report,
                        variant=variant,
                        include_original_transcripts=args.include_original_transcripts,
                    )
                )
            print(f"Wrote {out} ({len(report.get('observations', []))} observations)")
        except PermissionError:
            alt = out.replace(".pdf", "_new.pdf")
            with open(alt, "wb") as fh:
                fh.write(
                    build_logit_pdf_v2(
                        report,
                        variant=variant,
                        include_original_transcripts=args.include_original_transcripts,
                    )
                )
            print(f"Wrote {alt} (original locked) ({len(report.get('observations', []))} observations)")
