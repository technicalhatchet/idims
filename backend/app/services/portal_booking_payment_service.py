"""Portal booking prepayment: trip line + WorkOrderPayment (Square already captured)."""

from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.service import Service
from app.models.work_order import WorkOrder, WorkOrderService as WorkOrderServiceModel
from app.models.work_order_payment import WorkOrderPayment
from app.services.work_order_payment_service import (
    _generate_payment_number,
    apply_payment_to_work_order,
)

logger = logging.getLogger(__name__)

PORTAL_BOOKING_PAYMENT_NOTES = "Portal booking — diagnostic prepayment"


def work_order_has_trip_charge_line(db: Session, work_order_id: uuid.UUID) -> bool:
    """True if any TRIP-* SKU line exists on the work order."""
    return (
        db.query(WorkOrderServiceModel)
        .join(Service, WorkOrderServiceModel.service_id == Service.id)
        .filter(
            WorkOrderServiceModel.work_order_id == work_order_id,
            Service.sku_code.like("TRIP-%"),
        )
        .count()
        > 0
    )


def ensure_trip_line_from_pricing_snapshot(
    db: Session,
    work_order: WorkOrder,
    pricing_snapshot: Optional[dict],
    *,
    appointment_id: Optional[uuid.UUID] = None,
) -> None:
    """Add trip charge line when prepayment included trip; never duplicates TRIP-* lines."""
    if work_order_has_trip_charge_line(db, work_order.id):
        return

    snapshot = pricing_snapshot or {}
    trip = snapshot.get("trip_charge") or {}
    amount = trip.get("amount")
    if amount is None:
        return

    zone_key = (trip.get("zone_key") or "custom").lower()
    if zone_key == "custom" and trip.get("is_custom"):
        zone_key = "custom"

    from app.services.zone_service import get_zone_service

    zone_service = get_zone_service(db)
    zone_service.add_trip_charge_to_work_order(
        work_order_id=work_order.id,
        zone_key=zone_key,
        trip_charge=float(amount),
        appointment_id=appointment_id,
    )


def _existing_portal_booking_payment(
    db: Session, work_order_id: uuid.UUID, square_payment_id: str
) -> Optional[WorkOrderPayment]:
    return (
        db.query(WorkOrderPayment)
        .filter(
            WorkOrderPayment.work_order_id == work_order_id,
            WorkOrderPayment.reference_number == square_payment_id,
        )
        .first()
    )


def record_portal_booking_prepayment(
    db: Session,
    work_order: WorkOrder,
    payment_meta: Optional[dict],
    actor_id: uuid.UUID,
) -> Optional[WorkOrderPayment]:
    """Persist Square portal prepayment on work_order_payments (idempotent by square_payment_id)."""
    if not payment_meta:
        return None
    square_id = payment_meta.get("square_payment_id")
    if not square_id:
        return None

    existing = _existing_portal_booking_payment(db, work_order.id, square_id)
    if existing:
        return existing

    amount = float(payment_meta.get("amount") or 0)
    if amount < 0.01:
        return None

    payment = WorkOrderPayment(
        work_order_id=work_order.id,
        payment_number=_generate_payment_number(db),
        amount=amount,
        subtotal_amount=amount,
        tax_amount=0,
        tax_rate_snapshot=work_order.tax_rate,
        payment_method="credit_card",
        reference_number=square_id,
        notes=PORTAL_BOOKING_PAYMENT_NOTES,
        recorded_by=actor_id,
    )
    db.add(payment)
    apply_payment_to_work_order(
        db,
        work_order,
        amount,
        tax_amount=0,
        mark_billable_services_paid=False,
        user_id=actor_id,
    )
    db.flush()
    logger.info(
        "Recorded portal booking prepayment %s on work order %s",
        square_id,
        work_order.id,
    )
    return payment


def finalize_portal_booking_checkout(
    db: Session,
    work_order: WorkOrder,
    *,
    pricing_snapshot: Optional[dict],
    payment_meta: Optional[dict],
    actor_id: uuid.UUID,
    appointment_id: Optional[uuid.UUID] = None,
) -> None:
    """Trip line (if charged) + WorkOrderPayment; safe to call on rebook/confirm."""
    ensure_trip_line_from_pricing_snapshot(
        db,
        work_order,
        pricing_snapshot,
        appointment_id=appointment_id,
    )
    record_portal_booking_prepayment(db, work_order, payment_meta, actor_id)


def work_order_has_portal_prepayment(db: Session, work_order: WorkOrder) -> bool:
    meta = work_order.portal_scheduling_meta or {}
    if (meta.get("payment") or {}).get("square_payment_id"):
        return True
    return (
        db.query(WorkOrderPayment)
        .filter(
            WorkOrderPayment.work_order_id == work_order.id,
            WorkOrderPayment.notes == PORTAL_BOOKING_PAYMENT_NOTES,
        )
        .count()
        > 0
    )
