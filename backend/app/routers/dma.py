import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.constants.dma_codes import DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dma import DmaCodesResponse, DmaRepairOutcomeResponse, DmaSearchResponse
from app.services.dma_service import get_outcome_for_work_order, search_repair_outcomes

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
    """Search confirmed repair outcomes for field diagnostics."""
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
