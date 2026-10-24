from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_admin_or_manager_user
from app.db.database import get_db
from app.models.user import User
from app.services.appliance_lifespan_service import (
    create_lifespan_range,
    delete_lifespan_range,
    list_lifespan_ranges,
    redecode_all_appliance_ages,
    reset_lifespan_defaults,
    update_lifespan_range,
)
from app.services.feature_flags_service import FeatureContext, feature_enabled, require_feature

router = APIRouter()


def _staff_ctx(user: User) -> FeatureContext:
    return FeatureContext(roles=list(user.roles or []))


class LifespanPayload(BaseModel):
    equipment_type: str
    equipment_subtype: Optional[str] = None
    typical_min_years: int = Field(ge=1, le=40)
    typical_max_years: int = Field(ge=1, le=40)
    notes: Optional[str] = None


class LifespanUpdatePayload(BaseModel):
    equipment_type: Optional[str] = None
    equipment_subtype: Optional[str] = None
    typical_min_years: Optional[int] = Field(default=None, ge=1, le=40)
    typical_max_years: Optional[int] = Field(default=None, ge=1, le=40)
    notes: Optional[str] = None


@router.get("", response_model=List[Dict[str, Any]])
async def get_lifespan_ranges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "appliance_age", _staff_ctx(current_user))
    return list_lifespan_ranges(db)


@router.post("", response_model=Dict[str, Any])
async def post_lifespan_range(
    payload: LifespanPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "appliance_age", _staff_ctx(current_user))
    try:
        row = create_lifespan_range(db, payload.model_dump())
        db.commit()
        return row
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{row_id}", response_model=Dict[str, Any])
async def put_lifespan_range(
    row_id: UUID,
    payload: LifespanUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "appliance_age", _staff_ctx(current_user))
    try:
        row = update_lifespan_range(db, row_id, payload.model_dump(exclude_unset=True))
        if not row:
            raise HTTPException(status_code=404, detail="Lifespan row not found")
        db.commit()
        return row
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{row_id}")
async def remove_lifespan_range(
    row_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "appliance_age", _staff_ctx(current_user))
    if not delete_lifespan_range(db, row_id):
        raise HTTPException(status_code=404, detail="Lifespan row not found")
    db.commit()
    return {"success": True}


@router.post("/reset-defaults")
async def post_reset_defaults(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "appliance_age", _staff_ctx(current_user))
    count = reset_lifespan_defaults(db)
    db.commit()
    return {"reset_count": count}


@router.post("/redecode-all")
async def post_redecode_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "appliance_age", _staff_ctx(current_user))
    result = redecode_all_appliance_ages(db)
    db.commit()
    return result
