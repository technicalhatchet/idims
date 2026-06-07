"""Work order debriefing / activity log helpers."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.work_order import WorkOrderActivityLog

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo  # type: ignore

EST = ZoneInfo("America/New_York")

APPOINTMENT_STATUS_LABELS = {
    "scheduled": "Scheduled",
    "reschedule": "Needs Reschedule",
    "completed": "Completed",
    "canceled": "Canceled",
    "phone_payment": "Phone Payment",
    "refund": "Refund",
    "en_route": "En Route",
    "in_progress": "In Progress",
    "completed_pending_payment": "Completed — Pending Payment",
    "unreachable": "Unreachable",
    "failed": "APR",
}

WORK_ORDER_STATUS_LABELS = {
    "pending": "Pending",
    "scheduled": "Scheduled",
    "en_route": "En Route",
    "waiting_on_parts": "Waiting on Parts",
    "in_progress": "In Progress",
    "on_hold": "On Hold",
    "completed": "Completed",
    "completed_pending_payment": "Completed — Pending Payment",
    "pending_estimate_approval": "Pending Estimate Approval",
    "canceled": "Canceled",
    "parts_on_order": "Parts on Order",
    "reschedule": "Reschedule",
    "need_to_contact": "Need to Contact",
    "unreachable": "Unreachable",
    "recall": "Recall",
    "redo": "Redo",
    "refunded": "Refunded",
    "closed": "Closed",
}


def _status_val(status) -> str:
    if status is None:
        return ""
    val = status.value if hasattr(status, "value") else str(status)
    if val == "cancelled":
        return "canceled"
    return val


def format_est_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "Unknown time"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    local = dt.astimezone(EST)
    hour = local.strftime("%I").lstrip("0") or "12"
    return f"{local.strftime('%b')} {local.day}, {local.year} {hour}:{local.strftime('%M %p')} EST"


def get_user_display_name(user: Optional[User]) -> str:
    if not user:
        return "Unknown"
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or user.email or "Unknown"


def log_work_order_activity(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    event_type: str,
    headline: str,
    actor_label: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> WorkOrderActivityLog:
    entry = WorkOrderActivityLog(
        work_order_id=work_order_id,
        user_id=user_id,
        event_type=event_type,
        headline=headline,
        actor_label=actor_label,
        event_metadata=metadata or {},
    )
    db.add(entry)
    return entry


def log_work_order_created(db: Session, work_order_id: uuid.UUID, user_id: uuid.UUID) -> None:
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="work_order_created",
        headline="Work Order Created",
        actor_label="Created by",
    )


def log_work_order_status_changed(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    previous_status: str,
    new_status: str,
) -> None:
    prev = WORK_ORDER_STATUS_LABELS.get(previous_status, previous_status.replace("_", " ").title())
    new = WORK_ORDER_STATUS_LABELS.get(new_status, new_status.replace("_", " ").title())
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="work_order_status_changed",
        headline=f"Work Order Status Changed from {prev} to {new}",
        actor_label="Changed by",
        metadata={"previous_status": previous_status, "new_status": new_status},
    )


def log_work_order_assigned(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    technician_name: Optional[str] = None,
) -> None:
    headline = "Technician Assigned"
    if technician_name:
        headline = f"Technician Assigned to {technician_name}"
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="work_order_assigned",
        headline=headline,
        actor_label="Assigned by",
        metadata={"technician_name": technician_name},
    )


def log_equipment_updated(db: Session, work_order_id: uuid.UUID, user_id: uuid.UUID) -> None:
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="equipment_updated",
        headline="Equipment Details Updated",
        actor_label="Updated by",
    )


def log_appointment_added(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    scheduled_start: datetime,
    appointment_type: Optional[str] = None,
) -> None:
    when = format_est_datetime(scheduled_start)
    type_label = (appointment_type or "appointment").replace("-", " ").title()
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="appointment_added",
        headline=f"{type_label} Appointment Added for {when}",
        actor_label="Scheduled by",
        metadata={"scheduled_start": scheduled_start.isoformat() if scheduled_start else None, "appointment_type": appointment_type},
    )


def log_appointment_removed(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    scheduled_start: datetime,
    appointment_type: Optional[str] = None,
) -> None:
    when = format_est_datetime(scheduled_start)
    type_label = (appointment_type or "appointment").replace("-", " ").title()
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="appointment_removed",
        headline=f"{type_label} Appointment Removed for {when}",
        actor_label="Removed by",
        metadata={"scheduled_start": scheduled_start.isoformat() if scheduled_start else None, "appointment_type": appointment_type},
    )


def log_appointment_status_changed(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    previous_status: str,
    new_status: str,
    scheduled_start: Optional[datetime] = None,
) -> None:
    prev = APPOINTMENT_STATUS_LABELS.get(previous_status, previous_status.replace("_", " ").title())
    new = APPOINTMENT_STATUS_LABELS.get(new_status, new_status.replace("_", " ").title())
    when = format_est_datetime(scheduled_start) if scheduled_start else None
    headline = f"Appointment Status Changed from {prev} to {new}"
    if when:
        headline = f"{headline} ({when})"
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="appointment_status_changed",
        headline=headline,
        actor_label="Changed by",
        metadata={
            "previous_status": previous_status,
            "new_status": new_status,
            "scheduled_start": scheduled_start.isoformat() if scheduled_start else None,
        },
    )


def log_appointment_rescheduled(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    previous_start: datetime,
    new_start: datetime,
) -> None:
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="appointment_rescheduled",
        headline=(
            f"Appointment Rescheduled from {format_est_datetime(previous_start)} "
            f"to {format_est_datetime(new_start)}"
        ),
        actor_label="Changed by",
        metadata={
            "previous_start": previous_start.isoformat() if previous_start else None,
            "new_start": new_start.isoformat() if new_start else None,
        },
    )


def log_order_closed(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    order_number: str,
    invoice_total: float,
    amount_previously_paid: float,
) -> None:
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="order_closed",
        headline=f"Order Closed ({order_number})",
        actor_label="Closed by",
        metadata={
            "order_number": order_number,
            "invoice_total": invoice_total,
            "amount_previously_paid": amount_previously_paid,
        },
    )


def log_order_reopened(db: Session, *, work_order_id: uuid.UUID, user_id: uuid.UUID) -> None:
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="order_reopened",
        headline="Order Reopened",
        actor_label="Reopened by",
    )


def log_order_reclosed(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    order_number: str,
    invoice_total: float,
    amount_previously_paid: float,
) -> None:
    log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type="order_reclosed",
        headline=f"Order Reclosed ({order_number})",
        actor_label="Closed by",
        metadata={
            "order_number": order_number,
            "invoice_total": invoice_total,
            "amount_previously_paid": amount_previously_paid,
        },
    )


def get_work_order_activity_timeline(db: Session, work_order_id: uuid.UUID) -> List[Dict[str, Any]]:
    rows = (
        db.query(WorkOrderActivityLog, User)
        .join(User, WorkOrderActivityLog.user_id == User.id)
        .filter(WorkOrderActivityLog.work_order_id == work_order_id)
        .order_by(WorkOrderActivityLog.created_at.desc())
        .all()
    )
    timeline: List[Dict[str, Any]] = []
    for entry, user in rows:
        timeline.append(
            {
                "id": str(entry.id),
                "event_type": entry.event_type,
                "headline": entry.headline,
                "actor_label": entry.actor_label,
                "actor_name": get_user_display_name(user),
                "occurred_at": entry.created_at.isoformat() if entry.created_at else None,
                "occurred_at_est": format_est_datetime(entry.created_at),
                "metadata": entry.event_metadata or {},
            }
        )
    return timeline
