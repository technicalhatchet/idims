"""Beat-driven due_at outreach (no Celery ETA/countdown)."""

import asyncio
import logging
from datetime import timedelta

from celery import shared_task
from sqlalchemy.orm import Session, joinedload

from app.db.database import SessionLocal
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.services.worker_feature_flags_service import worker_feature_enabled

logger = logging.getLogger(__name__)

ACTIVE_APPOINTMENT_STATUSES = ("scheduled", "reschedule", "en_route", "in_progress")
REMINDER_HOURS_BEFORE = 24
REMINDER_WINDOW_HOURS_MIN = 23.0
REMINDER_WINDOW_HOURS_MAX = 24.5


@shared_task(name="app.background.tasks.scheduled_outreach.process_scheduled_outreach_tick")
def process_scheduled_outreach_tick():
    """Every 5 minutes: due review requests + appointment reminder emails."""
    db = SessionLocal()
    try:
        reviews = 0
        reminders = 0
        if worker_feature_enabled(db, "delayed_review_requests"):
            reviews = _process_due_review_requests(db)
        if worker_feature_enabled(db, "appointment_reminders"):
            reminders = _process_due_appointment_reminders(db)
        if reviews or reminders:
            logger.info(
                "Scheduled outreach tick: reviews_sent=%s appointment_reminders_sent=%s",
                reviews,
                reminders,
            )
        return {"reviews_sent": reviews, "appointment_reminders_sent": reminders}
    finally:
        db.close()


def _process_due_review_requests(db: Session) -> int:
    from app.utils.datetime_utils import utcnow_naive
    from app.services.portal_review_request_service import (
        review_request_eligibility,
        send_portal_review_request,
    )

    now = utcnow_naive()
    rows = (
        db.query(WorkOrder)
        .filter(
            WorkOrder.review_due_at.isnot(None),
            WorkOrder.review_due_at <= now,
            WorkOrder.review_requested_at.is_(None),
        )
        .all()
    )
    sent = 0
    for wo in rows:
        skip = review_request_eligibility(db, wo, force=False, automatic=True)
        if skip:
            wo.review_due_at = None
            continue
        result = asyncio.run(
            send_portal_review_request(db, wo.id, automatic=True)
        )
        if result.get("sent"):
            sent += 1
            wo.review_due_at = None
        elif result.get("reason") == "test_mode":
            continue
        elif result.get("reason") in ("not_found",):
            wo.review_due_at = None
    db.commit()
    return sent


def _process_due_appointment_reminders(db: Session) -> int:
    from app.utils.datetime_utils import utcnow_naive
    from app.services.appointment_reminder_service import send_appointment_reminder_email

    now = utcnow_naive()
    appts = (
        db.query(WorkOrderAppointment)
        .options(joinedload(WorkOrderAppointment.work_order).joinedload(WorkOrder.client))
        .filter(
            WorkOrderAppointment.appointment_reminder_sent_at.is_(None),
            WorkOrderAppointment.scheduled_start > now,
            WorkOrderAppointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
        )
        .all()
    )
    sent = 0
    for appt in appts:
        hours_until = (appt.scheduled_start - now).total_seconds() / 3600.0
        if hours_until > REMINDER_WINDOW_HOURS_MAX or hours_until < REMINDER_WINDOW_HOURS_MIN:
            continue
        if asyncio.run(send_appointment_reminder_email(db, appt)):
            appt.appointment_reminder_sent_at = now
            sent += 1
    if sent:
        db.commit()
    return sent
