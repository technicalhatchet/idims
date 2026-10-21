"""Promote work orders to pending_estimate_approval when estimate labor is ready."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder, WorkOrderAppointment, WorkOrderService
from app.services import work_order_activity_service as activity
from app.services.work_order_lifecycle_service import apply_work_order_status_change
from app.utils.portal_estimate import completed_diagnostic_date

SKIP_PROMOTE_STATUSES = frozenset({
    "pending_estimate_approval",
    "canceled",
    "cancelled",
    "refunded",
    "closed",
})


def work_order_has_unscheduled_estimate_labor(db: Session, work_order_id: uuid.UUID) -> bool:
    row = (
        db.query(WorkOrderService)
        .filter(
            WorkOrderService.work_order_id == work_order_id,
            WorkOrderService.billing_status == "not_billable",
            WorkOrderService.appointment_id.is_(None),
        )
        .first()
    )
    return row is not None


def work_order_diagnostic_visits_settled(db: Session, work_order_id: uuid.UUID) -> bool:
    """Completed diagnostic visits have no remaining billable (unpaid) lines."""
    diags = (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.work_order_id == work_order_id,
            WorkOrderAppointment.appointment_type == "diagnostic",
            WorkOrderAppointment.status == "completed",
        )
        .all()
    )
    if not diags:
        return False
    for appt in diags:
        unpaid = (
            db.query(WorkOrderService)
            .filter(
                WorkOrderService.work_order_id == work_order_id,
                WorkOrderService.appointment_id == appt.id,
                WorkOrderService.billing_status == "billable",
            )
            .first()
        )
        if unpaid:
            return False
    return True


def should_promote_pending_estimate_approval(db: Session, work_order: WorkOrder) -> bool:
    if getattr(work_order, "is_closed", False):
        return False
    status = activity._status_val(work_order.status)
    if status in SKIP_PROMOTE_STATUSES:
        return False
    if not work_order_has_unscheduled_estimate_labor(db, work_order.id):
        return False
    if completed_diagnostic_date(db, work_order.id) is None:
        return False
    if not work_order_diagnostic_visits_settled(db, work_order.id):
        return False
    return True


def maybe_promote_pending_estimate_approval(
    db: Session,
    work_order: WorkOrder,
    user_id: uuid.UUID,
    *,
    note: str = "Unscheduled estimate labor after diagnostic visit",
) -> bool:
    if not should_promote_pending_estimate_approval(db, work_order):
        return False
    current = activity._status_val(work_order.status)
    if current == "pending_estimate_approval":
        return False
    return apply_work_order_status_change(
        db,
        work_order,
        "pending_estimate_approval",
        user_id,
        notes=note,
    )


def resolve_completion_status_after_visit(
    db: Session,
    work_order: WorkOrder,
    default_status: str,
) -> str:
    """Prefer pending_estimate_approval over completed_pending_payment when estimate gate passes."""
    if default_status != "completed_pending_payment":
        return default_status
    if should_promote_pending_estimate_approval(db, work_order):
        return "pending_estimate_approval"
    return default_status
