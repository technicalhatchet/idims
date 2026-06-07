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

# Phase 2: completion / payment — synced after billing flags are applied
COMPLETION_APPOINTMENT_STATUSES = frozenset({
    "completed",
    "completed_pending_payment",
    "phone_payment",
})

# Visit done / awaiting payment → job board pending payment.
# ``completed`` on appointments is only set by the payment flow, not manual updates.
PHASE2_DIRECT_APPOINTMENT_TO_WO: Dict[str, str] = {
    "completed": "completed_pending_payment",
    "completed_pending_payment": "completed_pending_payment",
    "phone_payment": "completed_pending_payment",
}

# Office / terminal WO statuses — do not overwrite from a field visit update
WO_STATUSES_SKIP_APPOINTMENT_SYNC = frozenset({
    "cancelled",
    "refunded",
    "closed",
    "on_hold",
    "pending_estimate_approval",
})


def normalize_appointment_status_for_update(
    status: str,
    *,
    work_order_closed: bool = False,
) -> str:
    """
    Guard ``completed`` behind payment: manual updates become pending payment.
    Closed jobs may still set completed directly (admin/redo flows).
    """
    key = activity._status_val(status)
    if not key:
        return status
    if key == "completed" and not work_order_closed:
        return "completed_pending_payment"
    return key


def _resolve_canceled_work_order_status(
    db: Session,
    work_order_id: uuid.UUID,
    canceled_appointment_id: uuid.UUID,
) -> Optional[str]:
    """When the only active visit is canceled, the job needs rescheduling."""
    other_active = (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.work_order_id == work_order_id,
            WorkOrderAppointment.id != canceled_appointment_id,
            WorkOrderAppointment.status != "canceled",
        )
        .count()
    )
    return "reschedule" if other_active == 0 else None


def resolve_work_order_status_for_appointment(
    appointment_status: str,
    *,
    db: Optional[Session] = None,
    work_order: Optional[WorkOrder] = None,
    appointment_id: Optional[uuid.UUID] = None,
) -> Optional[str]:
    """Map an appointment status to the corresponding work order status, if any."""
    key = activity._status_val(appointment_status)
    if not key:
        return None

    if key in APPOINTMENT_TO_WORK_ORDER_STATUS:
        return APPOINTMENT_TO_WORK_ORDER_STATUS[key]

    if key in PHASE2_DIRECT_APPOINTMENT_TO_WO:
        return PHASE2_DIRECT_APPOINTMENT_TO_WO[key]

    if key == "canceled":
        if db is not None and work_order is not None and appointment_id is not None:
            return _resolve_canceled_work_order_status(
                db, work_order.id, appointment_id
            )
        return None

    return None


def _build_sync_note(appt_label: str, target_wo_status: str) -> str:
    if appt_label == "failed":
        return "Status synced from appointment APR → waiting on parts"
    if appt_label in ("completed", "completed_pending_payment") and target_wo_status == "completed_pending_payment":
        return "Status synced from appointment visit complete → completed pending payment"
    if appt_label == "phone_payment":
        return "Status synced from appointment phone payment → completed pending payment"
    return f"Status synced from appointment ({appt_label} → {target_wo_status})"


def sync_work_order_status_from_appointment(
    db: Session,
    appointment: WorkOrderAppointment,
    user_id: uuid.UUID,
    *,
    previous_appointment_status: Optional[str] = None,
    after_billing: bool = False,
) -> bool:
    """
    Update the parent work order status when an appointment status changes.

    Completion statuses (completed / payment) are resolved after billing updates
    unless ``after_billing=True``.

    Returns True if the work order status was updated.
    """
    new_appt_status = activity._status_val(appointment.status)
    if previous_appointment_status is not None:
        prev_appt_status = activity._status_val(previous_appointment_status)
        if prev_appt_status == new_appt_status and not after_billing:
            return False

    if new_appt_status in COMPLETION_APPOINTMENT_STATUSES and not after_billing:
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

    target_wo_status = resolve_work_order_status_for_appointment(
        new_appt_status,
        db=db,
        work_order=work_order,
        appointment_id=appointment.id,
    )
    if not target_wo_status:
        return False

    if getattr(work_order, "is_closed", False):
        return False

    current_wo_status = activity._status_val(work_order.status)
    if current_wo_status in WO_STATUSES_SKIP_APPOINTMENT_SYNC:
        return False

    if current_wo_status == target_wo_status:
        return False

    appt_label = activity._status_val(new_appt_status)
    note = _build_sync_note(appt_label, target_wo_status)

    return apply_work_order_status_change(
        db,
        work_order,
        target_wo_status,
        user_id,
        notes=note,
    )
