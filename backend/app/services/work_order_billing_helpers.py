"""Customer-facing billing math aligned with the work order invoice tab (frontend)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.models.work_order import WorkOrder
from app.services.work_order_completion_service import (
    has_outstanding_billable_skus,
    has_unpaid_scheduled_repair,
)

PART_BILLABLE_STATUSES = frozenset({
    "phone_payment",
    "paid_not_installed",
    "upfront_50",
    "installed",
})

PART_DUE_STATUSES = frozenset({
    "phone_payment",
    "upfront_50",
    "installed",
    "paid_not_installed",
})

REPAIR_COMPLETE_APPOINTMENT_STATUSES = frozenset({
    "completed",
    "completed_pending_payment",
})


def _decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _status_str(status: Any) -> str:
    if hasattr(status, "value"):
        return str(status.value).lower()
    return str(status).lower()


def _service_line_total(item: Any) -> Decimal:
    if getattr(item, "price", None) is not None:
        return _decimal(item.price)
    if getattr(item, "total_price", None) is not None:
        return _decimal(item.total_price)
    return Decimal("0")


def has_completed_repair_appointment(work_order: WorkOrder) -> bool:
    for appt in work_order.appointments or []:
        if appt.appointment_type == "repair" and _status_str(appt.status) in REPAIR_COMPLETE_APPOINTMENT_STATUSES:
            return True
    return False


def has_repair_sku_on_order(work_order: WorkOrder) -> bool:
    for item in work_order.service_items or []:
        service_type = None
        if getattr(item, "service", None) is not None:
            raw = getattr(item.service, "service_type", None)
            service_type = raw.value if hasattr(raw, "value") else raw
        if service_type == "repair":
            return True
        if "repair" in (item.name or "").lower():
            return True
    return False


def diagnostic_discount_amount(work_order: WorkOrder, *, half: bool = False) -> Decimal:
    if not has_repair_sku_on_order(work_order):
        return Decimal("0")
    raw = _decimal(work_order.diagnostic_discount_amount)
    if raw <= 0:
        return Decimal("0")
    if half:
        return (raw / Decimal("2")).quantize(Decimal("0.01"))
    return raw


def compute_net_invoice_total(work_order: WorkOrder) -> Decimal:
    """
    Total after diagnostic discount (when repair visit completed) and tax on parts only.
    Matches frontend computeWorkOrderDueToday().totalWorkOrder.
    """
    tax_rate = _decimal(work_order.tax_rate or 0)

    services_subtotal = sum(
        (_service_line_total(item) for item in (work_order.service_items or [])),
        Decimal("0"),
    )

    parts_subtotal = Decimal("0")
    for part in work_order.parts or []:
        if part.price is not None and part.status in PART_BILLABLE_STATUSES:
            parts_subtotal += _decimal(part.price)

    tax_on_parts = (parts_subtotal * tax_rate).quantize(Decimal("0.01"))

    discount = Decimal("0")
    if has_completed_repair_appointment(work_order):
        discount = diagnostic_discount_amount(work_order)

    return (services_subtotal + parts_subtotal + tax_on_parts - discount).quantize(Decimal("0.01"))


def compute_balance_due(work_order: WorkOrder) -> Decimal:
    """
    Remaining amount owed (due today). Matches frontend dueToday when no half-discount toggle.
    """
    tax_rate = _decimal(work_order.tax_rate or 0)

    billable_services = sum(
        (
            _service_line_total(item)
            for item in (work_order.service_items or [])
            if getattr(item, "billing_status", None) == "billable"
        ),
        Decimal("0"),
    )

    billable_parts = Decimal("0")
    for part in work_order.parts or []:
        if part.price is not None and part.status in PART_DUE_STATUSES:
            billable_parts += _decimal(part.price)

    tax_on_billable_parts = (billable_parts * tax_rate).quantize(Decimal("0.01"))
    previously_paid = _decimal(work_order.amount_previously_paid)

    discount = Decimal("0")
    if has_completed_repair_appointment(work_order):
        discount = diagnostic_discount_amount(work_order)

    due = billable_services + billable_parts + tax_on_billable_parts - previously_paid - discount
    return max(Decimal("0"), due).quantize(Decimal("0.01"))


def is_work_order_paid_in_full(work_order: WorkOrder) -> bool:
    """True when nothing billable remains and balance due is zero."""
    if has_outstanding_billable_skus(work_order):
        return False
    if has_unpaid_scheduled_repair(work_order):
        return False
    return compute_balance_due(work_order) <= Decimal("0.01")
