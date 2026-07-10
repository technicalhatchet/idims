"""Auto-complete work orders when all billable SKUs are paid (Phase 2d)."""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.work_order import (
    WorkOrder,
    WorkOrderService as WorkOrderServiceModel,
    WorkOrderStatusHistory,
)

logger = logging.getLogger(__name__)

CLOSED_WORK_ORDER_STATUSES = frozenset({"completed", "canceled", "closed"})


def _is_repair_service_line(item: WorkOrderServiceModel) -> bool:
    service_type = None
    if item.service is not None:
        raw = getattr(item.service, "service_type", None)
        service_type = raw.value if hasattr(raw, "value") else raw
    if service_type == "repair":
        return True
    return "repair" in (item.name or "").lower()


def has_outstanding_billable_skus(work_order: WorkOrder) -> bool:
    """True when any service line is still awaiting payment."""
    return any(item.billing_status == "billable" for item in (work_order.service_items or []))


def _appointment_status_str(appointment) -> str:
    raw = getattr(appointment, "status", None)
    if hasattr(raw, "value"):
        return str(raw.value).lower()
    return str(raw or "").lower()


def _repair_line_awaiting_visit(work_order: WorkOrder, item: WorkOrderServiceModel) -> bool:
    """
    True when a not_billable repair SKU still belongs to an open visit.

    Canceled visits waive their SKUs; completed diagnostics with a canceled repair
    attempt must not block close.
    """
    appointments = work_order.appointments or []
    appointments_by_id = {a.id: a for a in appointments}

    appt_id = getattr(item, "appointment_id", None)
    if appt_id and appt_id in appointments_by_id:
        return _appointment_status_str(appointments_by_id[appt_id]) in {
            "scheduled",
            "reschedule",
            "en_route",
            "in_progress",
        }

    return any(
        _appointment_status_str(appt) in {"scheduled", "reschedule", "en_route", "in_progress"}
        for appt in appointments
    )


def has_unpaid_scheduled_repair(work_order: WorkOrder) -> bool:
    """
    True when a repair SKU exists on the order but has not been paid yet and still
    belongs to a scheduled/open visit.
    """
    return any(
        _is_repair_service_line(item)
        and item.billing_status == "not_billable"
        and _repair_line_awaiting_visit(work_order, item)
        for item in (work_order.service_items or [])
    )


def is_work_order_financially_closed(work_order: WorkOrder) -> bool:
    """
    Work order is financially closed when nothing is billable and no unpaid repair
    SKU remains scheduled on the order.
    """
    if has_outstanding_billable_skus(work_order):
        return False
    if has_unpaid_scheduled_repair(work_order):
        return False
    return True


def work_order_needs_repair_outcome(db: Session, work_order_id: uuid.UUID) -> bool:
    from app.services.dma_service import get_outcome_for_work_order

    return get_outcome_for_work_order(db, work_order_id) is None


def load_work_order_for_completion_check(db: Session, work_order_id: uuid.UUID) -> Optional[WorkOrder]:
    return (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.service_items).joinedload(WorkOrderServiceModel.service),
            joinedload(WorkOrder.parts),
            joinedload(WorkOrder.appointments),
        )
        .filter(WorkOrder.id == work_order_id)
        .first()
    )


def try_auto_complete_after_payment(
    db: Session,
    work_order: WorkOrder,
    *,
    user_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """
    After payment, optionally mark the work order completed and report whether a
    Repair Outcome note is still missing.
    """
    from app.services import work_order_activity_service as activity
    from app.services.work_order_performance_service import handle_work_order_status_timing

    result = {
        "work_order_completed": False,
        "needs_repair_outcome": False,
    }

    actor_id = user_id or work_order.updated_by or work_order.created_by
    if not actor_id:
        return result

    if getattr(work_order, "is_closed", False) or work_order.status in CLOSED_WORK_ORDER_STATUSES:
        result["needs_repair_outcome"] = work_order_needs_repair_outcome(db, work_order.id)
        return result

    if not is_work_order_financially_closed(work_order):
        logger.info(
            "Work order %s not auto-completed: billable_skus=%s unpaid_repair=%s",
            work_order.id,
            has_outstanding_billable_skus(work_order),
            has_unpaid_scheduled_repair(work_order),
        )
        return result

    previous_status = activity._status_val(work_order.status)
    work_order.status = "completed"
    work_order.updated_by = actor_id
    work_order.updated_at = datetime.utcnow()
    if not work_order.actual_end:
        work_order.actual_end = datetime.utcnow()

    db.add(
        WorkOrderStatusHistory(
            work_order_id=work_order.id,
            previous_status=previous_status or "",
            new_status="completed",
            changed_by=actor_id,
            notes="Auto-completed after all SKUs paid",
        )
    )
    activity.log_work_order_status_changed(
        db,
        work_order.id,
        actor_id,
        previous_status,
        "completed",
    )
    handle_work_order_status_timing(
        db,
        work_order=work_order,
        previous_status=previous_status,
        user_id=actor_id,
    )

    result["work_order_completed"] = True
    result["needs_repair_outcome"] = work_order_needs_repair_outcome(db, work_order.id)
    logger.info(
        "Work order %s auto-completed after payment (needs_repair_outcome=%s)",
        work_order.id,
        result["needs_repair_outcome"],
    )
    return result
