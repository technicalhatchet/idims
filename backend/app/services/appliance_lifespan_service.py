"""CRUD and maintenance for appliance_lifespan_ranges."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.appliance_lifespan import ApplianceLifespanRange
from app.models.client_appliance import ClientAppliance
from app.services.appliance_age_service import apply_serial_decode

DEFAULT_LIFESPAN_ROWS: List[Dict[str, Any]] = [
    {
        "equipment_type": "appliance",
        "equipment_subtype": "refrigerator",
        "typical_min_years": 10,
        "typical_max_years": 18,
        "notes": "Varies with maintenance and usage",
    },
    {"equipment_type": "appliance", "equipment_subtype": "washing_machine", "typical_min_years": 8, "typical_max_years": 12, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "dryer", "typical_min_years": 10, "typical_max_years": 13, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "electric_dryer", "typical_min_years": 10, "typical_max_years": 13, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "gas_dryer", "typical_min_years": 10, "typical_max_years": 13, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "dishwasher", "typical_min_years": 8, "typical_max_years": 12, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "electric_range", "typical_min_years": 12, "typical_max_years": 15, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "gas_range", "typical_min_years": 12, "typical_max_years": 15, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "oven", "typical_min_years": 12, "typical_max_years": 15, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "microwave", "typical_min_years": 7, "typical_max_years": 10, "notes": None},
    {"equipment_type": "appliance", "equipment_subtype": "freezer", "typical_min_years": 10, "typical_max_years": 15, "notes": None},
    {
        "equipment_type": "appliance",
        "equipment_subtype": None,
        "typical_min_years": 8,
        "typical_max_years": 15,
        "notes": "Generic appliance fallback",
    },
]


def _decode_tuple(appliance: ClientAppliance) -> Tuple[Optional[int], Optional[int], Optional[str], Optional[str]]:
    return (
        appliance.manufacture_year,
        appliance.manufacture_month,
        appliance.manufacture_decode_rule,
        appliance.manufacture_decode_confidence,
    )


def serialize_lifespan(row: ApplianceLifespanRange) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "equipment_type": row.equipment_type,
        "equipment_subtype": row.equipment_subtype,
        "typical_min_years": row.typical_min_years,
        "typical_max_years": row.typical_max_years,
        "notes": row.notes,
    }


def list_lifespan_ranges(db: Session) -> List[Dict[str, Any]]:
    rows = (
        db.query(ApplianceLifespanRange)
        .order_by(ApplianceLifespanRange.equipment_type, ApplianceLifespanRange.equipment_subtype)
        .all()
    )
    return [serialize_lifespan(r) for r in rows]


def validate_lifespan_payload(
    *,
    equipment_type: str,
    equipment_subtype: Optional[str],
    typical_min_years: int,
    typical_max_years: int,
    exclude_id: Optional[UUID] = None,
    db: Optional[Session] = None,
) -> None:
    if not (equipment_type or "").strip():
        raise ValueError("equipment_type is required")
    if typical_min_years < 1 or typical_max_years > 40:
        raise ValueError("years must be between 1 and 40")
    if typical_min_years > typical_max_years:
        raise ValueError("min years cannot exceed max years")
    if db is not None:
        q = db.query(ApplianceLifespanRange).filter(
            ApplianceLifespanRange.equipment_type == equipment_type.strip(),
        )
        if equipment_subtype:
            q = q.filter(ApplianceLifespanRange.equipment_subtype == equipment_subtype.strip())
        else:
            q = q.filter(ApplianceLifespanRange.equipment_subtype.is_(None))
        if exclude_id:
            q = q.filter(ApplianceLifespanRange.id != exclude_id)
        if q.first():
            raise ValueError("duplicate equipment type and subtype")


def create_lifespan_range(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
    validate_lifespan_payload(
        equipment_type=payload["equipment_type"],
        equipment_subtype=payload.get("equipment_subtype"),
        typical_min_years=int(payload["typical_min_years"]),
        typical_max_years=int(payload["typical_max_years"]),
        db=db,
    )
    raw_sub = payload.get("equipment_subtype")
    equipment_subtype = str(raw_sub).strip() if raw_sub else None
    row = ApplianceLifespanRange(
        equipment_type=payload["equipment_type"].strip(),
        equipment_subtype=equipment_subtype or None,
        typical_min_years=int(payload["typical_min_years"]),
        typical_max_years=int(payload["typical_max_years"]),
        notes=payload.get("notes"),
    )
    db.add(row)
    db.flush()
    return serialize_lifespan(row)


def update_lifespan_range(db: Session, row_id: UUID, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    row = db.query(ApplianceLifespanRange).filter(ApplianceLifespanRange.id == row_id).first()
    if not row:
        return None
    equipment_type = payload.get("equipment_type", row.equipment_type)
    equipment_subtype = payload.get("equipment_subtype", row.equipment_subtype)
    min_y = int(payload.get("typical_min_years", row.typical_min_years))
    max_y = int(payload.get("typical_max_years", row.typical_max_years))
    validate_lifespan_payload(
        equipment_type=equipment_type,
        equipment_subtype=equipment_subtype,
        typical_min_years=min_y,
        typical_max_years=max_y,
        exclude_id=row_id,
        db=db,
    )
    row.equipment_type = equipment_type.strip()
    row.equipment_subtype = (equipment_subtype or None) and str(equipment_subtype).strip() or None
    row.typical_min_years = min_y
    row.typical_max_years = max_y
    if "notes" in payload:
        row.notes = payload.get("notes")
    db.flush()
    return serialize_lifespan(row)


def delete_lifespan_range(db: Session, row_id: UUID) -> bool:
    row = db.query(ApplianceLifespanRange).filter(ApplianceLifespanRange.id == row_id).first()
    if not row:
        return False
    db.delete(row)
    return True


def reset_lifespan_defaults(db: Session) -> int:
    db.query(ApplianceLifespanRange).delete()
    db.flush()
    for row in DEFAULT_LIFESPAN_ROWS:
        db.add(ApplianceLifespanRange(**row))
    db.flush()
    return len(DEFAULT_LIFESPAN_ROWS)


def redecode_all_appliance_ages(db: Session) -> Dict[str, int]:
    appliances = (
        db.query(ClientAppliance)
        .filter(
            ClientAppliance.is_active.is_(True),
            ClientAppliance.merged_into_id.is_(None),
        )
        .all()
    )
    changed = 0
    for appliance in appliances:
        before = _decode_tuple(appliance)
        apply_serial_decode(db, appliance)
        if _decode_tuple(appliance) != before:
            changed += 1
    return {"total": len(appliances), "changed": changed}
