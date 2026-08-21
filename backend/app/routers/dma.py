import logging
import uuid
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from app.constants.dma_codes import DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dma import (
    DmaCodesResponse,
    DmaRepairOutcomeResponse,
    DmaRepairRecordCreate,
    DmaRepairRecordResponse,
    DmaRepairRecordUpdate,
    DmaSearchResponse,
    DmaSuggestionsResponse,
    DmaEvidenceNudgesResponse,
    DmaPatternReportResponse,
    DmaErrorCodeReferenceResponse,
    DmaErrorCodeSearchResponse,
    DmaTagsResponse,
    DmaTagResponse,
    DmaOutcomeStatusResponse,
    DmaStandaloneDiagnosticCreate,
    DmaStandaloneDiagnosticUpdate,
    DmaStandaloneDiagnosticResponse,
    DmaStandaloneDiagnosticListResponse,
    DmaRepairRecordModerateRequest,
    DmaImportToWorkOrderResponse,
)
from app.services.dma_service import (
    create_repair_record,
    delete_repair_record,
    get_dma_suggestions,
    get_dma_evidence_nudges,
    get_dma_pattern_report,
    get_error_code_reference,
    get_outcome_for_work_order,
    get_repair_record,
    list_tags,
    repair_record_to_response,
    search_error_code_references,
    search_repair_outcomes,
    update_repair_record,
    _tag_dicts,
)
from app.services.dma_standalone_service import (
    create_standalone_diagnostic,
    delete_standalone_diagnostic,
    get_standalone_diagnostic,
    link_diagnostic_to_outcome,
    link_diagnostic_to_work_order_bones,
    link_record_to_work_order_bones,
    list_standalone_diagnostics,
    moderate_repair_record,
    repair_record_to_response_extended,
    standalone_diagnostic_to_response,
    unlink_diagnostic_from_outcome,
    update_standalone_diagnostic,
    user_can_edit_diagnostic,
    user_can_edit_record,
    user_can_view_diagnostic,
    user_can_view_record,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/codes", response_model=DmaCodesResponse)
async def get_dma_codes(
    current_user: User = Depends(get_current_user),
):
    """Return problem and resolution code labels for Repair Outcome notes."""
    return DmaCodesResponse(
        problem_codes=DMA_PROBLEM_CODES,
        resolution_codes=DMA_RESOLUTION_CODES,
    )


@router.get("/tags", response_model=DmaTagsResponse)
async def get_dma_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all repair memory tags."""
    try:
        tags = list_tags(db)
    except (ProgrammingError, OperationalError) as exc:
        logger.warning("DMA tags table unavailable: %s", exc)
        return DmaTagsResponse(items=[])
    return DmaTagsResponse(items=[DmaTagResponse.model_validate(tag) for tag in tags])


@router.get("/error-codes/search", response_model=DmaErrorCodeSearchResponse)
async def search_dma_error_codes(
    q: Optional[str] = Query(None, description="Search code, meaning, causes, or fix"),
    equipment_make: Optional[str] = Query(None),
    equipment_subtype: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search read-only manufacturer error code reference rows."""
    result = search_error_code_references(
        db,
        q=q,
        equipment_make=equipment_make,
        equipment_subtype=equipment_subtype,
        code=code,
        page=page,
        limit=limit,
    )
    return DmaErrorCodeSearchResponse(**result)


@router.get("/error-codes/{reference_id}", response_model=DmaErrorCodeReferenceResponse)
async def get_dma_error_code(
    reference_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = get_error_code_reference(db, reference_id)
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error code not found")
    return DmaErrorCodeReferenceResponse(**payload)


@router.get("/suggestions", response_model=DmaSuggestionsResponse)
async def get_dma_repair_suggestions(
    equipment_make: Optional[str] = Query(None),
    equipment_subtype: Optional[str] = Query(None),
    error_code: Optional[str] = Query(None),
    work_order_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """In-context repair memory suggestions for equipment on a job."""
    result = get_dma_suggestions(
        db,
        equipment_make=equipment_make,
        equipment_subtype=equipment_subtype,
        error_code=error_code,
        work_order_id=work_order_id,
    )
    return DmaSuggestionsResponse(**result)


@router.get("/evidence-nudges", response_model=DmaEvidenceNudgesResponse)
async def get_dma_evidence_nudges_route(
    equipment_subtype: str = Query(..., description="DMA equipment subtype slug"),
    equipment_make: Optional[str] = Query(None),
    tags: List[str] = Query(..., description="DMA tag slug(s) to match"),
    exclude_work_order_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historical repair counts per tag — feeds diagnostic evidence nudges (Phase 6d)."""
    result = get_dma_evidence_nudges(
        db,
        equipment_subtype=equipment_subtype,
        equipment_make=equipment_make,
        tags=tags,
        exclude_work_order_id=exclude_work_order_id,
    )
    return DmaEvidenceNudgesResponse(**result)


@router.get("/pattern-report", response_model=DmaPatternReportResponse)
async def get_dma_pattern_report_route(
    equipment_make: Optional[str] = Query(None),
    equipment_subtype: Optional[str] = Query(None),
    problem_code: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by DMA tag slug(s)"),
    min_cases: int = Query(2, ge=1, le=10),
    limit: int = Query(10, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Read-only repair pattern discovery (Phase 6f)."""
    result = get_dma_pattern_report(
        db,
        equipment_make=equipment_make,
        equipment_subtype=equipment_subtype,
        problem_code=problem_code,
        tags=tags,
        min_cases=min_cases,
        limit=limit,
    )
    return DmaPatternReportResponse(**result)


@router.get("/search", response_model=DmaSearchResponse)
async def search_dma_repairs(
    q: Optional[str] = Query(None, description="Free-text search"),
    equipment_make: Optional[str] = Query(None),
    equipment_subtype: Optional[str] = Query(None),
    problem_code: Optional[str] = Query(None),
    resolution_code: Optional[str] = Query(None),
    error_code: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tag slug(s)"),
    repair_successful: Optional[bool] = Query(None, description="Filter by success; omit for all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search confirmed repair outcomes and standalone field records."""
    result = search_repair_outcomes(
        db,
        q=q,
        equipment_make=equipment_make,
        equipment_subtype=equipment_subtype,
        problem_code=problem_code,
        resolution_code=resolution_code,
        error_code=error_code,
        tags=tags,
        repair_successful=repair_successful,
        page=page,
        limit=limit,
    )
    return DmaSearchResponse(**result)


@router.post("/records", response_model=DmaRepairRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_dma_repair_record(
    body: DmaRepairRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a standalone field repair memory record (no work order)."""
    try:
        record = create_repair_record(db, current_user.id, body, user=current_user)
        db.commit()
        record = get_repair_record(db, record.id)
        return DmaRepairRecordResponse(**repair_record_to_response_extended(record, db))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error("Error creating DMA repair record: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create record")


@router.get("/records/{record_id}", response_model=DmaRepairRecordResponse)
async def get_dma_repair_record(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = get_repair_record(db, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    if not user_can_view_record(current_user, record):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return DmaRepairRecordResponse(**repair_record_to_response_extended(record, db))


@router.put("/records/{record_id}", response_model=DmaRepairRecordResponse)
async def update_dma_repair_record(
    record_id: uuid.UUID,
    body: DmaRepairRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = get_repair_record(db, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    if not user_can_edit_record(current_user, record):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        record = update_repair_record(db, record, current_user.id, body)
        db.commit()
        record = get_repair_record(db, record.id)
        return DmaRepairRecordResponse(**repair_record_to_response_extended(record, db))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error("Error updating DMA repair record: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update record")


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dma_repair_record(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = get_repair_record(db, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    if not user_can_edit_record(current_user, record):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        delete_repair_record(db, record)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Error deleting DMA repair record: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete record")


@router.get("/work-orders/{work_order_id}/outcome-status", response_model=DmaOutcomeStatusResponse)
async def get_work_order_outcome_status(
    work_order_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check whether a work order already has a DMA repair outcome."""
    outcome = get_outcome_for_work_order(db, work_order_id)
    return DmaOutcomeStatusResponse(has_outcome=outcome is not None)


@router.get("/work-orders/{work_order_id}", response_model=DmaRepairOutcomeResponse)
async def get_work_order_dma_outcome(
    work_order_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the DMA repair outcome for a single work order, if recorded."""
    from app.models.work_order import WorkOrder

    outcome = get_outcome_for_work_order(db, work_order_id)
    if not outcome:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No repair outcome recorded")

    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    payload = {
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
        "order_number": work_order.order_number if work_order else None,
        "equipment_make": work_order.equipment_make if work_order else None,
        "equipment_model": work_order.equipment_model if work_order else None,
        "equipment_type": work_order.equipment_type if work_order else None,
        "equipment_subtype": work_order.equipment_subtype if work_order else None,
        "equipment_serial": work_order.equipment_serial if work_order else None,
        "symptoms": work_order.symptoms if work_order else None,
        "work_order_description": work_order.description if work_order else None,
        "tags": _tag_dicts(outcome.tags),
    }
    return DmaRepairOutcomeResponse(**payload)


@router.post("/records/{record_id}/moderate", response_model=DmaRepairRecordResponse)
async def moderate_dma_repair_record(
    record_id: uuid.UUID,
    body: DmaRepairRecordModerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve or reject a field record for the shared repair memory pool."""
    record = get_repair_record(db, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    try:
        record = moderate_repair_record(db, current_user, record, body)
        db.commit()
        record = get_repair_record(db, record.id)
        return DmaRepairRecordResponse(**repair_record_to_response_extended(record, db))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error("Error moderating DMA repair record: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to moderate record")


@router.post(
    "/records/{record_id}/import-to-work-order/{work_order_id}",
    response_model=DmaImportToWorkOrderResponse,
)
async def import_dma_record_to_work_order(
    record_id: uuid.UUID,
    work_order_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record intent to import a standalone outcome into a work order (full import TBD)."""
    record = get_repair_record(db, record_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    try:
        record = link_record_to_work_order_bones(db, current_user, record, work_order_id)
        db.commit()
        return DmaImportToWorkOrderResponse(
            record_id=record.id,
            work_order_id=work_order_id,
            imported_work_order_id=record.imported_work_order_id,
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error("Error linking DMA record to work order: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to link record")


@router.get("/diagnostics", response_model=DmaStandaloneDiagnosticListResponse)
async def list_dma_standalone_diagnostics(
    linked: Optional[bool] = Query(None, description="Filter by linked vs unlinked diagnostics"),
    outcome_id: Optional[uuid.UUID] = Query(None),
    context: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = list_standalone_diagnostics(
        db,
        current_user,
        linked=linked,
        outcome_id=outcome_id,
        context=context,
        page=page,
        limit=limit,
    )
    return DmaStandaloneDiagnosticListResponse(**result)


@router.post("/diagnostics", response_model=DmaStandaloneDiagnosticResponse, status_code=status.HTTP_201_CREATED)
async def create_dma_standalone_diagnostic(
    body: DmaStandaloneDiagnosticCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        row = create_standalone_diagnostic(db, current_user, body)
        db.commit()
        row = get_standalone_diagnostic(db, row.id)
        return DmaStandaloneDiagnosticResponse(**standalone_diagnostic_to_response(row))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error("Error creating standalone diagnostic: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create diagnostic")


@router.get("/diagnostics/{diagnostic_id}", response_model=DmaStandaloneDiagnosticResponse)
async def get_dma_standalone_diagnostic(
    diagnostic_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_standalone_diagnostic(db, diagnostic_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic not found")
    if not user_can_view_diagnostic(current_user, row):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return DmaStandaloneDiagnosticResponse(**standalone_diagnostic_to_response(row))


@router.put("/diagnostics/{diagnostic_id}", response_model=DmaStandaloneDiagnosticResponse)
async def update_dma_standalone_diagnostic(
    diagnostic_id: uuid.UUID,
    body: DmaStandaloneDiagnosticUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_standalone_diagnostic(db, diagnostic_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic not found")
    if not user_can_edit_diagnostic(current_user, row):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        row = update_standalone_diagnostic(db, current_user, row, body)
        db.commit()
        row = get_standalone_diagnostic(db, row.id)
        return DmaStandaloneDiagnosticResponse(**standalone_diagnostic_to_response(row))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error("Error updating standalone diagnostic: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update diagnostic")


@router.delete("/diagnostics/{diagnostic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dma_standalone_diagnostic(
    diagnostic_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_standalone_diagnostic(db, diagnostic_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic not found")
    if not user_can_edit_diagnostic(current_user, row):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        delete_standalone_diagnostic(db, row)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Error deleting standalone diagnostic: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete diagnostic")


@router.post("/diagnostics/{diagnostic_id}/link-outcome/{outcome_id}", response_model=DmaStandaloneDiagnosticResponse)
async def link_dma_diagnostic_to_outcome(
    diagnostic_id: uuid.UUID,
    outcome_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_standalone_diagnostic(db, diagnostic_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic not found")
    try:
        row = link_diagnostic_to_outcome(db, current_user, row, outcome_id)
        db.commit()
        row = get_standalone_diagnostic(db, row.id)
        return DmaStandaloneDiagnosticResponse(**standalone_diagnostic_to_response(row))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/diagnostics/{diagnostic_id}/unlink-outcome", response_model=DmaStandaloneDiagnosticResponse)
async def unlink_dma_diagnostic_from_outcome(
    diagnostic_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_standalone_diagnostic(db, diagnostic_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic not found")
    try:
        row = unlink_diagnostic_from_outcome(db, current_user, row)
        db.commit()
        row = get_standalone_diagnostic(db, row.id)
        return DmaStandaloneDiagnosticResponse(**standalone_diagnostic_to_response(row))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post(
    "/diagnostics/{diagnostic_id}/import-to-work-order/{work_order_id}",
    response_model=DmaImportToWorkOrderResponse,
)
async def import_dma_diagnostic_to_work_order(
    diagnostic_id: uuid.UUID,
    work_order_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_standalone_diagnostic(db, diagnostic_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic not found")
    try:
        row = link_diagnostic_to_work_order_bones(db, current_user, row, work_order_id)
        db.commit()
        return DmaImportToWorkOrderResponse(
            record_id=row.id,
            work_order_id=work_order_id,
            imported_work_order_id=row.imported_work_order_id,
            message="Diagnostic work order linkage recorded; full import is not yet implemented.",
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
