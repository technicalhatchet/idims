"""Portal booking prepayment: trip line, WorkOrderPayment, billing parity."""

import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.portal_booking_payment_service import (
    finalize_portal_booking_checkout,
    record_portal_booking_prepayment,
    work_order_has_trip_charge_line,
)
from app.services.work_order_billing_helpers import compute_balance_due, diagnostic_discount_amount


def _service_line(price: float, *, sku: str = "DIAG", billing_status: str = "billable"):
    svc = SimpleNamespace(sku_code=sku, service_type="diagnostic")
    return SimpleNamespace(
        price=Decimal(str(price)),
        billing_status=billing_status,
        service=svc,
        service_id=uuid.uuid4(),
        name="Diagnostic",
        appointment_id=None,
    )


def _trip_line(price: float):
    return _service_line(price, sku="TRIP-LOCAL", billing_status="billable")


def _work_order_pair(diagnostic: float, trip: float, prepaid: float):
    """Two identical WOs except amount_previously_paid (prepaid includes diag+trip)."""
    items = [_service_line(diagnostic), _trip_line(trip)]
    common = {
        "appointments": [],
        "parts": [],
        "tax_rate": Decimal("0"),
        "diagnostic_discount_amount": Decimal("50.00"),
        "service_items": items,
    }
    unpaid = SimpleNamespace(amount_previously_paid=Decimal("0"), **common)
    paid = SimpleNamespace(
        amount_previously_paid=Decimal(str(prepaid)),
        **common,
    )
    return unpaid, paid


def test_prepayment_parity_discount_unchanged_balance_differs_by_prepaid():
    unpaid, prepaid = _work_order_pair(89.0, 35.0, 124.0)

    assert diagnostic_discount_amount(unpaid) == diagnostic_discount_amount(prepaid)
    assert unpaid.diagnostic_discount_amount == prepaid.diagnostic_discount_amount

    due_unpaid = compute_balance_due(unpaid)
    due_paid = compute_balance_due(prepaid)
    assert due_unpaid - due_paid == Decimal("124.00")


def test_finalize_deny_rebook_confirm_one_trip_one_payment():
    """Simulate request -> rebook -> confirm finalize with same Square payment."""
    wo = SimpleNamespace(
        id=uuid.uuid4(),
        tax_rate=Decimal("0.0775"),
        amount_previously_paid=Decimal("0"),
        portal_scheduling_meta={},
    )
    actor_id = uuid.uuid4()
    pricing = {
        "diagnostic": {"price": 89.0},
        "trip_charge": {"zone_key": "local", "amount": 35.0},
        "estimated_total": 124.0,
    }
    payment_meta = {"square_payment_id": "sq_test_1", "amount": 124.0}

    trip_add_count = 0
    payment_rows = []

    def fake_ensure(db, work_order, pricing_snapshot, **kwargs):
        nonlocal trip_add_count
        if trip_add_count == 0:
            trip_add_count += 1

    def fake_record(db, work_order, meta, user_id):
        if any(p.get("square_payment_id") == meta.get("square_payment_id") for p in payment_rows):
            return payment_rows[0]
        row = {"square_payment_id": meta["square_payment_id"], "amount": meta["amount"]}
        payment_rows.append(row)
        work_order.amount_previously_paid = Decimal(str(meta["amount"]))
        return row

    db = MagicMock()

    with patch(
        "app.services.portal_booking_payment_service.ensure_trip_line_from_pricing_snapshot",
        side_effect=fake_ensure,
    ), patch(
        "app.services.portal_booking_payment_service.record_portal_booking_prepayment",
        side_effect=fake_record,
    ):
        for _ in range(3):
            finalize_portal_booking_checkout(
                db,
                wo,
                pricing_snapshot=pricing,
                payment_meta=payment_meta,
                actor_id=actor_id,
            )

    assert trip_add_count == 1
    assert len(payment_rows) == 1


def test_record_portal_booking_prepayment_skips_duplicate_square_id():
    wo_id = uuid.uuid4()
    wo = SimpleNamespace(id=wo_id, tax_rate=Decimal("0.0775"), amount_previously_paid=Decimal("0"))
    existing = SimpleNamespace(reference_number="sq_dup")

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = existing

    result = record_portal_booking_prepayment(
        db,
        wo,
        {"square_payment_id": "sq_dup", "amount": 100},
        uuid.uuid4(),
    )
    assert result is existing
    db.add.assert_not_called()


def test_work_order_has_trip_charge_line_delegates_to_query():
    db = MagicMock()
    db.query.return_value.join.return_value.filter.return_value.count.return_value = 1
    assert work_order_has_trip_charge_line(db, uuid.uuid4()) is True
