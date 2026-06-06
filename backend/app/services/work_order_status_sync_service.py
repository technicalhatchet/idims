"""Sync work order status from appointment status changes (field visit → job board)."""

from __future__ import annotations

import uuid
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.services import work_order_activity_service as activity
from app.services.work_order_lifecycle_service import apply_work_order_status_change

# Phase 1: field visit lifecycle — appointment status → work order status
APPOINTMENT_TO_WORK_ORDER_STATUS: Dict[str, str] = {
    "en_route": "en_route",
    "in_progress": "in_progress",
    "reschedule": "reschedule",
    "failed": "waiting_on_parts",  # APR on visit → waiting on parts on job
    "unreachable": "unreachable",
}

# Office / terminal WO statuses — do not overwrite from a field visit update
WO_STATUSES_SKIP_APPOINTMENT_SYNC = frozenset({
    "cancelled",
    "refunded",
    "closed",
    "on_hold",
    "pending_estimate_approval",
})


def resolve_work_order_status_for_appointment(appointment_status: str) -> Optional[str]:
    """Map an appointment status to the corresponding work order status, if any."""
    key = activity._status_val(appointment_status)
    if not key:
        return None
    return APPOINTMENT_TO_WORK_ORDER_STATUS.get(key)


def sync_work_order_status_from_appointment(
    db: Session,
    appointment: WorkOrderAppointment,
    user_id: uuid.UUID,
    *,
    previous_appointment_status: Optional[str] = None,
) -> bool:
    """
    Update the parent work order status when an appointment status changes.

    Returns True if the work order status was updated.
    """
    new_appt_status = activity._status_val(appointment.status)
    if previous_appointment_status is not None:
        prev_appt_status = activity._status_val(previous_appointment_status)
        if prev_appt_status == new_appt_status:
            return False

    target_wo_status = resolve_work_order_status_for_appointment(new_appt_status)
    if not target_wo_status:
        return False

    work_order = appointment.work_order
    if work_order is None:
        work_order = (
            db.query(WorkOrder)
            .filter(WorkOrder.id == appointment.work_order_id)
            .first()
        )
    if not work_order:
        return False

    if getattr(work_order, "is_closed", False):
        return False

    current_wo_status = activity._status_val(work_order.status)
    if current_wo_status in WO_STATUSES_SKIP_APPOINTMENT_SYNC:
        return False

    if current_wo_status == target_wo_status:
        return False

    appt_label = activity._status_val(new_appt_status)
    note = (
        f"Status synced from appointment ({appt_label} → {target_wo_status})"
    )
    if appt_label == "failed":
        note = "Status synced from appointment APR → waiting on parts"

    return apply_work_order_status_change(
        db,
        work_order,
        target_wo_status,
        user_id,
        notes=note,
    )
