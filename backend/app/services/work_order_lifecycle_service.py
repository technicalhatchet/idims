"""Administrative close / reopen and mutation guards for work orders."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.work_order import WorkOrder, WorkOrderPart, WorkOrderStatusHistory
from app.services import work_order_activity_service as activity
from app.services.dma_service import get_outcome_for_work_order
from app.services.work_order_billing_helpers import (
    compute_balance_due,
    compute_net_invoice_total,
    is_work_order_paid_in_full,
)
from app.services.work_order_completion_service import load_work_order_for_completion_check

PARTS_CLOSE_STATUSES = frozenset({"installed", "not_installed"})

CLOSED_APPOINTMENT_STATUS_ONLY = frozenset({
    "redo",
    "refund",
    "completed",
})

IMMUTABLE_WO_STATUSES = frozenset({"cancelled", "refunded"})


def _decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def all_parts_dispositioned(work_order: WorkOrder) -> bool:
    """Every part line must be installed or not_installed (or there are no parts)."""
    parts = work_order.parts or []
    if not parts:
        return True
    return all(p.status in PARTS_CLOSE_STATUSES for p in parts)


def build_close_readiness(db: Session, work_order_id: uuid.UUID) -> Dict[str, Any]:
    work_order = (
        db.query(WorkOrder)
        .options(joinedload(WorkOrder.parts))
        .filter(WorkOrder.id == work_order_id)
        .first()
    )
    if not work_order:
        raise NotFoundException(f"Work order with ID {work_order_id} not found")

    wo_for_billing = load_work_order_for_completion_check(db, work_order_id) or work_order
    dma = get_outcome_for_work_order(db, work_order_id)

    checks = {
        "has_dma_outcome": dma is not None,
        "parts_dispositioned": all_parts_dispositioned(work_order),
        "paid_in_full": is_work_order_paid_in_full(wo_for_billing),
        "status_completed": work_order.status == "completed",
        "not_already_closed": not work_order.is_closed,
        "not_immutable_status": work_order.status not in IMMUTABLE_WO_STATUSES,
    }
    blockers: List[str] = []
    if work_order.is_closed:
        blockers.append("Work order is already closed.")
    if work_order.status in IMMUTABLE_WO_STATUSES:
        blockers.append(f"Work order status is {work_order.status}.")
    if not checks["status_completed"]:
        blockers.append("Work order must be completed before closing.")
    if not checks["has_dma_outcome"]:
        blockers.append("DMA repair outcome is required.")
    if not checks["parts_dispositioned"]:
        blockers.append("All parts must be marked installed or not installed.")
    if not checks["paid_in_full"]:
        blockers.append("Work order must be paid in full with no outstanding billable SKUs.")

    return {
        "work_order_id": str(work_order_id),
        "is_closed": work_order.is_closed,
        "can_close": len(blockers) == 0,
        "blockers": blockers,
        "checks": checks,
        "snapshot_preview": {
            "invoice_total": float(compute_net_invoice_total(wo_for_billing)),
            "amount_previously_paid": float(_decimal(work_order.amount_previously_paid)),
            "balance_due": float(compute_balance_due(wo_for_billing)),
            "diagnostic_discount": float(_decimal(work_order.diagnostic_discount_amount)),
            "order_number": work_order.order_number,
        },
    }


def apply_work_order_status_change(
    db: Session,
    work_order: WorkOrder,
    new_status: str,
    user_id: uuid.UUID,
    *,
    notes: str,
) -> bool:
    """Apply a work order status change with history, metrics, and activity log."""
    previous_status = activity._status_val(work_order.status)
    if previous_status == new_status:
        return False
    _set_work_order_status(db, work_order, new_status, user_id, notes=notes)
    return True


def _set_work_order_status(
    db: Session,
    work_order: WorkOrder,
    new_status: str,
    user_id: uuid.UUID,
    *,
    notes: str,
) -> None:
    previous_status = activity._status_val(work_order.status)
    if previous_status == new_status:
        return

    work_order.status = new_status
    work_order.updated_by = user_id
    work_order.updated_at = datetime.utcnow()

    db.add(
        WorkOrderStatusHistory(
            work_order_id=work_order.id,
            previous_status=previous_status or "",
            new_status=new_status,
            changed_by=user_id,
            notes=notes,
        )
    )

    from app.services.work_order_performance_service import handle_work_order_status_timing

    handle_work_order_status_timing(
        db,
        work_order=work_order,
        previous_status=previous_status,
        user_id=user_id,
    )
    activity.log_work_order_status_changed(
        db,
        work_order_id=work_order.id,
        user_id=user_id,
        previous_status=previous_status,
        new_status=new_status,
    )


def _apply_close_flags(db: Session, work_order: WorkOrder, user_id: uuid.UUID) -> None:
    _set_work_order_status(
        db,
        work_order,
        "closed",
        user_id,
        notes="Administratively closed",
    )
    work_order.is_closed = True
    work_order.closed_at = datetime.utcnow()
    work_order.closed_by = user_id


def close_work_order(db: Session, work_order_id: uuid.UUID, user_id: uuid.UUID) -> WorkOrder:
    readiness = build_close_readiness(db, work_order_id)
    if not readiness["can_close"]:
        raise ValidationException("; ".join(readiness["blockers"]))

    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        raise NotFoundException(f"Work order with ID {work_order_id} not found")

    _apply_close_flags(db, work_order, user_id)
    activity.log_order_closed(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        invoice_total=float(_decimal(work_order.invoice_total)),
        amount_previously_paid=float(_decimal(work_order.amount_previously_paid)),
        order_number=work_order.order_number,
    )
    return work_order


def reopen_work_order(db: Session, work_order_id: uuid.UUID, user_id: uuid.UUID) -> WorkOrder:
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        raise NotFoundException(f"Work order with ID {work_order_id} not found")
    if not work_order.is_closed:
        raise ValidationException("Work order is not closed.")
    if work_order.is_redo:
        raise ValidationException("Redo child work orders cannot be reopened from the parent flow.")

    work_order.is_closed = False
    work_order.closed_at = None
    work_order.closed_by = None
    _set_work_order_status(
        db,
        work_order,
        "completed",
        user_id,
        notes="Reopened for admin edits",
    )

    activity.log_order_reopened(db, work_order_id=work_order_id, user_id=user_id)
    return work_order


def reclose_work_order(db: Session, work_order_id: uuid.UUID, user_id: uuid.UUID) -> WorkOrder:
    readiness = build_close_readiness(db, work_order_id)
    if not readiness["can_close"]:
        raise ValidationException("; ".join(readiness["blockers"]))

    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        raise NotFoundException(f"Work order with ID {work_order_id} not found")

    _apply_close_flags(db, work_order, user_id)
    activity.log_order_reclosed(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        order_number=work_order.order_number,
        invoice_total=float(_decimal(work_order.invoice_total)),
        amount_previously_paid=float(_decimal(work_order.amount_previously_paid)),
    )
    return work_order


def assert_work_order_mutable(work_order: WorkOrder, *, field_keys: Optional[List[str]] = None) -> None:
    if work_order.status in IMMUTABLE_WO_STATUSES:
        raise ConflictException(f"Cannot modify work order with status {work_order.status}")
    if work_order.is_closed or activity._status_val(work_order.status) == "closed":
        raise ConflictException("Work order is closed. Reopen (admin) to edit billing, parts, or scheduling.")


def assert_appointment_update_allowed(
    work_order: WorkOrder,
    update_keys: set,
    new_status: Optional[str] = None,
) -> None:
    if not work_order.is_closed:
        return
    if update_keys == {"status"} and new_status in CLOSED_APPOINTMENT_STATUS_ONLY:
        return
    raise ConflictException(
        "Closed work orders only allow appointment status changes to redo, refund, or completed."
    )
