"""Customer appointment reminder email (~24h before), no SMS."""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrderAppointment
from app.services.customer_outreach_service import (
    automatic_outreach_allowed,
    log_skipped_test_mode,
)
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


async def send_appointment_reminder_email(
    db: Session,
    appointment: WorkOrderAppointment,
) -> bool:
    wo = appointment.work_order
    if not wo or not wo.client_id:
        return False
    client = wo.client
    if not client:
        return False
    if not automatic_outreach_allowed(db, client.id):
        log_skipped_test_mode(
            channel="appointment_reminder_email",
            client_id=client.id,
            detail=f"appointment_id={appointment.id}",
        )
        return False
    if not (client.email or "").strip():
        logger.info("appointment reminder skipped: no email client_id=%s", client.id)
        return False

    when = appointment.scheduled_start.strftime("%A, %B %d at %I:%M %p")
    order = wo.order_number or str(wo.id)[:8]
    name = client.first_name or "there"
    subject = f"Reminder: your service appointment — {when}"
    body = f"""
    <p>Hi {name},</p>
    <p>This is a reminder that your Atomic Repair service is scheduled for <strong>{when}</strong>.</p>
    <p>Work order: #{order}</p>
    <p>Questions? Call (419) 740-0146.</p>
    """
    try:
        await NotificationService.send_email(
            to_email=client.email,
            subject=subject,
            content=body,
        )
        return True
    except Exception as exc:
        logger.error("Appointment reminder email failed appt=%s: %s", appointment.id, exc)
        return False
