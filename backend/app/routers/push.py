from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import logging

from app.db.database import get_db
from app.routers.auth import get_current_user_dependency
from app.core.auth import AuthUser
from app.config import settings
from app.models.push_subscription import PushSubscription
from app.services.web_push_service import (
    check_deploy_proximity,
    process_due_deploy_reminders,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class ProximityCheckBody(BaseModel):
    appointment_id: uuid.UUID
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    key = settings.VAPID_PUBLIC_KEY
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Web push is not configured",
        )
    return {"publicKey": key}


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe_push(
    body: PushSubscriptionCreate,
    current_user: AuthUser = Depends(get_current_user_dependency()),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(PushSubscription)
        .filter(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == body.endpoint,
        )
        .first()
    )
    if existing:
        existing.p256dh_key = body.keys.p256dh
        existing.auth_key = body.keys.auth
    else:
        db.add(
            PushSubscription(
                user_id=current_user.id,
                endpoint=body.endpoint,
                p256dh_key=body.keys.p256dh,
                auth_key=body.keys.auth,
            )
        )
    db.commit()
    return None


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_push(
    body: PushSubscriptionCreate,
    current_user: AuthUser = Depends(get_current_user_dependency()),
    db: Session = Depends(get_db),
):
    db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id,
        PushSubscription.endpoint == body.endpoint,
    ).delete(synchronize_session=False)
    db.commit()
    return None


@router.post("/proximity-check")
async def proximity_check(
    body: ProximityCheckBody,
    current_user: AuthUser = Depends(get_current_user_dependency()),
    db: Session = Depends(get_db),
):
    return check_deploy_proximity(
        db,
        body.appointment_id,
        current_user.id,
        body.lat,
        body.lng,
    )


@router.post("/process-reminders")
async def process_reminders(
    current_user: AuthUser = Depends(get_current_user_dependency()),
    db: Session = Depends(get_db),
):
    """Client heartbeat: fire any due deploy reminders (fallback when Celery beat is off)."""
    sent = process_due_deploy_reminders(db)
    return {"sent": sent}
