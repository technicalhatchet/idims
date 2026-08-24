"""Standalone Solomon diagnostics and DMA record visibility/moderation helpers."""

import math
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.constants.dma_standalone import (
    DMA_CONTEXT_DIY,
    DMA_CONTEXT_TECH,
    DMA_CONTEXT_TRAINING,
    DMA_MODERATION_APPROVED,
    DMA_MODERATION_PENDING,
    DMA_MODERATION_REJECTED,
    DMA_VISIBILITY_PRIVATE,
    DMA_VISIBILITY_TRAINING_CORPUS,
    POOL_VISIBILITIES,
)
from app.models.dma import DmaRepairRecord, DmaStandaloneDiagnostic
from app.models.user import User
from app.schemas.dma import (
    DmaRepairRecordModerateRequest,
    DmaStandaloneDiagnosticCreate,
    DmaStandaloneDiagnosticUpdate,
)


def record_is_pool_eligible(record: DmaRepairRecord) -> bool:
    """Whether a field record counts toward DMA evidence nudges / suggestion pool."""
    if not record.repair_successful:
        return False
    context = (record.context or DMA_CONTEXT_TECH).strip().lower()
    if context == DMA_CONTEXT_DIY:
        return (
            record.moderation_status == DMA_MODERATION_APPROVED
            and (record.visibility or DMA_VISIBILITY_PRIVATE) in POOL_VISIBILITIES
        )
    return record.moderation_status != DMA_MODERATION_REJECTED


def default_standalone_context(user: User, requested: Optional[str] = None) -> str:
    if user.is_diyer:
        return DMA_CONTEXT_DIY
    if requested in {DMA_CONTEXT_TECH, DMA_CONTEXT_TRAINING}:
        return requested
    return DMA_CONTEXT_TECH


def default_record_moderation(user: User, context: str) -> str:
    if user.is_diyer or context in {DMA_CONTEXT_DIY, DMA_CONTEXT_TRAINING}:
        return DMA_MODERATION_PENDING
    return DMA_MODERATION_APPROVED


def apply_record_create_defaults(
    user: User,
    data: Dict[str, Any],
) -> Dict[str, Any]:
    context = default_standalone_context(user, data.get("context"))
    payload = dict(data)
    payload["context"] = context
    payload.setdefault("visibility", DMA_VISIBILITY_PRIVATE)
    if not user.is_admin:
        payload.pop("moderation_status", None)
        payload["moderation_status"] = default_record_moderation(user, context)
    else:
        payload.setdefault("moderation_status", default_record_moderation(user, context))
    if user.is_diyer:
        payload["visibility"] = DMA_VISIBILITY_PRIVATE
        payload["context"] = DMA_CONTEXT_DIY
        payload["moderation_status"] = DMA_MODERATION_PENDING
    return payload


def user_can_view_record(user: User, record: DmaRepairRecord) -> bool:
    if user.is_admin or user.is_manager:
        return True
    if record.created_by == user.id:
        return True
    if user.is_diyer:
        return False
    if record.moderation_status == DMA_MODERATION_APPROVED:
        return (record.visibility or DMA_VISIBILITY_PRIVATE) in POOL_VISIBILITIES
    return False


def user_can_edit_record(user: User, record: DmaRepairRecord) -> bool:
    if user.is_admin or user.is_manager:
        return True
    return record.created_by == user.id


def user_can_view_diagnostic(user: User, diagnostic: DmaStandaloneDiagnostic) -> bool:
    if user.is_admin or user.is_manager:
        return True
    if diagnostic.created_by == user.id:
        return True
    if user.is_diyer:
        return False
    return False


def user_can_edit_diagnostic(user: User, diagnostic: DmaStandaloneDiagnostic) -> bool:
    if user.is_admin or user.is_manager:
        return True
    return diagnostic.created_by == user.id


def _template_label(template_id: Optional[str]) -> Optional[str]:
    if not template_id:
        return None
    return template_id.replace("_", " ").title()


def standalone_diagnostic_to_response(row: DmaStandaloneDiagnostic) -> Dict[str, Any]:
    payload = row.payload or {}
    template_id = payload.get("templateId")
    return {
        "id": row.id,
        "outcome_id": row.outcome_id,
        "equipment_make": row.equipment_make,
        "equipment_model": row.equipment_model,
        "equipment_type": row.equipment_type,
        "equipment_subtype": row.equipment_subtype,
        "equipment_serial": row.equipment_serial,
        "customer_complaint": row.customer_complaint,
        "payload": payload,
        "context": row.context,
        "visibility": row.visibility,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "created_by": row.created_by,
        "imported_work_order_id": row.imported_work_order_id,
        "template_id": template_id,
        "template_label": _template_label(template_id),
    }


def get_standalone_diagnostic(
    db: Session,
    diagnostic_id: uuid.UUID,
) -> Optional[DmaStandaloneDiagnostic]:
    return (
        db.query(DmaStandaloneDiagnostic)
        .filter(DmaStandaloneDiagnostic.id == diagnostic_id)
        .first()
    )


def create_standalone_diagnostic(
    db: Session,
    user: User,
    data: DmaStandaloneDiagnosticCreate,
) -> DmaStandaloneDiagnostic:
    context = default_standalone_context(user, data.context)
    visibility = DMA_VISIBILITY_PRIVATE
    if data.visibility and not user.is_diyer:
        visibility = data.visibility

    outcome_id = data.outcome_id
    if outcome_id:
        outcome = db.query(DmaRepairRecord).filter(DmaRepairRecord.id == outcome_id).first()
        if not outcome:
            raise ValueError("Linked outcome not found")
        if not user_can_edit_record(user, outcome):
            raise ValueError("Not allowed to link to this outcome")

    row = DmaStandaloneDiagnostic(
        outcome_id=outcome_id,
        equipment_make=data.equipment_make,
        equipment_model=data.equipment_model,
        equipment_type=data.equipment_type,
        equipment_subtype=data.equipment_subtype,
        equipment_serial=data.equipment_serial,
        customer_complaint=data.customer_complaint,
        payload=data.payload,
        context=context,
        visibility=visibility,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(row)
    db.flush()
    return row


def update_standalone_diagnostic(
    db: Session,
    user: User,
    diagnostic: DmaStandaloneDiagnostic,
    data: DmaStandaloneDiagnosticUpdate,
) -> DmaStandaloneDiagnostic:
    updates = data.model_dump(exclude_unset=True)
    outcome_id = updates.pop("outcome_id", None)
    if outcome_id is not None:
        if outcome_id:
            outcome = db.query(DmaRepairRecord).filter(DmaRepairRecord.id == outcome_id).first()
            if not outcome:
                raise ValueError("Linked outcome not found")
            if not user_can_edit_record(user, outcome):
                raise ValueError("Not allowed to link to this outcome")
        diagnostic.outcome_id = outcome_id

    if user.is_diyer:
        updates.pop("visibility", None)

    if "payload" in updates and updates["payload"] is not None:
        diagnostic.payload = updates.pop("payload")

    for key, value in updates.items():
        setattr(diagnostic, key, value)

    diagnostic.updated_by = user.id
    diagnostic.updated_at = datetime.utcnow()
    db.add(diagnostic)
    db.flush()
    return diagnostic


def delete_standalone_diagnostic(db: Session, diagnostic: DmaStandaloneDiagnostic) -> None:
    db.delete(diagnostic)
    db.flush()


def list_standalone_diagnostics(
    db: Session,
    user: User,
    *,
    linked: Optional[bool] = None,
    outcome_id: Optional[uuid.UUID] = None,
    context: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Dict[str, Any]:
    query = db.query(DmaStandaloneDiagnostic)

    if user.is_diyer or not (user.is_admin or user.is_manager):
        query = query.filter(DmaStandaloneDiagnostic.created_by == user.id)

    if linked is True:
        query = query.filter(DmaStandaloneDiagnostic.outcome_id.isnot(None))
    elif linked is False:
        query = query.filter(DmaStandaloneDiagnostic.outcome_id.is_(None))

    if outcome_id:
        query = query.filter(DmaStandaloneDiagnostic.outcome_id == outcome_id)

    if context:
        query = query.filter(DmaStandaloneDiagnostic.context == context)

    total = query.count()
    pages = max(1, math.ceil(total / limit)) if total else 1
    rows = (
        query.order_by(DmaStandaloneDiagnostic.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": [standalone_diagnostic_to_response(row) for row in rows],
        "total": total,
        "page": page,
        "pages": pages,
    }


def link_diagnostic_to_outcome(
    db: Session,
    user: User,
    diagnostic: DmaStandaloneDiagnostic,
    outcome_id: uuid.UUID,
) -> DmaStandaloneDiagnostic:
    outcome = db.query(DmaRepairRecord).filter(DmaRepairRecord.id == outcome_id).first()
    if not outcome:
        raise ValueError("Outcome not found")
    if not user_can_edit_record(user, outcome):
        raise ValueError("Not allowed to link to this outcome")
    if not user_can_edit_diagnostic(user, diagnostic):
        raise ValueError("Not allowed to edit this diagnostic")

    diagnostic.outcome_id = outcome_id
    diagnostic.updated_by = user.id
    diagnostic.updated_at = datetime.utcnow()
    db.add(diagnostic)
    db.flush()
    return diagnostic


def unlink_diagnostic_from_outcome(
    db: Session,
    user: User,
    diagnostic: DmaStandaloneDiagnostic,
) -> DmaStandaloneDiagnostic:
    if not user_can_edit_diagnostic(user, diagnostic):
        raise ValueError("Not allowed to edit this diagnostic")
    diagnostic.outcome_id = None
    diagnostic.updated_by = user.id
    diagnostic.updated_at = datetime.utcnow()
    db.add(diagnostic)
    db.flush()
    return diagnostic


def moderate_repair_record(
    db: Session,
    user: User,
    record: DmaRepairRecord,
    body: DmaRepairRecordModerateRequest,
) -> DmaRepairRecord:
    if not user.is_admin and not user.is_manager:
        raise ValueError("Only managers can moderate repair records")
    record.moderation_status = body.moderation_status
    if body.visibility:
        record.visibility = body.visibility
    elif body.moderation_status == DMA_MODERATION_APPROVED:
        record.visibility = DMA_VISIBILITY_TRAINING_CORPUS
    record.updated_by = user.id
    record.updated_at = datetime.utcnow()
    db.add(record)
    db.flush()
    return record


def link_record_to_work_order_bones(
    db: Session,
    user: User,
    record: DmaRepairRecord,
    work_order_id: uuid.UUID,
) -> DmaRepairRecord:
    if not user_can_edit_record(user, record):
        raise ValueError("Not allowed to edit this record")
    record.imported_work_order_id = work_order_id
    record.updated_by = user.id
    record.updated_at = datetime.utcnow()
    db.add(record)
    db.flush()
    return record


def link_diagnostic_to_work_order_bones(
    db: Session,
    user: User,
    diagnostic: DmaStandaloneDiagnostic,
    work_order_id: uuid.UUID,
) -> DmaStandaloneDiagnostic:
    if not user_can_edit_diagnostic(user, diagnostic):
        raise ValueError("Not allowed to edit this diagnostic")
    diagnostic.imported_work_order_id = work_order_id
    diagnostic.updated_by = user.id
    diagnostic.updated_at = datetime.utcnow()
    db.add(diagnostic)
    db.flush()
    return diagnostic


def count_linked_diagnostics(db: Session, record_id: uuid.UUID) -> int:
    return (
        db.query(DmaStandaloneDiagnostic)
        .filter(DmaStandaloneDiagnostic.outcome_id == record_id)
        .count()
    )


def list_repair_records(
    db: Session,
    user: User,
    *,
    page: int = 1,
    limit: int = 20,
    moderation_status: Optional[str] = None,
    context: Optional[str] = None,
) -> Dict[str, Any]:
    query = db.query(DmaRepairRecord).options(joinedload(DmaRepairRecord.tags))
    if user.is_diyer or not (user.is_admin or user.is_manager):
        query = query.filter(DmaRepairRecord.created_by == user.id)

    if moderation_status:
        status = moderation_status.strip().lower()
        if status not in {DMA_MODERATION_PENDING, DMA_MODERATION_APPROVED, DMA_MODERATION_REJECTED}:
            raise ValueError(f"moderation_status must be one of pending, approved, or rejected")
        query = query.filter(DmaRepairRecord.moderation_status == status)

    if context:
        ctx = context.strip().lower()
        if ctx not in {DMA_CONTEXT_TECH, DMA_CONTEXT_TRAINING, DMA_CONTEXT_DIY}:
            raise ValueError(f"context must be one of tech, training, or diy")
        query = query.filter(DmaRepairRecord.context == ctx)

    total = query.count()
    pages = max(1, math.ceil(total / limit)) if total else 1
    rows = (
        query.order_by(DmaRepairRecord.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": [repair_record_to_response_extended(row, db) for row in rows],
        "total": total,
        "page": page,
        "pages": pages,
    }


def repair_record_to_response_extended(
    record: DmaRepairRecord,
    db: Session,
) -> Dict[str, Any]:
    from app.services.dma_service import repair_record_to_response

    payload = repair_record_to_response(record)
    payload.update({
        "title": record.title,
        "equipment_serial": record.equipment_serial,
        "context": record.context,
        "visibility": record.visibility,
        "moderation_status": record.moderation_status,
        "imported_work_order_id": record.imported_work_order_id,
        "linked_diagnostic_count": count_linked_diagnostics(db, record.id),
    })
    return payload
