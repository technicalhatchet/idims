"""Public pay link (/pay/{token}): invoice view + Square charge for one work order.

The pay page is IDIMS-hosted (Square plan option A). It shows the same invoice the
PDF shows (``work_order_to_invoice``) and charges through the existing Square
Payments API path, so the payment is recorded the moment the charge succeeds.

Privacy: the token is the only credential, so the public payload leaves out the
shop address, customer email/phone and payment reference numbers. Once a job is
paid in full, the details stay visible for ``payment.pay_link_paid_visible_days``
(portal scheduling settings, default 7) and then the link only says "Paid".
"""

from __future__ import annotations

import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ValidationException
from app.models.work_order import WorkOrder, WorkOrderService as WorkOrderServiceModel
from app.utils.status_helpers import is_canceled_status

logger = logging.getLogger(__name__)

PAY_LINK_PAYMENT_NOTES = "Pay link — Square payment"

# 24 random bytes as hex = 48 chars (same shape as the SQL default).
_PAY_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{32,64}$")

# Square rejects charges under $1.00 (charge_square_payment enforces it too).
MIN_ONLINE_PAYMENT = 1.00

DEFAULT_PAID_VISIBLE_DAYS = 7


def new_pay_token() -> str:
    return secrets.token_hex(24)


def ensure_pay_token(db: Session, work_order: WorkOrder) -> str:
    """Give the work order a pay token if it doesn't have one yet (caller commits)."""
    if not work_order.pay_token:
        work_order.pay_token = new_pay_token()
        db.flush()
    return work_order.pay_token


def pay_link_base_url() -> str:
    """Origin + /pay. PAY_LINK_BASE_URL overrides (e.g. a Tailscale dev URL)."""
    override = (os.getenv("PAY_LINK_BASE_URL") or "").strip().rstrip("/")
    if override:
        return override
    from app.frontend_site_urls import build_frontend_url

    return build_frontend_url("/pay")


def pay_url_for_token(token: str) -> str:
    return f"{pay_link_base_url()}/{token}"


def _billing_query(db: Session):
    return db.query(WorkOrder).options(
        joinedload(WorkOrder.service_items).joinedload(WorkOrderServiceModel.service),
        joinedload(WorkOrder.parts),
        joinedload(WorkOrder.appointments),
    )


def load_work_order_by_pay_token(db: Session, token: str) -> Optional[WorkOrder]:
    if not token or not _PAY_TOKEN_RE.match(token):
        return None
    return _billing_query(db).filter(WorkOrder.pay_token == token).first()


def load_work_order_for_billing(db: Session, work_order_id: uuid.UUID) -> Optional[WorkOrder]:
    return _billing_query(db).filter(WorkOrder.id == work_order_id).first()


def amount_due(work_order: WorkOrder, db: Optional[Session] = None) -> float:
    """Same number TechDeck and the portal charge (compute_balance_due)."""
    from app.services.work_order_billing_helpers import compute_balance_due

    return float(compute_balance_due(work_order, db=db))


def pay_state(work_order: WorkOrder, due: float) -> str:
    """due | paid | canceled | call (balance under Square's $1 minimum)."""
    if is_canceled_status(work_order.status):
        return "canceled"
    if due < 0.01:
        return "paid"
    if due < MIN_ONLINE_PAYMENT:
        return "call"
    return "due"


def paid_visible_days(db: Session) -> int:
    from app.services.portal_scheduling_settings_service import get_portal_scheduling_settings

    payment = (get_portal_scheduling_settings(db) or {}).get("payment") or {}
    try:
        days = int(payment.get("pay_link_paid_visible_days", DEFAULT_PAID_VISIBLE_DAYS))
    except (TypeError, ValueError):
        days = DEFAULT_PAID_VISIBLE_DAYS
    return max(0, min(365, days))


def last_payment_at(db: Session, work_order: WorkOrder) -> Optional[datetime]:
    from app.models.work_order_payment import WorkOrderPayment

    return (
        db.query(func.max(WorkOrderPayment.payment_date))
        .filter(WorkOrderPayment.work_order_id == work_order.id)
        .scalar()
    )


def details_expired(db: Session, work_order: WorkOrder, state: str) -> bool:
    """Paid-in-full links stop showing details N days after the last payment."""
    if state != "paid":
        return False
    paid_at = last_payment_at(db, work_order) or work_order.updated_at
    if not paid_at:
        return False
    return datetime.utcnow() - paid_at > timedelta(days=paid_visible_days(db))


def _public_company(company: Dict[str, Any]) -> Dict[str, Any]:
    """Name, phone and email only — never the shop address."""
    company = company or {}
    return {
        "name": company.get("name"),
        "phone": company.get("phone"),
        "email": company.get("email"),
    }


def _public_invoice(db: Session, work_order: WorkOrder) -> Dict[str, Any]:
    """Invoice dict from the PDF pipeline, trimmed for a public page."""
    from app.services.work_order_invoice_pdf_data import (
        build_work_order_invoice_rd,
        enrich_document_pdf_payload,
        get_work_order_payment_ledger,
    )
    from pdf.work_order_adapter import work_order_to_invoice

    rd = build_work_order_invoice_rd(db, work_order)
    invoice = work_order_to_invoice(rd, notes=[], line_preset="full")
    invoice["payments"] = get_work_order_payment_ledger(db, work_order.id)
    enrich_document_pdf_payload(invoice, show_payment_message=True, show_technician=True)

    customer = invoice.get("customer") or {}
    technician = invoice.get("technician") or {}
    return {
        "invoice_number": invoice.get("invoice_number"),
        "date": invoice.get("date"),
        "company": _public_company(invoice.get("company")),
        # Service address stays (property managers need it); no customer email/phone.
        "customer": {
            "name": customer.get("name"),
            "address_line1": customer.get("address_line1"),
            "address_line2": customer.get("address_line2"),
        },
        "technician": {"name": technician.get("name")},
        "equipment": invoice.get("equipment"),
        "service_meta": invoice.get("service_meta"),
        "services": invoice.get("services") or [],
        "parts": invoice.get("parts") or [],
        "totals": invoice.get("totals") or {},
        # Ledger without processor references.
        "payments": [
            {"date": p.get("date"), "method": p.get("method"), "amount": p.get("amount")}
            for p in invoice.get("payments") or []
        ],
        "header_status_message": invoice.get("header_status_message"),
        "header_status_tone": invoice.get("header_status_tone"),
    }


def _minimal_invoice(work_order: WorkOrder) -> Dict[str, Any]:
    """Header-only view for expired or canceled links: no customer, lines or totals."""
    from pdf.work_order_adapter import COMPANY

    return {
        "invoice_number": work_order.order_number,
        "company": _public_company(COMPANY),
    }


def build_public_pay_payload(db: Session, work_order: WorkOrder) -> Dict[str, Any]:
    from app.services.portal_scheduling_settings_service import get_portal_scheduling_settings
    from app.services.portal_square_payment_service import get_square_config

    # Balance first, from the freshly loaded row, so it matches what /charge will check.
    due = amount_due(work_order, db=db)
    state = pay_state(work_order, due)

    if state == "canceled" or details_expired(db, work_order, state):
        return {
            "state": state,
            "details_hidden": True,
            "amount_due": 0,
            "invoice": _minimal_invoice(work_order),
            "square": {"configured": False},
        }

    invoice = _public_invoice(db, work_order)
    cfg = get_square_config(db)
    payment_settings = (get_portal_scheduling_settings(db) or {}).get("payment") or {}
    square_ready = bool(cfg["application_id"] and cfg["location_id"] and cfg["access_token"])

    return {
        "state": state,
        "details_hidden": False,
        "amount_due": round(due, 2),
        "invoice": invoice,
        "square": {
            "configured": square_ready,
            "application_id": cfg["application_id"] if square_ready else None,
            "location_id": cfg["location_id"] if square_ready else None,
            "environment": cfg["environment"],
        },
        "apple_pay_enabled": bool(payment_settings.get("apple_pay_enabled", True)),
    }


async def charge_by_pay_token(
    db: Session,
    token: str,
    *,
    amount: float,
    square_source_id: str,
    payment_idempotency_key: Optional[str] = None,
) -> Tuple[Any, Dict[str, Any], WorkOrder]:
    """Charge the current balance through the existing Square path and record it."""
    from app.services.portal_square_payment_service import square_credentials_configured
    from app.services.work_order_billing_helpers import compute_tax_on_billable_parts_due
    from app.services.work_order_payment_service import record_square_work_order_payment

    work_order = load_work_order_by_pay_token(db, token)
    if not work_order:
        raise ValueError("Invoice not found")

    if not square_credentials_configured(db):
        raise ValidationException("Online payment is not available right now. Please call us to pay.")

    due = amount_due(work_order, db=db)
    state = pay_state(work_order, due)
    if state == "canceled":
        raise ValidationException("This invoice can't be paid online.")
    if state == "paid":
        raise ValidationException("This invoice is already paid in full.")
    if state == "call":
        raise ValidationException("This balance is too small to pay online. Please call us.")

    recorder_id = work_order.updated_by or work_order.created_by
    if not recorder_id:
        raise ValidationException("Online payment is temporarily unavailable. Please call us.")

    tax_amount = float(compute_tax_on_billable_parts_due(work_order))

    # Amount must match the balance (±2¢) — checked inside before charging.
    payment, completion = await record_square_work_order_payment(
        db,
        work_order.id,
        recorder_id,
        amount=amount,
        tax_amount=tax_amount,
        square_source_id=square_source_id,
        payment_idempotency_key=payment_idempotency_key,
        payment_notes=PAY_LINK_PAYMENT_NOTES,
    )
    return payment, completion, work_order
