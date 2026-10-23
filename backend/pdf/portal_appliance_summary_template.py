"""Portal appliance summary PDF (light, customer-facing)."""

from __future__ import annotations

import html
import os
from io import BytesIO
from typing import Any, Dict, List, Sequence, Tuple

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
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

WHITE = colors.white
CYAN = colors.HexColor("#22D3EE")
CYAN_DARK = colors.HexColor("#0891B2")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
BORDER = colors.HexColor("#E5E7EB")
GREEN = colors.HexColor("#15803D")

HEADER_BAND_HEIGHT = 48
CYAN_RULE_HEIGHT = 3
HEADER_CONTENT_GAP = 3
FOOTER_PHONE = "(419) 740-0146"
FOOTER_SITE = "atomicrepair419.com"

# Approximate max table body height per frame chunk (property heading extra on each chunk).
_MAX_TABLE_CHUNK_HEIGHT = 500

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
        band_top = PAGE_HEIGHT - HEADER_BAND_HEIGHT
        self.setFillColor(WHITE)
        self.rect(0, band_top, PAGE_WIDTH, HEADER_BAND_HEIGHT, fill=1, stroke=0)
        logo_path = _resolve_logo_path()
        if os.path.isfile(logo_path):
            try:
                img = ImageReader(logo_path)
                iw, ih = img.getSize()
                max_h = HEADER_BAND_HEIGHT - 14
                max_w = 2.35 * inch
                scale = min(max_w / iw, max_h / ih)
                draw_w = iw * scale
                draw_h = ih * scale
                x = MARGIN_LEFT
                y = band_top + (HEADER_BAND_HEIGHT - draw_h) / 2
                self.drawImage(img, x, y, width=draw_w, height=draw_h, mask="auto")
            except Exception:
                pass
        self.setFillColor(CYAN)
        self.rect(0, band_top - CYAN_RULE_HEIGHT, PAGE_WIDTH, CYAN_RULE_HEIGHT, fill=1, stroke=0)

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
        "leading": 12,
        "textColor": TEXT,
        "alignment": TA_LEFT,
    }
    base.update(kwargs)
    return ParagraphStyle(name, **base)


def _model_cell(model: str, verified: bool, cell_style: ParagraphStyle):
    text = (model or "—").strip() or "—"
    if verified and text != "—":
        safe = html.escape(text)
        return Paragraph(
            f'{safe} <font color="#22D3EE">✓</font>',
            cell_style,
        )
    return text


def _section_table(
    rows: List[List[Any]],
    warranty_kinds: List[str],
    model_cell_style: ParagraphStyle,
) -> Table:
    header = ["Appliance", "Brand", "Model", "Serial", "Last service", "Warranty"]
    data = [header] + rows
    col_widths = [
        CONTENT_WIDTH * 0.17,
        CONTENT_WIDTH * 0.11,
        CONTENT_WIDTH * 0.27,
        CONTENT_WIDTH * 0.15,
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
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
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


def _table_height(rows: List[List[Any]], warranty_kinds: List[str], model_cell_style: ParagraphStyle) -> float:
    table = _section_table(rows, warranty_kinds, model_cell_style)
    _, height = table.wrap(CONTENT_WIDTH, _MAX_TABLE_CHUNK_HEIGHT)
    return height


def _chunk_row_ranges(
    row_count: int,
    build_row: Any,
    warranty_kinds: Sequence[str],
    model_cell_style: ParagraphStyle,
    max_height: float,
) -> List[Tuple[int, int]]:
    """Return (start, end) index ranges so each chunk's table fits in max_height."""
    if row_count == 0:
        return []
    ranges: List[Tuple[int, int]] = []
    start = 0
    while start < row_count:
        end = start + 1
        last_fit = start + 1
        while end <= row_count:
            chunk_rows = [build_row(i) for i in range(start, end)]
            chunk_kinds = list(warranty_kinds[start:end])
            if _table_height(chunk_rows, chunk_kinds, model_cell_style) <= max_height:
                last_fit = end
                end += 1
            else:
                break
        if last_fit <= start:
            last_fit = start + 1
        ranges.append((start, last_fit))
        start = last_fit
    return ranges


def _property_section_flowables(
    section: Dict[str, Any],
    section_title_style: ParagraphStyle,
    section_addr_style: ParagraphStyle,
    model_cell_style: ParagraphStyle,
) -> List[Any]:
    title = section.get("title") or "Property"
    address = (section.get("address") or "").strip()
    raw_rows = section.get("rows") or []

    table_rows: List[List[Any]] = []
    warranty_kinds: List[str] = []
    for row in raw_rows:
        model = row.get("model") or "—"
        table_rows.append(
            [
                row.get("appliance") or "—",
                row.get("brand") or "—",
                _model_cell(model, bool(row.get("model_verified")), model_cell_style),
                row.get("serial") or "—",
                row.get("last_service") or "—",
                row.get("warranty") or "—",
            ]
        )
        warranty_kinds.append(row.get("warranty_kind") or "none")

    def build_row(i: int) -> List[Any]:
        return table_rows[i]

    ranges = _chunk_row_ranges(
        len(table_rows),
        build_row,
        warranty_kinds,
        model_cell_style,
        _MAX_TABLE_CHUNK_HEIGHT,
    )
    if not ranges:
        return []

    flowables: List[Any] = []
    for chunk_index, (start, end) in enumerate(ranges):
        continued = chunk_index > 0
        heading = title + (" (continued)" if continued else "")
        chunk_block: List[Any] = [
            Paragraph(heading, section_title_style),
        ]
        if address and not continued:
            chunk_block.append(Paragraph(address, section_addr_style))
        chunk_block.append(
            _section_table(table_rows[start:end], warranty_kinds[start:end], model_cell_style)
        )
        flowables.append(KeepTogether(chunk_block))
    return flowables


def build_appliance_summary_pdf(document: Dict[str, Any]) -> bytes:
    """Render appliance summary PDF bytes from a document dict."""
    buffer = BytesIO()
    frame_top = PAGE_HEIGHT - MARGIN_TOP - HEADER_BAND_HEIGHT - CYAN_RULE_HEIGHT - HEADER_CONTENT_GAP
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
        topMargin=MARGIN_TOP + HEADER_BAND_HEIGHT + CYAN_RULE_HEIGHT + HEADER_CONTENT_GAP,
        bottomMargin=MARGIN_BOTTOM,
    )
    doc.addPageTemplates([PageTemplate(id="summary", frames=[frame])])

    title_style = _p_style(
        "title",
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=22,
        spaceAfter=2,
        spaceBefore=0,
    )
    muted_style = _p_style("muted", textColor=MUTED, fontSize=10, leading=11, spaceAfter=1)
    legend_style = _p_style(
        "legend",
        textColor=MUTED,
        fontSize=8.5,
        leading=10,
        spaceAfter=2,
    )
    section_title = _p_style(
        "section",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=CYAN_DARK,
        spaceBefore=8,
        spaceAfter=1,
        keepWithNext=True,
    )
    section_addr = _p_style(
        "addr",
        textColor=MUTED,
        fontSize=9,
        leading=11,
        spaceAfter=4,
        keepWithNext=True,
    )
    model_cell_style = _p_style("modelCell", fontSize=9, leading=11)

    story: List[Any] = []

    story.append(Paragraph("Appliance Summary", title_style))
    customer_line = document.get("customer_line") or ""
    if customer_line:
        story.append(Paragraph(customer_line, muted_style))
    summary_line = document.get("summary_line") or ""
    if summary_line:
        story.append(Paragraph(summary_line, muted_style))
    story.append(
        Paragraph(
            '<font color="#22D3EE">✓</font> = verified by Atomic Repair',
            legend_style,
        )
    )
    prepared = document.get("prepared_label") or ""
    if prepared:
        story.append(Paragraph(f"<b>{prepared}</b>", muted_style))
    story.append(Spacer(1, 6))

    sections = document.get("sections") or []
    if not sections:
        story.append(Paragraph("No appliances to show.", muted_style))
    else:
        for idx, section in enumerate(sections):
            if idx > 0:
                story.append(Spacer(1, 4))
            story.extend(
                _property_section_flowables(
                    section,
                    section_title,
                    section_addr,
                    model_cell_style,
                )
            )

    doc.build(story, canvasmaker=_NumberedCanvas)
    return buffer.getvalue()
