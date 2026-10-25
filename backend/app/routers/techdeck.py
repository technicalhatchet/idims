"""TechDeck mobile API (paths under /api/techdeck — not work-order CRUD)."""

from __future__ import annotations

from datetime import date as py_date
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_staff_user
from app.db.database import get_db
from app.models.user import User as UserModel
from app.services.work_order_dashboard_stats_service import get_techdeck_dashboard_stats

router = APIRouter()


@router.get("/dashboard-stats", response_model=Dict[str, Any])
async def get_techdeck_dashboard_stats_endpoint(
    local_date: str = Query(..., description="Local calendar date (YYYY-MM-DD)"),
    tz_offset: int = Query(
        ...,
        description="JavaScript Date.getTimezoneOffset() for the browser",
    ),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_staff_user),
):
    """Aggregated TechDeck home counts (not derived from paginated list)."""
    try:
        parsed_date = py_date.fromisoformat(local_date)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid local_date; use YYYY-MM-DD",
        ) from exc

    return get_techdeck_dashboard_stats(
        db,
        local_date=parsed_date,
        tz_offset_minutes=tz_offset,
    )
