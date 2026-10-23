"""Portal appliance summary PDF (light, customer-facing)."""

from __future__ import annotations

import os
from io import BytesIO
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.utils import ImageReader

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN_LEFT = 0.5 * inch
MARGIN_RIGHT = 0.5 * inch
MARGIN_TOP = 0.5 * inch
MARGIN_BOTTOM = 0.65 * inch
CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

NAVY = colors.HexColor("#0B0F1A")
CYAN = colors.HexColor("#22D3EE")
CYAN_DARK = colors.HexColor("#0891B2")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
BORDER = colors.HexColor("#E5E7EB")
GREEN = colors.HexColor("#15803D")

HEADER_BAND_HEIGHT = 52
CYAN_RULE_HEIGHT = 3
FOOTER_PHONE = "(419) 740-0146"
FOOTER_SITE = "atomicrepair419.com"

_PDF_DIR = os.path.dirname(__file__)
_ASSETS_DIR = os.path.join(_PDF_DIR, "assets")
_REPO_ROOT = os.path.normpath(os.path.join(_PDF_DIR, "..", ".."))


def _resolve_logo_path() -> str:
    bundled = os.path.join(_ASSETS_DIR, "atomic-repair-horizontal-flat.png")
    if os.path.isfile(bundled):
        return bundled
    return os.path.join(
        _REPO_ROOT,
        "frontend",
        "public",
        "atomicrepair-brand",
        "atomic-repair-horizontal-flat.png",
    )


class _NumberedCanvas(canvas.Canvas):
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
            self._draw_page_chrome(total)
            super().showPage()
        super().save()

    def _draw_page_chrome(self, page_count: int):
        self.saveState()
        # Navy header band + logo
        self.setFillColor(NAVY)
        self.rect(0, PAGE_HEIGHT - HEADER_BAND_HEIGHT, PAGE_WIDTH, HEADER_BAND_HEIGHT, fill=1, stroke=0)
        logo_path = _resolve_logo_path()
        if os.path.isfile(logo_path):
            try:
                img = ImageReader(logo_path)
                iw, ih = img.getSize()
                max_h = HEADER_BAND_HEIGHT - 16
                max_w = 2.2 * inch
                scale = min(max_w / iw, max_h / ih)
                draw_w = iw * scale
                draw_h = ih * scale
                x = MARGIN_LEFT
                y = PAGE_HEIGHT - HEADER_BAND_HEIGHT + (HEADER_BAND_HEIGHT - draw_h) / 2
                self.drawImage(img, x, y, width=draw_w, height=draw_h, mask="auto")
            except Exception:
                pass
        self.setFillColor(CYAN)
        self.rect(0, PAGE_HEIGHT - HEADER_BAND_HEIGHT - CYAN_RULE_HEIGHT, PAGE_WIDTH, CYAN_RULE_HEIGHT, fill=1, stroke=0)

        footer_y = 0.42 * inch
        self.setStrokeColor(BORDER)
        self.setLineWidth(0.5)
        self.line(MARGIN_LEFT, footer_y + 8, PAGE_WIDTH - MARGIN_RIGHT, footer_y + 8)
        self.setFillColor(MUTED)
        self.setFont("Helvetica", 8)
        self.drawCentredString(
            PAGE_WIDTH / 2,
            footer_y - 2,
            f"Atomic Repair · {FOOTER_PHONE} · {FOOTER_SITE} · Page {self._pageNumber} of {page_count}",
        )
        self.restoreState()


def _p_style(name: str, **kwargs) -> ParagraphStyle:
    base = {
        "fontName": "Helvetica",
        "fontSize": 10,
        "leading": 13,
        "textColor": TEXT,
        "alignment": TA_LEFT,
    }
    base.update(kwargs)
    return ParagraphStyle(name, **base)


def _section_table(rows: List[List[str]], warranty_kinds: List[str]) -> Table:
    header = ["Appliance", "Brand", "Model", "Serial", "Last service", "Warranty"]
    data = [header] + rows
    col_widths = [
        CONTENT_WIDTH * 0.18,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.22,
        CONTENT_WIDTH * 0.18,
        CONTENT_WIDTH * 0.14,
        CONTENT_WIDTH * 0.16,
    ]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style_commands = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#374151")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.5, CYAN),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    for row_idx, kind in enumerate(warranty_kinds, start=1):
        if kind == "active":
            style_commands.append(("TEXTCOLOR", (5, row_idx), (5, row_idx), GREEN))
        elif kind in ("expired", "none"):
            style_commands.append(("TEXTCOLOR", (5, row_idx), (5, row_idx), MUTED))
    table.setStyle(TableStyle(style_commands))
    return table


def build_appliance_summary_pdf(document: Dict[str, Any]) -> bytes:
    """Render appliance summary PDF bytes from a document dict."""
    buffer = BytesIO()
    frame_top = PAGE_HEIGHT - MARGIN_TOP - HEADER_BAND_HEIGHT - CYAN_RULE_HEIGHT - 8
    frame_height = frame_top - MARGIN_BOTTOM
    frame = Frame(
        MARGIN_LEFT,
        MARGIN_BOTTOM,
        CONTENT_WIDTH,
        frame_height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
        id="content",
    )

    doc = BaseDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP + HEADER_BAND_HEIGHT + CYAN_RULE_HEIGHT + 8,
        bottomMargin=MARGIN_BOTTOM,
    )
    doc.addPageTemplates([PageTemplate(id="summary", frames=[frame])])

    title_style = _p_style("title", fontName="Helvetica-Bold", fontSize=20, leading=24, spaceAfter=4)
    muted_style = _p_style("muted", textColor=MUTED, fontSize=10, leading=13)
    section_title = _p_style(
        "section",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=CYAN_DARK,
        spaceBefore=14,
        spaceAfter=2,
    )
    section_addr = _p_style("addr", textColor=MUTED, fontSize=9, leading=12, spaceAfter=6)

    story: List[Any] = []

    story.append(Paragraph("Appliance Summary", title_style))
    customer_line = document.get("customer_line") or ""
    story.append(Paragraph(customer_line, muted_style))
    summary_line = document.get("summary_line") or ""
    if summary_line:
        story.append(Paragraph(summary_line, muted_style))
    prepared = document.get("prepared_label") or ""
    if prepared:
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>{prepared}</b>", muted_style))
    story.append(Spacer(1, 10))

    sections = document.get("sections") or []
    if not sections:
        story.append(Paragraph("No appliances to show.", muted_style))
    else:
        for idx, section in enumerate(sections):
            if idx > 0:
                story.append(Spacer(1, 6))
            title = section.get("title") or "Property"
            story.append(Paragraph(title, section_title))
            address = (section.get("address") or "").strip()
            if address:
                story.append(Paragraph(address, section_addr))

            table_rows: List[List[str]] = []
            warranty_kinds: List[str] = []
            for row in section.get("rows") or []:
                model = row.get("model") or "—"
                if row.get("model_verified"):
                    model = f"{model} ✓ Verified"
                table_rows.append(
                    [
                        row.get("appliance") or "—",
                        row.get("brand") or "—",
                        model,
                        row.get("serial") or "—",
                        row.get("last_service") or "—",
                        row.get("warranty") or "—",
                    ]
                )
                warranty_kinds.append(row.get("warranty_kind") or "none")

            story.append(_section_table(table_rows, warranty_kinds))

    doc.build(story, canvasmaker=_NumberedCanvas)
    return buffer.getvalue()
