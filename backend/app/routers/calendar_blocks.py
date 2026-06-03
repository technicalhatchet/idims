"""Technician calendar block API (schedule-test / scheduling views)."""

import logging
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session

from app.core.auth import AuthUser
from app.core.exceptions import NotFoundException, ValidationException
from app.db.database import get_db
from app.routers.scheduling import get_current_user_dependency, get_manager_or_admin_dependency
from app.schemas.calendar_block import (
    CalendarBlockCreate,
    CalendarBlockListResponse,
    CalendarBlockResponse,
    CalendarBlockUpdate,
)
from app.services import calendar_block_service as block_svc

router = APIRouter()
logger = logging.getLogger(__name__)


def _block_response(block) -> CalendarBlockResponse:
    return CalendarBlockResponse(**block_svc.format_block_response(block))


@router.get("/calendar-blocks", response_model=CalendarBlockListResponse)
async def list_calendar_blocks(
    start_date: date = Query(..., description="Range start (inclusive day)"),
    end_date: date = Query(..., description="Range end (inclusive day)"),
    technician_id: Optional[uuid.UUID] = Query(None),
    include_canceled: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user_dependency),
):
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    blocks = block_svc.list_blocks(
        db,
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        technician_id=technician_id,
        current_user=current_user,
        active_only=not include_canceled,
    )
    return CalendarBlockListResponse(
        items=[_block_response(b) for b in blocks],
        date_range={"start": start_date.isoformat(), "end": end_date.isoformat()},
    )


@router.post("/calendar-blocks", response_model=CalendarBlockResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_block(
    payload: CalendarBlockCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
):
    try:
        actor_id = block_svc._resolve_actor_user_id(current_user)
        block = block_svc.create_block(db, payload, actor_user_id=actor_id)
        return _block_response(block)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch("/calendar-blocks/{block_id}", response_model=CalendarBlockResponse)
async def update_calendar_block(
    block_id: uuid.UUID = Path(...),
    payload: CalendarBlockUpdate = ...,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
):
    try:
        actor_id = block_svc._resolve_actor_user_id(current_user)
        block = block_svc.update_block(db, block_id, payload, actor_user_id=actor_id)
        return _block_response(block)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/calendar-blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_block(
    block_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    _current_user: AuthUser = Depends(get_manager_or_admin_dependency),
):
    try:
        block_svc.delete_block(db, block_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/calendar-blocks/{block_id}/cancel", response_model=CalendarBlockResponse)
async def cancel_calendar_block(
    block_id: uuid.UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_manager_or_admin_dependency),
):
    try:
        actor_id = block_svc._resolve_actor_user_id(current_user)
        block = block_svc.cancel_block(db, block_id, actor_user_id=actor_id)
        return _block_response(block)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
