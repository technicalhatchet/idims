import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.models.work_order import (
    WorkOrder,
    WorkOrderAppointment,
    WorkOrderPart,
    WorkOrderService as WorkOrderServiceModel,
)

# Settled at checkout but keep installed/upfront_50 for close disposition (installed | not_installed).
PART_STATUSES_MARK_PAID_ON_CHECKOUT = frozenset({"installed", "upfront_50"})
from app.services.work_order_completion_service import try_auto_complete_after_payment
from app.models.work_order_payment import WorkOrderPayment
from app.models.user import User
from app.schemas.work_order_payment import RecordWorkOrderPaymentRequest

logger = logging.getLogger(__name__)


def _generate_payment_number(db: Session) -> str:
    prefix = f"WOP-{datetime.utcnow().strftime('%Y%m%d')}"
    count = (
        db.query(WorkOrderPayment)
        .filter(WorkOrderPayment.payment_number.like(f"{prefix}%"))
        .count()
    )
    return f"{prefix}-{count + 1:04d}"


def complete_pending_payment_appointments(
    db: Session,
    work_order_id: uuid.UUID,
    *,
    user_id: Optional[uuid.UUID] = None,
) -> int:
    """
    After payment, move appointments from completed_pending_payment → completed.
    Does not change work order status (order may stay open for future visits).
    """
    from app.services import work_order_activity_service as activity
    from app.services.work_order_performance_service import handle_appointment_status_timing

    pending = (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.work_order_id == work_order_id,
            WorkOrderAppointment.status == "completed_pending_payment",
        )
        .all()
    )
    if not pending:
        return 0

    for appointment in pending:
        previous_status = activity._status_val(appointment.status)
        appointment.status = "completed"
        appointment.updated_at = datetime.utcnow()
        if user_id:
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
                new_status="completed",
                scheduled_start=appointment.scheduled_start,
            )
        logger.info(
            "Appointment %s completed after payment (was %s)",
            appointment.id,
            previous_status,
        )

    return len(pending)


def mark_billable_parts_paid_after_checkout(db: Session, work_order: WorkOrder) -> int:
    """
    After a lump-sum payment, align part collection fields with services marked paid.
    Status stays installed/upfront_50 so close readiness (disposition) is unchanged.
    """
    tax_rate = float(work_order.tax_rate or 0.0775)
    parts = (
        db.query(WorkOrderPart)
        .filter(
            WorkOrderPart.work_order_id == work_order.id,
            WorkOrderPart.status.in_(PART_STATUSES_MARK_PAID_ON_CHECKOUT),
        )
        .all()
    )
    for part in parts:
        price = float(part.price or 0)
        part.amount_upfront_collected = price
        part.tax_collected = round(price * tax_rate, 2)
        part.updated_at = datetime.utcnow()
        logger.info(
            "Part %s marked paid at checkout (status=%s, collected=%s)",
            part.id,
            part.status,
            price,
        )
    return len(parts)


def apply_payment_to_work_order(
    db: Session,
    work_order: WorkOrder,
    amount: float,
    *,
    tax_amount: float = 0,
    mark_billable_services_paid: bool = True,
    user_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Same financial updates as Stripe successful payment."""
    work_order.amount_previously_paid = Decimal(str(work_order.amount_previously_paid or 0)) + Decimal(
        str(amount)
    )
    if tax_amount:
        work_order.tax_collected = Decimal(str(work_order.tax_collected or 0)) + Decimal(str(tax_amount))

    if mark_billable_services_paid:
        billable_services = (
            db.query(WorkOrderServiceModel)
            .filter(
                WorkOrderServiceModel.work_order_id == work_order.id,
                WorkOrderServiceModel.billing_status == "billable",
            )
            .all()
        )
        for service in billable_services:
            service.billing_status = "paid"
            logger.info("Marked service %s as paid", service.id)
        mark_billable_parts_paid_after_checkout(db, work_order)

    complete_pending_payment_appointments(
        db, work_order.id, user_id=user_id or work_order.updated_by or work_order.created_by
    )
    work_order.calculate_totals()
    db.flush()
    return try_auto_complete_after_payment(
        db,
        work_order,
        user_id=user_id or work_order.updated_by or work_order.created_by,
    )


def record_work_order_payment(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    data: RecordWorkOrderPaymentRequest,
) -> Tuple[WorkOrderPayment, Dict[str, Any]]:
    work_order = (
        db.query(WorkOrder)
        .options(joinedload(WorkOrder.service_items).joinedload(WorkOrderServiceModel.service))
        .filter(WorkOrder.id == work_order_id)
        .first()
    )
    if not work_order:
        raise ValueError("Work order not found")

    tax_amount = float(data.tax_amount or 0)
    subtotal = data.subtotal_amount
    if subtotal is None:
        subtotal = max(0, float(data.amount) - tax_amount)

    payment = WorkOrderPayment(
        work_order_id=work_order_id,
        payment_number=_generate_payment_number(db),
        amount=data.amount,
        subtotal_amount=subtotal,
        tax_amount=tax_amount,
        tax_rate_snapshot=work_order.tax_rate,
        payment_method=data.payment_method,
        reference_number=data.reference_number,
        notes=data.notes,
        recorded_by=user_id,
    )
    db.add(payment)

    completion = apply_payment_to_work_order(
        db,
        work_order,
        float(data.amount),
        tax_amount=tax_amount,
        user_id=user_id,
    )

    db.flush()
    return payment, completion


def list_work_order_payments(db: Session, work_order_id: uuid.UUID) -> List[dict]:
    rows = (
        db.query(WorkOrderPayment, User)
        .outerjoin(User, WorkOrderPayment.recorded_by == User.id)
        .filter(WorkOrderPayment.work_order_id == work_order_id)
        .order_by(WorkOrderPayment.payment_date.desc())
        .all()
    )
    items = []
    for payment, user in rows:
        items.append(
            {
                "id": payment.id,
                "work_order_id": payment.work_order_id,
                "payment_number": payment.payment_number,
                "amount": float(payment.amount),
                "subtotal_amount": float(payment.subtotal_amount) if payment.subtotal_amount is not None else None,
                "tax_amount": float(payment.tax_amount or 0),
                "tax_rate_snapshot": float(payment.tax_rate_snapshot) if payment.tax_rate_snapshot is not None else None,
                "payment_method": payment.payment_method,
                "reference_number": payment.reference_number,
                "notes": payment.notes,
                "payment_date": payment.payment_date,
                "recorded_by": payment.recorded_by,
                "recorder_name": f"{user.first_name} {user.last_name}".strip() if user else None,
            }
        )
    return items


async def record_square_work_order_payment(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    amount: float,
    tax_amount: float,
    square_source_id: str,
    payment_idempotency_key: Optional[str] = None,
    half_diagnostic_discount: bool = False,
) -> Tuple[WorkOrderPayment, Dict[str, Any]]:
    from app.core.exceptions import ValidationException
    from app.services.portal_square_payment_service import charge_square_payment
    from app.services.work_order_billing_helpers import compute_balance_due

    work_order = (
        db.query(WorkOrder)
        .options(
            joinedload(WorkOrder.service_items).joinedload(WorkOrderServiceModel.service),
            joinedload(WorkOrder.parts),
            joinedload(WorkOrder.appointments),
        )
        .filter(WorkOrder.id == work_order_id)
        .first()
    )
    if not work_order:
        raise ValueError("Work order not found")

    expected_due = float(
        compute_balance_due(work_order, half_diagnostic_discount=half_diagnostic_discount)
    )
    if expected_due < 0.01:
        raise ValidationException("Nothing is due on this work order.")
    if abs(amount - expected_due) > 0.02:
        raise ValidationException(
            f"Payment amount must match balance due (${expected_due:.2f}). Refresh and try again."
        )

    wo_ref = (work_order.order_number or str(work_order_id))[:40]
    square_result = await charge_square_payment(
        db,
        amount=amount,
        source_id=square_source_id,
        idempotency_key=payment_idempotency_key,
        reference=wo_ref,
    )

    subtotal = max(0.0, float(amount) - float(tax_amount or 0))
    payment = WorkOrderPayment(
        work_order_id=work_order_id,
        payment_number=_generate_payment_number(db),
        amount=amount,
        subtotal_amount=subtotal,
        tax_amount=tax_amount or 0,
        tax_rate_snapshot=work_order.tax_rate,
        payment_method="credit_card",
        reference_number=square_result.get("square_payment_id"),
        notes="Square online payment",
        recorded_by=user_id,
    )
    db.add(payment)

    completion = apply_payment_to_work_order(
        db,
        work_order,
        float(amount),
        tax_amount=float(tax_amount or 0),
        user_id=user_id,
    )

    db.flush()
    return payment, {**completion, "square": square_result}
