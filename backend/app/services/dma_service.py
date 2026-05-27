import json
import logging
import math
import re
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, cast, String
from sqlalchemy.orm import Session

from app.constants.dma_codes import REPAIR_OUTCOME_NOTE_TYPE
from app.models.dma import DmaRepairOutcome
from app.models.work_order import WorkOrder

logger = logging.getLogger(__name__)

_REPAIR_OUTCOME_PREFIX = re.compile(
    rf"^\[{re.escape(REPAIR_OUTCOME_NOTE_TYPE)}\]\n",
    re.IGNORECASE,
)


def parse_repair_outcome_note(note_text: str) -> Optional[Dict[str, Any]]:
    """Parse structured Repair Outcome note JSON from note body."""
    if not note_text:
        return None
    match = _REPAIR_OUTCOME_PREFIX.match(note_text.strip())
    if not match:
        return None
    payload = note_text.strip()[match.end():].strip()
    if not payload:
        return None
    try:
        data = json.loads(payload)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        logger.warning("Repair Outcome note had invalid JSON payload")
    return None


def _coalesce_str(*values: Any) -> Optional[str]:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def upsert_repair_outcome_from_note(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    note_id: uuid.UUID,
    note_text: str,
) -> Optional[DmaRepairOutcome]:
    """Create or update the single DMA outcome row for a work order from a Repair Outcome note."""
    parsed = parse_repair_outcome_note(note_text)
    if not parsed:
        return None

    confirmed_fix = _coalesce_str(parsed.get("confirmedFix"), parsed.get("confirmed_fix"))
    if not confirmed_fix:
        logger.info("Repair Outcome note missing confirmedFix; skipping DMA upsert")
        return None

    existing = (
        db.query(DmaRepairOutcome)
        .filter(DmaRepairOutcome.work_order_id == work_order_id)
        .first()
    )

    fields = {
        "source_note_id": note_id,
        "customer_complaint": _coalesce_str(
            parsed.get("customerComplaint"), parsed.get("customer_complaint")
        ),
        "problem_code": _coalesce_str(parsed.get("problemCode"), parsed.get("problem_code")),
        "resolution_code": _coalesce_str(
            parsed.get("resolutionCode"), parsed.get("resolution_code")
        ),
        "confirmed_fix": confirmed_fix,
        "error_code_text": _coalesce_str(
            parsed.get("errorCodeText"), parsed.get("error_code_text")
        ),
        "replaced_parts": _coalesce_str(
            parsed.get("replacedParts"), parsed.get("replaced_parts")
        ),
        "repair_successful": bool(parsed.get("repairSuccessful", True)),
        "callback_required": bool(parsed.get("callbackRequired", False)),
        "technician_summary": _coalesce_str(
            parsed.get("repairComments"),
            parsed.get("repair_comments"),
            parsed.get("technicianSummary"),
        ),
        "updated_by": user_id,
    }

    if existing:
        for key, value in fields.items():
            setattr(existing, key, value)
        db.add(existing)
        db.flush()
        return existing

    outcome = DmaRepairOutcome(
        work_order_id=work_order_id,
        created_by=user_id,
        **fields,
    )
    db.add(outcome)
    db.flush()
    return outcome


def search_repair_outcomes(
    db: Session,
    *,
    q: Optional[str] = None,
    equipment_make: Optional[str] = None,
    equipment_subtype: Optional[str] = None,
    problem_code: Optional[str] = None,
    resolution_code: Optional[str] = None,
    error_code: Optional[str] = None,
    repair_successful: Optional[bool] = True,
    page: int = 1,
    limit: int = 20,
) -> Dict[str, Any]:
    """Search DMA repair outcomes joined with work order equipment context."""
    query = (
        db.query(DmaRepairOutcome, WorkOrder)
        .join(WorkOrder, DmaRepairOutcome.work_order_id == WorkOrder.id)
    )

    if repair_successful is not None:
        query = query.filter(DmaRepairOutcome.repair_successful == repair_successful)

    if equipment_make:
        query = query.filter(WorkOrder.equipment_make.ilike(f"%{equipment_make.strip()}%"))
    if equipment_subtype:
        query = query.filter(WorkOrder.equipment_subtype.ilike(f"%{equipment_subtype.strip()}%"))
    if problem_code:
        query = query.filter(DmaRepairOutcome.problem_code == problem_code)
    if resolution_code:
        query = query.filter(DmaRepairOutcome.resolution_code == resolution_code)
    if error_code:
        term = f"%{error_code.strip()}%"
        query = query.filter(DmaRepairOutcome.error_code_text.ilike(term))

    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                DmaRepairOutcome.confirmed_fix.ilike(term),
                DmaRepairOutcome.customer_complaint.ilike(term),
                DmaRepairOutcome.technician_summary.ilike(term),
                DmaRepairOutcome.replaced_parts.ilike(term),
                DmaRepairOutcome.error_code_text.ilike(term),
                WorkOrder.description.ilike(term),
                WorkOrder.equipment_make.ilike(term),
                WorkOrder.equipment_model.ilike(term),
                cast(WorkOrder.symptoms, String).ilike(term),
            )
        )

    total = query.count()
    safe_limit = max(1, min(limit, 100))
    safe_page = max(1, page)
    offset = (safe_page - 1) * safe_limit
    rows = (
        query.order_by(DmaRepairOutcome.updated_at.desc())
        .offset(offset)
        .limit(safe_limit)
        .all()
    )

    items = []
    for outcome, work_order in rows:
        items.append(
            {
                "id": outcome.id,
                "work_order_id": outcome.work_order_id,
                "source_note_id": outcome.source_note_id,
                "customer_complaint": outcome.customer_complaint,
                "problem_code": outcome.problem_code,
                "resolution_code": outcome.resolution_code,
                "confirmed_fix": outcome.confirmed_fix,
                "error_code_text": outcome.error_code_text,
                "replaced_parts": outcome.replaced_parts,
                "repair_successful": outcome.repair_successful,
                "callback_required": outcome.callback_required,
                "technician_summary": outcome.technician_summary,
                "created_at": outcome.created_at,
                "updated_at": outcome.updated_at,
                "order_number": work_order.order_number,
                "equipment_make": work_order.equipment_make,
                "equipment_model": work_order.equipment_model,
                "equipment_type": work_order.equipment_type,
                "equipment_subtype": work_order.equipment_subtype,
                "equipment_serial": work_order.equipment_serial,
                "symptoms": work_order.symptoms,
                "work_order_description": work_order.description,
            }
        )

    pages = max(1, math.ceil(total / safe_limit)) if total else 1
    return {
        "items": items,
        "total": total,
        "page": safe_page,
        "pages": pages,
    }


def get_outcome_for_work_order(
    db: Session, work_order_id: uuid.UUID
) -> Optional[DmaRepairOutcome]:
    return (
        db.query(DmaRepairOutcome)
        .filter(DmaRepairOutcome.work_order_id == work_order_id)
        .first()
    )
