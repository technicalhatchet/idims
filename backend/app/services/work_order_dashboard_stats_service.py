"""Aggregated work-order counts for TechDeck home (no partial list pagination)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict

from sqlalchemy import and_, exists, func
from sqlalchemy.orm import Session

from app.constants.appointment_status import APPOINTMENT_STATUS_CANCELED
from app.models.work_order import WorkOrder, WorkOrderAppointment

PARTS_HOLD_STATUSES = ("waiting_on_parts", "parts_on_order")
OPEN_OVERDUE_STATUSES = ("scheduled", "pending", "en_route")
# Finished jobs — do not count toward parts waiting even if a part line was never updated.
PARTS_WAITING_EXCLUDED_STATUSES = frozenset({
    "completed",
    "completed_pending_payment",
    "canceled",
    "closed",
    "refunded",
})


def work_order_eligible_for_parts_waiting(*, is_closed: bool, status: str) -> bool:
    if is_closed:
        return False
    st = (status or "").strip().lower()
    if st == "cancelled":
        st = "canceled"
    return st not in PARTS_WAITING_EXCLUDED_STATUSES


def _local_day_bounds(local_date: date, tz_offset_minutes: int) -> tuple[datetime, datetime]:
    """Map local calendar day to naive UTC window (matches browser getTimezoneOffset())."""
    start_local = datetime(local_date.year, local_date.month, local_date.day, 0, 0, 0)
    start_utc = start_local + timedelta(minutes=tz_offset_minutes)
    end_utc = start_utc + timedelta(days=1)
    return start_utc, end_utc


def get_techdeck_dashboard_stats(
    db: Session,
    *,
    local_date: date,
    tz_offset_minutes: int,
) -> Dict[str, Any]:
    day_start, day_end = _local_day_bounds(local_date, tz_offset_minutes)
    yesterday_end = day_start - timedelta(seconds=1)

    total = db.query(func.count(WorkOrder.id)).scalar() or 0

    today_q = and_(
        WorkOrder.scheduled_start.isnot(None),
        WorkOrder.scheduled_start >= day_start,
        WorkOrder.scheduled_start < day_end,
    )
    today = db.query(func.count(WorkOrder.id)).filter(today_q).scalar() or 0

    completed_today = (
        db.query(func.count(WorkOrder.id))
        .filter(today_q, WorkOrder.status == "completed")
        .scalar()
        or 0
    )

    # "Orders on hold" — WO status only (not stray ordered/needed lines on active/scheduled jobs).
    parts_waiting_open = and_(
        WorkOrder.is_closed.is_(False),
        ~WorkOrder.status.in_(tuple(PARTS_WAITING_EXCLUDED_STATUSES)),
        WorkOrder.status.in_(PARTS_HOLD_STATUSES),
    )
    parts_waiting = db.query(func.count(WorkOrder.id)).filter(parts_waiting_open).scalar() or 0

    critical_mass = (
        db.query(func.count(WorkOrder.id))
        .filter(
            WorkOrder.status.in_(OPEN_OVERDUE_STATUSES),
            WorkOrder.scheduled_start.isnot(None),
            WorkOrder.scheduled_start <= yesterday_end,
        )
        .scalar()
        or 0
    )

    has_scheduled_appt = exists().where(
        and_(
            WorkOrderAppointment.work_order_id == WorkOrder.id,
            WorkOrderAppointment.scheduled_start.isnot(None),
            WorkOrderAppointment.status != APPOINTMENT_STATUS_CANCELED,
        )
    )
    pending_scheduling = (
        db.query(func.count(WorkOrder.id))
        .filter(
            WorkOrder.status == "pending",
            WorkOrder.scheduled_start.is_(None),
            ~has_scheduled_appt,
        )
        .scalar()
        or 0
    )

    return {
        "total": int(total),
        "today": int(today),
        "completed_today": int(completed_today),
        "parts_waiting": int(parts_waiting),
        "critical_mass": int(critical_mass),
        "pending_scheduling": int(pending_scheduling),
    }
