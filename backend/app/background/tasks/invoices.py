import asyncio
import logging
from datetime import datetime, timedelta

from celery import shared_task
from sqlalchemy import and_

from app.db.database import SessionLocal
from app.models.client import Client
from app.models.invoice import Invoice
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


@shared_task(name="app.background.tasks.invoices.check_overdue_invoices")
def check_overdue_invoices():
    """Check for invoices that are now overdue and update their status (unscheduled by default)."""
    logger.info("Starting overdue invoices check")

    try:
        db = SessionLocal()
        now = datetime.utcnow()

        invoices = db.query(Invoice).filter(
            and_(
                Invoice.due_date < now,
                Invoice.status.in_(["sent", "partially_paid"]),
                Invoice.balance > 0,
            )
        ).all()

        logger.info("Found %s invoices that are now overdue", len(invoices))

        for invoice in invoices:
            old_status = invoice.status
            invoice.status = "overdue"
            if not invoice.metadata:
                invoice.metadata = {}
            if "status_history" not in invoice.metadata:
                invoice.metadata["status_history"] = []
            invoice.metadata["status_history"].append(
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "from_status": old_status,
                    "to_status": "overdue",
                    "notes": "Automatically marked as overdue by system",
                    "user_id": None,
                }
            )

            if invoice.client_id:
                client = db.query(Client).filter(Client.id == invoice.client_id).first()
                if client:
                    from app.services.client_portal_notification_service import (
                        notify_client_portal_users,
                    )

                    asyncio.run(
                        notify_client_portal_users(
                            db,
                            client.id,
                            title="Invoice Overdue",
                            message=(
                                f"Invoice #{invoice.invoice_number} for ${invoice.total:.2f} is now overdue. "
                                "Please make payment as soon as possible."
                            ),
                            notification_type="in_app",
                            reference_id=invoice.id,
                            related_type="invoice",
                            automatic_outreach=True,
                        )
                    )

                    from app.services.customer_outreach_service import automatic_outreach_allowed

                    if client.email and automatic_outreach_allowed(db, client.id):
                        email_subject = f"OVERDUE: Invoice #{invoice.invoice_number}"
                        email_content = f"""
                        <p>Dear {client.first_name},</p>
                        <p>This is a reminder that invoice #{invoice.invoice_number} for ${invoice.total:.2f} was due on {invoice.due_date.strftime('%B %d, %Y')}.</p>
                        <p>Please make payment as soon as possible. If you have already made payment, please disregard this notice.</p>
                        """
                        asyncio.run(
                            NotificationService.send_email(
                                to_email=client.email,
                                subject=email_subject,
                                content=email_content,
                            )
                        )

        db.commit()
        db.close()
        logger.info("Updated %s invoices to overdue status", len(invoices))
        return f"Updated {len(invoices)} invoices to overdue status"

    except Exception as e:
        logger.error("Error checking overdue invoices: %s", e)
        if "db" in locals():
            db.rollback()
            db.close()
        raise


@shared_task(name="app.background.tasks.invoices.send_payment_reminders")
def send_payment_reminders():
    """Send payment reminders for invoices due soon (unscheduled)."""
    logger.info("Starting payment reminders task")

    try:
        db = SessionLocal()
        today = datetime.utcnow().date()
        due_date = today + timedelta(days=3)
        invoices = db.query(Invoice).filter(
            and_(Invoice.due_date == due_date, Invoice.status == "sent")
        ).all()

        for invoice in invoices:
            if not invoice.client_id:
                continue
            client = db.query(Client).filter(Client.id == invoice.client_id).first()
            if not client:
                continue
            from app.services.client_portal_notification_service import notify_client_portal_users

            asyncio.run(
                notify_client_portal_users(
                    db,
                    client.id,
                    title="Payment Reminder",
                    message=(
                        f"Invoice #{invoice.invoice_number} for ${invoice.total:.2f} is due in 3 days on "
                        f"{invoice.due_date.strftime('%B %d, %Y')}."
                    ),
                    notification_type="in_app",
                    reference_id=invoice.id,
                    related_type="invoice",
                    automatic_outreach=True,
                )
            )
            from app.services.customer_outreach_service import automatic_outreach_allowed

            if client.email and automatic_outreach_allowed(db, client.id):
                asyncio.run(
                    NotificationService.send_email(
                        to_email=client.email,
                        subject=f"Payment Reminder: Invoice #{invoice.invoice_number}",
                        content=f"<p>Invoice #{invoice.invoice_number} is due in 3 days.</p>",
                    )
                )

        db.close()
        return f"Sent reminders for {len(invoices)} invoices"

    except Exception as e:
        logger.error("Error sending payment reminders: %s", e)
        if "db" in locals():
            db.close()
        raise
