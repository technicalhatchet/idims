from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, date, timedelta
import uuid
import logging
from fastapi import BackgroundTasks, Response
from fastapi.responses import FileResponse
import os
import tempfile

from app.models.invoice import Invoice, InvoiceItem
from app.models.client import Client
from app.models.work_order import WorkOrder, WorkOrderService, WorkOrderItem
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceSend
from app.core.exceptions import NotFoundException, ConflictException, ValidationException
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationCreate

logger = logging.getLogger(__name__)

class InvoiceService:
    """Service for handling invoice operations"""
    
    @staticmethod
    async def get_invoices(
        db: Session,
        client_id: Optional[uuid.UUID] = None,
        work_order_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get invoices with filtering and pagination"""
        query = db.query(Invoice)
        
        # Apply filters
        if client_id:
            query = query.filter(Invoice.client_id == client_id)
        
        if work_order_id:
            query = query.filter(Invoice.work_order_id == work_order_id)
        
        if status:
            query = query.filter(Invoice.status == status)
        
        if start_date:
            query = query.filter(Invoice.issue_date >= start_date)
        
        if end_date:
            # Include the end date by adding a day and using < operator
            next_day = end_date + timedelta(days=1)
            query = query.filter(Invoice.issue_date < next_day)
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        query = query.order_by(Invoice.issue_date.desc())
        invoices = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": invoices,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    async def get_invoice(db: Session, invoice_id: uuid.UUID) -> Invoice:
        """Get a specific invoice by ID"""
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        
        if not invoice:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")
        
        return invoice
    
    @staticmethod
    async def create_invoice(db: Session, invoice_data: InvoiceCreate, created_by: uuid.UUID) -> Invoice:
        """Create a new invoice"""
        # Validate client exists
        client = db.query(Client).filter(Client.id == invoice_data.client_id).first()
        if not client:
            raise ValidationException(f"Client with ID {invoice_data.client_id} not found")
        
        # Validate work order if provided
        if invoice_data.work_order_id:
            work_order = db.query(WorkOrder).filter(WorkOrder.id == invoice_data.work_order_id).first()
            if not work_order:
                raise ValidationException(f"Work order with ID {invoice_data.work_order_id} not found")
            if work_order.client_id != client.id:
                raise ValidationException("Work order does not belong to this client")
        
        # Generate unique invoice number
        invoice_number = await InvoiceService._generate_invoice_number(db)
        
        # Calculate due date if not provided
        issue_date = invoice_data.issue_date or datetime.utcnow().date()
        due_date = invoice_data.due_date
        if not due_date:
            # Use client payment terms or default to 30 days
            payment_terms = client.payment_terms or 30
            due_date = issue_date + timedelta(days=payment_terms)
        
        try:
            # Begin transaction
            # Create invoice
            new_invoice = Invoice(
                invoice_number=invoice_number,
                client_id=client.id,
                work_order_id=invoice_data.work_order_id,
                status=invoice_data.status or "draft",
                issue_date=issue_date,
                due_date=due_date,
                notes=invoice_data.notes,
                terms=invoice_data.terms,
                payment_instructions=invoice_data.payment_instructions,
                metadata=invoice_data.metadata,
                created_by=created_by
            )
            
            db.add(new_invoice)
            db.flush()  # Get the ID
            
            # Create invoice items
            subtotal = 0
            if invoice_data.items:
                for item_data in invoice_data.items:
                    item = InvoiceItem(
                        invoice_id=new_invoice.id,
                        description=item_data.description,
                        quantity=item_data.quantity,
                        unit_price=item_data.unit_price,
                        tax_rate=item_data.tax_rate,
                        discount=item_data.discount,
                        work_order_service_id=item_data.work_order_service_id,
                        work_order_item_id=item_data.work_order_item_id,
                        metadata=item_data.metadata
                    )
                    
                    # Calculate the total for this item
                    item_total = item.calculate_total()
                    subtotal += item_total
                    
                    db.add(item)
            
            # If work order provided and no items, auto-generate items
            elif invoice_data.work_order_id and not invoice_data.items:
                work_order = db.query(WorkOrder).filter(WorkOrder.id == invoice_data.work_order_id).first()
                
                # Add services
                services = db.query(WorkOrderService).filter(
                    WorkOrderService.work_order_id == work_order.id
                ).all()
                
                for service in services:
                    item = InvoiceItem(
                        invoice_id=new_invoice.id,
                        description=f"Service: {service.service.name if hasattr(service, 'service') else 'Unknown'}",
                        quantity=service.quantity,
                        unit_price=service.price,
                        tax_rate=0,  # Default values
                        discount=0,
                        work_order_service_id=service.id
                    )
                    
                    # Calculate the total for this item
                    item_total = item.calculate_total()
                    subtotal += item_total
                    
                    db.add(item)
                
                # Add items
                items = db.query(WorkOrderItem).filter(
                    WorkOrderItem.work_order_id == work_order.id
                ).all()
                
                for item in items:
                    invoice_item = InvoiceItem(
                        invoice_id=new_invoice.id,
                        description=f"Material: {item.inventory_item.name if hasattr(item, 'inventory_item') else 'Unknown'}",
                        quantity=item.quantity,
                        unit_price=item.price,
                        tax_rate=0,  # Default values
                        discount=0,
                        work_order_item_id=item.id
                    )
                    
                    # Calculate the total for this item
                    item_total = invoice_item.calculate_total()
                    subtotal += item_total
                    
                    db.add(invoice_item)
            
            # Update invoice totals
            tax_amount = 0  # Would calculate based on tax rules
            discount_amount = 0  # Would calculate based on discount rules
            
            new_invoice.subtotal = subtotal
            new_invoice.tax = tax_amount
            new_invoice.discount = discount_amount
            new_invoice.total = subtotal + tax_amount - discount_amount
            new_invoice.balance = new_invoice.total
            
            db.commit()
            db.refresh(new_invoice)
            
            return new_invoice
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating invoice: {str(e)}")
            raise ConflictException(f"Failed to create invoice: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating invoice: {str(e)}")
            raise ValidationException(f"Failed to create invoice: {str(e)}")
    
    @staticmethod
    async def update_invoice(db: Session, invoice_id: uuid.UUID, invoice_data: InvoiceUpdate) -> Invoice:
        """Update an existing invoice"""
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        
        # Prevent updating if invoice is already paid or sent
        if invoice.status in ["paid", "partially_paid"] and invoice_data.status != "cancelled":
            raise ConflictException("Cannot update an invoice that has been paid")
        
        try:
            # Update invoice with provided fields
            update_data = invoice_data.dict(exclude_unset=True)
            
            # Handle client change
            if 'client_id' in update_data and update_data['client_id'] != invoice.client_id:
                client = db.query(Client).filter(Client.id == update_data['client_id']).first()
                if not client:
                    raise ValidationException(f"Client with ID {update_data['client_id']} not found")
            
            # Handle work order change
            if 'work_order_id' in update_data and update_data['work_order_id'] != invoice.work_order_id:
                if update_data['work_order_id']:
                    work_order = db.query(WorkOrder).filter(WorkOrder.id == update_data['work_order_id']).first()
                    if not work_order:
                        raise ValidationException(f"Work order with ID {update_data['work_order_id']} not found")
                    
                    client_id = update_data.get('client_id', invoice.client_id)
                    if work_order.client_id != client_id:
                        raise ValidationException("Work order does not belong to this client")
            
            # Update the invoice with provided fields
            for key, value in update_data.items():
                setattr(invoice, key, value)
            
            # Update totals if needed
            if any(field in update_data for field in ['subtotal', 'tax', 'discount']):
                invoice.total = invoice.subtotal + invoice.tax - invoice.discount
                invoice.balance = invoice.total - invoice.amount_paid
            
            db.commit()
            db.refresh(invoice)
            
            return invoice
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating invoice: {str(e)}")
            raise ConflictException(f"Failed to update invoice: {str(e)}")
        except ValidationException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating invoice: {str(e)}")
            raise ValidationException(f"Failed to update invoice: {str(e)}")
    
    @staticmethod
    async def delete_invoice(db: Session, invoice_id: uuid.UUID) -> bool:
        """Delete an invoice"""
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        
        # Prevent deleting if invoice is already paid or sent
        if invoice.status in ["paid", "partially_paid", "sent"]:
            raise ConflictException(f"Cannot delete an invoice with status {invoice.status}")
        
        try:
            # Check for payments
            if invoice.payments and len(invoice.payments) > 0:
                raise ConflictException("Cannot delete invoice with associated payments")
            
            # Delete invoice items first
            db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice_id).delete()
            
            # Delete the invoice
            db.delete(invoice)
            db.commit()
            
            return True
            
        except ConflictException:
            raise
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting invoice: {str(e)}")
            raise ConflictException(f"Failed to delete invoice: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting invoice: {str(e)}")
            raise ValidationException(f"Failed to delete invoice: {str(e)}")
    
    @staticmethod
    async def update_invoice_status(
        db: Session, 
        invoice_id: uuid.UUID, 
        status: str,
        notes: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None
    ) -> Invoice:
        """Update an invoice's status"""
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        
        # Check valid status transitions
        valid_transitions = {
            "draft": ["sent", "cancelled"],
            "sent": ["paid", "partially_paid", "overdue", "cancelled"],
            "partially_paid": ["paid", "overdue", "cancelled"],
            "overdue": ["paid", "partially_paid", "cancelled"],
            "cancelled": ["draft"]
        }
        
        if status not in valid_transitions.get(invoice.status, []):
            raise ValidationException(
                f"Invalid status transition from {invoice.status} to {status}"
            )
        
        try:
            # Update the status
            invoice.status = status
            
            # Add any notes to the metadata
            if notes:
                if not invoice.metadata:
                    invoice.metadata = {}
                
                if "status_history" not in invoice.metadata:
                    invoice.metadata["status_history"] = []
                
                invoice.metadata["status_history"].append({
                    "timestamp": datetime.utcnow().isoformat(),
                    "from_status": invoice.status,
                    "to_status": status,
                    "notes": notes,
                    "user_id": str(user_id) if user_id else None
                })
            
            db.commit()
            db.refresh(invoice)
            
            return invoice
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating invoice status: {str(e)}")
            raise ConflictException(f"Failed to update invoice status: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating invoice status: {str(e)}")
            raise ValidationException(f"Failed to update invoice status: {str(e)}")
    
    @staticmethod
    async def send_invoice(
        db: Session, 
        invoice_id: uuid.UUID, 
        send_data: InvoiceSend,
        user_id: uuid.UUID,
        background_tasks: Optional[BackgroundTasks] = None
    ) -> Invoice:
        """Send an invoice to the client"""
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        
        # Check if invoice can be sent
        if invoice.status not in ["draft", "sent"]:
            raise ConflictException(
                f"Cannot send invoice with status {invoice.status}"
            )
        
        try:
            # Update invoice status to sent
            invoice.status = "sent"
            
            # Record in metadata
            if not invoice.metadata:
                invoice.metadata = {}
            
            if "send_history" not in invoice.metadata:
                invoice.metadata["send_history"] = []
            
            invoice.metadata["send_history"].append({
                "timestamp": datetime.utcnow().isoformat(),
                "sent_by": str(user_id),
                "recipients": send_data.email_recipients,
                "message": send_data.email_message
            })
            
            db.commit()
            db.refresh(invoice)
            
            # Send notifications
            if send_data.send_to_client and invoice.client and invoice.client.user_id:
                # Create in-app notification
                notification_data = NotificationCreate(
                    user_id=invoice.client.user_id,
                    title=f"New Invoice #{invoice.invoice_number}",
                    content=f"You have a new invoice for ${invoice.total:.2f} due on {invoice.due_date.isoformat()}",
                    type="in_app",
                    related_id=invoice.id,
                    related_type="invoice"
                )
                
                await NotificationService.create_notification(db, notification_data)
                
                # Send email notification if email recipients provided
                if send_data.email_recipients or invoice.client.email:
                    recipients = send_data.email_recipients or [invoice.client.email]
                    subject = send_data.email_subject or f"New Invoice #{invoice.invoice_number}"
                    message = send_data.email_message or f"Please find your invoice attached. Amount due: ${invoice.total:.2f}. Due date: {invoice.due_date.isoformat()}"
                    
                    if background_tasks:
                        # Send email in background
                        background_tasks.add_task(
                            InvoiceService._send_invoice_email,
                            invoice_id=invoice.id,
                            recipients=recipients,
                            subject=subject,
                            message=message
                        )
            
            return invoice
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error sending invoice: {str(e)}")
            raise ConflictException(f"Failed to send invoice: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error sending invoice: {str(e)}")
            raise ValidationException(f"Failed to send invoice: {str(e)}")
    
    @staticmethod
    async def generate_invoice_document(db: Session, invoice_id: uuid.UUID, format: str = "pdf") -> Response:
        """Generate an invoice document in the specified format"""
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        
        if format.lower() not in ["pdf", "csv"]:
            raise ValidationException(f"Unsupported format: {format}")
        
        try:
            # Generate document filename
            filename = f"invoice_{invoice.invoice_number}_{datetime.utcnow().strftime('%Y%m%d')}.{format.lower()}"
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{format.lower()}") as temp_file:
                temp_path = temp_file.name
                
                if format.lower() == "pdf":
                    await InvoiceService._generate_pdf(invoice, temp_path)
                else:  # csv
                    await InvoiceService._generate_csv(invoice, temp_path)
            
            # Return the file
            return FileResponse(
                path=temp_path,
                filename=filename,
                media_type=f"application/{format.lower()}",
                background=lambda: os.unlink(temp_path)  # Delete after sending
            )
            
        except Exception as e:
            logger.error(f"Error generating invoice document: {str(e)}")
            raise ValidationException(f"Failed to generate invoice document: {str(e)}")
    
    @staticmethod
    async def _generate_invoice_number(db: Session) -> str:
        """Generate a unique invoice number"""
        # Get the last invoice number
        last_invoice = db.query(Invoice).order_by(Invoice.invoice_number.desc()).first()
        
        prefix = "INV-"
        if last_invoice and last_invoice.invoice_number.startswith(prefix):
            try:
                last_number = int(last_invoice.invoice_number[len(prefix):])
                next_number = last_number + 1
            except ValueError:
                # Fallback if number parsing fails
                next_number = 1001
        else:
            next_number = 1001
        
        return f"{prefix}{next_number}"
    
    @staticmethod
    async def _send_invoice_email(invoice_id: uuid.UUID, recipients: List[str], subject: str, message: str):
        """Send invoice email with attachment"""
        # This would be implemented to use notification_service to send email with attachment
        # For now, just log it
        logger.info(f"Would send invoice {invoice_id} to {recipients} with subject: {subject}")
        pass
    
    @staticmethod
    async def _generate_pdf(invoice: Invoice, output_path: str):
        """Generate a PDF document for the invoice"""
        # This would use a PDF generation library
        # For now, just create a placeholder file
        with open(output_path, 'w') as f:
            f.write(f"INVOICE {invoice.invoice_number}\n")
            f.write(f"Date: {invoice.issue_date}\n")
            f.write(f"Due Date: {invoice.due_date}\n")
            f.write(f"Total: ${invoice.total}\n")
            # Would add more detailed content
        pass
    
    @staticmethod
    async def _generate_csv(invoice: Invoice, output_path: str):
        """Generate a CSV document for the invoice"""
        # Create a simple CSV file
        with open(output_path, 'w') as f:
            f.write(f"Invoice,{invoice.invoice_number}\n")
            f.write(f"Date,{invoice.issue_date}\n")
            f.write(f"Due Date,{invoice.due_date}\n")
            f.write(f"Client,{invoice.client.company_name if invoice.client.company_name else invoice.client.full_name}\n")
            f.write("\n")
            f.write("Description,Quantity,Unit Price,Tax,Discount,Total\n")
            
            for item in invoice.items:
                f.write(f"\"{item.description}\",{item.quantity},{item.unit_price},{item.tax_rate}%,{item.discount}%,{item.total}\n")
            
            f.write("\n")
            f.write(f"Subtotal,{invoice.subtotal}\n")
            f.write(f"Tax,{invoice.tax}\n")
            f.write(f"Discount,{invoice.discount}\n")
            f.write(f"Total,{invoice.total}\n")
        pass