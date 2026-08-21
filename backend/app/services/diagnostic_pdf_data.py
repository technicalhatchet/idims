"""Build diagnostic report PDF payload from work-order diagnostic notes."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder, WorkOrderAppointment, WorkOrderNote
from app.services.diagnostic_last_measurements_service import _parse_diagnostic_note_payload
from app.services.diagnostic_template_catalog import get_diagnostic_template
from app.services.work_order_invoice_pdf_data import build_work_order_invoice_rd
from app.services.work_order_photos_service import list_photos, read_photo_bytes
from app.services.work_order_service import NOTE_TYPE_DIAGNOSTIC_RESULTS
from pdf.work_order_adapter import _customer, _equipment, _format_date, _technician

logger = logging.getLogger(__name__)

_DIAG_NOTE_PREFIX = f"[{NOTE_TYPE_DIAGNOSTIC_RESULTS}]\n"

VALUE_LABELS = {
    "not_checked": "Not Checked",
    "good": "Good",
    "bad": "Bad",
    "yes": "Yes",
    "no": "No",
    "normal": "Normal",
    "excessive": "Excessive",
}


def format_field_value(field: Dict[str, Any], raw: Any) -> str:
    field_type = field.get("type")
    if field_type == "check":
        return "Reviewed" if raw else "—"
    if raw is None:
        return "—"
    text = str(raw).strip()
    if not text:
        return "—"
    return VALUE_LABELS.get(text, text)


def _format_appointment_type_label(value: Optional[str]) -> str:
    if not value:
        return "Visit"
    text = str(value).replace("_", " ").strip()
    if not text:
        return "Visit"
    return text[0].upper() + text[1:]


def _format_visit_label(appointment: Optional[Dict[str, Any]]) -> Optional[str]:
    if not appointment:
        return None
    appt_type = _format_appointment_type_label(appointment.get("appointment_type"))
    scheduled = appointment.get("scheduled_start")
    if not scheduled:
        return f"{appt_type} — Unscheduled"
    try:
        when = datetime.fromisoformat(str(scheduled).replace("Z", "+00:00"))
        when_text = when.strftime("%b %d, %I:%M %p").replace(" 0", " ")
    except (TypeError, ValueError):
        when_text = str(scheduled)
    return f"{appt_type} — {when_text}"


def _prose_text(auto_bullets: List[str], auto_format: Optional[str]) -> str:
    if not auto_bullets:
        return ""
    if auto_format == "prose" and len(auto_bullets) == 1:
        return str(auto_bullets[0] or "").strip()
    return "\n".join(str(b or "").strip() for b in auto_bullets if str(b or "").strip()).strip()


def _extract_prose_section(text: str, header: str) -> str:
    if not text:
        return ""
    pattern = rf"(?im)^{re.escape(header)}\s*\n+([\s\S]*?)(?=\n\n[A-Z][^\n]*\n|\Z)"
    match = re.search(pattern, text)
    if match:
        return match.group(1).strip()
    return ""


def _extract_customer_explanation(text: str) -> str:
    direct = _extract_prose_section(text, "Customer explanation")
    if direct:
        return direct
    match = re.search(r"(?is)customer explanation\s*\n+([\s\S]*)$", text)
    return match.group(1).strip() if match else ""


def _extract_diagnosis_summary(text: str) -> str:
    return _extract_prose_section(text, "Diagnosis")


def _normalize_evidence_shares(top_categories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not top_categories:
        return []
    total = sum(float(c.get("evidence") or 0) for c in top_categories)
    if total <= 0:
        return []
    rows = []
    for category in top_categories:
        evidence = float(category.get("evidence") or 0)
        if evidence <= 0:
            continue
        share = round(evidence / total * 100)
        rows.append(
            {
                "label": category.get("label") or category.get("id") or "—",
                "share_percent": int(share),
            }
        )
    if rows:
        drift = 100 - sum(r["share_percent"] for r in rows)
        if drift:
            rows[0]["share_percent"] += drift
    return rows


def _build_checklist_sections(
    template: Dict[str, Any],
    fields: Dict[str, Any],
    *,
    skip_section_ids: Optional[set] = None,
) -> List[Dict[str, Any]]:
    skip = skip_section_ids or set()
    sections: List[Dict[str, Any]] = []
    for section in template.get("sections") or []:
        section_id = section.get("id")
        if section_id in skip:
            continue
        rows = []
        for field in section.get("fields") or []:
            key = f"{section_id}.{field.get('id')}"
            raw = fields.get(key)
            field_type = field.get("type")
            if field_type == "check" and not raw:
                continue
            if field_type != "check" and (raw is None or str(raw).strip() == ""):
                continue
            rows.append(
                {
                    "label": field.get("label") or field.get("id") or "—",
                    "value": format_field_value(field, raw),
                }
            )
        if rows:
            sections.append({"title": section.get("title") or section_id or "Section", "rows": rows})
    return sections


def _load_diagnostic_note(
    db: Session,
    work_order_id: uuid.UUID,
    note_id: Optional[uuid.UUID] = None,
) -> Optional[WorkOrderNote]:
    query = db.query(WorkOrderNote).filter(
        WorkOrderNote.work_order_id == work_order_id,
        WorkOrderNote.note.like(f"{_DIAG_NOTE_PREFIX}%"),
    )
    if note_id:
        query = query.filter(WorkOrderNote.id == note_id)
    else:
        query = query.order_by(WorkOrderNote.created_at.desc())
    return query.first()


def _appointment_rows(db: Session, work_order_id: uuid.UUID) -> List[Dict[str, Any]]:
    appts = (
        db.query(WorkOrderAppointment)
        .filter(WorkOrderAppointment.work_order_id == work_order_id)
        .all()
    )
    rows = []
    for appt in appts:
        rows.append(
            {
                "id": str(appt.id),
                "appointment_type": appt.appointment_type,
                "status": appt.status.value if hasattr(appt.status, "value") else appt.status,
                "scheduled_start": appt.scheduled_start.isoformat() if appt.scheduled_start else None,
            }
        )
    return rows


def _resolve_visit_label(appointment_id: Optional[str], appointments: List[Dict[str, Any]]) -> Optional[str]:
    if not appointment_id:
        return None
    match = next((a for a in appointments if str(a.get("id")) == str(appointment_id)), None)
    return _format_visit_label(match)


def _load_photo_items(db: Session, work_order_id: uuid.UUID) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for row in list_photos(db, work_order_id):
        try:
            content, mime = read_photo_bytes(row)
        except Exception as exc:
            logger.warning("Skipping photo %s for diagnostic PDF: %s", row.id, exc)
            continue
        if not content:
            continue
        items.append(
            {
                "bytes": content,
                "mime_type": mime or row.mime_type or "image/jpeg",
                "description": (row.description or row.filename or "Photo").strip(),
            }
        )
    return items


def build_diagnostic_report_dict(
    db: Session,
    work_order: WorkOrder,
    *,
    note_id: Optional[uuid.UUID] = None,
    show_technician: bool = True,
    show_photos: bool = False,
) -> Dict[str, Any]:
    """Assemble the dict consumed by ``build_diagnostic_pdf_v2``."""
    note = _load_diagnostic_note(db, work_order.id, note_id=note_id)
    if not note:
        raise ValueError("No diagnostic results note found for this work order")

    payload = _parse_diagnostic_note_payload(note.note)
    if not payload:
        raise ValueError("Diagnostic note payload is invalid or unreadable")

    template = get_diagnostic_template(payload.get("templateId"))
    if not template:
        raise ValueError(f"Unknown diagnostic template: {payload.get('templateId')}")

    rd = build_work_order_invoice_rd(db, work_order)
    appointments = _appointment_rows(db, work_order.id)
    fields = payload.get("fields") or {}
    if not isinstance(fields, dict):
        fields = {}

    prose = _prose_text(payload.get("autoNoteBullets") or [], payload.get("autoNoteFormat"))
    root_cause = str(fields.get("diagnosis.root_cause") or "").strip() or _extract_diagnosis_summary(prose)
    recommended_repair = str(fields.get("diagnosis.recommended_repair") or "").strip()
    what_we_found = _extract_customer_explanation(prose)
    client_complaint = str(fields.get("customer_complaint.complaint") or "").strip()

    has_diagnosis_fields = bool(root_cause or recommended_repair)
    skip_sections = {"customer_complaint"}
    if has_diagnosis_fields:
        skip_sections.add("diagnosis")
    checklist_sections = _build_checklist_sections(template, fields, skip_section_ids=skip_sections)

    evidence = payload.get("evidenceSnapshot") or {}
    top_categories = _normalize_evidence_shares(evidence.get("topCategories") or [])

    report = {
        "report_number": work_order.order_number or "—",
        "date": _format_date(),
        "company": {
            "name": "Atomic Repair",
            "address1": "641 Barclay Drive",
            "address2": "Toledo, OH 43609",
            "phone": "(419) 555-0100",
            "email": "service@atomicrepair.com",
        },
        "customer": _customer(rd),
        "technician": _technician(rd),
        "equipment": _equipment(rd),
        "show_technician": show_technician,
        "template_label": template.get("label") or payload.get("templateId") or "—",
        "visit_label": _resolve_visit_label(payload.get("appointmentId"), appointments),
        "client_complaint": client_complaint,
        "root_cause": root_cause,
        "recommended_repair": recommended_repair,
        "what_we_found": what_we_found,
        "checklist_sections": checklist_sections,
        "evidence_snapshot": {
            "top_categories": top_categories,
            "matched_rule_count": evidence.get("matchedRuleCount"),
            "captured_at": evidence.get("capturedAt"),
        },
        "photos": _load_photo_items(db, work_order.id) if show_photos else [],
        "header_status_message": (template.get("label") or "").upper() or None,
        "header_status_tone": "due",
    }
    return report


def generate_work_order_diagnostic_pdf_v2(
    db: Session,
    work_order: WorkOrder,
    *,
    variant: str = "light",
    show_technician: bool = True,
    show_photos: bool = False,
    note_id: Optional[uuid.UUID] = None,
) -> bytes:
    from pdf.diagnostic_template_v2 import build_diagnostic_pdf_v2

    report = build_diagnostic_report_dict(
        db,
        work_order,
        note_id=note_id,
        show_technician=show_technician,
        show_photos=show_photos,
    )
    safe_variant = "dark" if variant == "dark" else "light"
    return build_diagnostic_pdf_v2(report, variant=safe_variant)


def build_standalone_diagnostic_report_dict(
    db: Session,
    diagnostic: Any,
    *,
    show_technician: bool = True,
) -> Dict[str, Any]:
    """Assemble PDF report dict from a standalone Solomon diagnostic row."""
    from app.models.dma import DmaStandaloneDiagnostic
    from app.models.user import User

    if not isinstance(diagnostic, DmaStandaloneDiagnostic):
        raise TypeError("diagnostic must be DmaStandaloneDiagnostic")

    payload = diagnostic.payload or {}
    if not isinstance(payload, dict):
        raise ValueError("Diagnostic payload is invalid")

    template = get_diagnostic_template(payload.get("templateId"))
    if not template:
        raise ValueError(f"Unknown diagnostic template: {payload.get('templateId')}")

    fields = payload.get("fields") or {}
    if not isinstance(fields, dict):
        fields = {}

    prose = _prose_text(payload.get("autoNoteBullets") or [], payload.get("autoNoteFormat"))
    root_cause = str(fields.get("diagnosis.root_cause") or "").strip() or _extract_diagnosis_summary(prose)
    recommended_repair = str(fields.get("diagnosis.recommended_repair") or "").strip()
    what_we_found = _extract_customer_explanation(prose)
    client_complaint = str(
        fields.get("customer_complaint.complaint") or diagnostic.customer_complaint or ""
    ).strip()

    has_diagnosis_fields = bool(root_cause or recommended_repair)
    skip_sections = {"customer_complaint"}
    if has_diagnosis_fields:
        skip_sections.add("diagnosis")
    checklist_sections = _build_checklist_sections(template, fields, skip_section_ids=skip_sections)

    evidence = payload.get("evidenceSnapshot") or {}
    top_categories = _normalize_evidence_shares(evidence.get("topCategories") or [])

    tech_user = None
    if diagnostic.created_by:
        tech_user = db.query(User).filter(User.id == diagnostic.created_by).first()

    equipment_label = " ".join(
        filter(
            None,
            [
                diagnostic.equipment_make,
                diagnostic.equipment_model,
                (diagnostic.equipment_subtype or "").replace("_", " "),
            ],
        )
    ).strip() or template.get("label") or "Equipment"

    technician_name = tech_user.full_name if tech_user else "—"
    technician_phone = (tech_user.phone or "") if tech_user else ""

    report_id = str(diagnostic.id).replace("-", "").upper()[:8]

    return {
        "report_number": f"SOL-{report_id}",
        "date": _format_date(),
        "company": {
            "name": "Atomic Repair",
            "address1": "641 Barclay Drive",
            "address2": "Toledo, OH 43609",
            "phone": "(419) 555-0100",
            "email": "service@atomicrepair.com",
        },
        "customer": {
            "name": "Standalone diagnostic",
            "address1": "",
            "address2": "",
            "phone": "",
            "email": "",
        },
        "technician": {
            "name": technician_name,
            "phone": technician_phone,
        },
        "equipment": {
            "label": equipment_label,
            "serial": diagnostic.equipment_serial or "—",
            "type": diagnostic.equipment_type or "",
            "subtype": diagnostic.equipment_subtype or "",
        },
        "show_technician": show_technician,
        "template_label": template.get("label") or payload.get("templateId") or "—",
        "visit_label": None,
        "client_complaint": client_complaint,
        "root_cause": root_cause,
        "recommended_repair": recommended_repair,
        "what_we_found": what_we_found,
        "checklist_sections": checklist_sections,
        "evidence_snapshot": {
            "top_categories": top_categories,
            "matched_rule_count": evidence.get("matchedRuleCount"),
            "captured_at": evidence.get("capturedAt"),
        },
        "photos": [],
        "header_status_message": (template.get("label") or "").upper() or None,
        "header_status_tone": "due",
    }


def generate_standalone_diagnostic_pdf_v2(
    db: Session,
    diagnostic: Any,
    *,
    variant: str = "light",
    show_technician: bool = True,
) -> bytes:
    from pdf.diagnostic_template_v2 import build_diagnostic_pdf_v2

    report = build_standalone_diagnostic_report_dict(
        db,
        diagnostic,
        show_technician=show_technician,
    )
    safe_variant = "dark" if variant == "dark" else "light"
    return build_diagnostic_pdf_v2(report, variant=safe_variant)
