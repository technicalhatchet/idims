"""
Atomic Repair cyberpunk invoice PDF — experimental template.

Standalone from app.services.pdf_service. Build with:

    from pdf.invoice_template import build_invoice_pdf
    pdf_bytes = build_invoice_pdf(invoice_dict)
"""

from __future__ import annotations

import os
from io import BytesIO
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import BaseDocTemplate, Flowable, Frame, PageTemplate, Spacer

from pdf.atomic_decorations import (
    DEFAULT_HEADER_LOGO_PATH,
    DEFAULT_WATERMARK_LOGO_PATH,
    draw_invoice_header,
    draw_page_decorations,
)
from pdf.atomic_panels import SideBySidePanelsFlowable, draw_panel
from pdf.atomic_tables import parts_section_flowables, services_section_flowables
from pdf import atomic_theme as theme
from pdf.atomic_theme import (
    CONTENT_WIDTH,
    CYAN,
    FONT_BOLD,
    FONT_REGULAR,
    FOOTER_RESERVED,
    HEADER_HEIGHT,
    MARGIN_BOTTOM,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    ORANGE,
    PAGE_HEIGHT,
    PdfVariant,
    money,
    safe_text,
    set_pdf_variant,
)


# Line items start at the same inset as the estimate totals panel (188 - 36).
ESTIMATE_TOTALS_ROWS_Y = 152
AMOUNT_CHIP_FONT_SIZE = 10
AMOUNT_CHIP_PAD_X = 5
AMOUNT_CHIP_HEIGHT = 14
AMOUNT_CHIP_RADIUS = 4
TOTAL_LABEL_SIZE = 11
BALANCE_LABEL_SIZE = 10
TOTAL_CHIP_GAP_ABOVE = 6
TOTAL_CHIP_GAP_BELOW = 6


class InvoiceTotalsPanelFlowable(Flowable):
    """Chamfered totals panel with balance due for invoice footer."""

    def __init__(self, width: float, totals: dict):
        Flowable.__init__(self)
        self.width = width
        self.totals = totals or {}
        self.height = 204

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        return self.width, self.height

    def _row(self, canvas, label: str, value: str, y: float, accent_label: bool = False):
        canvas.setFont(FONT_REGULAR, 9)
        canvas.setFillColor(CYAN if accent_label else theme.MUTED)
        canvas.drawString(16, y, label)
        canvas.setFillColor(theme.INK)
        canvas.drawRightString(self.width - 16, y, value)

    def draw(self):
        canvas = self.canv
        draw_panel(canvas, 0, 0, self.width, self.height, "Totals", CYAN)

        t = self.totals
        y = ESTIMATE_TOTALS_ROWS_Y
        rows = [
            ("Services Subtotal", money(t.get("service_subtotal"))),
            ("Parts Subtotal", money(t.get("parts_subtotal"))),
            ("Subtotal", money(t.get("subtotal"))),
            ("Sales Tax (7.75% on parts only)", money(t.get("tax"))),
            ("Gross Total", money(t.get("gross_total"))),
        ]
        for label, value in rows:
            self._row(canvas, label, value, y)
            y -= 14

        discount = t.get("discount")
        if discount not in (None, 0, 0.0, "0", "0.00"):
            canvas.setFont(FONT_BOLD, 9)
            canvas.setFillColor(CYAN)
            canvas.drawString(16, y, "Diagnostic Discount")
            canvas.setFont(FONT_REGULAR, 9)
            canvas.setFillColor(theme.INK)
            canvas.drawRightString(self.width - 16, y, money(discount))
            y -= 16

        y -= TOTAL_CHIP_GAP_ABOVE
        y = self._draw_amount_chip(
            canvas,
            y,
            "TOTAL",
            money(t.get("total")),
            CYAN,
            colors.Color(0, 0.85, 1, alpha=0.08),
            label_size=TOTAL_LABEL_SIZE,
        )

        y -= TOTAL_CHIP_GAP_BELOW
        canvas.setFont(FONT_REGULAR, 8.5)
        canvas.setFillColor(theme.MUTED)
        canvas.drawString(16, y, "Amount Previously Paid")
        canvas.setFillColor(theme.INK)
        canvas.drawRightString(self.width - 16, y, money(t.get("amount_paid")))
        y -= 16

        self._draw_amount_chip(
            canvas,
            y,
            "BALANCE DUE",
            money(t.get("balance_due")),
            ORANGE,
            colors.Color(1, 0.6, 0, alpha=0.08),
            label_size=BALANCE_LABEL_SIZE,
        )

    def _draw_amount_chip(
        self,
        canvas,
        y: float,
        label: str,
        amount: str,
        accent,
        fill_color,
        *,
        label_size: float,
    ) -> float:
        """Label on the left; compact chip around the amount on the right only."""
        canvas.setFont(FONT_BOLD, label_size)
        canvas.setFillColor(accent)
        canvas.drawString(16, y, label)

        amount_right = self.width - 15
        canvas.setFont(FONT_BOLD, AMOUNT_CHIP_FONT_SIZE)
        amount_w = canvas.stringWidth(amount, FONT_BOLD, AMOUNT_CHIP_FONT_SIZE)
        chip_w = amount_w + AMOUNT_CHIP_PAD_X * 2
        chip_x = amount_right - chip_w
        chip_y = y - 3
        canvas.setStrokeColor(accent)
        canvas.setLineWidth(1)
        canvas.setFillColor(fill_color)
        canvas.roundRect(chip_x, chip_y, chip_w, AMOUNT_CHIP_HEIGHT, AMOUNT_CHIP_RADIUS, stroke=1, fill=1)
        canvas.setFillColor(theme.INK)
        canvas.drawRightString(amount_right, y, amount)
        return chip_y - 8


class InvoiceTermsPanelFlowable(Flowable):
    """Payment terms block for lower-left footer."""

    def __init__(self, width: float, terms: Optional[str] = None, payment_instructions: Optional[str] = None):
        Flowable.__init__(self)
        self.width = width
        self.height = 104
        default = (
            "Payment is due upon completion of service unless otherwise agreed. "
            "Thank you for choosing Atomic Repair — we appreciate your business."
        )
        self.text = safe_text(terms) or default
        self.payment_instructions = safe_text(payment_instructions)

    def wrap(self, availWidth, availHeight):
        return self.width, min(self.height, availHeight)

    def _draw_wrapped(self, canvas, text: str, x: float, y: float, max_w: float, font_size: float = 7.5):
        canvas.setFont(FONT_BOLD, font_size)
        text_obj = canvas.beginText(x, y)
        text_obj.setLeading(10)
        words = text.split()
        line = ""
        for word in words:
            trial = f"{line} {word}".strip()
            if canvas.stringWidth(trial, FONT_BOLD, font_size) <= max_w:
                line = trial
            else:
                text_obj.textLine(line)
                line = word
        if line:
            text_obj.textLine(line)
        canvas.drawText(text_obj)

    def draw(self):
        draw_panel(self.canv, 0, 0, self.width, self.height, "Payment", CYAN)
        self.canv.setFillColor(theme.MUTED)
        self._draw_wrapped(self.canv, self.text, 14, self.height - 38, self.width - 28)
        if self.payment_instructions:
            self.canv.setFont(FONT_REGULAR, 7)
            self.canv.setFillColor(theme.INK)
            self.canv.drawString(14, 14, self.payment_instructions)


NOTES_UNDER_PAYMENT_GAP = 4
NOTES_LINE_HEIGHT = 11
NOTES_FONT_SIZE = 8
NOTES_PAD_X = 8
NOTES_TITLE_GAP = 10


def _notes_line_width(
    y_baseline: float,
    footer_height: float,
    totals_height: float,
    narrow_width: float,
    wide_width: float,
) -> float:
    """Narrow while vertically beside the totals panel; full width below its top edge."""
    totals_bottom = footer_height - totals_height
    return narrow_width if y_baseline >= totals_bottom else wide_width


def _layout_wrapped_notes(
    notes: List[str],
    *,
    narrow_width: float,
    wide_width: float,
    footer_height: float,
    totals_height: float,
    first_line_y: float,
    line_height: float = NOTES_LINE_HEIGHT,
    font: str = FONT_REGULAR,
    font_size: float = NOTES_FONT_SIZE,
) -> tuple[List[tuple[str, float, float]], float]:
    """
    Word-wrap notes with run-around beside the totals panel.

    Returns ([(text, x, y_baseline), ...], vertical span from first line to bottom).
    Footer coords: y=0 at bottom; totals panel is bottom-aligned.
    """
    cleaned = [safe_text(n) for n in notes if safe_text(n)]
    if not cleaned:
        return [], 0.0

    lines_out: List[tuple[str, float, float]] = []
    y = first_line_y

    for note in cleaned:
        words = note.split()
        if not words:
            continue
        first_line = True
        idx = 0
        while idx < len(words):
            max_w = (
                _notes_line_width(y, footer_height, totals_height, narrow_width, wide_width)
                - NOTES_PAD_X * 2
            )
            prefix = "• " if first_line else "  "
            line = prefix
            placed = False
            while idx < len(words):
                word = words[idx]
                trial = f"{line}{word}" if line == prefix else f"{line} {word}"
                if stringWidth(trial, font, font_size) <= max_w:
                    line = trial
                    idx += 1
                    placed = True
                elif line != prefix:
                    break
                else:
                    line = f"{prefix}{word}"
                    idx += 1
                    placed = True
                    break
            if not placed:
                break
            lines_out.append((line, NOTES_PAD_X, y))
            y -= line_height
            first_line = False

    if not lines_out:
        return [], 0.0
    span = first_line_y - lines_out[-1][2] + line_height
    return lines_out, span


class InvoiceFooterRowFlowable(Flowable):
    """Payment panel top-left, totals bottom-right, notes wrap around totals."""

    def __init__(
        self,
        terms_width: float,
        totals_width: float,
        totals: dict,
        terms: Optional[str] = None,
        payment_instructions: Optional[str] = None,
        notes: Optional[List[str]] = None,
    ):
        Flowable.__init__(self)
        self.terms_width = terms_width
        self.totals_width = totals_width
        self.full_width = terms_width + 12 + totals_width
        self.totals_data = totals
        self.terms = InvoiceTermsPanelFlowable(terms_width, terms, payment_instructions)
        self.totals = InvoiceTotalsPanelFlowable(totals_width, totals)
        self.notes = [safe_text(n) for n in (notes or []) if safe_text(n)]
        self._note_lines: List[tuple[str, float, float]] = []
        self.height = 0.0

    def _compute_layout(self):
        _, terms_h = self.terms.wrap(self.terms_width, 10000)
        _, totals_h = self.totals.wrap(self.totals.width, 10000)

        footer_h = max(totals_h, terms_h)
        self._note_lines = []

        if self.notes:
            for _ in range(6):
                first_line_y = (
                    footer_h
                    - terms_h
                    - NOTES_UNDER_PAYMENT_GAP
                    - NOTES_TITLE_GAP
                    - NOTES_FONT_SIZE
                )
                lines, span = _layout_wrapped_notes(
                    self.notes,
                    narrow_width=self.terms_width,
                    wide_width=self.full_width,
                    footer_height=footer_h,
                    totals_height=totals_h,
                    first_line_y=first_line_y,
                )
                notes_block_h = 0.0
                if lines:
                    notes_block_h = (
                        NOTES_UNDER_PAYMENT_GAP
                        + NOTES_TITLE_GAP
                        + NOTES_FONT_SIZE
                        + span
                    )
                new_h = max(totals_h, terms_h + notes_block_h)
                if abs(new_h - footer_h) < 0.5:
                    self._note_lines = lines
                    footer_h = new_h
                    break
                footer_h = new_h
            else:
                self._note_lines = lines
        else:
            footer_h = max(totals_h, terms_h)

        self.height = footer_h
        return terms_h, totals_h

    def wrap(self, availWidth, availHeight):
        self._compute_layout()
        return self.full_width, min(self.height, availHeight)

    def draw(self):
        terms_h, totals_h = self._compute_layout()
        canvas = self.canv

        self.terms.drawOn(canvas, 0, self.height - terms_h)
        x_totals = self.terms_width + 12
        self.totals.drawOn(canvas, x_totals, self.height - totals_h)

        if not self._note_lines:
            return

        header_y = self.height - terms_h - NOTES_UNDER_PAYMENT_GAP - NOTES_FONT_SIZE
        canvas.setFont(FONT_BOLD, NOTES_FONT_SIZE)
        canvas.setFillColor(CYAN)
        canvas.drawString(0, header_y, "NOTES")

        canvas.setFont(FONT_REGULAR, NOTES_FONT_SIZE)
        canvas.setFillColor(theme.INK)
        for text, x, y in self._note_lines:
            canvas.drawString(x, y, text)


class InvoiceDocTemplate(BaseDocTemplate):
    """Document with cyberpunk page chrome and flowing body frame."""

    def __init__(
        self,
        filename,
        invoice: dict,
        header_logo_path: Optional[str] = None,
        watermark_logo_path: Optional[str] = None,
        **kwargs,
    ):
        self.invoice_data = invoice
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
            id="invoice_body",
        )
        template = PageTemplate(id="invoice", frames=[frame], onPage=self._on_page)
        self.addPageTemplates([template])

    def _on_page(self, canvas, doc):
        draw_page_decorations(canvas, self.watermark_logo_path)
        draw_invoice_header(canvas, self.invoice_data, self.header_logo_path)


def _build_story(invoice: dict) -> List[Any]:
    totals = invoice.get("totals") or {}
    story: List[Any] = []

    story.append(Spacer(1, 4))
    story.append(
        SideBySidePanelsFlowable(
            CONTENT_WIDTH,
            invoice.get("customer") or {},
            invoice.get("equipment") or {},
            middle_panel=False,
        )
    )
    story.append(Spacer(1, 6))
    story.extend(
        services_section_flowables(
            invoice.get("services") or [],
            CONTENT_WIDTH,
            subtotal=totals.get("service_subtotal"),
        )
    )
    story.append(Spacer(1, 6))

    story.extend(
        parts_section_flowables(
            invoice.get("parts") or [],
            CONTENT_WIDTH,
            subtotal=totals.get("parts_subtotal"),
        )
    )
    story.append(Spacer(1, 6))

    terms_w = CONTENT_WIDTH * 0.56
    totals_w = CONTENT_WIDTH - terms_w - 12
    story.append(
        InvoiceFooterRowFlowable(
            terms_w,
            totals_w,
            totals,
            terms=invoice.get("terms"),
            payment_instructions=invoice.get("payment_instructions"),
            notes=invoice.get("notes") or [],
        )
    )

    story.append(Spacer(1, 8))
    return story


def build_invoice_pdf(
    invoice: dict,
    header_logo_path: Optional[str] = None,
    watermark_logo_path: Optional[str] = None,
    variant: PdfVariant = "dark",
) -> bytes:
    """
    Render a complete invoice PDF from the invoice data model.

    ``variant`` is ``"dark"`` (default) or ``"light"`` (white background, dark text).

    Returns PDF bytes suitable for HTTP response or file write.
    """
    set_pdf_variant(variant)
    buffer = BytesIO()
    doc = InvoiceDocTemplate(
        buffer,
        invoice,
        header_logo_path=header_logo_path,
        watermark_logo_path=watermark_logo_path,
        pagesize=letter,
        rightMargin=MARGIN_RIGHT,
        leftMargin=MARGIN_LEFT,
        topMargin=MARGIN_TOP + HEADER_HEIGHT,
        bottomMargin=MARGIN_BOTTOM + FOOTER_RESERVED,
    )
    doc.build(_build_story(invoice))
    return buffer.getvalue()


def sample_invoice() -> dict:
    """Rich sample payload for manual preview / QA."""
    return {
        "invoice_number": "INV-001028",
        "date": "June 9, 2026",
        "company": {
            "name": "Atomic Repair",
            "address1": "641 Barclay Drive",
            "address2": "Toledo, OH 43609",
            "phone": "(419) 555-0100",
            "email": "service@atomicrepair.com",
        },
        "customer": {
            "name": "Nicole Osstifin",
            "email": "nicole@example.com",
            "phone": "(419) 290-4065",
            "address_line1": "6358 N River Rd",
            "address_line2": "Waterville, OH 43566",
        },
        "equipment": {
            "category": "Appliance",
            "subtype": "Dishwasher",
            "make": "Samsung",
            "model": "DW80R5060UG",
            "serial": "SN-44821-A",
        },
        "service_meta": {
            "technician": "Mike Rodriguez",
            "service_date": "June 8, 2026",
            "work_order": "CT-001028",
        },
        "services": [
            {
                "name": "Diagnostic — Dishwasher",
                "qty": 1,
                "unit_price": 89.00,
                "total": 89.00,
                "billing_status": "Approved",
            },
            {
                "name": "Circulation Motor Replacement",
                "qty": 1,
                "unit_price": 185.00,
                "total": 185.00,
                "billing_status": "Approved",
            },
            {
                "name": "Labor — Standard Repair",
                "qty": 1,
                "unit_price": 120.00,
                "total": 120.00,
                "billing_status": "Approved",
            },
        ],
        "parts": [
            {
                "part_number": "DD81-01640A",
                "description": "Circulation motor assembly",
                "price": 142.50,
                "status": "Installed",
            },
            {
                "part_number": "AR-LBR-01",
                "description": "Labor materials / consumables",
                "price": 18.00,
                "status": "Installed",
            },
        ],
        "notes": [
            "Replaced circulation motor and verified drain cycle.",
            "Customer approved repair on-site after diagnostic.",
        ],
        "terms": None,
        "payment_instructions": "Pay online at atomicrepair.com/pay or call (419) 555-0100.",
        "totals": {
            "service_subtotal": 394.00,
            "parts_subtotal": 160.50,
            "subtotal": 554.50,
            "tax": 12.44,
            "gross_total": 566.94,
            "discount": 89.00,
            "total": 477.94,
            "amount_paid": 89.00,
            "balance_due": 388.94,
        },
    }


if __name__ == "__main__":
    base = os.path.dirname(__file__)
    for name, variant in (("sample_invoice_preview.pdf", "dark"), ("sample_invoice_preview_light.pdf", "light")):
        out = os.path.join(base, name)
        with open(out, "wb") as fh:
            fh.write(build_invoice_pdf(sample_invoice(), variant=variant))
        print(f"Wrote {out}")
