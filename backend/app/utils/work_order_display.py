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
