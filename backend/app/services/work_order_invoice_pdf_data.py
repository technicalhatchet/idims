"""Shared work-order → invoice PDF payload (line items, client, public notes)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

PAYMENT_METHOD_LABELS = {
    "cash": "Cash",
    "check": "Check",
    "credit_card": "Credit card",
    "bank_transfer": "Bank transfer",
    "paypal": "PayPal",
    "stripe": "Stripe",
    "venmo": "Venmo",
    "other": "Other",
}

NOTE_FIELDS = {
    "Pre-Call": [
        ("clientContactStatus", "Client Contact Status"),
        ("appointmentTime", "Appointment Time"),
        ("detailsReviewed", "Work Order Details Reviewed"),
        ("toolsReady", "Tools and Parts Prepared"),
        ("additionalNotes", "Additional Notes"),
    ],
    "Follow Up": [
        ("servicePerformed", "Service Performed"),
        ("partsUsed", "Parts Used"),
        ("clientFeedback", "Client Feedback"),
        ("nextSteps", "Next Steps"),
        ("additionalNotes", "Additional Notes"),
    ],
    "Redo": [
        ("originalIssue", "Original Issue"),
        ("previousAttempts", "Previous Attempts"),
        ("newApproach", "New Approach"),
        ("requiredParts", "Required Parts"),
        ("additionalNotes", "Additional Notes"),
    ],
}

# Internal / workflow notes — never on client-facing invoices.
INVOICE_EXCLUDED_NOTE_TYPES = frozenset({
    "Status Update",
    "Appointment Info",
    "Repair Outcome",
})


def format_public_notes_for_invoice(notes) -> List[str]:
    """Turn work-order note rows into printable invoice note strings."""
    note_texts: List[str] = []
    for n in notes:
        raw = n.note or ""
        match = re.match(r"^\[(.*?)\]\n?", raw)
        note_type = match.group(1) if match else None
        if note_type in INVOICE_EXCLUDED_NOTE_TYPES:
            continue
        content = raw[match.end() :].strip() if match else raw.strip()
        if not content:
            continue
        if note_type and note_type in NOTE_FIELDS:
            try:
                data = json.loads(content)
                lines = [f"{note_type}:"]
                for field_id, label in NOTE_FIELDS[note_type]:
                    val = data.get(field_id, "")
                    if isinstance(val, bool):
                        val = "✓" if val else "✗"
                    if val:
                        lines.append(f"  {label}: {val}")
                note_texts.append("\n".join(lines))
            except Exception:
                note_texts.append(f"{note_type}: {content}")
        else:
            note_texts.append(f"{note_type}: {content}" if note_type else content)
    return note_texts


def get_public_invoice_note_texts(db: Session, work_order_id) -> List[str]:
    from app.models.work_order import WorkOrderNote

    notes = (
        db.query(WorkOrderNote)
        .filter(
            WorkOrderNote.work_order_id == work_order_id,
            WorkOrderNote.is_private == False,
        )
        .order_by(WorkOrderNote.created_at.asc())
        .all()
    )
    return format_public_notes_for_invoice(notes)


def format_payment_method_label(method: Optional[str]) -> str:
    if not method:
        return "—"
    key = str(method).lower()
    if hasattr(method, "value"):
        key = str(method.value).lower()
    return PAYMENT_METHOD_LABELS.get(key, key.replace("_", " ").title())


def format_payment_date(value: Optional[datetime]) -> str:
    if not value:
        return "—"
    try:
        return value.strftime("%b %d, %Y")
    except (TypeError, ValueError):
        return "—"


def get_work_order_payment_ledger(db: Session, work_order_id) -> List[Dict[str, Any]]:
    """Payment rows for invoice v2 ledger (oldest first)."""
    from app.models.work_order_payment import WorkOrderPayment

    payments = (
        db.query(WorkOrderPayment)
        .filter(WorkOrderPayment.work_order_id == work_order_id)
        .order_by(WorkOrderPayment.payment_date.asc(), WorkOrderPayment.created_at.asc())
        .all()
    )
    return [
        {
            "date": format_payment_date(p.payment_date),
            "method": format_payment_method_label(p.payment_method),
            "amount": float(p.amount or 0),
            "reference": (p.reference_number or "").strip() or "—",
        }
        for p in payments
    ]


def generate_work_order_invoice_pdf(
    db: Session,
    work_order,
    *,
    variant: str = "light",
) -> bytes:
    """Render invoice PDF bytes (v2 layout with default full-invoice options)."""
    return generate_work_order_invoice_pdf_v2(
        db,
        work_order,
        variant=variant,
        show_payments=True,
        show_payment_message=True,
        show_technician=True,
        line_preset="full",
    )


def enrich_document_pdf_payload(
    doc: dict,
    *,
    show_payment_message: bool = True,
    show_technician: bool = True,
) -> dict:
    """Attach render flags and header status chip derived from totals."""
    doc["show_payment_message"] = show_payment_message
    doc["show_technician"] = show_technician

    totals = doc.get("totals") or {}
    amount_paid = float(totals.get("amount_paid") or 0)
    if totals.get("balance_due") is not None:
        balance = float(totals.get("balance_due") or 0)
    else:
        balance = max(0.0, float(totals.get("total") or 0) - amount_paid)

    if amount_paid > 0 and balance <= 0.01:
        doc["header_status_message"] = "PAID IN FULL"
        doc["header_status_tone"] = "paid"
    else:
        doc["header_status_message"] = "DUE ON RECEIPT"
        doc["header_status_tone"] = "due"
    return doc


def generate_work_order_invoice_pdf_v2(
    db: Session,
    work_order,
    *,
    variant: str = "light",
    show_payments: bool = True,
    show_payment_message: bool = True,
    show_technician: bool = True,
    line_preset: str = "full",
) -> bytes:
    """Render invoice PDF v2 bytes (optional payment ledger)."""
    from pdf.invoice_template_v2 import build_invoice_pdf_v2
    from pdf.work_order_adapter import work_order_to_invoice

    rd = build_work_order_invoice_rd(db, work_order)
    note_texts = get_public_invoice_note_texts(db, work_order.id)
    invoice = work_order_to_invoice(rd, notes=note_texts, line_preset=line_preset)
    if show_payments:
        invoice["payments"] = get_work_order_payment_ledger(db, work_order.id)
    else:
        invoice["payments"] = []
    enrich_document_pdf_payload(
        invoice,
        show_payment_message=show_payment_message,
        show_technician=show_technician,
    )
    safe_variant = "dark" if variant == "dark" else "light"
    return build_invoice_pdf_v2(invoice, variant=safe_variant)


def generate_work_order_estimate_pdf_v2(
    db: Session,
    work_order,
    *,
    variant: str = "light",
    show_payments: bool = True,
    show_payment_message: bool = True,
    show_technician: bool = True,
    line_preset: str = "full",
) -> bytes:
    """Render estimate PDF v2 bytes (optional payment ledger)."""
    from pdf.estimate_template_v2 import build_estimate_pdf_v2
    from pdf.work_order_adapter import work_order_to_estimate

    rd = build_work_order_invoice_rd(db, work_order)
    estimate = work_order_to_estimate(rd, line_preset=line_preset)
    if show_payments:
        estimate["payments"] = get_work_order_payment_ledger(db, work_order.id)
    else:
        estimate["payments"] = []
    enrich_document_pdf_payload(
        estimate,
        show_payment_message=show_payment_message,
        show_technician=show_technician,
    )
    safe_variant = "dark" if variant == "dark" else "light"
    return build_estimate_pdf_v2(estimate, variant=safe_variant)


def generate_work_order_document_pdf_v2(
    db: Session,
    work_order,
    *,
    doc_type: str = "invoice",
    variant: str = "light",
    show_payments: bool = True,
    show_payment_message: bool = True,
    show_technician: bool = True,
    line_preset: str = "full",
) -> bytes:
    """Render invoice or estimate PDF v2 bytes."""
    from pdf.document_presets import normalize_line_preset

    effective_preset = normalize_line_preset(line_preset, doc_type=doc_type)
    if doc_type == "estimate":
        return generate_work_order_estimate_pdf_v2(
            db,
            work_order,
            variant=variant,
            show_payments=show_payments,
            show_payment_message=show_payment_message,
            show_technician=show_technician,
            line_preset=effective_preset,
        )
    return generate_work_order_invoice_pdf_v2(
        db,
        work_order,
        variant=variant,
        show_payments=show_payments,
        show_payment_message=show_payment_message,
        show_technician=show_technician,
        line_preset=effective_preset,
    )


def resolve_work_order_client_email(db: Session, work_order) -> tuple[Optional[str], str]:
    """Client email and display name for document delivery."""
    from app.models.client import Client
    from app.models.user import User as UserModel

    if not work_order.client_id:
        return None, ""
    client = db.query(Client).filter(Client.id == work_order.client_id).first()
    if not client:
        return None, ""

    name = client.display_name or f"{client.first_name or ''} {client.last_name or ''}".strip()
    email = client.email
    if client.user_id:
        user = db.query(UserModel).filter(UserModel.id == client.user_id).first()
        if user:
            email = user.email or client.email
            user_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            if user_name:
                name = user_name
    return email, name or "Customer"


def build_work_order_invoice_rd(db: Session, work_order) -> Dict[str, Any]:
    """Build the work-order dict consumed by ``work_order_to_invoice``."""
    from app.models.client import Client
    from app.models.user import User as UserModel
    from app.models.work_order import (
        WorkOrderAppointment,
        WorkOrderPart as WOPart,
        WorkOrderService as WOSvcModel,
    )
    from app.utils.work_order_display import resolve_technician_contact_for_work_order
    from sqlalchemy.orm import joinedload

    work_order.calculate_totals()
    rd = {k: v for k, v in work_order.__dict__.items() if k != "_sa_instance_state"}
    rd.pop("technician", None)

    if work_order.client_id:
        c = db.query(Client).filter(Client.id == work_order.client_id).first()
        if c:
            rd["client_name"] = c.display_name
            rd["client_user"] = {
                "first_name": c.first_name,
                "last_name": c.last_name,
                "email": c.email,
                "phone": c.phone or c.mobile,
            }
            if c.user_id:
                u = db.query(UserModel).filter(UserModel.id == c.user_id).first()
                if u:
                    rd["client_user"] = {
                        "first_name": u.first_name,
                        "last_name": u.last_name,
                        "email": u.email or c.email,
                        "phone": u.phone or c.phone or c.mobile,
                    }

    tech_contact = resolve_technician_contact_for_work_order(db, work_order)
    if tech_contact:
        rd["technician_name"] = tech_contact["name"]
        rd["technician"] = tech_contact

    svcs = (
        db.query(WOSvcModel)
        .options(joinedload(WOSvcModel.service))
        .filter(WOSvcModel.work_order_id == work_order.id)
        .all()
    )
    rd["services"] = []
    for s in svcs:
        svc_def = s.service
        service_type = None
        if svc_def and svc_def.service_type is not None:
            service_type = (
                svc_def.service_type.value
                if hasattr(svc_def.service_type, "value")
                else str(svc_def.service_type)
            )
        rd["services"].append(
            {
                "id": str(s.id),
                "name": s.name,
                "sku_code": svc_def.sku_code if svc_def else None,
                "service_type": service_type,
                "quantity": s.quantity,
                "unit_price": float(s.unit_price or 0),
                "price": float(s.price or 0),
                "billing_status": s.billing_status,
            }
        )

    parts = db.query(WOPart).filter(WOPart.work_order_id == work_order.id).all()
    rd["parts"] = [
        {
            "number": p.number,
            "description": p.description,
            "price": float(p.price or 0),
            "status": p.status,
            "part_source": p.part_source,
            "amount_upfront_collected": float(p.amount_upfront_collected or 0),
            "tax_collected": float(p.tax_collected or 0),
        }
        for p in parts
    ]

    rd["tax_rate"] = float(work_order.tax_rate or 0.0775)
    rd["diagnostic_discount_amount"] = float(work_order.diagnostic_discount_amount or 0)
    rd["amount_previously_paid"] = float(work_order.amount_previously_paid or 0)
    rd["service_location"] = work_order.service_location

    appts = db.query(WorkOrderAppointment).filter(WorkOrderAppointment.work_order_id == work_order.id).all()
    rd["appointments"] = [
        {
            "appointment_type": a.appointment_type,
            "status": a.status.value if hasattr(a.status, "value") else a.status,
            "scheduled_start": a.scheduled_start.isoformat() if a.scheduled_start else None,
        }
        for a in appts
    ]

    for k in list(rd.keys()):
        if isinstance(rd[k], uuid.UUID):
            rd[k] = str(rd[k])
        elif isinstance(rd[k], datetime):
            rd[k] = rd[k].isoformat()

    return rd
