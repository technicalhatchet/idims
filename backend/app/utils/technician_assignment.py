"""Shared technician assignment matching for work orders and appointments."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import and_, or_

from app.models.work_order import WorkOrder, WorkOrderAppointment


def appointment_matches_technician_filter(technician_id: uuid.UUID):
    """
    SQLAlchemy filter: appointment belongs to technician if assigned on the
    appointment row, or (when appointment tech is unset) on the parent work order.
    """
    return or_(
        WorkOrderAppointment.assigned_technician_id == technician_id,
        and_(
            WorkOrderAppointment.assigned_technician_id.is_(None),
            WorkOrder.assigned_technician_id == technician_id,
        ),
    )


def effective_technician_id(
    appointment: WorkOrderAppointment,
    work_order: Optional[WorkOrder] = None,
) -> Optional[uuid.UUID]:
    wo = work_order or getattr(appointment, "work_order", None)
    if appointment.assigned_technician_id:
        return appointment.assigned_technician_id
    if wo and wo.assigned_technician_id:
        return wo.assigned_technician_id
    return None
