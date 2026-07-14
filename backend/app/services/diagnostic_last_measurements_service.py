"""Load prior diagnostic measurement readings from work-order notes."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder, WorkOrderNote
from app.services.work_order_service import NOTE_TYPE_DIAGNOSTIC_RESULTS

_DIAG_NOTE_PREFIX = f"[{NOTE_TYPE_DIAGNOSTIC_RESULTS}]\n"


def _normalize_serial(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _parse_diagnostic_note_payload(note_text: str) -> Optional[Dict[str, Any]]:
    if not note_text:
        return None
    text = str(note_text).strip()
    if text.startswith("["):
        match = re.match(r"^\[([^\]]+)\]\s*\n?(.*)$", text, re.DOTALL)
        if match and match.group(1) == NOTE_TYPE_DIAGNOSTIC_RESULTS:
            text = match.group(2).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or not data.get("templateId"):
        return None
    return data


def get_last_diagnostic_measurements(
    db: Session,
    *,
    equipment_serial: str,
    template_id: str,
    exclude_work_order_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    serial_norm = _normalize_serial(equipment_serial)
    if not serial_norm or not template_id:
        return {"equipment_serial": equipment_serial, "template_id": template_id, "readings": {}}

    work_orders = (
        db.query(WorkOrder.id, WorkOrder.equipment_serial)
        .filter(WorkOrder.equipment_serial.isnot(None))
        .all()
    )
    matching_ids = [
        wo_id
        for wo_id, wo_serial in work_orders
        if _normalize_serial(wo_serial) == serial_norm and wo_id != exclude_work_order_id
    ]
    if not matching_ids:
        return {"equipment_serial": equipment_serial, "template_id": template_id, "readings": {}}

    notes = (
        db.query(WorkOrderNote)
        .filter(
            WorkOrderNote.work_order_id.in_(matching_ids),
            WorkOrderNote.note.like(f"{_DIAG_NOTE_PREFIX}%"),
        )
        .order_by(WorkOrderNote.created_at.desc())
        .all()
    )

    readings: Dict[str, Dict[str, Any]] = {}
    for note in notes:
        payload = _parse_diagnostic_note_payload(note.note)
        if not payload or payload.get("templateId") != template_id:
            continue
        fields = payload.get("fields") or {}
        if not isinstance(fields, dict):
            continue
        for field_key, raw_value in fields.items():
            if field_key in readings:
                continue
            if raw_value is None:
                continue
            text_value = str(raw_value).strip()
            if not text_value:
                continue
            readings[field_key] = {
                "value": text_value,
                "work_order_id": str(note.work_order_id),
                "note_id": str(note.id),
                "recorded_at": note.created_at.isoformat() if isinstance(note.created_at, datetime) else None,
            }

    return {
        "equipment_serial": equipment_serial,
        "template_id": template_id,
        "readings": readings,
    }
