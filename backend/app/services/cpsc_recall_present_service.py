"""API payloads for recall matches on appliances."""

from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.cpsc_recall import ClientApplianceRecallMatch


def _recall_dict(match: ClientApplianceRecallMatch) -> Dict[str, Any]:
    recall = match.recall
    return {
        "match_id": str(match.id),
        "status": match.status,
        "matched_on": match.matched_on,
        "match_rule": match.match_rule,
        "cpsc_recall_id": recall.cpsc_recall_id if recall else None,
        "title": recall.title if recall else "",
        "recall_date": recall.recall_date.isoformat() if recall and recall.recall_date else None,
        "url": recall.url if recall else None,
        "hazard": recall.hazard if recall else None,
        "remedy": recall.remedy if recall else None,
        "manufacturer": recall.manufacturer if recall else None,
    }


def recalls_for_appliance_payload(
    db: Session,
    appliance_id: UUID,
    *,
    customer_view: bool,
) -> Dict[str, Any]:
    q = (
        db.query(ClientApplianceRecallMatch)
        .options(joinedload(ClientApplianceRecallMatch.recall))
        .filter(ClientApplianceRecallMatch.appliance_id == appliance_id)
    )
    if customer_view:
        q = q.filter(ClientApplianceRecallMatch.status == "confirmed")
    else:
        q = q.filter(ClientApplianceRecallMatch.status.in_(("pending", "confirmed")))

    matches = q.all()
    pending_count = sum(1 for m in matches if m.status == "pending")
    confirmed = [_recall_dict(m) for m in matches if m.status == "confirmed"]
    pending = [_recall_dict(m) for m in matches if m.status == "pending"] if not customer_view else []

    return {
        "pending_count": pending_count,
        "has_unconfirmed": pending_count > 0,
        "confirmed_recalls": confirmed,
        "pending_recalls": pending,
    }
