"""Technician calendar blocks — CRUD and schedule overlap helpers."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import NotFoundException, ValidationException
from app.models.technician import Technician
from app.models.technician_calendar_block import TechnicianCalendarBlock
from app.schemas.calendar_block import (
    BLOCK_TYPES,
    CalendarBlockCreate,
    CalendarBlockUpdate,
)

BLOCK_TYPE_LABELS = {
    "lunch": "Lunch",
    "meeting": "Meeting",
    "shop": "Shop",
    "pto": "PTO",
    "other": "Block",
}


def intervals_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    from app.services.scheduling_constraints_service import intervals_overlap as _overlap

    return _overlap(start_a, end_a, start_b, end_b)


def _enum_val(value) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


def format_block_response(block: TechnicianCalendarBlock) -> Dict[str, Any]:
    """API / CRUD shape (start_at / end_at)."""
    tech_name = block.technician.name if block.technician else "Technician"
    block_type = _enum_val(block.block_type)
    label = (block.title or "").strip() or BLOCK_TYPE_LABELS.get(block_type, "Block")
    start_iso = block.start_at.isoformat() if block.start_at else None
    end_iso = block.end_at.isoformat() if block.end_at else None
    return {
        "id": str(block.id),
        "technician_id": str(block.technician_id),
        "technician_name": tech_name,
        "block_type": block_type,
        "title": label,
        "notes": block.notes,
        "start_at": start_iso,
        "end_at": end_iso,
        "status": _enum_val(block.status),
        "source": "calendar_block",
        "created_at": block.created_at.isoformat() if block.created_at else None,
        "updated_at": block.updated_at.isoformat() if block.updated_at else None,
    }


def format_block_for_schedule(block: TechnicianCalendarBlock) -> Dict[str, Any]:
    """Combined schedule feed — same fields as appointments (start / end)."""
    payload = format_block_response(block)
    return {
        **payload,
        "start": payload["start_at"],
        "end": payload["end_at"],
    }


def _resolve_actor_user_id(current_user) -> uuid.UUID:
    raw = getattr(current_user, "id", None)
    if not raw:
        raise ValidationException("Authenticated user id is required")
    return raw if isinstance(raw, uuid.UUID) else uuid.UUID(str(raw))


def _load_technician(db: Session, technician_id: uuid.UUID) -> Technician:
    tech = db.query(Technician).options(joinedload(Technician.user)).filter(Technician.id == technician_id).first()
    if not tech:
        raise NotFoundException(f"Technician {technician_id} not found")
    return tech


def apply_role_filter_to_block_query(query, db: Session, current_user):
    roles = list(getattr(current_user, "roles", None) or [])
    if any(r in ("admin", "manager") for r in roles):
        return query
    if "technician" in roles:
        tech = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not tech:
            return query.filter(False)
        return query.filter(TechnicianCalendarBlock.technician_id == tech.id)
    return query.filter(False)


def list_blocks(
    db: Session,
    *,
    start_datetime: datetime,
    end_datetime: datetime,
    technician_id: Optional[uuid.UUID],
    current_user,
    active_only: bool = True,
) -> List[TechnicianCalendarBlock]:
    query = (
        db.query(TechnicianCalendarBlock)
        .options(joinedload(TechnicianCalendarBlock.technician).joinedload(Technician.user))
        .filter(
            TechnicianCalendarBlock.start_at < end_datetime,
            TechnicianCalendarBlock.end_at > start_datetime,
        )
        .order_by(TechnicianCalendarBlock.start_at.asc())
    )
    if active_only:
        query = query.filter(TechnicianCalendarBlock.status == "active")
    if technician_id:
        query = query.filter(TechnicianCalendarBlock.technician_id == technician_id)
    query = apply_role_filter_to_block_query(query, db, current_user)
    return query.all()


def get_block(db: Session, block_id: uuid.UUID) -> TechnicianCalendarBlock:
    block = (
        db.query(TechnicianCalendarBlock)
        .options(joinedload(TechnicianCalendarBlock.technician).joinedload(Technician.user))
        .filter(TechnicianCalendarBlock.id == block_id)
        .first()
    )
    if not block:
        raise NotFoundException(f"Calendar block {block_id} not found")
    return block


def create_block(db: Session, data: CalendarBlockCreate, *, actor_user_id: uuid.UUID) -> TechnicianCalendarBlock:
    _load_technician(db, data.technician_id)
    block = TechnicianCalendarBlock(
        technician_id=data.technician_id,
        block_type=data.block_type,
        title=data.title,
        notes=data.notes,
        start_at=data.start_at,
        end_at=data.end_at,
        status="active",
        created_by=actor_user_id,
        updated_by=actor_user_id,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return get_block(db, block.id)


def update_block(
    db: Session,
    block_id: uuid.UUID,
    data: CalendarBlockUpdate,
    *,
    actor_user_id: uuid.UUID,
) -> TechnicianCalendarBlock:
    block = get_block(db, block_id)
    payload = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)

    if "block_type" in payload and payload["block_type"]:
        block.block_type = payload["block_type"]
    if "title" in payload:
        block.title = payload["title"]
    if "notes" in payload:
        block.notes = payload["notes"]
    if "status" in payload and payload["status"]:
        block.status = payload["status"]
    if "start_at" in payload and payload["start_at"]:
        block.start_at = payload["start_at"]
    if "end_at" in payload and payload["end_at"]:
        block.end_at = payload["end_at"]

    if block.end_at <= block.start_at:
        raise ValidationException("end_at must be after start_at")

    block.updated_by = actor_user_id
    block.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(block)
    return get_block(db, block.id)


def delete_block(db: Session, block_id: uuid.UUID) -> None:
    block = get_block(db, block_id)
    db.delete(block)
    db.commit()


def cancel_block(db: Session, block_id: uuid.UUID, *, actor_user_id: uuid.UUID) -> TechnicianCalendarBlock:
    return update_block(
        db,
        block_id,
        CalendarBlockUpdate(status="canceled"),
        actor_user_id=actor_user_id,
    )


def active_blocks_for_technician_between(
    db: Session,
    technician_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> List[TechnicianCalendarBlock]:
    return (
        db.query(TechnicianCalendarBlock)
        .filter(
            TechnicianCalendarBlock.technician_id == technician_id,
            TechnicianCalendarBlock.status == "active",
            TechnicianCalendarBlock.start_at < end,
            TechnicianCalendarBlock.end_at > start,
        )
        .all()
    )
