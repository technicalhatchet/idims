"""
Atomic Repair diagnostic report PDF v2 — shared cyberpunk chrome with invoice/estimate.

    from pdf.diagnostic_template_v2 import build_diagnostic_pdf_v2
    pdf_bytes = build_diagnostic_pdf_v2(report_dict, variant="light")
"""

from __future__ import annotations

from io import BytesIO
from typing import Any, Dict, List, Optional, Sequence

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image as RLImage,
    LongTable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from pdf.atomic_decorations import (
    DEFAULT_HEADER_LOGO_PATH,
    DEFAULT_WATERMARK_LOGO_PATH,
    draw_diagnostic_header,
    draw_page_decorations,
)
from pdf.atomic_panels import PanelFlowable, SideBySidePanelsFlowable
from pdf.atomic_tables import SectionLabelFlowable
from pdf import atomic_theme as theme
from pdf.atomic_theme import (
    CONTENT_WIDTH,
    CYAN,
    CYAN_HEX,
    FONT_BOLD,
    FONT_REGULAR,
    FOOTER_RESERVED,
    HEADER_HEIGHT,
    MARGIN_BOTTOM,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    PAGE_HEIGHT,
    PdfVariant,
    safe_text,
    set_pdf_variant,
)

SECTION_LABEL_TABLE_GAP = 4
CHECKLIST_LABEL_COL_FRAC = 0.42
PHOTO_COLS = 2
PHOTO_MAX_HEIGHT = 220
PHOTO_GAP = 8
TEXT_PANEL_PADDING = 10


def _checklist_header_left() -> ParagraphStyle:
    return ParagraphStyle(
        "DiagChecklistHeaderLeft",
        parent=theme.STYLE_TABLE_HEADER,
        alignment=TA_LEFT,
    )


def _checklist_finding_cell() -> ParagraphStyle:
    return ParagraphStyle(
        "DiagChecklistFindingCell",
        parent=theme.STYLE_TABLE_CELL,
        alignment=TA_CENTER,
    )


class DiagnosticDocTemplate(BaseDocTemplate):
    """Document with cyberpunk page chrome and flowing body frame."""

    def __init__(
        self,
        filename,
        report: dict,
        header_logo_path: Optional[str] = None,
        watermark_logo_path: Optional[str] = None,
        **kwargs,
    ):
        self.report_data = report
        self.header_logo_path = header_logo_path or DEFAULT_HEADER_LOGO_PATH
        self.watermark_logo_path = watermark_logo_path or DEFAULT_WATERMARK_LOGO_PATH
        super().__init__(filename, **kwargs)
        frame = Frame(
            MARGIN_LEFT,
            MARGIN_BOTTOM + FOOTER_RESERVED,
            CONTENT_WIDTH,
            PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - HEADER_HEIGHT - FOOTER_RESERVED,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
            id="diagnostic_body",
        )
        template = PageTemplate(id="diagnostic", frames=[frame], onPage=self._on_page)
        self.addPageTemplates([template])

    def _on_page(self, canvas, doc):
        draw_page_decorations(canvas, self.watermark_logo_path)
        draw_diagnostic_header(canvas, self.report_data, self.header_logo_path)


def _paragraph(text: str, style=None) -> Paragraph:
    return Paragraph(safe_text(text).replace("\n", "<br/>"), style or theme.STYLE_PANEL_BODY)


def _text_panel(width: float, title: str, text: str, *, accent: str = "cyan") -> PanelFlowable:
    body = text.strip() or "—"
    return PanelFlowable(
        width,
        title,
        [_paragraph(body)],
        accent=accent,
        min_height=0,
        padding=TEXT_PANEL_PADDING,
        title_height=20,
    )


def _section_prose_flowables(label: str, paragraphs: Sequence[str], *, accent: str = "cyan") -> List[Any]:
    """Section label + body text without an extra chamfered panel."""
    body = [p.strip() for p in paragraphs if p and str(p).strip()]
    if not body:
        return []
    return [
        SectionLabelFlowable(label, accent=accent),
        Spacer(1, SECTION_LABEL_TABLE_GAP),
        *[_paragraph(line) for line in body],
        Spacer(1, 6),
    ]


def _service_details_flowables(report: dict) -> List[Any]:
    left_bits: List[str] = []
    template_label = safe_text(report.get("template_label"))
    if template_label and template_label != "—":
        left_bits.append(f"<b>Appliance:</b> {template_label}")
    visit_label = report.get("visit_label")
    if visit_label:
        left_bits.append(f"<b>Visit:</b> {safe_text(visit_label)}")

    client_complaint = safe_text(report.get("client_complaint")).strip()
    if not left_bits and not client_complaint:
        return []

    items: List[Any] = [
        SectionLabelFlowable("SERVICE DETAILS", accent="cyan"),
        Spacer(1, SECTION_LABEL_TABLE_GAP),
    ]

    left_para = Paragraph(
        "<br/>".join(left_bits) if left_bits else "—",
        theme.STYLE_PANEL_BODY_COMPACT,
    )
    if client_complaint:
        right_para = Paragraph(
            f"<b>Client complaint:</b> {client_complaint.replace(chr(10), '<br/>')}",
            theme.STYLE_PANEL_BODY_COMPACT,
        )
        table = Table(
            [[left_para, right_para]],
            colWidths=[CONTENT_WIDTH * 0.38, CONTENT_WIDTH * 0.62],
        )
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 0), (0, 0), "LEFT"),
                    ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        items.append(table)
    else:
        items.append(left_para)

    items.append(Spacer(1, 6))
    return items


def _checklist_table_style() -> TableStyle:
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(CYAN_HEX)),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTNAME", (0, 1), (-1, -1), FONT_REGULAR),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("TEXTCOLOR", (0, 1), (0, -1), theme.MUTED),
            ("TEXTCOLOR", (1, 1), (1, -1), theme.INK),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 1), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.Color(0, 0, 0, alpha=0), theme.ROW_ALT]),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, colors.HexColor(CYAN_HEX)),
        ]
    )


def _section_heading_row(title: str) -> List[Any]:
    return [
        Paragraph(safe_text(title).upper(), theme.STYLE_SECTION_LABEL),
        Paragraph("", theme.STYLE_TABLE_CELL),
    ]


def _build_checklist_flowables(sections: Sequence[dict], width: float) -> List[Any]:
    if not sections:
        return [
            SectionLabelFlowable("DIAGNOSTIC CHECKLIST", accent="cyan"),
            Spacer(1, SECTION_LABEL_TABLE_GAP),
            _paragraph("No checklist readings were recorded.", theme.STYLE_PANEL_BODY),
        ]

    label_w = width * CHECKLIST_LABEL_COL_FRAC
    value_w = width - label_w
    header_left = _checklist_header_left()
    finding_cell = _checklist_finding_cell()
    rows: List[List[Any]] = [
        [
            Paragraph("ITEM", header_left),
            Paragraph("FINDING", theme.STYLE_TABLE_HEADER),
        ]
    ]
    section_row_indexes: List[int] = []

    for section in sections:
        section_row_indexes.append(len(rows))
        rows.append(_section_heading_row(section.get("title") or "Section"))
        for row in section.get("rows") or []:
            rows.append(
                [
                    Paragraph(safe_text(row.get("label")), theme.STYLE_TABLE_CELL),
                    Paragraph(safe_text(row.get("value")), finding_cell),
                ]
            )

    table = LongTable(rows, colWidths=[label_w, value_w], repeatRows=1, splitByRow=1)
    style = _checklist_table_style()
    for idx in section_row_indexes:
        style.add("SPAN", (0, idx), (1, idx))
        style.add("ALIGN", (0, idx), (1, idx), "LEFT")
        style.add("BACKGROUND", (0, idx), (1, idx), colors.HexColor("#0E2230"))
        style.add("TEXTCOLOR", (0, idx), (1, idx), colors.HexColor(CYAN_HEX))
        style.add("FONTNAME", (0, idx), (1, idx), FONT_BOLD)
        style.add("FONTSIZE", (0, idx), (1, idx), 8)
        style.add("TOPPADDING", (0, idx), (1, idx), 7)
        style.add("BOTTOMPADDING", (0, idx), (1, idx), 7)
    table.setStyle(style)

    return [
        SectionLabelFlowable("DIAGNOSTIC CHECKLIST", accent="cyan"),
        Spacer(1, SECTION_LABEL_TABLE_GAP),
        table,
    ]


def _evidence_flowables(snapshot: dict, width: float) -> List[Any]:
    top_categories = snapshot.get("top_categories") or []
    if not top_categories and snapshot.get("matched_rule_count") is None:
        return []

    lines: List[str] = []
    if top_categories:
        summary = ", ".join(f"{c['label']} {c['share_percent']}%" for c in top_categories)
        lines.append(f"<b>Top evidence:</b> {safe_text(summary)}")
    matched = snapshot.get("matched_rule_count")
    if matched is not None:
        lines.append(f"{int(matched)} rules matched at capture")
    captured_at = snapshot.get("captured_at")
    if captured_at:
        lines.append(f"Captured {safe_text(captured_at)}")

    if not lines:
        return []

    return [Spacer(1, 8), *_section_prose_flowables("EVIDENCE SNAPSHOT", lines, accent="cyan")]


class PhotoGridFlowable(Flowable):
    """Two-column photo grid with captions."""

    def __init__(self, photos: Sequence[dict], width: float):
        Flowable.__init__(self)
        self.photos = list(photos or [])
        self.width = width
        self.height = 0.0
        self._items: List[tuple] = []

    def _prepare(self):
        self._items = []
        col_w = (self.width - PHOTO_GAP) / PHOTO_COLS
        max_img_w = col_w - 12
        max_img_h = PHOTO_MAX_HEIGHT
        for photo in self.photos:
            raw = photo.get("bytes")
            if not raw:
                continue
            reader = ImageReader(BytesIO(raw))
            iw, ih = reader.getSize()
            if iw <= 0 or ih <= 0:
                continue
            scale = min(max_img_w / iw, max_img_h / ih, 1.0)
            img = RLImage(BytesIO(raw), width=iw * scale, height=ih * scale)
            caption = safe_text(photo.get("description") or "Photo")
            self._items.append((img, caption, img.drawHeight + 18))

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        self._prepare()
        if not self._items:
            self.height = 0.0
            return self.width, self.height

        row_heights: List[float] = []
        for i in range(0, len(self._items), PHOTO_COLS):
            row = self._items[i : i + PHOTO_COLS]
            row_heights.append(max(item[2] for item in row))
        self.height = sum(row_heights) + PHOTO_GAP * max(0, len(row_heights) - 1) + 8
        return self.width, min(self.height, availHeight)

    def draw(self):
        if not self._items:
            return
        col_w = (self.width - PHOTO_GAP) / PHOTO_COLS
        y = self.height - 8
        row: List[tuple] = []
        for item in self._items:
            row.append(item)
            if len(row) == PHOTO_COLS:
                y = self._draw_row(row, y, col_w)
                row = []
        if row:
            self._draw_row(row, y, col_w)

    def _draw_row(self, row: List[tuple], y_top: float, col_w: float) -> float:
        row_h = max(item[2] for item in row)
        y = y_top - row_h
        for idx, (img, caption, block_h) in enumerate(row):
            x = idx * (col_w + PHOTO_GAP)
            img_y = y + (block_h - img.drawHeight - 14)
            img.drawOn(self.canv, x + 6, img_y)
            self.canv.setFont(FONT_REGULAR, 7.5)
            self.canv.setFillColor(theme.MUTED)
            self.canv.drawString(x + 6, y + 2, caption[:72])
        return y - PHOTO_GAP


def _photo_flowables(photos: Sequence[dict], width: float) -> List[Any]:
    if not photos:
        return []
    return [
        Spacer(1, 8),
        SectionLabelFlowable("FIELD PHOTOS", accent="orange"),
        Spacer(1, SECTION_LABEL_TABLE_GAP),
        PhotoGridFlowable(photos, width),
    ]


def _build_story(report: dict) -> List[Any]:
    story: List[Any] = [Spacer(1, 4)]

    show_technician = report.get("show_technician", True)
    technician = (report.get("technician") or {"name": "—", "phone": "", "email": ""}) if show_technician else None
    story.append(
        SideBySidePanelsFlowable(
            CONTENT_WIDTH,
            report.get("customer") or {},
            report.get("equipment") or {},
            technician=technician,
            middle_panel=show_technician,
        )
    )
    story.append(Spacer(1, 6))
    story.extend(_service_details_flowables(report))

    root_cause = (report.get("root_cause") or "").strip()
    recommended = (report.get("recommended_repair") or "").strip()
    if root_cause:
        story.append(_text_panel(CONTENT_WIDTH, "ROOT CAUSE", root_cause, accent="orange"))
        story.append(Spacer(1, 5))
    if recommended:
        story.append(_text_panel(CONTENT_WIDTH, "RECOMMENDED REPAIR", recommended, accent="cyan"))
        story.append(Spacer(1, 5))

    what_we_found = (report.get("what_we_found") or "").strip()
    if what_we_found:
        story.append(_text_panel(CONTENT_WIDTH, "WHAT WE FOUND", what_we_found, accent="cyan"))
        story.append(Spacer(1, 6))

    story.extend(_build_checklist_flowables(report.get("checklist_sections") or [], CONTENT_WIDTH))
    story.extend(_evidence_flowables(report.get("evidence_snapshot") or {}, CONTENT_WIDTH))
    story.extend(_photo_flowables(report.get("photos") or [], CONTENT_WIDTH))
    story.append(Spacer(1, 8))
    return story


def build_diagnostic_pdf_v2(
    report: dict,
    header_logo_path: Optional[str] = None,
    watermark_logo_path: Optional[str] = None,
    variant: PdfVariant = "dark",
) -> bytes:
    """Render diagnostic report PDF bytes."""
    set_pdf_variant(variant)
    buffer = BytesIO()
    doc = DiagnosticDocTemplate(
        buffer,
        report,
        header_logo_path=header_logo_path,
        watermark_logo_path=watermark_logo_path,
        pagesize=letter,
        rightMargin=MARGIN_RIGHT,
        leftMargin=MARGIN_LEFT,
        topMargin=MARGIN_TOP + HEADER_HEIGHT,
        bottomMargin=MARGIN_BOTTOM + FOOTER_RESERVED,
    )
    doc.build(_build_story(report))
    return buffer.getvalue()
