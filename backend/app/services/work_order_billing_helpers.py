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

PAYMENT_READY_APPOINTMENT_STATUSES = frozenset({
    "phone_payment",
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


def _service_type_str(item: Any) -> str | None:
    if getattr(item, "service", None) is not None:
        raw = getattr(item.service, "service_type", None)
        return raw.value if hasattr(raw, "value") else raw
    return None


def is_repair_service_line(item: Any) -> bool:
    if _service_type_str(item) == "repair":
        return True
    return "repair" in (getattr(item, "name", None) or "").lower()


def _linked_service_ids_for_appointment(appt: Any) -> set:
    linked = set()
    for svc in getattr(appt, "services", None) or []:
        sid = getattr(svc, "id", None)
        if sid is not None:
            linked.add(sid)
    return linked


def appointment_has_repair_sku(work_order: WorkOrder, appointment: Any) -> bool:
    """True when this visit includes a repair SKU (catalog or work-order line)."""
    appt_id = getattr(appointment, "id", None)
    linked_service_ids = _linked_service_ids_for_appointment(appointment)

    for item in work_order.service_items or []:
        on_appt = getattr(item, "appointment_id", None) == appt_id
        if not on_appt and getattr(item, "service_id", None) in linked_service_ids:
            on_appt = True
        if on_appt and is_repair_service_line(item):
            return True

    for svc in getattr(appointment, "services", None) or []:
        raw = getattr(svc, "service_type", None)
        st = raw.value if hasattr(raw, "value") else raw
        if st == "repair":
            return True

    return False


def has_completed_repair_appointment(work_order: WorkOrder) -> bool:
    """
    True when a visit with repair SKU(s) reached a terminal paid-complete status.
    Replaces appointment_type == 'repair' (supports one-stop diag + repair visits).
    """
    for appt in work_order.appointments or []:
        if _status_str(appt.status) not in REPAIR_COMPLETE_APPOINTMENT_STATUSES:
            continue
        if appointment_has_repair_sku(work_order, appt):
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

    parts_subtotal = sum(
        (_decimal(part.price) for part in (work_order.parts or []) if part.price is not None),
        Decimal("0"),
    )

    taxable_parts = sum(
        (
            _decimal(part.price)
            for part in (work_order.parts or [])
            if part.price is not None and part.status not in {"not_installed"}
        ),
        Decimal("0"),
    )

    tax_on_parts = (taxable_parts * tax_rate).quantize(Decimal("0.01"))

    discount = Decimal("0")
    if has_completed_repair_appointment(work_order):
        discount = diagnostic_discount_amount(work_order)

    return (services_subtotal + parts_subtotal + tax_on_parts - discount).quantize(Decimal("0.01"))


def compute_balance_due(
    work_order: WorkOrder,
    *,
    half_diagnostic_discount: bool = False,
) -> Decimal:
    """
    Remaining amount owed (due today). Matches frontend dueToday (optional 50% discount toggle).
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
        discount = diagnostic_discount_amount(
            work_order,
            half=half_diagnostic_discount,
        )

    due = billable_services + billable_parts + tax_on_billable_parts - previously_paid - discount
    return max(Decimal("0"), due).quantize(Decimal("0.01"))


def is_work_order_paid_in_full(work_order: WorkOrder) -> bool:
    """True when nothing billable remains and balance due is zero."""
    if has_outstanding_billable_skus(work_order):
        return False
    if has_unpaid_scheduled_repair(work_order):
        return False
    return compute_balance_due(work_order) <= Decimal("0.01")


def work_order_services_for_appointment(db, work_order_id, appointment_id):
    """SKUs billed for a visit: linked via appointment_id and/or M2M association."""
    import uuid

    from sqlalchemy import or_
    from sqlalchemy.orm import joinedload

    from app.models.work_order import (
        WorkOrderAppointment,
        WorkOrderService as WorkOrderServiceModel,
        appointment_services_association,
    )

    if isinstance(work_order_id, uuid.UUID):
        wo_id = work_order_id
    else:
        wo_id = uuid.UUID(str(work_order_id))
    if isinstance(appointment_id, uuid.UUID):
        appt_id = appointment_id
    else:
        appt_id = uuid.UUID(str(appointment_id))

    linked_rows = db.execute(
        appointment_services_association.select().where(
            appointment_services_association.c.appointment_id == appt_id
        )
    ).fetchall()
    linked_service_ids = {row.service_id for row in linked_rows}

    appt = (
        db.query(WorkOrderAppointment)
        .options(joinedload(WorkOrderAppointment.services))
        .filter(WorkOrderAppointment.id == appt_id)
        .first()
    )
    if appt and appt.services:
        linked_service_ids.update(s.id for s in appt.services)

    clauses = [WorkOrderServiceModel.appointment_id == appt_id]
    if linked_service_ids:
        clauses.append(WorkOrderServiceModel.service_id.in_(linked_service_ids))

    return (
        db.query(WorkOrderServiceModel)
        .filter(
            WorkOrderServiceModel.work_order_id == wo_id,
            or_(*clauses),
        )
        .all()
    )


def apply_appointment_status_billing(
    db,
    *,
    work_order: WorkOrder,
    appointment_id,
    new_status: str,
) -> int:
    """
    Flip WorkOrderService billing_status when visit status changes.
    Returns count of line items updated.
    """
    from app.services import work_order_activity_service as activity

    status = activity._status_val(new_status)
    services = work_order_services_for_appointment(db, work_order.id, appointment_id)
    updated = 0

    if status in PAYMENT_READY_APPOINTMENT_STATUSES:
        for line in services:
            if line.billing_status == "not_billable":
                line.billing_status = "billable"
                if line.appointment_id is None:
                    line.appointment_id = appointment_id
                updated += 1
    elif status == "refund":
        if getattr(work_order, "is_closed", False):
            work_order.status = "refunded"
        else:
            for line in services:
                if line.billing_status == "paid":
                    line.billing_status = "billable"
                    updated += 1
                elif line.billing_status == "billable":
                    line.billing_status = "not_billable"
                    updated += 1
    elif status == "canceled":
        for line in services:
            if line.billing_status in ("billable", "not_billable"):
                line.billing_status = "waived"
                updated += 1
    else:
        for line in services:
            if line.billing_status == "billable":
                line.billing_status = "not_billable"
                updated += 1

    if updated:
        work_order.calculate_totals()
    return updated
