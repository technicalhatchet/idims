"""Client portal estimate availability (30 days after completed diagnostic)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.utils.datetime_utils import as_utc_naive, utcnow_naive

ESTIMATE_VALIDITY_DAYS = 30
ESTIMATE_BLOCKED_STATUSES = frozenset({"canceled", "cancelled", "refunded"})


def _enum_value(value) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


def completed_diagnostic_date(db: Session, work_order_id) -> Optional[datetime]:
    """Earliest completed diagnostic visit date for a work order."""
    appt = (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.work_order_id == work_order_id,
            WorkOrderAppointment.appointment_type == "diagnostic",
            WorkOrderAppointment.status == "completed",
        )
        .order_by(WorkOrderAppointment.scheduled_start.asc())
        .first()
    )
    if not appt:
        return None
    if appt.actual_end:
        return as_utc_naive(appt.actual_end)
    if appt.actual_start:
        return as_utc_naive(appt.actual_start)
    return as_utc_naive(appt.scheduled_start)


def portal_estimate_meta(
    wo: WorkOrder,
    db: Session,
    now: Optional[datetime] = None,
) -> dict:
    """
    Whether the client may view/download an estimate for this work order.

    Valid for ESTIMATE_VALIDITY_DAYS after the completed diagnostic visit.
    """
    now = as_utc_naive(now) or utcnow_naive()
    status = _enum_value(wo.status)

    empty = {
        "estimate_available": False,
        "estimate_expires_at": None,
        "diagnostic_completed_at": None,
    }
    if status in ESTIMATE_BLOCKED_STATUSES:
        return empty

    diagnostic_date = completed_diagnostic_date(db, wo.id)
    if not diagnostic_date:
        return empty

    expires = diagnostic_date + timedelta(days=ESTIMATE_VALIDITY_DAYS)
    return {
        "estimate_available": now <= expires,
        "estimate_expires_at": expires.isoformat(),
        "diagnostic_completed_at": diagnostic_date.isoformat(),
    }
