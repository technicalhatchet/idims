from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_admin_or_manager_user
from app.models.user import User
from app.services.cpsc_recall_workflow_service import (
    confirm_recall_match,
    dismiss_recall_match,
    list_matches_for_staff,
)
from app.services.feature_flags_service import FeatureContext, feature_enabled, require_feature

router = APIRouter()


class RecallSummary(BaseModel):
    cpsc_recall_id: int
    title: str
    recall_date: Optional[str] = None
    url: Optional[str] = None
    hazard: Optional[str] = None
    remedy: Optional[str] = None
    manufacturer: Optional[str] = None


class RecallMatchResponse(BaseModel):
    id: UUID
    status: str
    matched_on: str
    match_rule: str
    first_seen_at: str
    appliance_id: UUID
    appliance_make: Optional[str] = None
    appliance_model: Optional[str] = None
    appliance_nickname: Optional[str] = None
    client_id: Optional[UUID] = None
    recall: RecallSummary
    model_config = ConfigDict(from_attributes=True)


def _staff_ctx(user: User) -> FeatureContext:
    roles = list(user.roles or [])
    return FeatureContext(roles=roles)


def _to_response(match) -> RecallMatchResponse:
    appt = match.appliance
    recall = match.recall
    return RecallMatchResponse(
        id=match.id,
        status=match.status,
        matched_on=match.matched_on,
        match_rule=match.match_rule,
        first_seen_at=match.first_seen_at.isoformat() if match.first_seen_at else "",
        appliance_id=match.appliance_id,
        appliance_make=appt.make if appt else None,
        appliance_model=appt.model if appt else None,
        appliance_nickname=appt.nickname if appt else None,
        client_id=appt.client_id if appt else None,
        recall=RecallSummary(
            cpsc_recall_id=recall.cpsc_recall_id,
            title=recall.title,
            recall_date=recall.recall_date.isoformat() if recall.recall_date else None,
            url=recall.url,
            hazard=recall.hazard,
            remedy=recall.remedy,
            manufacturer=recall.manufacturer,
        ),
    )


def _pending_recall_count(db: Session, user: User) -> int:
    if not feature_enabled(db, "recall_alerts", _staff_ctx(user)):
        return 0
    from app.models.cpsc_recall import ClientApplianceRecallMatch

    return (
        db.query(ClientApplianceRecallMatch)
        .filter(ClientApplianceRecallMatch.status == "pending")
        .count()
    )


@router.get("/matches/pending-count")
async def matches_pending_recall_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    return {"pending": _pending_recall_count(db, current_user)}


@router.get("/matches", response_model=List[RecallMatchResponse])
async def get_recall_matches(
    status: Optional[str] = Query(None, pattern="^(pending|confirmed|dismissed)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "recall_alerts", _staff_ctx(current_user))
    rows = list_matches_for_staff(db, status=status)
    return [_to_response(m) for m in rows]


@router.post("/matches/{match_id}/confirm", response_model=RecallMatchResponse)
async def confirm_match(
    match_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "recall_alerts", _staff_ctx(current_user))
    match = confirm_recall_match(db, match_id, current_user.id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    from sqlalchemy.orm import joinedload
    from app.models.cpsc_recall import ClientApplianceRecallMatch

    match = (
        db.query(ClientApplianceRecallMatch)
        .options(
            joinedload(ClientApplianceRecallMatch.appliance),
            joinedload(ClientApplianceRecallMatch.recall),
        )
        .filter(ClientApplianceRecallMatch.id == match_id)
        .first()
    )
    return _to_response(match)


@router.post("/matches/{match_id}/dismiss", response_model=RecallMatchResponse)
async def dismiss_match(
    match_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    require_feature(db, "recall_alerts", _staff_ctx(current_user))
    match = dismiss_recall_match(db, match_id, current_user.id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    from sqlalchemy.orm import joinedload
    from app.models.cpsc_recall import ClientApplianceRecallMatch

    match = (
        db.query(ClientApplianceRecallMatch)
        .options(
            joinedload(ClientApplianceRecallMatch.appliance),
            joinedload(ClientApplianceRecallMatch.recall),
        )
        .filter(ClientApplianceRecallMatch.id == match_id)
        .first()
    )
    return _to_response(match)


@router.get("/pending-count")
async def pending_recall_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    return {"pending": _pending_recall_count(db, current_user)}
