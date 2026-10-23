"""Diagnostic credit mode (half vs full) and half-credit rounding."""

from decimal import Decimal
from unittest.mock import MagicMock

from app.services.work_order_billing_helpers import (
    compute_balance_due,
    diagnostic_credit_dollars,
    diagnostic_discount_amount,
)


def test_half_credit_rounds_up_to_whole_dollars():
    assert diagnostic_credit_dollars(Decimal("89"), mode="half") == Decimal("45")
    assert diagnostic_credit_dollars(Decimal("89"), mode="full") == Decimal("89.00")
    assert diagnostic_credit_dollars(Decimal("90"), mode="half") == Decimal("45")


def test_diagnostic_discount_amount_reads_work_order_mode():
    wo = MagicMock()
    wo.diagnostic_discount_amount = Decimal("89")
    wo.diagnostic_credit_mode = "half"
    wo.service_items = [
        MagicMock(
            billing_status="repair",
            price=Decimal("128"),
            name="Repair",
            service=MagicMock(service_type="repair"),
        )
    ]
    assert diagnostic_discount_amount(wo) == Decimal("45")

    wo.diagnostic_credit_mode = "full"
    assert diagnostic_discount_amount(wo) == Decimal("89")


def test_ct001020_half_mode_due_after_prepaid():
    from tests.test_compute_balance_due_paid_lines import _ct001020_work_order

    wo = _ct001020_work_order(amount_previously_paid=89.0)
    wo.diagnostic_credit_mode = "half"
    assert compute_balance_due(wo) == Decimal("83.00")
