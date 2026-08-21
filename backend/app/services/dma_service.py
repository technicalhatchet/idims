import json
import logging
import math
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, cast, String
from sqlalchemy.orm import Session, joinedload

from app.constants.dma_codes import REPAIR_OUTCOME_NOTE_TYPE, DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES
from app.constants.dma_brand_families import manufacturers_for_lookup
from app.models.dma import (
    DmaRepairOutcome,
    DmaRepairRecord,
    DmaErrorCodeReference,
    DmaTag,
    dma_outcome_tags,
    dma_record_tags,
)
from app.models.work_order import WorkOrder, WorkOrderNote
from app.schemas.dma import DmaRepairRecordCreate, DmaRepairRecordUpdate

logger = logging.getLogger(__name__)

_REPAIR_OUTCOME_PREFIX = re.compile(
    rf"^\[{re.escape(REPAIR_OUTCOME_NOTE_TYPE)}\]\n",
    re.IGNORECASE,
)


def normalize_tag_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower().strip()).strip("_")
    return slug[:80] or "tag"


def normalize_tag_label(slug: str, raw: Optional[str] = None) -> str:
    if raw and str(raw).strip():
        return str(raw).strip()[:120]
    return slug.replace("_", " ").title()[:120]


def get_or_create_tag(db: Session, raw: str) -> Optional[DmaTag]:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    slug = normalize_tag_slug(text)
    existing = db.query(DmaTag).filter(DmaTag.slug == slug).first()
    if existing:
        return existing
    tag = DmaTag(slug=slug, label=normalize_tag_label(slug, text))
    db.add(tag)
    db.flush()
    return tag


def resolve_tags(db: Session, raw_tags: Optional[List[Any]]) -> List[DmaTag]:
    if not raw_tags:
        return []
    tags: List[DmaTag] = []
    seen: set[str] = set()
    for raw in raw_tags:
        tag = get_or_create_tag(db, str(raw))
        if tag and tag.slug not in seen:
            seen.add(tag.slug)
            tags.append(tag)
    return tags


def sync_outcome_tags(
    db: Session, outcome: DmaRepairOutcome, raw_tags: Optional[List[Any]]
) -> None:
    outcome.tags = resolve_tags(db, raw_tags or [])
    db.add(outcome)
    db.flush()


def sync_record_tags(
    db: Session, record: DmaRepairRecord, raw_tags: Optional[List[Any]]
) -> None:
    record.tags = resolve_tags(db, raw_tags or [])
    db.add(record)
    db.flush()


def list_tags(db: Session) -> List[DmaTag]:
    from app.constants.dma_tags import CATEGORY_SORT_ORDER

    rows = db.query(DmaTag).all()
    return sorted(
        rows,
        key=lambda tag: (
            CATEGORY_SORT_ORDER.get(tag.category or "", 99),
            (tag.label or "").lower(),
        ),
    )


def _parse_tags_from_note(parsed: Dict[str, Any]) -> List[str]:
    raw = parsed.get("tags") or parsed.get("repairTags") or parsed.get("repair_tags") or []
    if isinstance(raw, str):
        return [part.strip() for part in raw.split(",") if part.strip()]
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]
    return []


def _tag_dicts(tags: Optional[List[DmaTag]]) -> List[Dict[str, Any]]:
    return [
        {
            "id": tag.id,
            "slug": tag.slug,
            "label": tag.label,
            "category": tag.category,
        }
        for tag in (tags or [])
    ]


def _apply_tag_filter_outcomes(query, db: Session, tags: Optional[List[str]]):
    if not tags:
        return query
    slugs = [normalize_tag_slug(tag) for tag in tags if tag and str(tag).strip()]
    if not slugs:
        return query
    tagged_ids = (
        db.query(dma_outcome_tags.c.outcome_id)
        .join(DmaTag, DmaTag.id == dma_outcome_tags.c.tag_id)
        .filter(DmaTag.slug.in_(slugs))
    )
    return query.filter(DmaRepairOutcome.id.in_(tagged_ids))


def _apply_tag_filter_records(query, db: Session, tags: Optional[List[str]]):
    if not tags:
        return query
    slugs = [normalize_tag_slug(tag) for tag in tags if tag and str(tag).strip()]
    if not slugs:
        return query
    tagged_ids = (
        db.query(dma_record_tags.c.record_id)
        .join(DmaTag, DmaTag.id == dma_record_tags.c.tag_id)
        .filter(DmaTag.slug.in_(slugs))
    )
    return query.filter(DmaRepairRecord.id.in_(tagged_ids))


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


def _parse_bool_field(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized == "true":
            return True
        if normalized == "false":
            return False
    if value is None:
        return default
    return bool(value)


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
        "repair_successful": _parse_bool_field(parsed.get("repairSuccessful"), default=False),
        "repair_memory_match": _coalesce_str(
            parsed.get("repairMemoryMatch"), parsed.get("repair_memory_match")
        ),
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
        sync_outcome_tags(db, existing, _parse_tags_from_note(parsed))
        return existing

    outcome = DmaRepairOutcome(
        work_order_id=work_order_id,
        created_by=user_id,
        **fields,
    )
    db.add(outcome)
    db.flush()
    sync_outcome_tags(db, outcome, _parse_tags_from_note(parsed))
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
    tags: Optional[List[str]] = None,
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
        tags=tags,
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
        tags=tags,
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
    tags: Optional[List[str]],
    repair_successful: Optional[bool],
    max_rows: Optional[int] = None,
    load_tags: bool = True,
) -> List[Dict[str, Any]]:
    query = (
        db.query(DmaRepairOutcome, WorkOrder)
        .join(WorkOrder, DmaRepairOutcome.work_order_id == WorkOrder.id)
    )
    if load_tags:
        query = query.options(joinedload(DmaRepairOutcome.tags))

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
    query = _apply_tag_filter_outcomes(query, db, tags)
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

    rows = query.order_by(DmaRepairOutcome.updated_at.desc())
    if max_rows is not None:
        rows = rows.limit(max(1, max_rows))
    rows = rows.all()
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
                "tags": _tag_dicts(outcome.tags),
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
    tags: Optional[List[str]],
    repair_successful: Optional[bool],
    max_rows: Optional[int] = None,
    load_tags: bool = True,
    for_pool: bool = False,
) -> List[Dict[str, Any]]:
    query = db.query(DmaRepairRecord)
    if load_tags:
        query = query.options(joinedload(DmaRepairRecord.tags))

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
    query = _apply_tag_filter_records(query, db, tags)
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

    rows = query.order_by(DmaRepairRecord.updated_at.desc())
    if max_rows is not None:
        rows = rows.limit(max(1, max_rows))
    rows = rows.all()
    if for_pool:
        from app.services.dma_standalone_service import record_is_pool_eligible
        rows = [row for row in rows if record_is_pool_eligible(row)]
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
        "tags": _tag_dicts(record.tags),
    }


def create_repair_record(
    db: Session,
    user_id: uuid.UUID,
    data: DmaRepairRecordCreate,
    user: Optional["User"] = None,
) -> DmaRepairRecord:
    from app.models.user import User as UserModel
    from app.services.dma_standalone_service import apply_record_create_defaults

    actor = user or db.query(UserModel).filter(UserModel.id == user_id).first()
    payload = data.model_dump(exclude={"tags"})
    if actor:
        payload = apply_record_create_defaults(actor, payload)
    record = DmaRepairRecord(
        created_by=user_id,
        updated_by=user_id,
        **payload,
    )
    db.add(record)
    db.flush()
    sync_record_tags(db, record, data.tags)
    return record


def get_repair_record(db: Session, record_id: uuid.UUID) -> Optional[DmaRepairRecord]:
    return (
        db.query(DmaRepairRecord)
        .options(joinedload(DmaRepairRecord.tags))
        .filter(DmaRepairRecord.id == record_id)
        .first()
    )


def repair_record_to_response(record: DmaRepairRecord) -> Dict[str, Any]:
    payload = {
        "id": record.id,
        "equipment_make": record.equipment_make,
        "equipment_model": record.equipment_model,
        "equipment_type": record.equipment_type,
        "equipment_subtype": record.equipment_subtype,
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
        "created_by": record.created_by,
        "tags": _tag_dicts(record.tags),
    }
    return payload


def update_repair_record(
    db: Session,
    record: DmaRepairRecord,
    user_id: uuid.UUID,
    data: DmaRepairRecordUpdate,
) -> DmaRepairRecord:
    updates = data.model_dump(exclude_unset=True)
    tag_values = updates.pop("tags", None)
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
    if tag_values is not None:
        sync_record_tags(db, record, tag_values)
    return record


def delete_repair_record(db: Session, record: DmaRepairRecord) -> None:
    db.delete(record)
    db.flush()


def get_outcome_for_work_order(
    db: Session, work_order_id: uuid.UUID
) -> Optional[DmaRepairOutcome]:
    return (
        db.query(DmaRepairOutcome)
        .options(joinedload(DmaRepairOutcome.tags))
        .filter(DmaRepairOutcome.work_order_id == work_order_id)
        .first()
    )


DMA_EXEMPT_ACTIVITY_TYPES = frozenset({"installation", "remote"})


def _activity_type_token(value) -> str:
    if value is None:
        return ""
    raw = value.value if hasattr(value, "value") else value
    return str(raw).strip().lower().replace("-", "_")


def collect_work_order_activity_types(work_order: WorkOrder) -> set:
    """Visit types and catalog service types present on the work order."""
    types = set()
    for appt in work_order.appointments or []:
        token = _activity_type_token(appt.appointment_type)
        if token:
            types.add(token)
    for item in work_order.service_items or []:
        service = getattr(item, "service", None)
        if service is not None:
            token = _activity_type_token(getattr(service, "service_type", None))
            if token:
                types.add(token)
        name = (item.name or "").lower()
        if "diagnostic" in name:
            types.add("diagnostic")
        elif "repair" in name:
            types.add("repair")
        elif "install" in name:
            types.add("installation")
        elif "remote" in name:
            types.add("remote")
    return types


def work_order_requires_dma_outcome(db: Session, work_order_id: uuid.UUID) -> bool:
    """
    DMA repair outcome is required for diagnostic/repair work.
    Waived when the order only contains installation and/or remote activity.
    """
    from app.services.work_order_completion_service import load_work_order_for_completion_check

    work_order = load_work_order_for_completion_check(db, work_order_id)
    if not work_order:
        return True
    types = collect_work_order_activity_types(work_order)
    if not types:
        return True
    non_exempt = types - DMA_EXEMPT_ACTIVITY_TYPES
    return bool(non_exempt)


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


SUGGESTION_ROWS_PER_SOURCE = 25


def _fetch_suggestion_items(
    db: Session,
    *,
    equipment_make: str,
    equipment_subtype: str,
    error_code: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Lightweight fetch for in-context suggestions (SQL-limited, no tag hydration)."""
    shared = {
        "q": None,
        "equipment_make": equipment_make,
        "equipment_subtype": equipment_subtype,
        "problem_code": None,
        "resolution_code": None,
        "error_code": error_code,
        "tags": None,
        "repair_successful": True,
        "max_rows": SUGGESTION_ROWS_PER_SOURCE,
        "load_tags": False,
    }
    wo_items = _fetch_work_order_outcome_items(db, **shared)
    field_items = _fetch_field_record_items(db, **shared, for_pool=True)
    return sorted(
        wo_items + field_items,
        key=lambda row: row["updated_at"],
        reverse=True,
    )


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
        "error_code_references": [],
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

    baseline_items = _fetch_suggestion_items(db, equipment_make=make, equipment_subtype=subtype)

    items = baseline_items
    applied_error_code: Optional[str] = None
    if detected_codes:
        error_filtered = _fetch_suggestion_items(
            db,
            equipment_make=make,
            equipment_subtype=subtype,
            error_code=detected_codes[0],
        )
        if error_filtered:
            items = error_filtered
            applied_error_code = detected_codes[0]

    reference_codes = detected_codes[:3] if detected_codes else []
    error_code_references = lookup_error_code_references(
        db,
        equipment_make=make,
        equipment_subtype=subtype,
        codes=reference_codes,
        limit=3,
    )

    return {
        "total_count": len(items),
        "common_fixes": _aggregate_common_fixes(items),
        "detected_error_codes": detected_codes,
        "error_code_references": error_code_references,
        "search_params": {
            "equipment_make": make,
            "equipment_subtype": subtype,
            "error_code": applied_error_code,
        },
    }


def _normalize_lookup_code(code: str) -> str:
    return re.sub(r"\s+", "", code.strip()).upper()


def _error_code_to_summary(record: DmaErrorCodeReference) -> Dict[str, Any]:
    return {
        "id": record.id,
        "manufacturer": record.manufacturer,
        "equipment_subtype": record.equipment_subtype,
        "code": record.code,
        "code_normalized": record.code_normalized,
        "meaning": record.meaning,
        "alias_group_id": record.alias_group_id,
    }


def lookup_error_code_references(
    db: Session,
    *,
    equipment_make: Optional[str] = None,
    equipment_subtype: Optional[str] = None,
    codes: Optional[List[str]] = None,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """Find reference rows for detected or searched codes."""
    if not codes:
        return []

    manufacturers = manufacturers_for_lookup(equipment_make)
    normalized_codes = [_normalize_lookup_code(code) for code in codes if code and code.strip()]
    if not manufacturers or not normalized_codes:
        return []

    query = db.query(DmaErrorCodeReference).filter(
        DmaErrorCodeReference.manufacturer.in_(manufacturers),
        DmaErrorCodeReference.code_normalized.in_(normalized_codes),
    )
    if equipment_subtype and equipment_subtype.strip():
        query = query.filter(
            DmaErrorCodeReference.equipment_subtype == equipment_subtype.strip()
        )

    rows = query.order_by(DmaErrorCodeReference.code_normalized.asc()).limit(max(1, limit)).all()
    return [_error_code_to_summary(row) for row in rows]


def search_error_code_references(
    db: Session,
    *,
    q: Optional[str] = None,
    equipment_make: Optional[str] = None,
    equipment_subtype: Optional[str] = None,
    code: Optional[str] = None,
    page: int = 1,
    limit: int = 30,
) -> Dict[str, Any]:
    query = db.query(DmaErrorCodeReference)

    if equipment_make and equipment_make.strip():
        manufacturers = manufacturers_for_lookup(equipment_make)
        query = query.filter(DmaErrorCodeReference.manufacturer.in_(manufacturers))
    if equipment_subtype and equipment_subtype.strip():
        query = query.filter(
            DmaErrorCodeReference.equipment_subtype == equipment_subtype.strip()
        )
    if code and code.strip():
        normalized = _normalize_lookup_code(code)
        query = query.filter(DmaErrorCodeReference.code_normalized == normalized)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                DmaErrorCodeReference.code.ilike(term),
                DmaErrorCodeReference.code_normalized.ilike(term),
                DmaErrorCodeReference.meaning.ilike(term),
                DmaErrorCodeReference.common_causes.ilike(term),
                DmaErrorCodeReference.recommended_fix.ilike(term),
            )
        )

    total = query.count()
    safe_limit = max(1, min(limit, 100))
    safe_page = max(1, page)
    offset = (safe_page - 1) * safe_limit
    rows = (
        query.order_by(
            DmaErrorCodeReference.manufacturer.asc(),
            DmaErrorCodeReference.equipment_subtype.asc(),
            DmaErrorCodeReference.code_normalized.asc(),
        )
        .offset(offset)
        .limit(safe_limit)
        .all()
    )
    pages = max(1, math.ceil(total / safe_limit)) if total else 1
    return {
        "items": [_error_code_to_summary(row) for row in rows],
        "total": total,
        "page": safe_page,
        "pages": pages,
    }


def get_error_code_reference(
    db: Session, reference_id: uuid.UUID
) -> Optional[Dict[str, Any]]:
    record = (
        db.query(DmaErrorCodeReference)
        .filter(DmaErrorCodeReference.id == reference_id)
        .first()
    )
    if not record:
        return None

    related = (
        db.query(DmaErrorCodeReference)
        .filter(DmaErrorCodeReference.alias_group_id == record.alias_group_id)
        .order_by(DmaErrorCodeReference.code_normalized.asc())
        .all()
    )
    payload = {
        "id": record.id,
        "manufacturer": record.manufacturer,
        "equipment_subtype": record.equipment_subtype,
        "code": record.code,
        "code_normalized": record.code_normalized,
        "meaning": record.meaning,
        "common_causes": record.common_causes,
        "recommended_fix": record.recommended_fix,
        "alias_group_id": record.alias_group_id,
        "related_codes": [_error_code_to_summary(row) for row in related],
    }
    return payload


def get_dma_evidence_nudges(
    db: Session,
    *,
    equipment_subtype: Optional[str] = None,
    equipment_make: Optional[str] = None,
    tags: Optional[List[str]] = None,
    exclude_work_order_id: Optional[uuid.UUID] = None,
) -> Dict[str, Any]:
    """Aggregate successful repair counts per DMA tag for diagnostic evidence nudges."""
    subtype = (equipment_subtype or "").strip()
    slugs = [normalize_tag_slug(tag) for tag in (tags or []) if tag and str(tag).strip()]
    slugs = list(dict.fromkeys(slug for slug in slugs if slug))
    if not subtype or not slugs:
        return {"equipment_subtype": subtype or None, "nudges": []}

    tag_rows = db.query(DmaTag).filter(DmaTag.slug.in_(slugs)).all()
    tag_by_slug = {row.slug: row for row in tag_rows}

    nudges: List[Dict[str, Any]] = []
    for slug in slugs:
        wo_items = _fetch_work_order_outcome_items(
            db,
            q=None,
            equipment_make=equipment_make,
            equipment_subtype=subtype,
            problem_code=None,
            resolution_code=None,
            error_code=None,
            tags=[slug],
            repair_successful=True,
            load_tags=False,
        )
        field_items = _fetch_field_record_items(
            db,
            q=None,
            equipment_make=equipment_make,
            equipment_subtype=subtype,
            problem_code=None,
            resolution_code=None,
            error_code=None,
            tags=[slug],
            repair_successful=True,
            load_tags=False,
            for_pool=True,
        )
        combined = wo_items + field_items
        if exclude_work_order_id:
            combined = [
                item
                for item in combined
                if str(item.get("work_order_id") or "") != str(exclude_work_order_id)
            ]
        case_count = len(combined)
        if case_count <= 0:
            continue
        tag = tag_by_slug.get(slug)
        nudges.append(
            {
                "tag": slug,
                "label": tag.label if tag else normalize_tag_label(slug),
                "case_count": case_count,
            }
        )

    nudges.sort(key=lambda row: (-row["case_count"], row["label"].lower()))
    return {"equipment_subtype": subtype, "nudges": nudges}


_PATTERN_REPORT_MAX_ROWS = 500
_DIAGNOSTIC_NOTE_TYPE = "Diagnostic Results"
_DIAGNOSTIC_NOTE_PREFIX = f"[{_DIAGNOSTIC_NOTE_TYPE}]\n"


def _parse_diagnostic_note_payload(note_text: str) -> Optional[Dict[str, Any]]:
    if not note_text:
        return None
    text = str(note_text).strip()
    if text.startswith("["):
        match = re.match(r"^\[([^\]]+)\]\s*\n?(.*)$", text, re.DOTALL)
        if match and match.group(1) == _DIAGNOSTIC_NOTE_TYPE:
            text = match.group(2).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or not data.get("templateId"):
        return None
    return data


def _rate_pct(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(100.0 * count / total, 1)


def _pattern_bucket_stats(items: List[Dict[str, Any]], *, fix_limit: int = 3) -> Dict[str, Any]:
    total = len(items)
    successful = sum(1 for row in items if row.get("repair_successful"))
    callbacks = sum(1 for row in items if row.get("callback_required"))
    return {
        "total_cases": total,
        "successful_repairs": successful,
        "success_rate_pct": _rate_pct(successful, total),
        "callback_cases": callbacks,
        "callback_rate_pct": _rate_pct(callbacks, total),
        "top_fixes": _aggregate_common_fixes(items, limit=fix_limit),
    }


def _leading_category_by_work_order(
    db: Session,
    work_order_ids: List[uuid.UUID],
) -> Dict[str, Dict[str, Any]]:
    if not work_order_ids:
        return {}

    notes = (
        db.query(WorkOrderNote)
        .filter(
            WorkOrderNote.work_order_id.in_(work_order_ids),
            WorkOrderNote.note.like(f"{_DIAGNOSTIC_NOTE_PREFIX}%"),
        )
        .order_by(WorkOrderNote.created_at.desc())
        .all()
    )

    result: Dict[str, Dict[str, Any]] = {}
    for note in notes:
        wo_key = str(note.work_order_id)
        if wo_key in result:
            continue
        payload = _parse_diagnostic_note_payload(note.note)
        if not payload:
            continue
        snapshot = payload.get("evidenceSnapshot")
        if not isinstance(snapshot, dict):
            continue
        tops = snapshot.get("topCategories") or []
        if not tops or not isinstance(tops[0], dict):
            continue
        top = tops[0]
        result[wo_key] = {
            "id": str(top.get("id") or "unknown"),
            "label": str(top.get("label") or "Unknown"),
            "evidence": top.get("evidence"),
        }
    return result


def _pattern_group_by_code(
    items: List[Dict[str, Any]],
    field: str,
    labels: Dict[str, str],
    *,
    limit: int,
    min_cases: int,
) -> List[Dict[str, Any]]:
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    for item in items:
        code = (item.get(field) or "").strip() or "unknown"
        buckets.setdefault(code, []).append(item)

    rows: List[Dict[str, Any]] = []
    for code, bucket in buckets.items():
        if len(bucket) < min_cases:
            continue
        label = labels.get(code) if code != "unknown" else "Unspecified"
        rows.append(
            {
                "code": code,
                "label": label or code.replace("_", " ").title(),
                **_pattern_bucket_stats(bucket),
            }
        )

    rows.sort(key=lambda row: (-row["total_cases"], row["label"].lower()))
    return rows[:limit]


def _pattern_group_by_tags(
    items: List[Dict[str, Any]],
    *,
    limit: int,
    min_cases: int,
) -> List[Dict[str, Any]]:
    buckets: Dict[str, Dict[str, Any]] = {}
    for item in items:
        tag_rows = item.get("tags") or []
        if not tag_rows:
            slug = "untagged"
            entry = buckets.setdefault(slug, {"slug": slug, "label": "Untagged", "items": []})
            entry["items"].append(item)
            continue
        for tag in tag_rows:
            slug = str(tag.get("slug") or "").strip()
            if not slug:
                continue
            entry = buckets.setdefault(
                slug,
                {"slug": slug, "label": tag.get("label") or normalize_tag_label(slug), "items": []},
            )
            entry["items"].append(item)

    rows: List[Dict[str, Any]] = []
    for entry in buckets.values():
        bucket = entry["items"]
        if len(bucket) < min_cases:
            continue
        rows.append(
            {
                "tag": entry["slug"],
                "label": entry["label"],
                **_pattern_bucket_stats(bucket),
            }
        )

    rows.sort(key=lambda row: (-row["total_cases"], row["label"].lower()))
    return rows[:limit]


def _pattern_evidence_paths(
    items: List[Dict[str, Any]],
    leading_by_work_order: Dict[str, Dict[str, Any]],
    *,
    limit: int,
    min_cases: int,
) -> List[Dict[str, Any]]:
    buckets: Dict[str, Dict[str, Any]] = {}

    for item in items:
        wo_id = item.get("work_order_id")
        leading = leading_by_work_order.get(str(wo_id)) if wo_id else None
        category_id = leading["id"] if leading else "no_snapshot"
        category_label = leading["label"] if leading else "No evidence snapshot"
        problem_code = (item.get("problem_code") or "").strip() or "unknown"
        key = f"{category_id}::{problem_code}"
        if key not in buckets:
            buckets[key] = {
                "leading_category_id": category_id,
                "leading_category_label": category_label,
                "problem_code": problem_code,
                "problem_label": DMA_PROBLEM_CODES.get(problem_code, "Unspecified")
                if problem_code != "unknown"
                else "Unspecified",
                "items": [],
            }
        buckets[key]["items"].append(item)

    rows: List[Dict[str, Any]] = []
    for entry in buckets.values():
        bucket = entry["items"]
        if len(bucket) < min_cases:
            continue
        rows.append(
            {
                "leading_category_id": entry["leading_category_id"],
                "leading_category_label": entry["leading_category_label"],
                "problem_code": entry["problem_code"],
                "problem_label": entry["problem_label"],
                **_pattern_bucket_stats(bucket, fix_limit=2),
            }
        )

    rows.sort(key=lambda row: (-row["total_cases"], row["leading_category_label"].lower()))
    return rows[:limit]


def get_dma_pattern_report(
    db: Session,
    *,
    equipment_make: Optional[str] = None,
    equipment_subtype: Optional[str] = None,
    problem_code: Optional[str] = None,
    tags: Optional[List[str]] = None,
    min_cases: int = 2,
    limit: int = 10,
) -> Dict[str, Any]:
    """Read-only pattern discovery — callback rates, fix success, evidence paths."""
    safe_limit = max(1, min(limit, 25))
    safe_min = max(1, min(min_cases, 10))

    shared_filters = {
        "q": None,
        "equipment_make": equipment_make,
        "equipment_subtype": equipment_subtype,
        "problem_code": problem_code,
        "resolution_code": None,
        "error_code": None,
        "tags": tags,
        "repair_successful": None,
        "max_rows": _PATTERN_REPORT_MAX_ROWS,
        "load_tags": True,
    }

    wo_items = _fetch_work_order_outcome_items(db, **shared_filters)
    field_items = _fetch_field_record_items(db, **shared_filters, for_pool=True)
    items = wo_items + field_items

    wo_ids = [row["work_order_id"] for row in wo_items if row.get("work_order_id")]
    leading_by_work_order = _leading_category_by_work_order(db, wo_ids)

    with_snapshot = sum(
        1 for row in wo_items if leading_by_work_order.get(str(row.get("work_order_id")))
    )

    return {
        "filters": {
            "equipment_make": (equipment_make or "").strip() or None,
            "equipment_subtype": (equipment_subtype or "").strip() or None,
            "problem_code": problem_code or None,
            "tags": tags or [],
            "min_cases": safe_min,
        },
        "summary": {
            **_pattern_bucket_stats(items, fix_limit=5),
            "work_order_cases": len(wo_items),
            "field_record_cases": len(field_items),
            "cases_with_evidence_snapshot": with_snapshot,
        },
        "by_problem_code": _pattern_group_by_code(
            items,
            "problem_code",
            DMA_PROBLEM_CODES,
            limit=safe_limit,
            min_cases=safe_min,
        ),
        "by_resolution_code": _pattern_group_by_code(
            items,
            "resolution_code",
            DMA_RESOLUTION_CODES,
            limit=safe_limit,
            min_cases=safe_min,
        ),
        "by_tag": _pattern_group_by_tags(items, limit=safe_limit, min_cases=safe_min),
        "common_fixes": _aggregate_common_fixes(items, limit=safe_limit),
        "evidence_paths": _pattern_evidence_paths(
            wo_items,
            leading_by_work_order,
            limit=safe_limit,
            min_cases=safe_min,
        ),
    }
