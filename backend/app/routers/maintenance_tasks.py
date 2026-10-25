from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_admin_or_manager_user
from app.db.database import get_db
from app.models.user import User
from app.services.feature_flags_service import FeatureContext, require_feature
from app.services.maintenance_service import (
    create_task_definition,
    delete_task_definition,
    list_task_definitions,
    reset_definition_defaults,
    update_task_definition,
)

router = APIRouter()


def _staff_ctx(user: User) -> FeatureContext:
    return FeatureContext(roles=list(user.roles or []))


class MaintenanceTaskPayload(BaseModel):
    equipment_type: str
    equipment_subtype: Optional[str] = None
    name: str
    interval_months: int = Field(ge=1, le=120)
    kind: str
    how_to_text: Optional[str] = None
    parts_search_term: Optional[str] = None
    bookable_service_id: Optional[UUID] = None
    enabled: bool = True
    sort_order: int = 0


class MaintenanceTaskUpdatePayload(BaseModel):
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    name: Optional[str] = None
    interval_months: Optional[int] = Field(default=None, ge=1, le=120)
    kind: Optional[str] = None
    how_to_text: Optional[str] = None
    parts_search_term: Optional[str] = None
    bookable_service_id: Optional[UUID] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


@router.get("", response_model=List[Dict[str, Any]])
async def get_maintenance_task_definitions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "maintenance_reminders", _staff_ctx(current_user))
    return list_task_definitions(db)


@router.post("", response_model=Dict[str, Any])
async def post_maintenance_task_definition(
    payload: MaintenanceTaskPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "maintenance_reminders", _staff_ctx(current_user))
    try:
        row = create_task_definition(db, payload.model_dump())
        db.commit()
        return row
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{row_id}", response_model=Dict[str, Any])
async def put_maintenance_task_definition(
    row_id: UUID,
    payload: MaintenanceTaskUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "maintenance_reminders", _staff_ctx(current_user))
    try:
        row = update_task_definition(db, row_id, payload.model_dump(exclude_unset=True))
        if not row:
            raise HTTPException(status_code=404, detail="Task definition not found")
        db.commit()
        return row
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{row_id}")
async def delete_maintenance_task_definition(
    row_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "maintenance_reminders", _staff_ctx(current_user))
    if not delete_task_definition(db, row_id):
        raise HTTPException(status_code=404, detail="Task definition not found")
    db.commit()
    return {"success": True}


@router.post("/reset-defaults")
async def post_reset_maintenance_defaults(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "maintenance_reminders", _staff_ctx(current_user))
    count = reset_definition_defaults(db)
    db.commit()
    return {"reset": count}
