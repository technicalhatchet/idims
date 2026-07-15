"""Chamfered panel drawing and panel Flowables."""

from __future__ import annotations

from typing import List, Optional, Sequence

from reportlab.lib import colors
from reportlab.platypus import Flowable, Paragraph, Spacer

from pdf import atomic_theme as theme
from pdf.atomic_theme import (
    BORDER_WIDTH,
    CHAMFER,
    CYAN,
    FONT_BOLD,
    ORANGE,
    PANEL_GAP,
    accent_color,
    safe_text,
)


def _chamfered_path(canvas, x: float, y: float, width: float, height: float, chamfer: float = CHAMFER):
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


def _draw_glow_border(
    canvas,
    x,
    y,
    width,
    height,
    accent,
    chamfer: float = CHAMFER,
    glow_width: float | None = None,
):
    glow_width = theme.GLOW_WIDTH if glow_width is None else glow_width
    glow = colors.Color(accent.red, accent.green, accent.blue, alpha=0.35)
    canvas.saveState()
    canvas.setStrokeColor(glow)
    canvas.setLineWidth(glow_width)
    canvas.drawPath(_chamfered_path(canvas, x, y, width, height, chamfer), stroke=1, fill=0)
    canvas.setStrokeColor(accent)
    canvas.setLineWidth(BORDER_WIDTH)
    canvas.drawPath(_chamfered_path(canvas, x, y, width, height, chamfer), stroke=1, fill=0)
    canvas.restoreState()


def draw_panel(
    canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    title: str,
    accent_color_name=CYAN,
    *,
    title_height: float = 22,
):
    """Draw a chamfered panel with title strip. ``y`` is the bottom edge."""
    accent = accent_color_name if hasattr(accent_color_name, "red") else accent_color(str(accent_color_name))

    canvas.saveState()
    path = _chamfered_path(canvas, x, y, width, height)
    canvas.setFillColor(theme.PANEL_FILL)
    canvas.drawPath(path, stroke=0, fill=1)

    title_h = title_height
    title_path = canvas.beginPath()
    title_path.moveTo(x + CHAMFER, y + height - title_h)
    title_path.lineTo(x + width - CHAMFER, y + height - title_h)
    title_path.lineTo(x + width, y + height - title_h + CHAMFER * 0.35)
    title_path.lineTo(x + width, y + height - CHAMFER)
    title_path.lineTo(x + width - CHAMFER, y + height)
    title_path.lineTo(x + CHAMFER, y + height)
    title_path.lineTo(x, y + height - CHAMFER)
    title_path.lineTo(x, y + height - title_h + CHAMFER * 0.35)
    title_path.close()
    canvas.setFillColor(colors.Color(accent.red, accent.green, accent.blue, alpha=0.12))
    canvas.drawPath(title_path, stroke=0, fill=1)

    if safe_text(title):
        canvas.setFillColor(accent)
        canvas.circle(x + 16, y + height - title_h / 2, 3, stroke=0, fill=1)
        canvas.setFont(FONT_BOLD, 9)
        canvas.setFillColor(theme.TITLE_ON_SURFACE)
        canvas.drawString(x + 26, y + height - title_h / 2 - 3, safe_text(title).upper())

    _draw_glow_border(canvas, x, y, width, height, accent)
    canvas.restoreState()


def draw_plain_panel(
    canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    accent=CYAN,
    *,
    chamfer: float = CHAMFER,
    glow_width: float | None = None,
):
    """Chamfered panel without a title strip — for compact meta blocks."""
    glow_width = theme.GLOW_WIDTH if glow_width is None else glow_width
    accent_color_obj = accent if hasattr(accent, "red") else accent_color(str(accent))
    canvas.saveState()
    path = _chamfered_path(canvas, x, y, width, height, chamfer)
    canvas.setFillColor(theme.PANEL_FILL)
    canvas.drawPath(path, stroke=0, fill=1)
    _draw_glow_border(canvas, x, y, width, height, accent_color_obj, chamfer=chamfer, glow_width=glow_width)
    canvas.restoreState()


class PanelFlowable(Flowable):
    """Flowable wrapper that renders content inside a chamfered panel."""

    def __init__(
        self,
        width: float,
        title: str,
        content: Sequence[Flowable],
        accent: str = "cyan",
        min_height: float = 88,
        padding: float = 12,
        title_height: float = 22,
    ):
        Flowable.__init__(self)
        self.panel_width = width
        self.title = title
        self.content = list(content)
        self.accent_name = accent
        self.min_height = min_height
        self.padding = padding
        self.title_height = title_height
        self._content_height = 0.0

    def wrap(self, availWidth, availHeight):
        inner_w = self.panel_width - 2 * self.padding
        total_h = 0.0
        for item in self.content:
            w, h = item.wrap(inner_w, availHeight)
            total_h += h
        min_content_h = 0.0
        if self.min_height and self.min_height > 0:
            min_content_h = max(0.0, self.min_height - self.title_height - 2 * self.padding)
        self._content_height = max(total_h, min_content_h)
        self.height = self.title_height + 2 * self.padding + self._content_height
        self.width = self.panel_width
        return self.width, self.height

    def draw(self):
        canvas = self.canv
        panel_h = getattr(self, "_stretch_height", None) or self.height
        draw_panel(
            canvas,
            0,
            0,
            self.width,
            panel_h,
            self.title,
            accent_color(self.accent_name),
            title_height=self.title_height,
        )
        inner_w = self.width - 2 * self.padding
        y_cursor = panel_h - self.title_height - self.padding
        for item in self.content:
            iw, ih = item.wrap(inner_w, self._content_height)
            y_cursor -= ih
            item.drawOn(canvas, self.padding, y_cursor)


HEADER_META_FRAC = 0.27
HEADER_PANEL_PADDING = 6
HEADER_PANEL_TITLE_HEIGHT = 16
HEADER_PANEL_MIN_HEIGHT = 68
def _bill_to_address_lines(customer: dict) -> tuple[str, str]:
    """Street on line 1, city/state/zip on line 2."""
    line1 = safe_text(customer.get("address_line1"))
    line2 = safe_text(customer.get("address_line2"))
    if line1 or line2:
        return line1, line2

    address = safe_text(customer.get("address"))
    if not address:
        return "", ""

    parts = [part.strip() for part in address.split(",") if part.strip()]
    if len(parts) >= 3:
        return parts[0], ", ".join(parts[1:])
    if len(parts) == 2:
        return parts[0], parts[1]
    return address, ""


def _equipment_type_label_and_subtype(equipment: dict) -> tuple[str, str]:
    """Category label (Appliance / TV) with subtype as the value."""
    subtype = safe_text(equipment.get("subtype"))
    category = safe_text(equipment.get("category"))
    raw_type = safe_text(equipment.get("type"))

    if category:
        label = "TV" if category.lower() in ("tv", "television") else category
        return label, subtype or "—"

    if " / " in raw_type:
        left, right = raw_type.split(" / ", 1)
        left = left.strip()
        right = right.strip()
        if left.lower() in ("tv", "television"):
            return "TV", right or subtype or "—"
        if left.lower().startswith("appliance"):
            return "Appliance", right or subtype or "—"
        return left, right

    if raw_type.lower().startswith("tv"):
        return "TV", subtype or "—"
    if raw_type:
        return "Appliance", subtype or raw_type
    return "—", "—"


def build_bill_to_panel(width: float, customer: dict) -> PanelFlowable:
    name = safe_text(customer.get("name"), "—")
    email = safe_text(customer.get("email"))
    phone = safe_text(customer.get("phone"))
    address_line1, address_line2 = _bill_to_address_lines(customer)

    body = theme.STYLE_PANEL_BODY_COMPACT
    lines: List[Flowable] = [Paragraph(name, body)]
    if address_line1:
        lines.append(Paragraph(address_line1, body))
    if address_line2:
        lines.append(Paragraph(address_line2, body))
    if phone:
        lines.append(Paragraph(phone, body))
    if email:
        lines.append(Paragraph(email, body))

    return PanelFlowable(
        width,
        "Bill To",
        lines,
        accent="cyan",
        min_height=HEADER_PANEL_MIN_HEIGHT,
        padding=HEADER_PANEL_PADDING,
        title_height=HEADER_PANEL_TITLE_HEIGHT,
    )


def build_technician_panel(width: float, technician: dict) -> PanelFlowable:
    """Assigned technician name, phone, and email."""
    name = safe_text(technician.get("name"), "—")
    phone = safe_text(technician.get("phone"))
    email = safe_text(technician.get("email"))

    body = theme.STYLE_PANEL_BODY_COMPACT
    lines: List[Flowable] = [Paragraph(name, body)]
    if phone:
        lines.append(Paragraph(phone, body))
    if email:
        lines.append(Paragraph(email, body))

    return PanelFlowable(
        width,
        "Technician",
        lines,
        accent="cyan",
        min_height=HEADER_PANEL_MIN_HEIGHT,
        padding=HEADER_PANEL_PADDING,
        title_height=HEADER_PANEL_TITLE_HEIGHT,
    )


def build_service_meta_panel(width: float, meta: dict) -> PanelFlowable:
    """Work order, service date, and technician stacked vertically."""
    rows = [
        ("Work Order", safe_text(meta.get("work_order"), "—")),
        ("Date of Service", safe_text(meta.get("service_date"), "—")),
        ("Technician", safe_text(meta.get("technician"), "—")),
    ]
    lines: List[Flowable] = []
    for label, value in rows:
        lines.append(
            Paragraph(
                f"<font color='{theme.MUTED_HEX}'><b>{label}</b></font>  {value}",
                theme.STYLE_PANEL_BODY_COMPACT,
            )
        )
    return PanelFlowable(
        width,
        "Service",
        lines,
        accent="cyan",
        min_height=HEADER_PANEL_MIN_HEIGHT,
        padding=HEADER_PANEL_PADDING,
        title_height=HEADER_PANEL_TITLE_HEIGHT,
    )


def build_equipment_panel(width: float, equipment: dict) -> PanelFlowable:
    type_label, subtype_value = _equipment_type_label_and_subtype(equipment)
    rows = [
        (type_label, subtype_value),
        ("Make", safe_text(equipment.get("make"), "—")),
        ("Model", safe_text(equipment.get("model"), "—")),
        ("Serial Number", safe_text(equipment.get("serial"), "—")),
    ]
    lines: List[Flowable] = []
    for label, value in rows:
        lines.append(
            Paragraph(
                f"<font color='{theme.MUTED_HEX}'><b>{label}</b></font>  {value}",
                theme.STYLE_PANEL_BODY_COMPACT,
            )
        )
    return PanelFlowable(
        width,
        "Equipment",
        lines,
        accent="cyan",
        min_height=HEADER_PANEL_MIN_HEIGHT,
        padding=HEADER_PANEL_PADDING,
        title_height=HEADER_PANEL_TITLE_HEIGHT,
    )


def _header_column_widths(total_width: float) -> tuple[float, float, float]:
    avail = total_width - 2 * PANEL_GAP
    meta_w = avail * HEADER_META_FRAC
    side_w = (avail - meta_w) / 2
    return side_w, meta_w, side_w


class HeaderPanelsFlowable(Flowable):
    """Bill To, optional service meta, and Equipment panels on one row."""

    def __init__(
        self,
        width: float,
        customer: dict,
        equipment: dict,
        service_meta: Optional[dict] = None,
        technician: Optional[dict] = None,
        *,
        middle_panel: bool = True,
    ):
        Flowable.__init__(self)
        self.middle_panel = middle_panel
        has_middle = technician is not None or middle_panel

        if has_middle:
            left_w, meta_w, right_w = _header_column_widths(width)
            if technician is not None:
                middle = build_technician_panel(meta_w, technician)
            else:
                middle = build_service_meta_panel(meta_w, service_meta or {})
            self._slots: List[tuple[Optional[PanelFlowable], float]] = [
                (build_bill_to_panel(left_w, customer), left_w),
                (middle, meta_w),
                (build_equipment_panel(right_w, equipment), right_w),
            ]
        else:
            avail = width - PANEL_GAP
            side_w = avail / 2
            self._slots = [
                (build_bill_to_panel(side_w, customer), side_w),
                (build_equipment_panel(side_w, equipment), side_w),
            ]
        self.width = width
        self.height = 0.0

    def wrap(self, availWidth, availHeight):
        heights = []
        for panel, col_w in self._slots:
            if panel is None:
                continue
            _, h = panel.wrap(col_w, availHeight)
            heights.append(h)
        self.height = max(heights) if heights else 0.0
        return self.width, self.height

    def draw(self):
        x = 0.0
        for panel, col_w in self._slots:
            if panel is not None:
                panel.wrap(col_w, self.height)
                panel._stretch_height = self.height
                panel.drawOn(self.canv, x, 0)
            x += col_w + PANEL_GAP


class SideBySidePanelsFlowable(HeaderPanelsFlowable):
    """Backward-compatible alias for the header row."""

    def __init__(
        self,
        width: float,
        customer: dict,
        equipment: dict,
        service_meta: Optional[dict] = None,
        technician: Optional[dict] = None,
        *,
        middle_panel: bool = True,
    ):
        HeaderPanelsFlowable.__init__(
            self,
            width,
            customer,
            equipment,
            service_meta=service_meta,
            technician=technician,
            middle_panel=middle_panel,
        )


class TermsPanelFlowable(Flowable):
    """Legal / thank-you block for lower-left footer."""

    def __init__(self, width: float):
        Flowable.__init__(self)
        self.width = width
        self.height = 92
        self.text = (
            "This estimate is valid for 30 days from the date shown above. "
            "Diagnostic fees may apply. Approved repairs are subject to parts availability. "
            "Thank you for choosing Atomic Repair."
        )

    def wrap(self, availWidth, availHeight):
        return self.width, min(self.height, availHeight)

    def draw(self):
        draw_panel(self.canv, 0, 0, self.width, self.height, "Terms", CYAN)
        self.canv.setFont(FONT_BOLD, 7.5)
        self.canv.setFillColor(theme.MUTED)
        text_obj = self.canv.beginText(14, self.height - 38)
        text_obj.setLeading(10)
        words = self.text.split()
        line = ""
        max_w = self.width - 28
        for word in words:
            trial = f"{line} {word}".strip()
            if self.canv.stringWidth(trial, FONT_BOLD, 7.5) <= max_w:
                line = trial
            else:
                text_obj.textLine(line)
                line = word
        if line:
            text_obj.textLine(line)
        self.canv.drawText(text_obj)
