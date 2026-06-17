"""Shared work-order → invoice PDF payload (line items, client, public notes)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy.orm import Session

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


def generate_work_order_invoice_pdf(
    db: Session,
    work_order,
    *,
    variant: str = "light",
) -> bytes:
    """Render invoice PDF bytes for a work order."""
    from pdf import build_invoice_pdf
    from pdf.work_order_adapter import work_order_to_invoice

    rd = build_work_order_invoice_rd(db, work_order)
    note_texts = get_public_invoice_note_texts(db, work_order.id)
    safe_variant = "dark" if variant == "dark" else "light"
    return build_invoice_pdf(
        work_order_to_invoice(rd, notes=note_texts),
        variant=safe_variant,
    )


def build_work_order_invoice_rd(db: Session, work_order) -> Dict[str, Any]:
    """Build the work-order dict consumed by ``work_order_to_invoice``."""
    from app.models.client import Client
    from app.models.technician import Technician
    from app.models.user import User as UserModel
    from app.models.work_order import (
        WorkOrderAppointment,
        WorkOrderPart as WOPart,
        WorkOrderService as WOSvcModel,
    )

    work_order.calculate_totals()
    rd = {k: v for k, v in work_order.__dict__.items() if k != "_sa_instance_state"}

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

    if work_order.assigned_technician_id:
        t = db.query(Technician).filter(Technician.id == work_order.assigned_technician_id).first()
        if t and t.user_id:
            tu = db.query(UserModel).filter(UserModel.id == t.user_id).first()
            if tu:
                rd["technician_name"] = f"{tu.first_name} {tu.last_name}"

    svcs = db.query(WOSvcModel).filter(WOSvcModel.work_order_id == work_order.id).all()
    rd["services"] = [
        {
            "id": str(s.id),
            "name": s.name,
            "quantity": s.quantity,
            "unit_price": float(s.unit_price or 0),
            "price": float(s.price or 0),
            "billing_status": s.billing_status,
        }
        for s in svcs
    ]

    parts = db.query(WOPart).filter(WOPart.work_order_id == work_order.id).all()
    rd["parts"] = [
        {
            "number": p.number,
            "description": p.description,
            "price": float(p.price or 0),
            "status": p.status,
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
