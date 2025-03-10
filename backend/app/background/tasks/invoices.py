import logging
from datetime import datetime, timedelta
from celery import shared_task
from sqlalchemy import and_

from app.db.database import get_db_session
from app.models.invoice import Invoice
from app.models.client import Client
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationCreate

logger = logging.getLogger(__name__)

@shared_task(name="app.background.tasks.invoices.check_overdue_invoices")
def check_overdue_invoices():
    """Check for invoices that are now overdue and update their status"""
    logger.info("Starting overdue invoices check")
    
    try:
        # Get database session
        db = get_db_session()
        
        # Current date
        today = datetime.utcnow().date()
        
        # Find invoices that are due today or earlier, still in sent or partially_paid status
        invoices = db.query(Invoice).filter(
            and_(
                Invoice.due_date <= today,
                Invoice.status.in_(["sent", "partially_paid"]),
                Invoice.balance > 0
            )
        ).all()
        
        logger.info(f"Found {len(invoices)} invoices that are now overdue")
        
        for invoice in invoices:
            # Update status to overdue
            old_status = invoice.status
            invoice.status = "overdue"
            
            # Add status change to metadata
            if not invoice.metadata:
                invoice.metadata = {}
            
            if "status_history" not in invoice.metadata:
                invoice.metadata["status_history"] = []
            
            invoice.metadata["status_history"].append({
                "timestamp": datetime.utcnow().isoformat(),
                "from_status": old_status,
                "to_status": "overdue",
                "notes": "Automatically marked as overdue by system",
                "user_id": None
            })
            
            # Notify client if this invoice has a client and the client has a user
            if invoice.client_id:
                client = db.query(Client).filter(Client.id == invoice.client_id).first()
                if client and client.user_id:
                    # Create notification
                    notification_data = NotificationCreate(
                        user_id=client.user_id,
                        title="Invoice Overdue",
                        content=f"Invoice #{invoice.invoice_number} for ${invoice.total:.2f} is now overdue. Please make payment as soon as possible.",
                        type="in_app",
                        related_id=invoice.id,
                        related_type="invoice"
                    )
                    
                    await NotificationService.create_notification(db, notification_data)
                    
                    # If client has email, send email reminder
                    if client.email:
                        email_subject = f"OVERDUE: Invoice #{invoice.invoice_number}"
                        email_content = f"""
                        <p>Dear {client.first_name},</p>
                        
                        <p>This is a reminder that invoice #{invoice.invoice_number} for ${invoice.total:.2f} was due on {invoice.due_date.strftime('%B %d, %Y')}.</p>
                        
                        <p>Please make payment as soon as possible. If you have already made payment, please disregard this notice.</p>
                        
                        <p>If you have any questions, please contact us.</p>
                        
                        <p>Thank you,<br>
                        Service Business Team</p>
                        """
                        
                        await NotificationService.send_email(
                            to_email=client.email,
                            subject=email_subject,
                            content=email_content
                        )
        
        # Commit the changes
        db.commit()
        
        # Close the session
        db.close()
        
        logger.info(f"Updated {len(invoices)} invoices to overdue status")
        return f"Updated {len(invoices)} invoices to overdue status"
        
    except Exception as e:
        logger.error(f"Error checking overdue invoices: {str(e)}")
        if 'db' in locals():
            db.rollback()
            db.close()
        raise

@shared_task(name="app.background.tasks.invoices.send_payment_reminders")
def send_payment_reminders():
    """Send payment reminders for invoices due soon"""
    logger.info("Starting payment reminders task")
    
    try:
        # Get database session
        db = get_db_session()
        
        # Current date
        today = datetime.utcnow().date()
        
        # Find invoices due in 3 days that are in sent status
        due_date = today + timedelta(days=3)
        invoices = db.query(Invoice).filter(
            and_(
                Invoice.due_date == due_date,
                Invoice.status == "sent"
            )
        ).all()
        
        logger.info(f"Found {len(invoices)} invoices due in 3 days")
        
        for invoice in invoices:
            # Notify client if this invoice has a client and the client has a user
            if invoice.client_id:
                client = db.query(Client).filter(Client.id == invoice.client_id).first()
                if client and client.user_id:
                    # Create notification
                    notification_data = NotificationCreate(
                        user_id=client.user_id,
                        title="Payment Reminder",
                        content=f"Invoice #{invoice.invoice_number} for ${invoice.total:.2f} is due in 3 days on {invoice.due_date.strftime('%B %d, %Y')}.",
                        type="in_app",
                        related_id=invoice.id,
                        related_type="invoice"
                    )
                    
                    await NotificationService.create_notification(db, notification_data)
                    
                    # If client has email, send email reminder
                    if client.email:
                        email_subject = f"Payment Reminder: Invoice #{invoice.invoice_number}"
                        email_content = f"""
                        <p>Dear {client.first_name},</p>
                        
                        <p>This is a friendly reminder that invoice #{invoice.invoice_number} for ${invoice.total:.2f} is due in 3 days on {invoice.due_date.strftime('%B %d, %Y')}.</p>
                        
                        <p>Please make payment before the due date to avoid late fees.</p>
                        
                        <p>If you have any questions, please contact us.</p>
                        
                        <p>Thank you,<br>
                        Service Business Team</p>
                        """
                        
                        await NotificationService.send_email(
                            to_email=client.email,
                            subject=email_subject,
                            content=email_content
                        )
        
        # Close the session
        db.close()
        
        logger.info(f"Sent reminders for {len(invoices)} invoices")
        return f"Sent reminders for {len(invoices)} invoices"
        
    except Exception as e:
        logger.error(f"Error sending payment reminders: {str(e)}")
        if 'db' in locals():
            db.close()
        raise

@shared_task(name="app.background.tasks.invoices.auto_generate_invoices")
def auto_generate_invoices():
    """Auto-generate invoices for completed work orders that don't have invoices yet"""
    logger.info("Starting auto invoice generation task")
    
    try:
        # Get database session
        db = get_db_session()
        
        # Import here to avoid circular imports
        from app.models.work_order import WorkOrder
        from app.services.invoice_service import InvoiceService
        from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate
        
        # Find completed work orders without invoices
        work_orders = db.query(WorkOrder).filter(
            and_(
                WorkOrder.status == "completed",
                ~WorkOrder.invoices.any()  # No associated invoices
            )
        ).all()
        
        logger.info(f"Found {len(work_orders)} completed work orders without invoices")
        
        invoices_created = 0
        
        for work_order in work_orders:
            # Skip if no client
            if not work_order.client_id:
                logger.warning(f"Work order {work_order.id} has no client, skipping invoice generation")
                continue
            
            try:
                # Create invoice for this work order
                invoice_data = InvoiceCreate(
                    client_id=work_order.client_id,
                    work_order_id=work_order.id,
                    status="draft",
                    # Let the service generate items from work order services and items
                    items=[]
                )
                
                # Create the invoice using service
                invoice = await InvoiceService.create_invoice(db, invoice_data, work_order.created_by)
                invoices_created += 1
                
                logger.info(f"Created invoice {invoice.invoice_number} for work order {work_order.order_number}")
                
            except Exception as e:
                logger.error(f"Error creating invoice for work order {work_order.id}: {str(e)}")
                # Continue with other work orders
                continue
        
        # Close the session
        db.close()
        
        logger.info(f"Created {invoices_created} invoices from completed work orders")
        return f"Created {invoices_created} invoices from completed work orders"
        
    except Exception as e:
        logger.error(f"Error auto-generating invoices: {str(e)}")
        if 'db' in locals():
            db.close()
        raise