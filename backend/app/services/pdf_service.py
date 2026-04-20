from typing import Optional
import uuid
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import os
from app.config import settings

from app.models.quote import Quote
from app.models.client import Client

class PDFService:
    @staticmethod
    async def generate_quote_pdf(
        quote: Quote,
        client: Client,
        output_path: Optional[str] = None
    ) -> str:
        """
        Generate a PDF for a quote.
        """
        if not output_path:
            # Create output directory if it doesn't exist
            output_dir = os.path.join(settings.MEDIA_ROOT, "quotes")
            os.makedirs(output_dir, exist_ok=True)
            
            # Generate unique filename
            filename = f"quote_{quote.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
            output_path = os.path.join(output_dir, filename)
        
        # Create PDF document
        doc = SimpleDocTemplate(
            output_path,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = styles["Heading1"]
        heading_style = styles["Heading2"]
        normal_style = styles["Normal"]
        
        # Content elements
        elements = []
        
        # Header
        elements.append(Paragraph(f"Quote #{quote.id}", title_style))
        elements.append(Spacer(1, 12))
        
        # Client Information
        elements.append(Paragraph("Client Information", heading_style))
        elements.append(Spacer(1, 6))
        
        client_info = [
            f"Name: {client.name}",
            f"Email: {client.email}",
            f"Phone: {client.phone}",
            f"Address: {client.address}"
        ]
        
        for info in client_info:
            elements.append(Paragraph(info, normal_style))
        
        elements.append(Spacer(1, 12))
        
        # Quote Details
        elements.append(Paragraph("Quote Details", heading_style))
        elements.append(Spacer(1, 6))
        
        quote_info = [
            f"Date: {quote.created_at.strftime('%Y-%m-%d')}",
            f"Valid Until: {quote.valid_until.strftime('%Y-%m-%d')}",
            f"Status: {quote.status.title()}"
        ]
        
        for info in quote_info:
            elements.append(Paragraph(info, normal_style))
        
        elements.append(Spacer(1, 12))
        
        # Items Table
        elements.append(Paragraph("Items", heading_style))
        elements.append(Spacer(1, 6))
        
        # Table data
        table_data = [["Description", "Quantity", "Unit Price", "Total"]]
        
        for item in quote.items:
            table_data.append([
                item.description,
                str(item.quantity),
                f"${item.unit_price:.2f}",
                f"${item.total_price:.2f}"
            ])
        
        # Add total row
        table_data.append(["", "", "Total:", f"${quote.total_amount:.2f}"])
        
        # Create table
        table = Table(table_data, colWidths=[3*inch, 1*inch, 1.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -2), colors.black),
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -2), 12),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 12))
        
        # Terms and Conditions
        if quote.terms:
            elements.append(Paragraph("Terms and Conditions", heading_style))
            elements.append(Spacer(1, 6))
            elements.append(Paragraph(quote.terms, normal_style))
            elements.append(Spacer(1, 12))
        
        # Build PDF
        doc.build(elements)
        
        return output_path 