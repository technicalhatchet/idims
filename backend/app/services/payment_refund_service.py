"""Record processor refunds on work orders (provider-neutral).

Every card path stores the processor's payment id in WorkOrderPayment.reference_number
(pay link, portal, portal Pay All, TechDeck Enter card, booking prepay, Tap to Pay).
A refund finds those rows by that id and adds a negative WorkOrderPayment per work order.

What a refund changes:
  - amount_previously_paid and tax_collected go down, so the balance due goes back up.
  - Line items, visit and work order statuses are NOT changed. Use the visit "Refund"
    status as before when the work itself should stop being billable.

Square calls this from its webhook today; a future Stripe (or other) adapter passes its
own ids and label — nothing here is Square-specific.
"""

from __future__ import annotations

import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder
from app.models.work_order_payment import WorkOrderPayment

logger = logging.getLogger(__name__)

CENT = Decimal("0.01")


def _d(value: Any) -> Decimal:
    return Decimal(str(value or 0))


def _already_refunded(db: Session, original: WorkOrderPayment) -> Decimal:
    """Sum of earlier refund rows that point at this original payment row."""
    rows = (
        db.query(WorkOrderPayment)
        .filter(
            WorkOrderPayment.work_order_id == original.work_order_id,
            WorkOrderPayment.amount < 0,
            WorkOrderPayment.notes.like(f"%[refund-of {original.payment_number}]%"),
        )
        .all()
    )
    return -sum((_d(r.amount) for r in rows), Decimal("0"))


def record_processor_refund(
    db: Session,
    *,
    processor_payment_id: str,
    refund_id: str,
    refund_cents: int,
    processor_label: str = "Square",
) -> Dict[str, Any]:
    """Apply a COMPLETED refund once. Returns what was recorded (or why not)."""
    from app.services.work_order_payment_service import _generate_payment_number

    if not processor_payment_id or not refund_id or refund_cents <= 0:
        return {"recorded": False, "reason": "missing refund details"}

    if db.query(WorkOrderPayment.id).filter(WorkOrderPayment.reference_number == refund_id).first():
        return {"recorded": False, "reason": "already recorded"}

    originals: List[WorkOrderPayment] = (
        db.query(WorkOrderPayment)
        .filter(
            WorkOrderPayment.reference_number == processor_payment_id,
            WorkOrderPayment.amount > 0,
        )
        .order_by(WorkOrderPayment.payment_date.asc(), WorkOrderPayment.created_at.asc())
        .all()
    )
    if not originals:
        return {"recorded": False, "reason": "payment not in IDIMS"}

    # Lock every work order involved (one charge can cover several via portal Pay All).
    wo_ids = sorted({o.work_order_id for o in originals}, key=str)
    for wo_id in wo_ids:
        db.query(WorkOrder.id).filter(WorkOrder.id == wo_id).with_for_update().first()
    if db.query(WorkOrderPayment.id).filter(WorkOrderPayment.reference_number == refund_id).first():
        return {"recorded": False, "reason": "already recorded"}

    remaining = (Decimal(refund_cents) / 100).quantize(CENT)
    applied: List[Dict[str, Any]] = []

    for original in originals:
        if remaining <= 0:
            break
        refundable = _d(original.amount) - _already_refunded(db, original)
        if refundable <= 0:
            continue
        portion = min(remaining, refundable)
        remaining -= portion

        tax_share = Decimal("0")
        if _d(original.amount) > 0 and _d(original.tax_amount) > 0:
            tax_share = (_d(original.tax_amount) * portion / _d(original.amount)).quantize(CENT, ROUND_HALF_UP)

        work_order = db.query(WorkOrder).filter(WorkOrder.id == original.work_order_id).first()
        row = WorkOrderPayment(
            work_order_id=original.work_order_id,
            payment_number=_generate_payment_number(db),
            amount=-portion,
            subtotal_amount=-(portion - tax_share),
            tax_amount=-tax_share,
            tax_rate_snapshot=original.tax_rate_snapshot,
            payment_method=original.payment_method,
            reference_number=refund_id,
            notes=f"Refund — {processor_label} [refund-of {original.payment_number}]",
            recorded_by=original.recorded_by,
        )
        db.add(row)
        db.flush()  # next payment number sees this row

        if work_order is not None:
            work_order.amount_previously_paid = max(Decimal("0"), _d(work_order.amount_previously_paid) - portion)
            work_order.tax_collected = max(Decimal("0"), _d(work_order.tax_collected) - tax_share)
            try:
                work_order.calculate_totals()
            except Exception:  # totals are cosmetic here; the ledger row is what matters
                logger.debug("calculate_totals failed after refund on %s", work_order.id)

        applied.append(
            {
                "work_order_id": str(original.work_order_id),
                "order_number": getattr(work_order, "order_number", None),
                "amount": float(portion),
                "payment_number": row.payment_number,
            }
        )

    if remaining > 0:
        logger.warning(
            "[Refund] %s refund %s: $%s more than IDIMS recorded for payment %s",
            processor_label, refund_id, remaining, processor_payment_id,
        )

    db.flush()
    return {"recorded": bool(applied), "applied": applied, "unapplied": float(remaining)}
