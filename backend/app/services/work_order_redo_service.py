"""Create redo child work orders from parent appointments marked redo."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.dma import DmaRepairOutcome
from app.models.service import Service
from app.models.work_order import (
    WorkOrder,
    WorkOrderAppointment,
    WorkOrderNote,
    WorkOrderService as WorkOrderServiceModel,
    appointment_services_association,
)
from app.services import work_order_activity_service as activity
from app.services.work_order_lifecycle_service import apply_work_order_status_change
from app.services.work_order_service import WorkOrderService


def _service_type(service: Service) -> Optional[str]:
    raw = getattr(service, "service_type", None)
    return raw.value if hasattr(raw, "value") else raw


def _build_redo_summary_note(parent: WorkOrder, dma: Optional[DmaRepairOutcome]) -> str:
    lines = [f"Redo of {parent.order_number}"]
    if dma:
        if dma.technician_summary:
            lines.append(f"DMA summary: {dma.technician_summary}")
        if dma.replaced_parts:
            lines.append(f"Parts (reference only): {dma.replaced_parts}")
        if dma.confirmed_fix:
            lines.append(f"Confirmed fix: {dma.confirmed_fix}")
    return "\n".join(lines)


async def create_redo_from_appointment(
    db: Session,
    *,
    parent_work_order_id: uuid.UUID,
    appointment_id: uuid.UUID,
    user_id: uuid.UUID,
    scheduled_start: Optional[datetime] = None,
    scheduled_end: Optional[datetime] = None,
    time_window: Optional[str] = None,
) -> Dict[str, Any]:
    parent = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.appointments).joinedload(WorkOrderAppointment.services),
            joinedload(WorkOrder.service_items).joinedload(WorkOrderServiceModel.service),
        )
        .filter(WorkOrder.id == parent_work_order_id)
        .first()
    )
    if not parent:
        raise NotFoundException(f"Work order {parent_work_order_id} not found")

    appointment = next((a for a in parent.appointments if a.id == appointment_id), None)
    if not appointment:
        raise NotFoundException(f"Appointment {appointment_id} not found on this work order")

    if activity._status_val(appointment.status) != "redo":
        raise ValidationException("Appointment must be marked redo before creating a redo work order.")

    existing_child = (
        db.query(WorkOrder)
        .filter(WorkOrder.redo_source_appointment_id == appointment_id)
        .first()
    )
    if existing_child:
        raise ConflictException(
            f"A redo work order already exists for this appointment ({existing_child.order_number})."
        )

    dma = (
        db.query(DmaRepairOutcome)
        .filter(DmaRepairOutcome.work_order_id == parent.id)
        .first()
    )
    if dma:
        dma.callback_required = True

    summary_note = _build_redo_summary_note(parent, dma)
    child_data = {
        "client_id": parent.client_id,
        "description": summary_note,
        "priority": parent.priority,
        "created_by": user_id,
        "service_location": parent.service_location,
        "equipment_make": parent.equipment_make,
        "equipment_model": parent.equipment_model,
        "equipment_serial": parent.equipment_serial,
        "equipment_version": parent.equipment_version,
        "equipment_type": parent.equipment_type,
        "equipment_subtype": parent.equipment_subtype,
        "is_wall_mounted": parent.is_wall_mounted,
        "equipment_notes": parent.equipment_notes,
        "symptoms": parent.symptoms,
        "assigned_technician_id": appointment.assigned_technician_id or parent.assigned_technician_id,
    }

    child = await WorkOrderService.create_work_order(db, child_data, commit=False)
    child.parent_work_order_id = parent.id
    child.is_redo = True
    child.redo_source_appointment_id = appointment.id
    child.status = "pending"

    db.add(
        WorkOrderNote(
            work_order_id=child.id,
            user_id=user_id,
            note=summary_note,
            is_private=True,
        )
    )

    service_ids: list = [s.id for s in appointment.services]
    if not service_ids:
        for line in parent.service_items:
            if line.appointment_id == appointment.id and line.service_id:
                service_ids.append(line.service_id)

    start = scheduled_start or (datetime.utcnow() + timedelta(days=1)).replace(
        hour=14, minute=0, second=0, microsecond=0
    )
    end = scheduled_end or (start + timedelta(hours=1))

    child_appt = WorkOrderAppointment(
        work_order_id=child.id,
        appointment_type=appointment.appointment_type or "repair",
        scheduled_start=start,
        scheduled_end=end,
        assigned_technician_id=appointment.assigned_technician_id or parent.assigned_technician_id,
        status="scheduled",
        created_by=user_id,
        time_window=time_window or appointment.time_window,
    )
    db.add(child_appt)
    db.flush()

    for service_id in set(service_ids):
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            continue
        db.execute(
            appointment_services_association.insert().values(
                appointment_id=child_appt.id,
                service_id=service_id,
            )
        )
        stype = _service_type(service)
        billing_status = "waived" if stype == "diagnostic" else "not_billable"
        unit = Decimal(str(service.base_price or 0))
        db.add(
            WorkOrderServiceModel(
                work_order_id=child.id,
                service_id=service.id,
                appointment_id=child_appt.id,
                name=service.name,
                quantity=1,
                unit_price=unit,
                price=unit,
                billing_status=billing_status,
                notes="Cloned from redo visit" if billing_status == "waived" else None,
            )
        )

    activity.log_work_order_activity(
        db,
        work_order_id=parent.id,
        user_id=user_id,
        event_type="redo_work_order_created",
        headline=f"Redo work order {child.order_number} created",
        actor_label="Created by",
        metadata={
            "child_work_order_id": str(child.id),
            "child_order_number": child.order_number,
            "source_appointment_id": str(appointment.id),
        },
    )

    if activity._status_val(parent.status) != "redo":
        apply_work_order_status_change(
            db,
            parent,
            "redo",
            user_id,
            notes=f"Redo child work order {child.order_number} created",
        )

    db.commit()
    db.refresh(child)
    db.refresh(child_appt)
    await WorkOrderService._schedule_notifications(db, child)

    return {
        "parent_work_order_id": str(parent.id),
        "child_work_order_id": str(child.id),
        "child_order_number": child.order_number,
        "child_appointment_id": str(child_appt.id),
        "badge_label": f"Redo of {parent.order_number}",
    }
