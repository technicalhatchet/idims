import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.work_order import (
    WorkOrder,
    WorkOrderAppointment,
    WorkOrderService as WorkOrderServiceModel,
)
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


def apply_payment_to_work_order(
    db: Session,
    work_order: WorkOrder,
    amount: float,
    *,
    tax_amount: float = 0,
    mark_billable_services_paid: bool = True,
    user_id: Optional[uuid.UUID] = None,
) -> None:
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

    complete_pending_payment_appointments(
        db, work_order.id, user_id=user_id or work_order.updated_by or work_order.created_by
    )
    work_order.calculate_totals()


def record_work_order_payment(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    data: RecordWorkOrderPaymentRequest,
) -> WorkOrderPayment:
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
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

    apply_payment_to_work_order(
        db,
        work_order,
        float(data.amount),
        tax_amount=tax_amount,
        user_id=user_id,
    )

    db.flush()
    return payment


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
