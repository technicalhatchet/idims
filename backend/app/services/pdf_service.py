import os
import uuid
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image, KeepTogether
)
from reportlab.lib.colors import HexColor

from app.config import settings

# Atomic Repair brand colors
AR_DARK = HexColor('#0B0F1A')       # dark navy background
AR_CYAN = HexColor('#22D3EE')       # cyan accent
AR_ORANGE = HexColor('#F97316')     # orange accent
AR_GRAY = HexColor('#374151')       # table header gray
AR_LIGHT = HexColor('#F9FAFB')      # light row background
AR_WHITE = colors.white
AR_TEXT = HexColor('#111827')       # main text
AR_MUTED = HexColor('#6B7280')      # muted text

# Path to the logo — relative to the backend
LOGO_PATH = os.path.join(
    os.path.dirname(__file__),       # backend/app/services/
    '..', '..', '..', 'frontend', 'public', 'arlogosmall.png'
)
LOGO_PATH = os.path.normpath(LOGO_PATH)

COMPANY_NAME = 'Atomic Repair'
COMPANY_PHONE = '(419) 555-0100'
COMPANY_EMAIL = 'service@atomicrepair.com'
COMPANY_ADDRESS = '641 Barclay Drive, Toledo, OH 43609'


def _base_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='ARTitle',
        fontSize=22,
        textColor=AR_TEXT,
        fontName='Helvetica-Bold',
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name='ARSubtitle',
        fontSize=10,
        textColor=AR_MUTED,
        fontName='Helvetica',
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name='ARSectionHeader',
        fontSize=9,
        textColor=AR_WHITE,
        fontName='Helvetica-Bold',
        spaceAfter=0,
    ))
    styles.add(ParagraphStyle(
        name='ARBody',
        fontSize=9,
        textColor=AR_TEXT,
        fontName='Helvetica',
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name='ARBodyBold',
        fontSize=9,
        textColor=AR_TEXT,
        fontName='Helvetica-Bold',
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name='ARMuted',
        fontSize=8,
        textColor=AR_MUTED,
        fontName='Helvetica',
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        name='ARRight',
        fontSize=9,
        textColor=AR_TEXT,
        fontName='Helvetica',
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='ARRightBold',
        fontSize=10,
        textColor=AR_TEXT,
        fontName='Helvetica-Bold',
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name='ARCenter',
        fontSize=8,
        textColor=AR_MUTED,
        fontName='Helvetica',
        alignment=TA_CENTER,
    ))
    return styles


def _build_header(styles, doc_type: str, doc_number: str, doc_date: str, elements: list):
    """Build the branded header with logo + company info + document title."""
    # Logo
    logo_img = None
    if os.path.exists(LOGO_PATH):
        logo_img = Image(LOGO_PATH, width=0.7*inch, height=0.7*inch)

    company_block = [
        Paragraph(COMPANY_NAME, styles['ARTitle']),
        Paragraph(COMPANY_ADDRESS, styles['ARSubtitle']),
        Paragraph(f'{COMPANY_PHONE}  |  {COMPANY_EMAIL}', styles['ARSubtitle']),
    ]

    doc_block = [
        Paragraph(doc_type, ParagraphStyle(
            'DocType', fontSize=18, textColor=AR_CYAN,
            fontName='Helvetica-Bold', alignment=TA_RIGHT
        )),
        Paragraph(f'#{doc_number}', ParagraphStyle(
            'DocNum', fontSize=11, textColor=AR_TEXT,
            fontName='Helvetica-Bold', alignment=TA_RIGHT
        )),
        Paragraph(doc_date, ParagraphStyle(
            'DocDate', fontSize=9, textColor=AR_MUTED,
            fontName='Helvetica', alignment=TA_RIGHT
        )),
    ]

    logo_col = [[logo_img]] if logo_img else [[]]
    header_data = [[
        Table([logo_col, company_block], colWidths=[0.8*inch, 4*inch]),
        Table([[b] for b in doc_block], colWidths=[2.7*inch])
    ]]
    header_table = Table(header_data, colWidths=[4.8*inch, 2.7*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width='100%', thickness=2, color=AR_CYAN, spaceAfter=10))


def _client_equipment_block(styles, work_order: dict, elements: list):
    """Two-column block: client info left, equipment right."""
    client = work_order.get('client_user') or {}
    client_name = (
        work_order.get('client_name') or
        f"{client.get('first_name', '')} {client.get('last_name', '')}".strip() or
        'N/A'
    )
    client_email = client.get('email', 'N/A')
    client_phone = client.get('phone', 'N/A')
    address = work_order.get('service_location', {}) or {}
    service_address = address.get('address', 'N/A')

    eq_type = (work_order.get('equipment_type') or '').replace('_', ' ').title()
    eq_sub = (work_order.get('equipment_subtype') or '').replace('_', ' ').title()
    eq_make = work_order.get('equipment_make') or 'N/A'
    eq_model = work_order.get('equipment_model') or 'N/A'
    eq_serial = work_order.get('equipment_serial') or 'N/A'

    def section_header(title):
        cell = Table(
            [[Paragraph(title, styles['ARSectionHeader'])]],
            colWidths=[3.5*inch]
        )
        cell.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), AR_GRAY),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ]))
        return cell

    def kv(label, value):
        return Table(
            [[Paragraph(f'<b>{label}:</b>', styles['ARBody']),
              Paragraph(str(value), styles['ARBody'])]],
            colWidths=[1.1*inch, 2.3*inch]
        )

    client_block = [
        section_header('BILL TO'),
        kv('Name', client_name),
        kv('Email', client_email),
        kv('Phone', client_phone),
        kv('Address', service_address),
    ]
    equip_block = [
        section_header('EQUIPMENT'),
        kv('Type', f'{eq_type} — {eq_sub}' if eq_sub else eq_type or 'N/A'),
        kv('Make', eq_make),
        kv('Model', eq_model),
        kv('Serial', eq_serial),
    ]

    row_data = [[
        Table([[b] for b in client_block], colWidths=[3.5*inch]),
        Spacer(0.2*inch, 1),
        Table([[b] for b in equip_block], colWidths=[3.5*inch]),
    ]]
    row = Table(row_data, colWidths=[3.7*inch, 0.1*inch, 3.7*inch])
    row.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(row)
    elements.append(Spacer(1, 10))


def _services_table(styles, services: list, elements: list):
    """Services line-item table."""
    if not services:
        return
    elements.append(HRFlowable(width='100%', thickness=1, color=AR_GRAY, spaceAfter=4))

    header = [
        Paragraph('SERVICE', styles['ARSectionHeader']),
        Paragraph('QTY', ParagraphStyle('Ch', fontSize=9, textColor=AR_WHITE, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        Paragraph('UNIT PRICE', ParagraphStyle('Ch', fontSize=9, textColor=AR_WHITE, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        Paragraph('TOTAL', ParagraphStyle('Ch', fontSize=9, textColor=AR_WHITE, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        Paragraph('STATUS', ParagraphStyle('Ch', fontSize=9, textColor=AR_WHITE, fontName='Helvetica-Bold', alignment=TA_CENTER)),
    ]
    table_data = [header]
    for s in services:
        status = (s.get('billing_status') or 'not_billable').replace('_', ' ').title()
        row = [
            Paragraph(s.get('name', 'N/A'), styles['ARBody']),
            Paragraph(str(s.get('quantity', 1)), ParagraphStyle('R', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)),
            Paragraph(f"${float(s.get('unit_price') or 0):.2f}", ParagraphStyle('R', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)),
            Paragraph(f"${float(s.get('price') or 0):.2f}", ParagraphStyle('R', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)),
            Paragraph(status, ParagraphStyle('C', fontSize=8, fontName='Helvetica', alignment=TA_CENTER, textColor=AR_MUTED)),
        ]
        table_data.append(row)

    t = Table(table_data, colWidths=[3.2*inch, 0.5*inch, 1.1*inch, 1.0*inch, 1.2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), AR_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [AR_WHITE, AR_LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.3, HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 8))


def _parts_table(styles, parts: list, elements: list):
    """Parts line-item table."""
    billable_parts = [p for p in parts if p.get('status') in
                      ['phone_payment', 'paid_not_installed', 'upfront_50', 'installed']]
    if not billable_parts:
        return

    elements.append(HRFlowable(width='100%', thickness=1, color=AR_GRAY, spaceAfter=4))

    header = [
        Paragraph('PART', styles['ARSectionHeader']),
        Paragraph('DESCRIPTION', styles['ARSectionHeader']),
        Paragraph('PRICE', ParagraphStyle('Ch', fontSize=9, textColor=AR_WHITE, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
        Paragraph('STATUS', ParagraphStyle('Ch', fontSize=9, textColor=AR_WHITE, fontName='Helvetica-Bold', alignment=TA_CENTER)),
    ]
    table_data = [header]
    for p in billable_parts:
        status_map = {
            'phone_payment': 'Phone Pmt',
            'paid_not_installed': 'PdNI',
            'upfront_50': '50% Upfront',
            'installed': 'Installed',
        }
        status = status_map.get(p.get('status', ''), p.get('status', ''))
        row = [
            Paragraph(p.get('number', 'N/A'), styles['ARBody']),
            Paragraph(p.get('description', 'N/A'), styles['ARBody']),
            Paragraph(f"${float(p.get('price') or 0):.2f}", ParagraphStyle('R', fontSize=9, fontName='Helvetica', alignment=TA_RIGHT)),
            Paragraph(status, ParagraphStyle('C', fontSize=8, fontName='Helvetica', alignment=TA_CENTER, textColor=AR_MUTED)),
        ]
        table_data.append(row)

    t = Table(table_data, colWidths=[1.2*inch, 3.5*inch, 1.0*inch, 1.3*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), AR_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [AR_WHITE, AR_LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.3, HexColor('#E5E7EB')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 8))


def _totals_block(styles, work_order: dict, elements: list, is_estimate: bool = False):
    """Right-aligned totals section."""
    services = work_order.get('services') or []
    parts = work_order.get('parts') or []
    tax_rate = float(work_order.get('tax_rate') or 0.0775)
    BILLABLE_PART_STATUSES = ['phone_payment', 'paid_not_installed', 'upfront_50', 'installed']

    services_subtotal = sum(float(s.get('price') or 0) for s in services)
    parts_subtotal = sum(float(p.get('price') or 0) for p in parts if p.get('status') in BILLABLE_PART_STATUSES)
    subtotal = services_subtotal + parts_subtotal
    tax_on_parts = round(parts_subtotal * tax_rate, 2)
    gross_total = round(subtotal + tax_on_parts, 2)

    # Discount — show on estimate always if repair SKU exists, on invoice only if completed
    has_repair = any('repair' in (s.get('name') or '').lower() for s in services)
    diag_discount = float(work_order.get('diagnostic_discount_amount') or 0)
    show_discount = has_repair and diag_discount > 0
    total_work_order = round(gross_total - diag_discount, 2) if show_discount else gross_total

    previously_paid = float(work_order.get('amount_previously_paid') or 0)
    due_today = max(0, round(total_work_order - previously_paid, 2))

    def totals_row(label, value, bold=False, color=AR_TEXT):
        label_style = ParagraphStyle('TL', fontSize=9, fontName='Helvetica-Bold' if bold else 'Helvetica',
                                     textColor=color, alignment=TA_RIGHT)
        value_style = ParagraphStyle('TV', fontSize=9, fontName='Helvetica-Bold' if bold else 'Helvetica',
                                     textColor=color, alignment=TA_RIGHT)
        return [Paragraph(label, label_style), Paragraph(value, value_style)]

    rows = [
        totals_row('Services Subtotal', f'${services_subtotal:.2f}'),
        totals_row('Parts Subtotal', f'${parts_subtotal:.2f}'),
        totals_row('Subtotal', f'${subtotal:.2f}', bold=True),
        totals_row(f'Sales Tax ({tax_rate*100:.2f}% on parts)', f'${tax_on_parts:.2f}'),
        totals_row('Gross Total', f'${gross_total:.2f}', bold=True),
    ]
    if show_discount:
        discount_label = 'Diagnostic Discount' if not is_estimate else 'Diagnostic Discount (if repair approved)'
        rows.append(totals_row(discount_label, f'-${diag_discount:.2f}', color=AR_CYAN))
    rows.append(totals_row('Total', f'${total_work_order:.2f}', bold=True))
    if not is_estimate:
        rows.append(totals_row('Amount Previously Paid', f'-${previously_paid:.2f}'))
        rows.append(totals_row('BALANCE DUE', f'${due_today:.2f}', bold=True, color=AR_ORANGE))

    # Right-align the totals block by putting it in a 2-col outer table
    inner = Table(rows, colWidths=[2.5*inch, 1.2*inch])
    inner.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [AR_WHITE, AR_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, AR_ORANGE),
        ('LINEBEFORE', (0, 0), (0, -1), 0.5, HexColor('#E5E7EB')),
    ]))
    outer = Table([[Spacer(4.3*inch, 1), inner]], colWidths=[4.3*inch, 3.7*inch])
    outer.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(HRFlowable(width='100%', thickness=1, color=AR_GRAY, spaceBefore=4, spaceAfter=6))
    elements.append(outer)


def _footer(styles, elements: list, is_estimate: bool = False):
    elements.append(Spacer(1, 16))
    elements.append(HRFlowable(width='100%', thickness=1, color=AR_GRAY, spaceAfter=6))
    if is_estimate:
        msg = 'This estimate is valid for 30 days. Prices subject to change based on final diagnosis. Thank you for choosing Atomic Repair!'
    else:
        msg = 'Thank you for choosing Atomic Repair! Payment is due upon completion of service. We appreciate your business.'
    elements.append(Paragraph(msg, styles['ARCenter']))
    elements.append(Paragraph(f'{COMPANY_NAME}  |  {COMPANY_PHONE}  |  {COMPANY_EMAIL}', styles['ARCenter']))


class PDFService:

    @staticmethod
    def generate_work_order_estimate(work_order: dict) -> bytes:
        """
        Generate a branded estimate PDF for the given work order dict.
        Returns the PDF as bytes.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=letter,
            rightMargin=0.6*inch, leftMargin=0.6*inch,
            topMargin=0.6*inch, bottomMargin=0.6*inch
        )
        styles = _base_styles()
        elements = []

        order_num = work_order.get('order_number', 'N/A')
        date_str = datetime.utcnow().strftime('%B %d, %Y')

        _build_header(styles, 'ESTIMATE', order_num, date_str, elements)
        elements.append(Spacer(1, 8))
        _client_equipment_block(styles, work_order, elements)

        # Services — show ALL services as proposed
        elements.append(Paragraph('SERVICES', styles['ARSectionHeader']))
        _services_table(styles, work_order.get('services') or [], elements)

        # Parts if any quoted
        if work_order.get('parts'):
            elements.append(Paragraph('PARTS', styles['ARSectionHeader']))
            _parts_table(styles, work_order.get('parts') or [], elements)

        _totals_block(styles, work_order, elements, is_estimate=True)
        _footer(styles, elements, is_estimate=True)

        doc.build(elements)
        return buffer.getvalue()

    @staticmethod
    def generate_work_order_invoice(work_order: dict, notes: Optional[List[str]] = None) -> bytes:
        """
        Generate a branded invoice PDF for the given work order dict.
        Returns the PDF as bytes.
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=letter,
            rightMargin=0.6*inch, leftMargin=0.6*inch,
            topMargin=0.6*inch, bottomMargin=0.6*inch
        )
        styles = _base_styles()
        elements = []

        order_num = work_order.get('order_number', 'N/A')
        date_str = datetime.utcnow().strftime('%B %d, %Y')

        _build_header(styles, 'INVOICE', order_num, date_str, elements)
        elements.append(Spacer(1, 8))
        _client_equipment_block(styles, work_order, elements)

        # Technician + date of service
        tech_name = work_order.get('technician_name') or 'Atomic Repair Technician'
        appointments = work_order.get('appointments') or []
        completed_appts = [a for a in appointments if a.get('status') == 'completed']
        service_dates = ', '.join(
            datetime.fromisoformat(a['scheduled_start']).strftime('%b %d, %Y')
            for a in completed_appts if a.get('scheduled_start')
        ) or date_str

        meta_data = [
            [Paragraph('<b>Technician:</b>', styles['ARBody']), Paragraph(tech_name, styles['ARBody'])],
            [Paragraph('<b>Date of Service:</b>', styles['ARBody']), Paragraph(service_dates, styles['ARBody'])],
            [Paragraph('<b>Work Order:</b>', styles['ARBody']), Paragraph(f'#{order_num}', styles['ARBody'])],
        ]
        meta_table = Table(meta_data, colWidths=[1.3*inch, 4*inch])
        meta_table.setStyle(TableStyle([
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 8))

        # Services
        elements.append(Paragraph('SERVICES', styles['ARSectionHeader']))
        _services_table(styles, work_order.get('services') or [], elements)

        # Parts
        if work_order.get('parts'):
            elements.append(Paragraph('PARTS', styles['ARSectionHeader']))
            _parts_table(styles, work_order.get('parts') or [], elements)

        _totals_block(styles, work_order, elements, is_estimate=False)

        # Notes
        if notes:
            elements.append(Spacer(1, 10))
            elements.append(HRFlowable(width='100%', thickness=1, color=AR_GRAY, spaceAfter=4))
            elements.append(Paragraph('NOTES', styles['ARSectionHeader']))
            elements.append(Spacer(1, 4))
            for note in notes:
                elements.append(Paragraph(f'• {note}', styles['ARBody']))

        _footer(styles, elements, is_estimate=False)

        doc.build(elements)
        return buffer.getvalue()

    # Keep old method for backwards compat
    @staticmethod
    async def generate_quote_pdf(quote, client, output_path=None):
        pass
