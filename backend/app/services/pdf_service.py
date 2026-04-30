import os
from datetime import datetime
from typing import Optional, List
from io import BytesIO

from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch

CYAN = colors.HexColor("#22D3EE")
ORANGE = colors.HexColor("#F97316")

LOGO_PATH = os.path.normpath(os.path.join(
    os.path.dirname(__file__), '..', 'static', 'arlogopdf.png'
))

COMPANY_NAME = 'Atomic Repair'
COMPANY_PHONE = '(419) 555-1234'
COMPANY_EMAIL = 'service@atomicrepair.com'
COMPANY_ADDRESS = '641 Barclay Drive, Toledo, OH 43609'


class PDFService:

    @staticmethod
    def generate_work_order_estimate(work_order: dict) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        elements = []
        logo = Image(LOGO_PATH, width=0.7*inch, height=0.7*inch) if os.path.exists(LOGO_PATH) else Spacer(0.7*inch, 0.7*inch)
        company_info = Paragraph(f"<b>{COMPANY_NAME}</b><br/>{COMPANY_ADDRESS}<br/>{COMPANY_PHONE} | {COMPANY_EMAIL}", styles["Normal"])
        meta = Paragraph(f'<para align=right><font size=16 color="#00D4FF"><b>ESTIMATE</b></font><br/>#{work_order.get("order_number","N/A")}<br/>{datetime.now().strftime("%B %d, %Y")}</para>', styles["Normal"])
        ht = Table([[logo, company_info, meta]], colWidths=[0.9*inch, 3.5*inch, 2.5*inch])
        ht.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP")]))
        elements += [ht, Spacer(1,20)]
        client = work_order.get("client_user") or {}
        location = work_order.get("service_location") or {}
        eq_type = (work_order.get('equipment_type') or '').replace('_',' ').title()
        eq_sub = (work_order.get('equipment_subtype') or '').replace('_',' ').title()
        left = Paragraph(f"<b>Bill To</b><br/>{work_order.get('client_name','N/A')}<br/>{client.get('email','N/A')}<br/>{client.get('phone','N/A')}<br/>{location.get('address','N/A')}", styles["Normal"])
        right = Paragraph(f"<b>Equipment</b><br/>{eq_type}{' - '+eq_sub if eq_sub else ''}<br/>Make: {work_order.get('equipment_make','N/A')}<br/>Model: {work_order.get('equipment_model','N/A')}<br/>Serial: {work_order.get('equipment_serial','N/A')}", styles["Normal"])
        it = Table([[left, right]], colWidths=[3.5*inch, 3.5*inch])
        it.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP")]))
        elements += [it, Spacer(1,20)]
        services = work_order.get('services') or []
        svc_sub = 0
        sdata = [["Service","Qty","Unit Price","Total","Status"]]
        for s in services:
            p = float(s.get('price') or 0); svc_sub += p
            sdata.append([s.get('name','N/A'), str(s.get('quantity',1)), f"${float(s.get('unit_price') or 0):.2f}", f"${p:.2f}", (s.get('billing_status') or '').replace('_',' ').title()])
        st = Table(sdata, repeatRows=1)
        st.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.black),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("GRID",(0,0),(-1,-1),0.5,colors.grey),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#F9FAFB")]),("ALIGN",(1,0),(-1,-1),"RIGHT"),("ALIGN",(0,0),(0,-1),"LEFT")]))
        elements += [Paragraph("<b>Services</b>", styles["Heading3"]), Spacer(1,6), st, Spacer(1,20)]
        parts = work_order.get('parts') or []
        parts_sub = 0
        if parts:
            pdata = [["Part #","Description","Price","Status"]]
            for p in parts:
                pr = float(p.get('price') or 0); parts_sub += pr
                pdata.append([p.get('number','N/A'), p.get('description','N/A'), f"${pr:.2f}", p.get('status','')])
            pt = Table(pdata, repeatRows=1)
            pt.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.black),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("GRID",(0,0),(-1,-1),0.5,colors.grey),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#F9FAFB")]),("ALIGN",(2,0),(3,-1),"RIGHT")]))
            elements += [Paragraph("<b>Parts</b>", styles["Heading3"]), Spacer(1,6), pt, Spacer(1,20)]
        tax_rate = float(work_order.get('tax_rate') or 0.0775)
        tax = round(parts_sub * tax_rate, 2)
        subtotal = svc_sub + parts_sub
        gross = round(subtotal + tax, 2)
        discount = float(work_order.get('diagnostic_discount_amount') or 0)
        has_repair = any('repair' in (s.get('name') or '').lower() for s in services)
        show_disc = has_repair and discount > 0
        total = round(gross - discount, 2) if show_disc else gross
        tdata = [["Services Subtotal",f"${svc_sub:.2f}"],["Parts Subtotal",f"${parts_sub:.2f}"],["Subtotal",f"${subtotal:.2f}"],[f"Sales Tax ({tax_rate*100:.2f}% on parts)",f"${tax:.2f}"],["Gross Total",f"${gross:.2f}"]]
        if show_disc: tdata.append(["Diagnostic Discount (if repair approved)",f"-${discount:.2f}"])
        tdata.append(["Total",f"${total:.2f}"])
        tstyle = [("ALIGN",(1,0),(-1,-1),"RIGHT"),("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),("LINEABOVE",(0,-1),(-1,-1),1,colors.black)]
        if show_disc: tstyle.append(("TEXTCOLOR",(0,len(tdata)-2),(-1,len(tdata)-2),CYAN))
        tt = Table(tdata, colWidths=[3.5*inch, 2*inch])
        tt.setStyle(TableStyle(tstyle))
        elements += [tt, Spacer(1,30)]
        elements.append(Paragraph("This estimate is valid for 30 days. Prices subject to change based on final diagnosis.<br/>Thank you for choosing Atomic Repair!", styles["Normal"]))
        doc.build(elements)
        return buffer.getvalue()

    @staticmethod
    def generate_work_order_invoice(work_order: dict, notes: Optional[List[str]] = None) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        styles = getSampleStyleSheet()
        elements = []
        logo = Image(LOGO_PATH, width=0.7*inch, height=0.7*inch) if os.path.exists(LOGO_PATH) else Spacer(0.7*inch, 0.7*inch)
        left_h = [logo, Paragraph(f"<b>{COMPANY_NAME}</b>", styles["Title"]), Paragraph(COMPANY_ADDRESS, styles["Normal"]), Paragraph(f"{COMPANY_PHONE} | {COMPANY_EMAIL}", styles["Normal"])]
        right_h = [Paragraph("<font color='#F97316'><b>INVOICE</b></font>", styles["Title"]), Paragraph(f"<b>#{work_order.get('order_number','N/A')}</b>", styles["Normal"]), Paragraph(datetime.now().strftime("%B %d, %Y"), styles["Normal"])]
        ht = Table([[left_h, right_h]], colWidths=[300, 200])
        ht.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP")]))
        elements += [ht, Spacer(1,20)]
        client = work_order.get("client_user") or {}
        location = work_order.get("service_location") or {}
        eq_type = (work_order.get('equipment_type') or '').replace('_',' ').title()
        eq_sub = (work_order.get('equipment_subtype') or '').replace('_',' ').title()
        bill = Paragraph(f"<b>BILL TO</b><br/>{work_order.get('client_name','N/A')}<br/>{client.get('email','N/A')}<br/>{client.get('phone','N/A')}<br/>{location.get('address','N/A')}", styles["Normal"])
        equip = Paragraph(f"<b>EQUIPMENT</b><br/>{eq_type}{' / '+eq_sub if eq_sub else ''}<br/>Make: {work_order.get('equipment_make','N/A')}<br/>Model: {work_order.get('equipment_model','N/A')}<br/>Serial: {work_order.get('equipment_serial','N/A')}", styles["Normal"])
        it = Table([[bill, equip]], colWidths=[250, 250])
        it.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP")]))
        elements += [it, Spacer(1,20)]
        tech = work_order.get('technician_name') or 'Atomic Repair Technician'
        appts = work_order.get('appointments') or []
        completed = [a for a in appts if a.get('status') == 'completed']
        dates = ', '.join(datetime.fromisoformat(a['scheduled_start']).strftime('%b %d, %Y') for a in completed if a.get('scheduled_start')) or datetime.now().strftime('%B %d, %Y')
        si = Table([["Technician", tech],["Date of Service", dates],["Work Order", f"#{work_order.get('order_number','N/A')}"]], colWidths=[150, 350])
        si.setStyle(TableStyle([("FONTNAME",(0,0),(0,-1),"Helvetica-Bold")]))
        elements += [si, Spacer(1,20)]
        services = work_order.get('services') or []
        svc_sub = 0
        srows = [["Service","Qty","Unit","Total","Status"]]
        for s in services:
            p = float(s.get('price') or 0); svc_sub += p
            srows.append([s.get('name','N/A'), str(s.get('quantity',1)), f"${float(s.get('unit_price') or 0):.2f}", f"${p:.2f}", (s.get('billing_status') or '').replace('_',' ').title()])
        svct = Table(srows)
        svct.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),CYAN),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("GRID",(0,0),(-1,-1),0.5,colors.grey),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#F9FAFB")])]))
        elements += [svct, Spacer(1,20)]
        parts = work_order.get('parts') or []
        parts_sub = 0
        BILLABLE = ['phone_payment','paid_not_installed','upfront_50','installed']
        STATUS_MAP = {'phone_payment':'Paid in Full','upfront_50':'50% Collected','installed':'Due Today','paid_not_installed':'Paid (Not Installed)'}
        if any(p.get('status') in BILLABLE for p in parts):
            prows = [["Part #","Description","Price","Status"]]
            for p in parts:
                pr = float(p.get('price') or 0); parts_sub += pr
                prows.append([p.get('number','N/A'), p.get('description','N/A'), f"${pr:.2f}", STATUS_MAP.get(p.get('status',''),'Pending')])
            pvt = Table(prows)
            pvt.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),ORANGE),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("GRID",(0,0),(-1,-1),0.5,colors.grey),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#F9FAFB")])]))
            elements += [pvt, Spacer(1,20)]
        tax_rate = float(work_order.get('tax_rate') or 0.0775)
        tax = round(parts_sub * tax_rate, 2)
        gross = round(svc_sub + parts_sub + tax, 2)
        discount = float(work_order.get('diagnostic_discount_amount') or 0)
        paid = float(work_order.get('amount_previously_paid') or 0)
        has_repair = any('repair' in (s.get('name') or '').lower() for s in services)
        show_disc = has_repair and discount > 0
        total = round(gross - discount, 2) if show_disc else gross
        balance = max(0, round(total - paid, 2))
        tdata = [["Services Subtotal",f"${svc_sub:.2f}"],["Parts Subtotal",f"${parts_sub:.2f}"],["Subtotal",f"${svc_sub+parts_sub:.2f}"],[f"Sales Tax ({tax_rate*100:.2f}% on parts)",f"${tax:.2f}"],["Gross Total",f"${gross:.2f}"]]
        if show_disc: tdata.append(["Diagnostic Discount",f"-${discount:.2f}"])
        tdata += [["Total Work Order",f"${total:.2f}"],["Amount Paid",f"-${paid:.2f}"],["BALANCE DUE",f"${balance:.2f}"]]
        tstyle = [("ALIGN",(1,0),(-1,-1),"RIGHT"),("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),("TEXTCOLOR",(0,-1),(-1,-1),ORANGE),("LINEABOVE",(0,-1),(-1,-1),1,colors.black)]
        if show_disc: tstyle.append(("TEXTCOLOR",(0,5),(-1,5),CYAN))
        tt = Table(tdata, colWidths=[300, 150])
        tt.setStyle(TableStyle(tstyle))
        elements += [tt, Spacer(1,20)]
        if notes:
            elements.append(Paragraph("<b>Notes</b>", styles["Heading3"]))
            for n in notes: elements.append(Paragraph(f"• {n}", styles["Normal"]))
            elements.append(Spacer(1,20))
        elements.append(Paragraph("Thank you for choosing Atomic Repair! Payment is due upon completion of service.", styles["Normal"]))
        doc.build(elements)
        return buffer.getvalue()

    @staticmethod
    async def generate_quote_pdf(quote, client, output_path=None):
        pass