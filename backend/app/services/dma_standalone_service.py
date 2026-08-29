"""Standalone Solomon diagnostics and DMA record visibility/moderation helpers."""

import json
import math
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.constants.dma_codes import REPAIR_OUTCOME_NOTE_TYPE
from app.constants.dma_standalone import (
    DMA_CONTEXT_DIY,
    DMA_CONTEXT_TECH,
    DMA_CONTEXT_TRAINING,
    DMA_DIAGNOSTIC_COMPLETED,
    DMA_DIAGNOSTIC_IN_PROGRESS,
    DMA_DIAGNOSTIC_STATUSES,
    DMA_MODERATION_APPROVED,
    DMA_MODERATION_PENDING,
    DMA_MODERATION_REJECTED,
    DMA_VISIBILITY_PRIVATE,
    DMA_VISIBILITY_TRAINING_CORPUS,
    OUTCOME_CONFIDENCE_CONFIRMED,
    OUTCOME_CONFIDENCE_INCORRECT,
    OUTCOME_CONFIDENCE_UNCONFIRMED,
    POOL_VISIBILITIES,
)
from app.models.dma import DmaRepairRecord, DmaStandaloneDiagnostic
from app.models.user import User
from app.models.work_order import WorkOrder, WorkOrderAppointment, WorkOrderNote
from app.schemas.dma import (
    DmaRepairRecordModerateRequest,
    DmaStandaloneDiagnosticCreate,
    DmaStandaloneDiagnosticUpdate,
)


_DIAGNOSTIC_NOTE_TYPE = "Diagnostic Results"
_PRIVATE_WO_NOTE_TYPES = frozenset({REPAIR_OUTCOME_NOTE_TYPE, _DIAGNOSTIC_NOTE_TYPE})


def user_can_import_to_work_order(user: User) -> bool:
    return user.is_admin or user.is_manager or user.is_technician


def _require_work_order_mutation_access(
    db: Session,
    user: User,
    work_order_id: uuid.UUID,
) -> WorkOrder:
    from app.services.user_service import UserService

    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        raise ValueError("Work order not found")
    if user.is_admin or user.is_manager:
        return work_order
    if user.is_technician:
        technician = UserService.get_technician_by_user_id(db, str(user.id))
        if not technician:
            raise ValueError("Technician profile not found")
        if work_order.assigned_technician_id == technician.id:
            return work_order
        has_visit = (
            db.query(WorkOrderAppointment.id)
            .filter(
                WorkOrderAppointment.work_order_id == work_order_id,
                WorkOrderAppointment.assigned_technician_id == technician.id,
                WorkOrderAppointment.status != "canceled",
            )
            .first()
        )
        if has_visit:
            return work_order
    raise ValueError("You do not have permission to modify this work order")


def _serialize_diagnostic_payload(payload: Dict[str, Any]) -> str:
    serialized = {
        "templateId": payload.get("templateId"),
        "appointmentId": None,
        "fields": payload.get("fields") or {},
        "timeline": payload.get("timeline") if isinstance(payload.get("timeline"), list) else [],
        "evidenceSnapshot": payload.get("evidenceSnapshot"),
        "autoNoteBullets": payload.get("autoNoteBullets") if isinstance(payload.get("autoNoteBullets"), list) else [],
        "autoNoteEdited": bool(payload.get("autoNoteEdited")),
        "autoNoteFormat": "prose" if payload.get("autoNoteFormat") == "prose" else "bullets",
        "includeAutoNoteInSummary": payload.get("includeAutoNoteInSummary") is not False,
    }
    if isinstance(payload.get("visitedStepKeys"), list):
        serialized["visitedStepKeys"] = payload.get("visitedStepKeys")
    if payload.get("currentStepKey"):
        serialized["currentStepKey"] = payload.get("currentStepKey")
    return json.dumps(serialized)


def _format_diagnostic_note_text(payload: Dict[str, Any]) -> str:
    return f"[{_DIAGNOSTIC_NOTE_TYPE}]\n{_serialize_diagnostic_payload(payload)}"


def _format_repair_outcome_note_text(record: DmaRepairRecord) -> str:
    tag_slugs = []
    if record.tags:
        tag_slugs = [t.slug for t in record.tags if t.slug]
    fields = {
        "customerComplaint": record.customer_complaint or "",
        "problemCode": record.problem_code or "",
        "resolutionCode": record.resolution_code or "",
        "confirmedFix": record.confirmed_fix or "",
        "errorCodeText": record.error_code_text or "",
        "replacedParts": record.replaced_parts or "",
        "repairMemoryMatch": "didnt_use",
        "repairSuccessful": "true" if record.repair_successful else "false",
        "callbackRequired": bool(record.callback_required),
        "repairComments": record.technician_summary or "",
        "tags": tag_slugs,
    }
    if record.outcome_confidence:
        fields["outcomeConfidence"] = record.outcome_confidence
    return f"[{REPAIR_OUTCOME_NOTE_TYPE}]\n{json.dumps(fields)}"


def _create_work_order_note_sync(
    db: Session,
    user: User,
    work_order_id: uuid.UUID,
    note_text: str,
    appointment_id: Optional[uuid.UUID] = None,
) -> WorkOrderNote:
    from app.services.dma_service import upsert_repair_outcome_from_note

    is_private = False
    match = re.match(r"^\[(.*?)\]", note_text or "")
    if match and match.group(1) in _PRIVATE_WO_NOTE_TYPES:
        is_private = True

    note = WorkOrderNote(
        work_order_id=work_order_id,
        user_id=user.id,
        note=note_text,
        is_private=is_private,
        appointment_id=appointment_id,
    )
    db.add(note)
    db.flush()
    upsert_repair_outcome_from_note(
        db,
        work_order_id=work_order_id,
        user_id=user.id,
        note_id=note.id,
        note_text=note_text,
    )
    return note


def import_standalone_diagnostic_to_work_order(
    db: Session,
    user: User,
    diagnostic: DmaStandaloneDiagnostic,
    work_order_id: uuid.UUID,
) -> Dict[str, Any]:
    if not user_can_import_to_work_order(user):
        raise ValueError("Only staff can import Solomon data into work orders")
    if not user_can_edit_diagnostic(user, diagnostic):
        raise ValueError("Not allowed to import this diagnostic")
    _require_work_order_mutation_access(db, user, work_order_id)

    if diagnostic.imported_work_order_id == work_order_id:
        raise ValueError("Already imported to this work order")
    if diagnostic.imported_work_order_id and diagnostic.imported_work_order_id != work_order_id:
        raise ValueError("Diagnostic already imported to another work order")

    payload = diagnostic.payload or {}
    if not payload.get("templateId"):
        raise ValueError("Diagnostic has no guided data to import")

    note = _create_work_order_note_sync(
        db,
        user,
        work_order_id,
        _format_diagnostic_note_text(payload),
    )
    diagnostic.imported_work_order_id = work_order_id
    diagnostic.updated_by = user.id
    diagnostic.updated_at = datetime.utcnow()
    db.add(diagnostic)
    db.flush()

    return {
        "diagnostic_note_id": note.id,
        "imported_work_order_id": work_order_id,
    }


def import_repair_record_to_work_order(
    db: Session,
    user: User,
    record: DmaRepairRecord,
    work_order_id: uuid.UUID,
) -> Dict[str, Any]:
    if not user_can_import_to_work_order(user):
        raise ValueError("Only staff can import Solomon data into work orders")
    if not user_can_edit_record(user, record):
        raise ValueError("Not allowed to import this outcome")
    _require_work_order_mutation_access(db, user, work_order_id)

    if record.imported_work_order_id == work_order_id:
        raise ValueError("Already imported to this work order")
    if record.imported_work_order_id and record.imported_work_order_id != work_order_id:
        raise ValueError("Outcome already imported to another work order")

    repair_outcome_note_id = None
    if (record.confirmed_fix or "").strip():
        repair_note = _create_work_order_note_sync(
            db,
            user,
            work_order_id,
            _format_repair_outcome_note_text(record),
        )
        repair_outcome_note_id = repair_note.id

    imported_diagnostic_note_ids: List[uuid.UUID] = []
    linked_rows = (
        db.query(DmaStandaloneDiagnostic)
        .filter(DmaStandaloneDiagnostic.outcome_id == record.id)
        .all()
    )
    for row in linked_rows:
        if row.imported_work_order_id:
            continue
        payload = row.payload or {}
        if not payload.get("templateId"):
            continue
        diag_note = _create_work_order_note_sync(
            db,
            user,
            work_order_id,
            _format_diagnostic_note_text(payload),
        )
        imported_diagnostic_note_ids.append(diag_note.id)
        row.imported_work_order_id = work_order_id
        row.updated_by = user.id
        row.updated_at = datetime.utcnow()
        db.add(row)

    record.imported_work_order_id = work_order_id
    record.updated_by = user.id
    record.updated_at = datetime.utcnow()
    db.add(record)
    db.flush()

    return {
        "repair_outcome_note_id": repair_outcome_note_id,
        "imported_diagnostic_note_ids": imported_diagnostic_note_ids,
        "imported_work_order_id": work_order_id,
    }


def record_is_pool_eligible(record: DmaRepairRecord) -> bool:
    """Whether a field record counts toward DMA evidence nudges / suggestion pool."""
    if not record.repair_successful:
        return False

    confidence = (record.outcome_confidence or "").strip().lower()
    if confidence == OUTCOME_CONFIDENCE_INCORRECT:
        return False
    if confidence == OUTCOME_CONFIDENCE_UNCONFIRMED:
        return False
    # Only confirmed outcomes strengthen shared repair memory; legacy rows without confidence
    # remain eligible when repair_successful (backwards compatible).
    if confidence and confidence != OUTCOME_CONFIDENCE_CONFIRMED:
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


SOLOMON_STAFF_ROLES = frozenset({"admin", "manager", "technician"})


def user_can_use_solomon(user: User) -> bool:
    """Standalone Solomon is for staff technicians or enrolled DIY homeowners."""
    if user.is_diyer:
        return True
    roles = set(user.roles or [])
    return bool(roles & SOLOMON_STAFF_ROLES)


def require_solomon_access(user: User) -> None:
    if not user_can_use_solomon(user):
        raise ValueError(
            "Solomon access requires a homeowner or staff account. "
            "Homeowners should complete signup at /solomon/signup."
        )


def _template_label(template_id: Optional[str]) -> Optional[str]:
    if not template_id:
        return None
    return template_id.replace("_", " ").title()


def _outcome_summary_from_record(record: Optional[DmaRepairRecord]) -> Optional[Dict[str, Any]]:
    if not record:
        return None
    return {
        "repair_successful": bool(record.repair_successful),
        "moderation_status": record.moderation_status,
        "visibility": record.visibility,
    }


def standalone_diagnostic_to_response(row: DmaStandaloneDiagnostic) -> Dict[str, Any]:
    payload = row.payload or {}
    template_id = payload.get("templateId")
    outcome_summary = None
    if row.outcome_id:
        outcome_summary = _outcome_summary_from_record(row.outcome)
    return {
        "id": row.id,
        "outcome_id": row.outcome_id,
        "outcome_summary": outcome_summary,
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
        "status": row.status or DMA_DIAGNOSTIC_IN_PROGRESS,
        "template_id": template_id,
        "template_label": _template_label(template_id),
    }


def get_standalone_diagnostic(
    db: Session,
    diagnostic_id: uuid.UUID,
) -> Optional[DmaStandaloneDiagnostic]:
    return (
        db.query(DmaStandaloneDiagnostic)
        .options(joinedload(DmaStandaloneDiagnostic.outcome))
        .filter(DmaStandaloneDiagnostic.id == diagnostic_id)
        .first()
    )


def create_standalone_diagnostic(
    db: Session,
    user: User,
    data: DmaStandaloneDiagnosticCreate,
) -> DmaStandaloneDiagnostic:
    require_solomon_access(user)
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

    initial_status = data.status
    if not initial_status:
        initial_status = DMA_DIAGNOSTIC_COMPLETED if outcome_id else DMA_DIAGNOSTIC_IN_PROGRESS

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
        status=initial_status,
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
        if outcome_id:
            diagnostic.status = DMA_DIAGNOSTIC_COMPLETED
        elif diagnostic.status == DMA_DIAGNOSTIC_COMPLETED:
            diagnostic.status = DMA_DIAGNOSTIC_IN_PROGRESS

    if user.is_diyer:
        updates.pop("visibility", None)

    if "payload" in updates and updates["payload"] is not None:
        diagnostic.payload = updates.pop("payload")

    if "status" in updates and updates["status"] is not None:
        status = str(updates["status"]).strip().lower()
        if status not in DMA_DIAGNOSTIC_STATUSES:
            raise ValueError("status must be in_progress, completed, or abandoned")
        diagnostic.status = status
        updates.pop("status", None)

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
    status: Optional[str] = None,
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

    if status:
        normalized = status.strip().lower()
        if normalized in DMA_DIAGNOSTIC_STATUSES:
            query = query.filter(DmaStandaloneDiagnostic.status == normalized)

    if outcome_id:
        query = query.filter(DmaStandaloneDiagnostic.outcome_id == outcome_id)

    if context:
        query = query.filter(DmaStandaloneDiagnostic.context == context)

    total = query.count()
    pages = max(1, math.ceil(total / limit)) if total else 1
    rows = (
        query.options(joinedload(DmaStandaloneDiagnostic.outcome))
        .order_by(DmaStandaloneDiagnostic.updated_at.desc())
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
    diagnostic.status = DMA_DIAGNOSTIC_COMPLETED
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
    if diagnostic.status == DMA_DIAGNOSTIC_COMPLETED:
        diagnostic.status = DMA_DIAGNOSTIC_IN_PROGRESS
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
