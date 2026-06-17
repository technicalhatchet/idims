"""Services and parts table Flowables with repeating headers and page breaks."""

from __future__ import annotations

from typing import Any, List, Optional, Sequence

from reportlab.lib import colors
from reportlab.platypus import Flowable, LongTable, Paragraph, Spacer, TableStyle

from pdf.atomic_badges import badge_cell
from pdf.atomic_fonts import title_display_font
from pdf.atomic_section_icons import (
    SECTION_ICON_LEFT,
    SECTION_ICON_SIZE,
    SECTION_LABEL_HEIGHT,
    SECTION_LABEL_TABLE_GAP,
    SECTION_TITLE_FONT_SIZE,
    section_icon_cy,
    section_title_baseline,
    draw_section_icon_badge,
    section_title_text_x,
)
from pdf import atomic_theme as theme
from pdf.atomic_theme import (
    CYAN,
    CYAN_HEX,
    FONT_BOLD,
    ORANGE,
    ORANGE_HEX,
    SECTION_GAP,
    TABLE_HEADER_CYAN,
    TABLE_HEADER_ORANGE,
    WHITE,
    money,
    safe_text,
)

def _service_row(service: dict) -> List[Any]:
    name = safe_text(service.get("name") or service.get("service_name"), "—")
    qty = safe_text(service.get("qty") or service.get("quantity"), "1")
    unit = money(service.get("unit_price"))
    total = money(service.get("total"))
    status = safe_text(service.get("billing_status") or service.get("status"), "Pending")
    return [
        Paragraph(name, theme.STYLE_TABLE_CELL),
        Paragraph(qty, theme.STYLE_TABLE_CELL_CENTER),
        Paragraph(unit, theme.STYLE_TABLE_CELL_RIGHT),
        Paragraph(total, theme.STYLE_TABLE_CELL_RIGHT),
        badge_cell(status, section="services"),
    ]


def _part_row(part: dict) -> List[Any]:
    part_no = safe_text(part.get("part_number"), "—")
    desc = safe_text(part.get("description"), "—")
    price = money(part.get("price"))
    status = safe_text(part.get("status"), "Pending")
    return [
        Paragraph(part_no, theme.STYLE_TABLE_CELL),
        Paragraph(desc, theme.STYLE_TABLE_CELL),
        Paragraph(price, theme.STYLE_TABLE_CELL_RIGHT),
        badge_cell(status, section="parts"),
    ]


def _services_style(col_count: int) -> TableStyle:
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_CYAN),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0, TABLE_HEADER_CYAN),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.Color(0, 0.85, 1, alpha=theme.TABLE_GRID_ALPHA)),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.Color(0, 0, 0, alpha=0), theme.ROW_ALT]),
    ]
    return TableStyle(commands)


def _parts_style() -> TableStyle:
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_ORANGE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        ("TOPPADDING", (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0, TABLE_HEADER_ORANGE),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.Color(1, 0.6, 0, alpha=theme.TABLE_GRID_ALPHA)),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.Color(0, 0, 0, alpha=0), theme.ROW_ALT]),
    ]
    return TableStyle(commands)


def _services_col_widths(width: float) -> List[float]:
    return [
        width * 0.40,
        width * 0.08,
        width * 0.16,
        width * 0.16,
        width * 0.20,
    ]


def _parts_col_widths(width: float) -> List[float]:
    return [
        width * 0.22,
        width * 0.48,
        width * 0.14,
        width * 0.16,
    ]


def build_services_long_table(services: Sequence[dict], width: float) -> LongTable:
    header = [
        Paragraph("SERVICE NAME", theme.STYLE_TABLE_HEADER),
        Paragraph("QTY", theme.STYLE_TABLE_HEADER),
        Paragraph("UNIT PRICE", theme.STYLE_TABLE_HEADER),
        Paragraph("TOTAL", theme.STYLE_TABLE_HEADER),
        Paragraph("BILLING STATUS", theme.STYLE_TABLE_HEADER),
    ]
    rows = [header]
    if services:
        rows.extend(_service_row(s) for s in services)
    else:
        rows.append([
            Paragraph("No services listed", theme.STYLE_TABLE_CELL),
            Paragraph("—", theme.STYLE_TABLE_CELL_CENTER),
            Paragraph("—", theme.STYLE_TABLE_CELL_RIGHT),
            Paragraph(money(0), theme.STYLE_TABLE_CELL_RIGHT),
            badge_cell("Pending", section="services"),
        ])
    table = LongTable(rows, colWidths=_services_col_widths(width), repeatRows=1, splitByRow=1)
    table.setStyle(_services_style(len(rows[0])))
    return table


def build_parts_long_table(parts: Sequence[dict], width: float) -> LongTable:
    header = [
        Paragraph("PART NUMBER", theme.STYLE_TABLE_HEADER),
        Paragraph("DESCRIPTION", theme.STYLE_TABLE_HEADER),
        Paragraph("PRICE", theme.STYLE_TABLE_HEADER),
        Paragraph("STATUS", theme.STYLE_TABLE_HEADER),
    ]
    rows = [header]
    if parts:
        rows.extend(_part_row(p) for p in parts)
    else:
        rows.append([
            Paragraph("—", theme.STYLE_TABLE_CELL),
            Paragraph("No parts listed", theme.STYLE_TABLE_CELL),
            Paragraph(money(0), theme.STYLE_TABLE_CELL_RIGHT),
            badge_cell("Pending", section="parts"),
        ])
    table = LongTable(rows, colWidths=_parts_col_widths(width), repeatRows=1, splitByRow=1)
    table.setStyle(_parts_style())
    return table


class SectionLabelFlowable(Flowable):
    """Section heading above a table (SERVICES / PARTS) with hex badge icon."""

    def __init__(self, label: str, accent: str = "cyan"):
        Flowable.__init__(self)
        self.label = label
        self.accent = accent
        self.width = 0.0
        self.height = SECTION_LABEL_HEIGHT

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return self.width, min(self.height, availHeight)

    def draw(self):
        color = CYAN if self.accent == "cyan" else ORANGE
        icon_cx = SECTION_ICON_LEFT + SECTION_ICON_SIZE / 2
        kind = "services" if self.accent == "cyan" else "parts"
        draw_section_icon_badge(self.canv, icon_cx, section_icon_cy(), color, kind)
        self.canv.setFont(title_display_font(), SECTION_TITLE_FONT_SIZE)
        self.canv.setFillColor(color)
        self.canv.drawString(section_title_text_x(), section_title_baseline(), self.label)


class SubtotalLineFlowable(Flowable):
    """Right-aligned subtotal below a section table."""

    def __init__(self, label: str, amount, width: float, accent_hex: str):
        Flowable.__init__(self)
        self.label = label
        self.amount = amount
        self.table_width = width
        self.accent_hex = accent_hex
        self.width = width
        self.height = 16.0

    def wrap(self, availWidth, availHeight):
        self.width = min(self.table_width, availWidth)
        return self.width, min(self.height, availHeight)

    def draw(self):
        self.canv.setFont(FONT_BOLD, 8)
        self.canv.setFillColor(colors.HexColor(self.accent_hex))
        self.canv.drawRightString(self.width, 4, f"{self.label}  {money(self.amount)}")


def services_section_flowables(
    services: Sequence[dict],
    width: float,
    subtotal: Optional[float] = None,
) -> List[Flowable]:
    """Flowables for the services block — LongTable splits across pages."""
    items: List[Flowable] = [
        SectionLabelFlowable("SERVICES", accent="cyan"),
        Spacer(1, SECTION_LABEL_TABLE_GAP),
        build_services_long_table(services, width),
    ]
    if subtotal is not None:
        items.extend([Spacer(1, 4), SubtotalLineFlowable("SERVICES SUBTOTAL", subtotal, width, CYAN_HEX)])
    return items


def parts_section_flowables(
    parts: Sequence[dict],
    width: float,
    subtotal: Optional[float] = None,
) -> List[Flowable]:
    """Flowables for the parts block — LongTable splits across pages."""
    items: List[Flowable] = [
        SectionLabelFlowable("PARTS", accent="orange"),
        Spacer(1, SECTION_LABEL_TABLE_GAP),
        build_parts_long_table(parts, width),
    ]
    if subtotal is not None:
        items.extend([Spacer(1, 4), SubtotalLineFlowable("PARTS SUBTOTAL", subtotal, width, ORANGE_HEX)])
    return items


class ServicesTableFlowable(Flowable):
    """LongTable-based services section with cyan styling."""

    def __init__(self, services: Sequence[dict], width: float, subtotal: Optional[float] = None):
        Flowable.__init__(self)
        self.services = list(services or [])
        self.table_width = width
        self.subtotal = subtotal
        self._table = None
        self.width = width
        self.height = 0.0

    def _build_table(self) -> LongTable:
        return build_services_long_table(self.services, self.table_width)

    def wrap(self, availWidth, availHeight):
        self._table = self._build_table()
        overhead = SECTION_GAP + 16 + (18 if self.subtotal is not None else 0)
        w, h = self._table.wrap(min(availWidth, self.table_width), max(availHeight - overhead, 20))
        self._table_height = h
        self.width = w
        self.height = h + overhead
        return self.width, self.height

    def draw(self):
        canvas = self.canv
        icon_cx = SECTION_ICON_LEFT + SECTION_ICON_SIZE / 2
        label_top = self.height - SECTION_LABEL_HEIGHT
        draw_section_icon_badge(canvas, icon_cx, label_top + section_icon_cy(), CYAN, "services")
        canvas.setFont(title_display_font(), SECTION_TITLE_FONT_SIZE)
        canvas.setFillColor(CYAN)
        canvas.drawString(section_title_text_x(), label_top + section_title_baseline(), "SERVICES")

        table_h = self._table_height
        y_table = self.height - SECTION_GAP - table_h - (18 if self.subtotal is not None else 0)
        self._table.drawOn(canvas, 0, y_table)

        if self.subtotal is not None:
            canvas.setFont(FONT_BOLD, 8)
            canvas.setFillColor(colors.HexColor(CYAN_HEX))
            canvas.drawRightString(self.width, y_table - 14, f"SERVICES SUBTOTAL  {money(self.subtotal)}")


class PartsTableFlowable(Flowable):
    """LongTable-based parts section with orange styling."""

    def __init__(self, parts: Sequence[dict], width: float, subtotal: Optional[float] = None):
        Flowable.__init__(self)
        self.parts = list(parts or [])
        self.table_width = width
        self.subtotal = subtotal
        self._table = None
        self.width = width
        self.height = 0.0

    def _build_table(self) -> LongTable:
        return build_parts_long_table(self.parts, self.table_width)

    def wrap(self, availWidth, availHeight):
        self._table = self._build_table()
        overhead = SECTION_GAP + 16 + (18 if self.subtotal is not None else 0)
        w, h = self._table.wrap(min(availWidth, self.table_width), max(availHeight - overhead, 20))
        self._table_height = h
        self.width = w
        self.height = h + overhead
        return self.width, self.height

    def draw(self):
        canvas = self.canv
        icon_cx = SECTION_ICON_LEFT + SECTION_ICON_SIZE / 2
        label_top = self.height - SECTION_LABEL_HEIGHT
        draw_section_icon_badge(canvas, icon_cx, label_top + section_icon_cy(), ORANGE, "parts")
        canvas.setFont(title_display_font(), SECTION_TITLE_FONT_SIZE)
        canvas.setFillColor(ORANGE)
        canvas.drawString(section_title_text_x(), label_top + section_title_baseline(), "PARTS")

        table_h = self._table_height
        y_table = self.height - SECTION_GAP - table_h - (18 if self.subtotal is not None else 0)
        self._table.drawOn(canvas, 0, y_table)

        if self.subtotal is not None:
            canvas.setFont(FONT_BOLD, 8)
            canvas.setFillColor(colors.HexColor(ORANGE_HEX))
            canvas.drawRightString(self.width, y_table - 14, f"PARTS SUBTOTAL  {money(self.subtotal)}")


def draw_services_table(canvas, services: Sequence[dict], x: float, y: float, width: float, subtotal: Optional[float] = None) -> float:
    """
    Draw services table with top-left at (x, y) where y is the top edge.
    Returns the vertical space consumed (points).
    """
    flow = ServicesTableFlowable(services, width, subtotal=subtotal)
    avail_h = y - 36
    flow.wrap(width, avail_h)
    flow.drawOn(canvas, x, y - flow.height)
    return flow.height


def draw_parts_table(canvas, parts: Sequence[dict], x: float, y: float, width: float, subtotal: Optional[float] = None) -> float:
    """Draw parts table with top-left at (x, y). Returns height consumed."""
    flow = PartsTableFlowable(parts, width, subtotal=subtotal)
    avail_h = y - 36
    flow.wrap(width, avail_h)
    flow.drawOn(canvas, x, y - flow.height)
    return flow.height
