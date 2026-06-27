"""
Atomic Repair cyberpunk estimate PDF v2 — payment ledger + footer layout parity with invoice v2.

Copy of estimate_template.py; v1 remains unchanged.
"""

from __future__ import annotations

import os
from io import BytesIO
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import BaseDocTemplate, Flowable, Frame, PageTemplate, Spacer

from pdf.atomic_decorations import draw_estimate_header, draw_page_decorations
from pdf.atomic_panels import SideBySidePanelsFlowable, TermsPanelFlowable, draw_panel
from pdf.atomic_tables import parts_section_flowables, services_section_flowables
from pdf.invoice_template_v2 import (
    InvoicePaymentsPanelFlowable,
    _footer_column_widths,
)
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
    PAGE_HEIGHT,
    PAGE_WIDTH,
    PdfVariant,
    money,
    safe_text,
    set_pdf_variant,
)

from pdf.atomic_decorations import DEFAULT_HEADER_LOGO_PATH, DEFAULT_WATERMARK_LOGO_PATH


class TotalsPanelFlowable(Flowable):
    """Chamfered totals panel for estimate footer."""

    def __init__(self, width: float, totals: dict):
        Flowable.__init__(self)
        self.width = width
        self.totals = totals or {}
        self.height = 188

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        return self.width, min(self.height, availHeight)

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
        y = self.height - 36
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
            canvas.drawString(16, y + 4, "Diagnostic Discount")
            canvas.setFont(FONT_REGULAR, 6.5)
            canvas.setFillColor(theme.MUTED)
            canvas.drawString(16, y - 6, "(pending repair approval)")
            canvas.setFont(FONT_REGULAR, 9)
            canvas.setFillColor(theme.INK)
            canvas.drawRightString(self.width - 16, y, money(discount))
        y -= 26

        box_w = 118
        box_h = 28
        box_x = self.width - 16 - box_w
        box_y = y - 14
        total_text_y = box_y + box_h / 2 - 5
        canvas.setStrokeColor(CYAN)
        canvas.setLineWidth(1.5)
        canvas.setFillColor(colors.Color(0, 0.85, 1, alpha=0.08))
        canvas.roundRect(box_x, box_y, box_w, box_h, 6, stroke=1, fill=1)
        canvas.setFont(FONT_BOLD, 16)
        canvas.setFillColor(CYAN)
        canvas.drawString(16, total_text_y, "TOTAL")
        canvas.setFillColor(theme.INK)
        canvas.setFillColor(theme.INK)
        canvas.drawRightString(self.width - 22, total_text_y, money(t.get("total")))

        y -= 34
        canvas.setFont(FONT_REGULAR, 8.5)
        canvas.setFillColor(theme.MUTED)
        canvas.drawString(16, y, "Amount Previously Paid")
        canvas.setFillColor(theme.INK)
        canvas.drawRightString(self.width - 16, y, money(t.get("amount_paid")))


def draw_totals_panel(canvas, totals: dict, x: float, y: float, width: float, height: float = 188):
    """Draw totals panel with bottom-left at (x, y)."""
    panel = TotalsPanelFlowable(width, totals)
    panel.wrap(width, height)
    panel.canv = canvas
    panel.drawOn(canvas, x, y)


class EstimateDocTemplate(BaseDocTemplate):
    """Document with cyberpunk page chrome and flowing body frame."""

    def __init__(
        self,
        filename,
        estimate: dict,
        header_logo_path: Optional[str] = None,
        watermark_logo_path: Optional[str] = None,
        **kwargs,
    ):
        self.estimate_data = estimate
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
            id="estimate_body",
        )
        template = PageTemplate(id="estimate", frames=[frame], onPage=self._on_page)
        self.addPageTemplates([template])

    def _on_page(self, canvas, doc):
        draw_page_decorations(canvas, self.watermark_logo_path)
        draw_estimate_header(canvas, self.estimate_data, self.header_logo_path)


class EstimatePaymentsTotalsRowFlowable(Flowable):
    """Payments ledger (left) + estimate totals (right)."""

    def __init__(
        self,
        left_width: float,
        right_width: float,
        content_width: float,
        payments: List[dict],
        totals: dict,
    ):
        Flowable.__init__(self)
        self.left_width = left_width
        self.right_width = right_width
        self.content_width = content_width
        self.payments_panel = InvoicePaymentsPanelFlowable(left_width, payments)
        self.totals = TotalsPanelFlowable(right_width, totals)
        self.height = 0.0

    def _compute_layout(self):
        _, payments_h = self.payments_panel.wrap(self.left_width, 10000)
        _, totals_h = self.totals.wrap(self.right_width, 10000)
        self.height = max(payments_h, totals_h)
        return payments_h, totals_h

    def wrap(self, availWidth, availHeight):
        self._compute_layout()
        return self.content_width, min(self.height, availHeight)

    def draw(self):
        payments_h, totals_h = self._compute_layout()
        canvas = self.canv
        self.payments_panel.drawOn(canvas, 0, self.height - payments_h)
        x_totals = self.content_width - self.right_width
        self.totals.drawOn(canvas, x_totals, self.height - totals_h)


class EstimateFooterRowFlowable(Flowable):
    """Estimate terms (left) and totals panel (right) on one row."""

    def __init__(
        self,
        terms_width: float,
        totals_width: float,
        content_width: float,
        totals: dict,
        show_estimate_terms: bool = True,
    ):
        Flowable.__init__(self)
        self.left_width = terms_width
        self.right_width = totals_width
        self.content_width = content_width
        self.terms = TermsPanelFlowable(terms_width) if show_estimate_terms else None
        self.totals = TotalsPanelFlowable(totals_width, totals)
        self.height = 0.0

    def wrap(self, availWidth, availHeight):
        terms_h = 0.0
        if self.terms:
            _, terms_h = self.terms.wrap(self.left_width, availHeight)
        _, totals_h = self.totals.wrap(self.right_width, availHeight)
        self.height = max(terms_h, totals_h)
        return self.content_width, self.height

    def draw(self):
        terms_h = 0.0
        if self.terms:
            self.terms.drawOn(self.canv, 0, self.height - self.terms.height)
            terms_h = self.terms.height
        x_totals = self.content_width - self.right_width
        self.totals.drawOn(self.canv, x_totals, self.height - self.totals.height)


def _build_story(estimate: dict) -> List[Any]:
    totals = estimate.get("totals") or {}
    story: List[Any] = []

    story.append(Spacer(1, 4))
    show_technician = estimate.get("show_technician", True)
    technician = (estimate.get("technician") or {"name": "—", "phone": "", "email": ""}) if show_technician else None
    story.append(
        SideBySidePanelsFlowable(
            CONTENT_WIDTH,
            estimate.get("customer") or {},
            estimate.get("equipment") or {},
            technician=technician,
            middle_panel=show_technician,
        )
    )
    story.append(Spacer(1, 6))

    story.extend(
        services_section_flowables(
            estimate.get("services") or [],
            CONTENT_WIDTH,
            subtotal=totals.get("service_subtotal"),
        )
    )
    story.append(Spacer(1, 6))

    story.extend(
        parts_section_flowables(
            estimate.get("parts") or [],
            CONTENT_WIDTH,
            subtotal=totals.get("parts_subtotal"),
        )
    )
    story.append(Spacer(1, 6))

    payments = estimate.get("payments") or []
    left_w, right_w, content_w = _footer_column_widths()
    show_payment_message = estimate.get("show_payment_message", True)

    if payments:
        story.append(
            EstimatePaymentsTotalsRowFlowable(
                left_w,
                right_w,
                content_w,
                payments,
                totals,
            )
        )
    else:
        story.append(
            EstimateFooterRowFlowable(
                left_w,
                right_w,
                content_w,
                totals,
                show_estimate_terms=show_payment_message,
            )
        )
    story.append(Spacer(1, 8))
    return story


def build_estimate_pdf_v2(
    estimate: dict,
    header_logo_path: Optional[str] = None,
    watermark_logo_path: Optional[str] = None,
    variant: PdfVariant = "dark",
) -> bytes:
    """
    Render estimate PDF v2 (payment ledger when ``estimate['payments']`` is set).

    ``variant`` is ``"dark"`` (default) or ``"light"`` (white background, dark text).
    """
    set_pdf_variant(variant)
    buffer = BytesIO()
    doc = EstimateDocTemplate(
        buffer,
        estimate,
        header_logo_path=header_logo_path,
        watermark_logo_path=watermark_logo_path,
        pagesize=letter,
        rightMargin=MARGIN_RIGHT,
        leftMargin=MARGIN_LEFT,
        topMargin=MARGIN_TOP + HEADER_HEIGHT,
        bottomMargin=MARGIN_BOTTOM + FOOTER_RESERVED,
    )
    doc.build(_build_story(estimate))
    return buffer.getvalue()


def sample_estimate() -> dict:
    """Rich sample payload for manual preview / QA."""
    return {
        "estimate_number": "CT-001028",
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
                "billing_status": "Recommended",
            },
            {
                "name": "Labor — Standard Repair",
                "qty": 1,
                "unit_price": 120.00,
                "total": 120.00,
                "billing_status": "Required",
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
                "status": "Pending",
            },
        ],
        "totals": {
            "service_subtotal": 394.00,
            "parts_subtotal": 160.50,
            "subtotal": 554.50,
            "tax": 12.44,
            "gross_total": 566.94,
            "discount": 89.00,
            "total": 477.94,
            "amount_paid": 89.00,
        },
        "payments": [
            {
                "date": "June 8, 2026",
                "method": "Venmo",
                "amount": 89.00,
                "reference": "Diagnostic",
            },
        ],
    }


if __name__ == "__main__":
    base = os.path.dirname(__file__)
    for name, variant in (
        ("sample_estimate_v2_preview.pdf", "dark"),
        ("sample_estimate_v2_preview_light.pdf", "light"),
    ):
        out = os.path.join(base, name)
        with open(out, "wb") as fh:
            fh.write(build_estimate_pdf_v2(sample_estimate(), variant=variant))
        print(f"Wrote {out}")
