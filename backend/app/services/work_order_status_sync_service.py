"""Sync work order and appointment statuses (field visit ↔ job board)."""

from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import Dict, List, Optional, Sequence

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
    "canceled",
    "refunded",
    "closed",
    "on_hold",
    "pending_estimate_approval",
})

# When a visit is scheduled, promote the job board from these statuses only.
WO_STATUSES_PROMOTE_TO_SCHEDULED = frozenset({
    "pending",
    "reschedule",
})

# Phase 3: manual work order status → appointment updates (office / dispatch)
WO_STATUSES_SYNC_TO_APPOINTMENTS = frozenset({
    "reschedule",
    "canceled",
    "en_route",
    "in_progress",
})

# Parts / contact queue statuses intentionally do not change visits (office-only signal).
WO_STATUSES_LEAVE_APPOINTMENTS_UNCHANGED = frozenset({
    "waiting_on_parts",
    "parts_on_order",
    "need_to_contact",
})

APPOINTMENT_TERMINAL_STATUSES = frozenset({
    "completed",
    "completed_pending_payment",
    "canceled",
    "refund",
    "redo",
})

# When a work order is canceled, also cancel active field visits (even if not "future").
WO_CANCEL_ACTIVE_VISIT_STATUSES = frozenset({"en_route", "in_progress"})

FIELD_APPOINTMENT_TARGET_BY_WO = {
    "en_route": "en_route",
    "in_progress": "in_progress",
}


def _calendar_day_bounds_utc(day: datetime) -> tuple[datetime, datetime]:
    d = day.date()
    start = datetime.combine(d, time.min)
    end = datetime.combine(d, time(23, 59, 59, 999999))
    return start, end


def _active_appointments_for_work_order(
    db: Session,
    work_order_id: uuid.UUID,
) -> List[WorkOrderAppointment]:
    return (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.work_order_id == work_order_id,
            WorkOrderAppointment.status != "canceled",
        )
        .order_by(WorkOrderAppointment.scheduled_start.asc())
        .all()
    )


def _future_appointments(
    appointments: Sequence[WorkOrderAppointment],
    *,
    now: Optional[datetime] = None,
) -> List[WorkOrderAppointment]:
    now = now or datetime.utcnow()
    return [a for a in appointments if a.scheduled_start and a.scheduled_start > now]


def _appointments_to_cancel_on_work_order_cancel(
    appointments: Sequence[WorkOrderAppointment],
    *,
    now: Optional[datetime] = None,
) -> List[WorkOrderAppointment]:
    """Future non-terminal visits plus any en route / in progress visit."""
    now = now or datetime.utcnow()
    to_cancel: List[WorkOrderAppointment] = []
    seen_ids: set = set()
    for appt in appointments:
        st = activity._status_val(appt.status)
        if st in APPOINTMENT_TERMINAL_STATUSES:
            continue
        if appt.id in seen_ids:
            continue
        if st in WO_CANCEL_ACTIVE_VISIT_STATUSES:
            to_cancel.append(appt)
            seen_ids.add(appt.id)
            continue
        if appt.scheduled_start and appt.scheduled_start > now:
            to_cancel.append(appt)
            seen_ids.add(appt.id)
    return to_cancel


def _today_appointments(
    appointments: Sequence[WorkOrderAppointment],
    *,
    now: Optional[datetime] = None,
) -> List[WorkOrderAppointment]:
    now = now or datetime.utcnow()
    day_start, day_end = _calendar_day_bounds_utc(now)
    return [
        a
        for a in appointments
        if a.scheduled_start and day_start <= a.scheduled_start <= day_end
    ]


def _pick_driver_appointment_today(
    appointments: Sequence[WorkOrderAppointment],
    *,
    now: Optional[datetime] = None,
) -> Optional[WorkOrderAppointment]:
    today = _today_appointments(appointments, now=now)
    if not today:
        return None

    for preferred in ("in_progress", "en_route", "scheduled", "reschedule"):
        for appt in today:
            if activity._status_val(appt.status) == preferred:
                return appt

    for appt in today:
        if activity._status_val(appt.status) not in APPOINTMENT_TERMINAL_STATUSES:
            return appt
    return None


def _apply_appointment_status_change(
    db: Session,
    appointment: WorkOrderAppointment,
    new_status: str,
    user_id: uuid.UUID,
    *,
    work_order_id: uuid.UUID,
    sync_note: str,
) -> bool:
    previous_status = activity._status_val(appointment.status)
    if previous_status == new_status:
        return False

    appointment.status = new_status
    appointment.updated_at = datetime.utcnow()
    appointment.updated_by = user_id
    db.add(appointment)

    from app.services.work_order_performance_service import handle_appointment_status_timing

    handle_appointment_status_timing(
        db,
        appointment=appointment,
        previous_status=previous_status,
        user_id=user_id,
    )
    activity.log_appointment_status_changed(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        previous_status=previous_status,
        new_status=new_status,
        scheduled_start=appointment.scheduled_start,
    )
    return True


def sync_appointments_from_work_order_status(
    db: Session,
    work_order: WorkOrder,
    user_id: uuid.UUID,
    *,
    previous_work_order_status: str,
    new_work_order_status: str,
) -> int:
    """
    Phase 3: propagate a manual work order status change to the relevant visit(s).

    Returns the number of appointments updated.
    """
    prev_wo = activity._status_val(previous_work_order_status)
    new_wo = activity._status_val(new_work_order_status)
    if not new_wo or prev_wo == new_wo:
        return 0

    if new_wo in WO_STATUSES_LEAVE_APPOINTMENTS_UNCHANGED:
        return 0

    if new_wo not in WO_STATUSES_SYNC_TO_APPOINTMENTS:
        return 0

    if getattr(work_order, "is_closed", False):
        return 0

    appointments = _active_appointments_for_work_order(db, work_order.id)
    if not appointments:
        return 0

    now = datetime.utcnow()
    updated = 0

    if new_wo == "reschedule":
        future = _future_appointments(appointments, now=now)
        if not future:
            return 0
        target = future[0]
        if _apply_appointment_status_change(
            db,
            target,
            "reschedule",
            user_id,
            work_order_id=work_order.id,
            sync_note="Status synced from work order reschedule",
        ):
            updated += 1
        return updated

    if new_wo == "canceled":
        for appt in _appointments_to_cancel_on_work_order_cancel(appointments, now=now):
            if _apply_appointment_status_change(
                db,
                appt,
                "canceled",
                user_id,
                work_order_id=work_order.id,
                sync_note="Status synced from work order canceled",
            ):
                updated += 1
        return updated

    if new_wo in FIELD_APPOINTMENT_TARGET_BY_WO:
        driver = _pick_driver_appointment_today(appointments, now=now)
        if not driver:
            return 0
        target_status = FIELD_APPOINTMENT_TARGET_BY_WO[new_wo]
        if activity._status_val(driver.status) in APPOINTMENT_TERMINAL_STATUSES:
            return 0
        if _apply_appointment_status_change(
            db,
            driver,
            target_status,
            user_id,
            work_order_id=work_order.id,
            sync_note=f"Status synced from work order {new_wo}",
        ):
            updated += 1
        return updated

    return updated


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

    if key == "scheduled" and work_order is not None:
        if activity._status_val(work_order.status) in WO_STATUSES_PROMOTE_TO_SCHEDULED:
            return "scheduled"

    return None


def _build_sync_note(appt_label: str, target_wo_status: str) -> str:
    if appt_label == "failed":
        return "Status synced from appointment APR → waiting on parts"
    if appt_label in ("completed", "completed_pending_payment") and target_wo_status == "completed_pending_payment":
        return "Status synced from appointment visit complete → completed pending payment"
    if appt_label == "phone_payment":
        return "Status synced from appointment phone payment → completed pending payment"
    if appt_label == "scheduled" and target_wo_status == "scheduled":
        return "Status synced from appointment scheduled → work order scheduled"
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
