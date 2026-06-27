"""
Derive list/schedule display fields when scheduling lives on WorkOrderAppointment
but work_orders.assigned_technician_id / scheduled_* are unset.
"""
from __future__ import annotations

from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.technician import Technician
from app.models.work_order import WorkOrderAppointment


def primary_appointments_by_work_order_ids(
    db: Session, work_order_ids: List[UUID]
) -> Dict[UUID, WorkOrderAppointment]:
    """Earliest non-canceled appointment per work order (by scheduled_start)."""
    if not work_order_ids:
        return {}
    rows = (
        db.query(WorkOrderAppointment)
        .options(
            joinedload(WorkOrderAppointment.technician).joinedload(Technician.user),
        )
        .filter(
            WorkOrderAppointment.work_order_id.in_(work_order_ids),
            WorkOrderAppointment.status != "canceled",
        )
        .order_by(
            WorkOrderAppointment.work_order_id,
            WorkOrderAppointment.scheduled_start.asc(),
        )
        .all()
    )
    out: Dict[UUID, WorkOrderAppointment] = {}
    for row in rows:
        if row.work_order_id not in out:
            out[row.work_order_id] = row
    return out


def technician_display_name_from_appointment(appt: WorkOrderAppointment) -> Optional[str]:
    if not appt.technician:
        return None
    return appt.technician.name


def resolve_technician_contact_for_work_order(
    db: Session, work_order
) -> Optional[Dict[str, str]]:
    """
    Technician name/phone/email for client-facing PDFs.

    Uses work_orders.assigned_technician_id when set; otherwise the earliest
    non-canceled appointment's assignee (same rule as list/schedule display).
    """
    technician_id = work_order.assigned_technician_id

    if not technician_id:
        primary = primary_appointments_by_work_order_ids(db, [work_order.id])
        appt = primary.get(work_order.id)
        if appt:
            technician_id = appt.assigned_technician_id

    if not technician_id:
        return None

    t = (
        db.query(Technician)
        .options(joinedload(Technician.user))
        .filter(Technician.id == technician_id)
        .first()
    )
    if not t:
        return None

    if t.user:
        name = f"{t.user.first_name or ''} {t.user.last_name or ''}".strip() or t.name
        return {
            "name": name or "—",
            "phone": t.user.phone or "",
            "email": t.user.email or "",
        }

    return {
        "name": t.name or "—",
        "phone": t.phone or "",
        "email": t.email or "",
    }
