"""Confirm / dismiss recall matches."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.cpsc_recall import ClientApplianceRecallMatch
from app.services.cpsc_recall_customer_notify_service import notify_customer_confirmed_recall
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)


def confirm_recall_match(db: Session, match_id: UUID, user_id: UUID) -> Optional[ClientApplianceRecallMatch]:
    match = (
        db.query(ClientApplianceRecallMatch)
        .filter(ClientApplianceRecallMatch.id == match_id)
        .first()
    )
    if not match or match.status == "dismissed":
        return None
    if match.status == "confirmed":
        return match

    match.status = "confirmed"
    match.confirmed_at = utcnow_naive()
    match.confirmed_by = user_id
    db.add(match)
    db.commit()
    db.refresh(match)

    try:
        asyncio.run(notify_customer_confirmed_recall(db, match_id))
    except Exception:
        logger.exception("Customer recall notify failed match_id=%s", match_id)
    return match


def dismiss_recall_match(db: Session, match_id: UUID, user_id: UUID) -> Optional[ClientApplianceRecallMatch]:
    match = (
        db.query(ClientApplianceRecallMatch)
        .filter(ClientApplianceRecallMatch.id == match_id)
        .first()
    )
    if not match or match.status == "dismissed":
        return match if match and match.status == "dismissed" else None

    match.status = "dismissed"
    match.dismissed_at = utcnow_naive()
    match.dismissed_by = user_id
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


def list_matches_for_staff(
    db: Session,
    *,
    status: Optional[str] = None,
    limit: int = 200,
):
    q = (
        db.query(ClientApplianceRecallMatch)
        .options(
            joinedload(ClientApplianceRecallMatch.appliance),
            joinedload(ClientApplianceRecallMatch.recall),
        )
        .order_by(ClientApplianceRecallMatch.first_seen_at.desc())
    )
    if status:
        q = q.filter(ClientApplianceRecallMatch.status == status)
    return q.limit(limit).all()


def confirmed_recalls_for_appliance(db: Session, appliance_id: UUID):
    return (
        db.query(ClientApplianceRecallMatch)
        .options(joinedload(ClientApplianceRecallMatch.recall))
        .filter(
            ClientApplianceRecallMatch.appliance_id == appliance_id,
            ClientApplianceRecallMatch.status == "confirmed",
        )
        .all()
    )


def pending_count_for_appliance(db: Session, appliance_id: UUID) -> int:
    return (
        db.query(ClientApplianceRecallMatch)
        .filter(
            ClientApplianceRecallMatch.appliance_id == appliance_id,
            ClientApplianceRecallMatch.status == "pending",
        )
        .count()
    )
