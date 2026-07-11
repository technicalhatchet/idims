"""Job economics: expenses, receipts, mileage, P&L, property history."""

from __future__ import annotations

import logging
from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.constants.expense_categories import EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS
from app.models.job_economics import (
    AppointmentMileage,
    ExpenseReceipt,
    ExpenseVendor,
    WorkOrderExpense,
)
from app.models.property import Property
from app.models.work_order import WorkOrder, WorkOrderAppointment, WorkOrderPart
from app.models.work_order_payment import WorkOrderPayment
from app.models.dma import DmaRepairOutcome
from app.config import settings
from app.services.google_drive_service import (
    build_receipt_filename,
    download_drive_file_bytes,
    drive_unavailable_reason,
    save_receipt_locally,
    upload_receipt_to_drive,
)

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")


def _dec(value) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(str(value))


def list_vendors(db: Session) -> List[ExpenseVendor]:
    return (
        db.query(ExpenseVendor)
        .filter(ExpenseVendor.is_active.is_(True))
        .order_by(ExpenseVendor.name.asc())
        .all()
    )


def list_expenses(db: Session, work_order_id: UUID) -> List[WorkOrderExpense]:
    return (
        db.query(WorkOrderExpense)
        .options(joinedload(WorkOrderExpense.vendor))
        .filter(WorkOrderExpense.work_order_id == work_order_id)
        .order_by(WorkOrderExpense.expense_date.desc(), WorkOrderExpense.created_at.desc())
        .all()
    )


def create_expense(
    db: Session, work_order_id: UUID, data: dict, user_id: UUID
) -> WorkOrderExpense:
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise ValueError("Work order not found")
    row = WorkOrderExpense(
        work_order_id=work_order_id,
        category=data["category"],
        amount=data["amount"],
        vendor_id=data.get("vendor_id"),
        vendor_name=data.get("vendor_name"),
        description=data.get("description"),
        expense_date=data.get("expense_date") or date.today(),
        created_by=user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_expense(db: Session, expense_id: UUID, data: dict) -> WorkOrderExpense:
    row = db.query(WorkOrderExpense).filter(WorkOrderExpense.id == expense_id).first()
    if not row:
        raise ValueError("Expense not found")
    for key, value in data.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def delete_expense(db: Session, expense_id: UUID) -> None:
    row = db.query(WorkOrderExpense).filter(WorkOrderExpense.id == expense_id).first()
    if not row:
        raise ValueError("Expense not found")
    db.delete(row)
    db.commit()


def list_receipts(db: Session, work_order_id: UUID) -> List[ExpenseReceipt]:
    return (
        db.query(ExpenseReceipt)
        .filter(ExpenseReceipt.work_order_id == work_order_id)
        .order_by(ExpenseReceipt.created_at.desc())
        .all()
    )


def get_receipt(db: Session, receipt_id: UUID) -> ExpenseReceipt:
    row = db.query(ExpenseReceipt).filter(ExpenseReceipt.id == receipt_id).first()
    if not row:
        raise ValueError("Receipt not found")
    return row


def read_receipt_bytes(row: ExpenseReceipt) -> tuple[bytes, str]:
    """Load receipt file bytes and mime type from Drive or local disk."""
    mime = row.mime_type or "application/octet-stream"

    if row.storage_backend == "drive" and row.drive_file_id:
        content = download_drive_file_bytes(row.drive_file_id)
        if not content:
            raise ValueError(drive_unavailable_reason() or "Could not download receipt from Google Drive")
        return content, mime

    if not row.local_path:
        raise ValueError("Receipt file path not found")

    path = Path(row.local_path)
    if not path.is_file():
        raise ValueError("Receipt file not found on server")

    return path.read_bytes(), mime


def save_receipt(
    db: Session,
    *,
    work_order_id: UUID,
    user_id: UUID,
    file_bytes: bytes,
    original_filename: str,
    mime_type: str,
    expense_id: Optional[UUID] = None,
    category: str = "misc",
    vendor_name: str = "receipt",
) -> ExpenseReceipt:
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise ValueError("Work order not found")

    expense_date = date.today()
    if expense_id:
        exp = db.query(WorkOrderExpense).filter(WorkOrderExpense.id == expense_id).first()
        if exp:
            category = exp.category
            vendor_name = exp.vendor_name or (exp.vendor.name if exp.vendor else "vendor")
            expense_date = exp.expense_date

    order_number = wo.order_number or str(work_order_id)[:8]
    filename = build_receipt_filename(order_number, category, vendor_name, expense_date, original_filename)
    year = expense_date.year

    drive_result = upload_receipt_to_drive(
        file_bytes=file_bytes,
        filename=filename,
        mime_type=mime_type,
        order_number=order_number,
        year=year,
    )

    if drive_result:
        file_id, link, folder_id = drive_result
        logger.info("Receipt %s uploaded to Google Drive for WO %s", filename, order_number)
        row = ExpenseReceipt(
            work_order_id=work_order_id,
            expense_id=expense_id,
            filename=filename,
            mime_type=mime_type,
            file_size=len(file_bytes),
            storage_backend="drive",
            drive_file_id=file_id,
            drive_web_view_link=link,
            drive_folder_id=folder_id,
            uploaded_by=user_id,
        )
    else:
        local_path = save_receipt_locally(
            file_bytes=file_bytes,
            filename=filename,
            order_number=order_number,
            year=year,
        )
        logger.info(
            "Receipt %s stored locally for WO %s at %s (%s)",
            filename,
            order_number,
            local_path,
            drive_unavailable_reason(),
        )
        row = ExpenseReceipt(
            work_order_id=work_order_id,
            expense_id=expense_id,
            filename=filename,
            mime_type=mime_type,
            file_size=len(file_bytes),
            storage_backend="local",
            local_path=local_path,
            uploaded_by=user_id,
        )

    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_mileage_for_work_order(db: Session, work_order_id: UUID) -> List[AppointmentMileage]:
    return (
        db.query(AppointmentMileage)
        .filter(AppointmentMileage.work_order_id == work_order_id)
        .all()
    )


def get_mileage_for_appointment(db: Session, appointment_id: UUID) -> Optional[AppointmentMileage]:
    return db.query(AppointmentMileage).filter(AppointmentMileage.appointment_id == appointment_id).first()


def upsert_appointment_mileage(
    db: Session, appointment_id: UUID, data: dict, user_id: UUID
) -> AppointmentMileage:
    appt = db.query(WorkOrderAppointment).filter(WorkOrderAppointment.id == appointment_id).first()
    if not appt:
        raise ValueError("Appointment not found")

    miles = _dec(data.get("miles", 0))
    method = data.get("method") or "estimated"
    if method == "odometer" and data.get("odometer_start") is not None and data.get("odometer_end") is not None:
        miles = _dec(data["odometer_end"]) - _dec(data["odometer_start"])
        if miles < 0:
            miles = ZERO

    row = get_mileage_for_appointment(db, appointment_id)
    if row:
        row.method = method
        row.miles = miles
        row.odometer_start = data.get("odometer_start")
        row.odometer_end = data.get("odometer_end")
        row.notes = data.get("notes")
        row.updated_at = datetime.utcnow()
    else:
        row = AppointmentMileage(
            appointment_id=appointment_id,
            work_order_id=appt.work_order_id,
            method=method,
            miles=miles,
            odometer_start=data.get("odometer_start"),
            odometer_end=data.get("odometer_end"),
            notes=data.get("notes"),
            created_by=user_id,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _customer_paid(db: Session, wo: WorkOrder) -> Decimal:
    payments = (
        db.query(WorkOrderPayment)
        .filter(WorkOrderPayment.work_order_id == wo.id)
        .all()
    )
    if payments:
        return sum(_dec(p.amount) for p in payments)
    if wo.amount_previously_paid:
        return _dec(wo.amount_previously_paid)
    if wo.invoice_total:
        return _dec(wo.invoice_total)
    return ZERO


def _parts_cost(db: Session, work_order_id: UUID) -> Decimal:
    parts = db.query(WorkOrderPart).filter(WorkOrderPart.work_order_id == work_order_id).all()
    return sum(_dec(p.cost) for p in parts)


def _other_expenses(db: Session, work_order_id: UUID) -> Decimal:
    rows = db.query(WorkOrderExpense).filter(WorkOrderExpense.work_order_id == work_order_id).all()
    return sum(_dec(r.amount) for r in rows)


def _mileage_for_work_order(db: Session, work_order_id: UUID) -> Decimal:
    rows = db.query(AppointmentMileage).filter(AppointmentMileage.work_order_id == work_order_id).all()
    return sum(_dec(r.miles) for r in rows)


def compute_job_economics(db: Session, work_order_id: UUID) -> dict:
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        raise ValueError("Work order not found")

    rate = _dec(getattr(settings, "MILEAGE_RATE_PER_MILE", 0.67))
    customer_paid = _customer_paid(db, wo)
    parts_cost = _parts_cost(db, work_order_id)
    other_expenses = _other_expenses(db, work_order_id)
    mileage_miles = _mileage_for_work_order(db, work_order_id)
    mileage_cost = (mileage_miles * rate).quantize(Decimal("0.01"))
    estimated_net = customer_paid - parts_cost - other_expenses - mileage_cost

    line_items = [
        {"label": "Customer paid", "amount": customer_paid},
        {"label": "Parts cost", "amount": parts_cost},
        {"label": "Other expenses", "amount": other_expenses},
        {"label": f"Mileage ({mileage_miles} mi × ${rate})", "amount": mileage_cost},
        {"label": "Est. net", "amount": estimated_net},
    ]

    return {
        "work_order_id": wo.id,
        "order_number": wo.order_number,
        "customer_paid": customer_paid,
        "parts_cost": parts_cost,
        "other_expenses": other_expenses,
        "mileage_miles": mileage_miles,
        "mileage_cost": mileage_cost,
        "mileage_rate": rate,
        "estimated_net": estimated_net,
        "line_items": line_items,
        "disclaimer": (
            "Parts cost is summed from part cost fields on the Equipment tab. "
            "Job expenses are for non-parts costs only (fuel, parking, tolls, etc.) — "
            "do not log parts purchases here or they will be counted twice. "
            "Operational estimate only — not tax advice."
        ),
    }


def monthly_economics_report(db: Session, year: int, month: int) -> dict:
    start = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    end = date(year, month, last_day)
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())

    payments = (
        db.query(WorkOrderPayment)
        .filter(WorkOrderPayment.payment_date >= start_dt, WorkOrderPayment.payment_date <= end_dt)
        .all()
    )
    revenue = sum(_dec(p.amount) for p in payments)

    expenses = (
        db.query(WorkOrderExpense)
        .options(joinedload(WorkOrderExpense.vendor))
        .filter(WorkOrderExpense.expense_date >= start, WorkOrderExpense.expense_date <= end)
        .all()
    )
    other_expenses = sum(_dec(e.amount) for e in expenses)

    by_category: dict[str, Decimal] = {}
    for e in expenses:
        by_category[e.category] = by_category.get(e.category, ZERO) + _dec(e.amount)

    vendor_totals: dict[str, Decimal] = {}
    for e in expenses:
        label = e.vendor_name or (e.vendor.name if e.vendor else "Unknown")
        if e.vendor_id and e.vendor:
            label = e.vendor.name
        vendor_totals[label] = vendor_totals.get(label, ZERO) + _dec(e.amount)

    mileage_rows = (
        db.query(AppointmentMileage)
        .filter(AppointmentMileage.created_at >= start_dt, AppointmentMileage.created_at <= end_dt)
        .all()
    )
    mileage_miles = sum(_dec(m.miles) for m in mileage_rows)
    rate = _dec(getattr(settings, "MILEAGE_RATE_PER_MILE", 0.67))
    mileage_cost = (mileage_miles * rate).quantize(Decimal("0.01"))

    part_rows = (
        db.query(WorkOrderPart)
        .join(WorkOrder, WorkOrderPart.work_order_id == WorkOrder.id)
        .filter(WorkOrder.created_at >= start_dt, WorkOrder.created_at <= end_dt)
        .all()
    )
    parts_cost = sum(_dec(p.cost) for p in part_rows)

    estimated_net = revenue - parts_cost - other_expenses - mileage_cost

    return {
        "period_start": start,
        "period_end": end,
        "revenue_collected": revenue,
        "parts_cost": parts_cost,
        "other_expenses": other_expenses,
        "mileage_miles": mileage_miles,
        "mileage_cost": mileage_cost,
        "estimated_net": estimated_net,
        "expenses_by_category": [
            {"label": EXPENSE_CATEGORY_LABELS.get(k, k), "amount": v}
            for k, v in sorted(by_category.items(), key=lambda x: -x[1])
        ],
        "top_vendors": [
            {"label": k, "amount": v}
            for k, v in sorted(vendor_totals.items(), key=lambda x: -x[1])[:10]
        ],
    }


def property_service_history(db: Session, property_id: UUID) -> dict:
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise ValueError("Property not found")

    orders = (
        db.query(WorkOrder)
        .options(joinedload(WorkOrder.dma_outcome))
        .filter(WorkOrder.property_id == property_id)
        .order_by(WorkOrder.created_at.desc())
        .all()
    )

    items = []
    for wo in orders:
        paid = _customer_paid(db, wo)
        outcome: Optional[DmaRepairOutcome] = wo.dma_outcome
        resolution = None
        if outcome:
            resolution = outcome.confirmed_fix or outcome.technician_summary
        items.append(
            {
                "work_order_id": wo.id,
                "order_number": wo.order_number,
                "completed_at": wo.updated_at if wo.status == "completed" else wo.created_at,
                "equipment_make": wo.equipment_make,
                "equipment_model": wo.equipment_model,
                "equipment_subtype": wo.equipment_subtype,
                "description": wo.description,
                "resolution_summary": resolution,
                "amount_collected": paid if paid > 0 else None,
                "status": wo.status,
            }
        )

    return {
        "property_id": prop.id,
        "address": prop.address,
        "items": items,
    }


def expense_categories_payload() -> list:
    return [{"slug": slug, "label": EXPENSE_CATEGORY_LABELS[slug]} for slug in EXPENSE_CATEGORIES]
