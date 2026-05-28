import json
import logging
import math
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, cast, String
from sqlalchemy.orm import Session

from app.constants.dma_codes import REPAIR_OUTCOME_NOTE_TYPE
from app.models.dma import DmaRepairOutcome, DmaRepairRecord
from app.models.work_order import WorkOrder
from app.schemas.dma import DmaRepairRecordCreate, DmaRepairRecordUpdate

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
    """Unified search: work-order outcomes + standalone field records."""
    wo_items = _fetch_work_order_outcome_items(
        db,
        q=q,
        equipment_make=equipment_make,
        equipment_subtype=equipment_subtype,
        problem_code=problem_code,
        resolution_code=resolution_code,
        error_code=error_code,
        repair_successful=repair_successful,
    )
    field_items = _fetch_field_record_items(
        db,
        q=q,
        equipment_make=equipment_make,
        equipment_subtype=equipment_subtype,
        problem_code=problem_code,
        resolution_code=resolution_code,
        error_code=error_code,
        repair_successful=repair_successful,
    )

    combined = sorted(
        wo_items + field_items,
        key=lambda row: row["updated_at"],
        reverse=True,
    )
    total = len(combined)
    safe_limit = max(1, min(limit, 100))
    safe_page = max(1, page)
    offset = (safe_page - 1) * safe_limit
    page_items = combined[offset : offset + safe_limit]
    pages = max(1, math.ceil(total / safe_limit)) if total else 1

    return {
        "items": page_items,
        "total": total,
        "page": safe_page,
        "pages": pages,
    }


def _fetch_work_order_outcome_items(
    db: Session,
    *,
    q: Optional[str],
    equipment_make: Optional[str],
    equipment_subtype: Optional[str],
    problem_code: Optional[str],
    resolution_code: Optional[str],
    error_code: Optional[str],
    repair_successful: Optional[bool],
) -> List[Dict[str, Any]]:
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

    rows = query.order_by(DmaRepairOutcome.updated_at.desc()).all()
    items = []
    for outcome, work_order in rows:
        items.append(
            {
                "id": outcome.id,
                "source_type": "work_order",
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
                "performed_on": None,
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
    return items


def _fetch_field_record_items(
    db: Session,
    *,
    q: Optional[str],
    equipment_make: Optional[str],
    equipment_subtype: Optional[str],
    problem_code: Optional[str],
    resolution_code: Optional[str],
    error_code: Optional[str],
    repair_successful: Optional[bool],
) -> List[Dict[str, Any]]:
    query = db.query(DmaRepairRecord)

    if repair_successful is not None:
        query = query.filter(DmaRepairRecord.repair_successful == repair_successful)
    if equipment_make:
        query = query.filter(DmaRepairRecord.equipment_make.ilike(f"%{equipment_make.strip()}%"))
    if equipment_subtype:
        query = query.filter(DmaRepairRecord.equipment_subtype.ilike(f"%{equipment_subtype.strip()}%"))
    if problem_code:
        query = query.filter(DmaRepairRecord.problem_code == problem_code)
    if resolution_code:
        query = query.filter(DmaRepairRecord.resolution_code == resolution_code)
    if error_code:
        term = f"%{error_code.strip()}%"
        query = query.filter(DmaRepairRecord.error_code_text.ilike(term))
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                DmaRepairRecord.confirmed_fix.ilike(term),
                DmaRepairRecord.customer_complaint.ilike(term),
                DmaRepairRecord.technician_summary.ilike(term),
                DmaRepairRecord.replaced_parts.ilike(term),
                DmaRepairRecord.error_code_text.ilike(term),
                DmaRepairRecord.equipment_make.ilike(term),
                DmaRepairRecord.equipment_model.ilike(term),
            )
        )

    rows = query.order_by(DmaRepairRecord.updated_at.desc()).all()
    return [_field_record_to_search_item(record) for record in rows]


def _field_record_to_search_item(record: DmaRepairRecord) -> Dict[str, Any]:
    return {
        "id": record.id,
        "source_type": "field_record",
        "work_order_id": None,
        "source_note_id": None,
        "customer_complaint": record.customer_complaint,
        "problem_code": record.problem_code,
        "resolution_code": record.resolution_code,
        "confirmed_fix": record.confirmed_fix,
        "error_code_text": record.error_code_text,
        "replaced_parts": record.replaced_parts,
        "repair_successful": record.repair_successful,
        "callback_required": record.callback_required,
        "technician_summary": record.technician_summary,
        "performed_on": record.performed_on,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
        "order_number": None,
        "equipment_make": record.equipment_make,
        "equipment_model": record.equipment_model,
        "equipment_type": record.equipment_type,
        "equipment_subtype": record.equipment_subtype,
        "equipment_serial": None,
        "symptoms": None,
        "work_order_description": None,
    }


def create_repair_record(
    db: Session,
    user_id: uuid.UUID,
    data: DmaRepairRecordCreate,
) -> DmaRepairRecord:
    record = DmaRepairRecord(
        created_by=user_id,
        updated_by=user_id,
        **data.model_dump(),
    )
    db.add(record)
    db.flush()
    return record


def get_repair_record(db: Session, record_id: uuid.UUID) -> Optional[DmaRepairRecord]:
    return db.query(DmaRepairRecord).filter(DmaRepairRecord.id == record_id).first()


def update_repair_record(
    db: Session,
    record: DmaRepairRecord,
    user_id: uuid.UUID,
    data: DmaRepairRecordUpdate,
) -> DmaRepairRecord:
    updates = data.model_dump(exclude_unset=True)
    if updates:
        make = (updates.get("equipment_make") if "equipment_make" in updates else record.equipment_make) or ""
        subtype = (updates.get("equipment_subtype") if "equipment_subtype" in updates else record.equipment_subtype) or ""
        if not str(make).strip() and not str(subtype).strip():
            raise ValueError("Provide at least equipment make or appliance type")
    for key, value in updates.items():
        setattr(record, key, value)
    record.updated_by = user_id
    record.updated_at = datetime.utcnow()
    db.add(record)
    db.flush()
    return record


def delete_repair_record(db: Session, record: DmaRepairRecord) -> None:
    db.delete(record)
    db.flush()


def get_outcome_for_work_order(
    db: Session, work_order_id: uuid.UUID
) -> Optional[DmaRepairOutcome]:
    return (
        db.query(DmaRepairOutcome)
        .filter(DmaRepairOutcome.work_order_id == work_order_id)
        .first()
    )


_ERROR_CODE_PATTERN = re.compile(
    r"\b(?:"
    r"F\s*\d{1,2}\s*E\s*\d{1,2}|"
    r"E\s*\d{1,3}|"
    r"[A-Z]{2}\s*\d{1,3}|"
    r"LF|LE|OE|UE|SE|PE|DC|DR|IE|FE|HF|HE|PF\s*\d+"
    r")\b",
    re.IGNORECASE,
)


def extract_error_codes_from_text(text: str) -> List[str]:
    """Extract likely appliance error codes from free text."""
    if not text or not text.strip():
        return []
    seen: set[str] = set()
    codes: List[str] = []
    for match in _ERROR_CODE_PATTERN.finditer(text):
        normalized = re.sub(r"\s+", "", match.group(0)).upper()
        if normalized not in seen:
            seen.add(normalized)
            codes.append(normalized)
    return codes


def _symptoms_to_text(symptoms: Any) -> str:
    if not symptoms:
        return ""
    if isinstance(symptoms, list):
        parts = [str(item).strip() for item in symptoms if str(item).strip()]
        return ", ".join(parts)
    return str(symptoms).strip()


def _work_order_context_text(work_order: WorkOrder) -> str:
    parts = [work_order.description or "", _symptoms_to_text(work_order.symptoms)]
    return "\n".join(part for part in parts if part)


def _normalize_fix_key(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _aggregate_common_fixes(items: List[Dict[str, Any]], limit: int = 3) -> List[Dict[str, Any]]:
    tallies: Dict[str, Dict[str, Any]] = {}
    for item in items:
        fix = (item.get("confirmed_fix") or "").strip()
        if not fix:
            continue
        key = _normalize_fix_key(fix)
        if key not in tallies:
            tallies[key] = {"label": fix, "count": 0}
        tallies[key]["count"] += 1
    ranked = sorted(tallies.values(), key=lambda row: (-row["count"], row["label"].lower()))
    return ranked[:limit]


def get_dma_suggestions(
    db: Session,
    *,
    equipment_make: Optional[str] = None,
    equipment_subtype: Optional[str] = None,
    error_code: Optional[str] = None,
    work_order_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Return in-context repair memory suggestions for equipment on a job."""
    make = (equipment_make or "").strip()
    subtype = (equipment_subtype or "").strip()
    empty = {
        "total_count": 0,
        "common_fixes": [],
        "detected_error_codes": [],
        "search_params": {
            "equipment_make": make or None,
            "equipment_subtype": subtype or None,
            "error_code": None,
        },
    }
    if not make or not subtype:
        return empty

    detected_codes: List[str] = []
    if error_code and error_code.strip():
        detected_codes = [re.sub(r"\s+", "", error_code.strip()).upper()]
    elif work_order_id:
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if work_order:
            detected_codes = extract_error_codes_from_text(_work_order_context_text(work_order))

    baseline_items = search_repair_outcomes(
        db,
        equipment_make=make,
        equipment_subtype=subtype,
        repair_successful=True,
        page=1,
        limit=100,
    )["items"]

    items = baseline_items
    applied_error_code: Optional[str] = None
    if detected_codes:
        error_filtered = search_repair_outcomes(
            db,
            equipment_make=make,
            equipment_subtype=subtype,
            error_code=detected_codes[0],
            repair_successful=True,
            page=1,
            limit=100,
        )["items"]
        if error_filtered:
            items = error_filtered
            applied_error_code = detected_codes[0]

    return {
        "total_count": len(items),
        "common_fixes": _aggregate_common_fixes(items),
        "detected_error_codes": detected_codes,
        "search_params": {
            "equipment_make": make,
            "equipment_subtype": subtype,
            "error_code": applied_error_code,
        },
    }
