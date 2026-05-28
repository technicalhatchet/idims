import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
)
from app.services.dma_service import (
    create_repair_record,
    delete_repair_record,
    get_dma_suggestions,
    get_outcome_for_work_order,
    get_repair_record,
    search_repair_outcomes,
    update_repair_record,
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


@router.get("/search", response_model=DmaSearchResponse)
async def search_dma_repairs(
    q: Optional[str] = Query(None, description="Free-text search"),
    equipment_make: Optional[str] = Query(None),
    equipment_subtype: Optional[str] = Query(None),
    problem_code: Optional[str] = Query(None),
    resolution_code: Optional[str] = Query(None),
    error_code: Optional[str] = Query(None),
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
        record = create_repair_record(db, current_user.id, body)
        db.commit()
        db.refresh(record)
        return record
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
    return record


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
    try:
        record = update_repair_record(db, record, current_user.id, body)
        db.commit()
        db.refresh(record)
        return record
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
    try:
        delete_repair_record(db, record)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Error deleting DMA repair record: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete record")


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
    }
    return DmaRepairOutcomeResponse(**payload)
