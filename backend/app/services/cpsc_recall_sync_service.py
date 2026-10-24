"""Upsert CPSC recalls and match appliances (pending until staff confirms)."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from uuid import UUID

from app.models.client_appliance import ClientAppliance
from app.models.cpsc_recall import ClientApplianceRecallMatch, CpscRecall, CpscRecallSyncState
from app.services.cpsc_recall_brand_families import families_compatible
from app.services.cpsc_recall_fetch_service import fetch_all_configured_manufacturers
from app.services.cpsc_recall_model_match import match_model_to_recall

logger = logging.getLogger(__name__)


def _get_sync_state(db: Session) -> CpscRecallSyncState:
    row = db.query(CpscRecallSyncState).filter(CpscRecallSyncState.id == 1).first()
    if not row:
        row = CpscRecallSyncState(id=1)
        db.add(row)
        db.flush()
    return row


def upsert_recalls(db: Session, rows: List[dict]) -> int:
    count = 0
    for row in rows:
        existing = (
            db.query(CpscRecall).filter(CpscRecall.cpsc_recall_id == row["cpsc_recall_id"]).first()
        )
        if existing:
            existing.title = row["title"]
            existing.recall_date = row.get("recall_date")
            existing.last_publish_date = row.get("last_publish_date")
            existing.url = row.get("url")
            existing.hazard = row.get("hazard")
            existing.remedy = row.get("remedy")
            existing.manufacturer = row.get("manufacturer")
            existing.product_name = row.get("product_name")
            existing.model_numbers = row.get("model_numbers") or []
            existing.raw_payload = row.get("raw_payload")
        else:
            db.add(CpscRecall(**row))
            count += 1
    return count


def match_appliances_to_recalls(db: Session, recall_ids: Optional[List[int]] = None) -> int:
    """Create pending matches for appliances; returns count of NEW pending rows."""
    recall_query = db.query(CpscRecall)
    if recall_ids:
        recall_query = recall_query.filter(CpscRecall.cpsc_recall_id.in_(recall_ids))
    recalls = recall_query.all()

    appliances = (
        db.query(ClientAppliance)
        .filter(
            ClientAppliance.is_active.is_(True),
            ClientAppliance.merged_into_id.is_(None),
            ClientAppliance.model.isnot(None),
            ClientAppliance.model != "",
        )
        .all()
    )

    new_pending = 0
    for appt in appliances:
        for recall in recalls:
            if not families_compatible(appt.make, recall.manufacturer):
                continue
            models = recall.model_numbers or []
            if not models:
                continue
            hit = match_model_to_recall(appt.model or "", models)
            if not hit:
                continue
            matched_on, match_rule = hit
            existing = (
                db.query(ClientApplianceRecallMatch)
                .filter(
                    ClientApplianceRecallMatch.appliance_id == appt.id,
                    ClientApplianceRecallMatch.cpsc_recall_id == recall.cpsc_recall_id,
                )
                .first()
            )
            if existing:
                continue
            db.add(
                ClientApplianceRecallMatch(
                    appliance_id=appt.id,
                    cpsc_recall_id=recall.cpsc_recall_id,
                    status="pending",
                    matched_on=matched_on,
                    match_rule=match_rule,
                )
            )
            new_pending += 1
    return new_pending


def match_single_appliance(db: Session, appliance_id: UUID) -> int:
    appliance = db.query(ClientAppliance).filter(ClientAppliance.id == appliance_id).first()
    if not appliance or not appliance.model:
        return 0
    recalls = db.query(CpscRecall).all()
    new_pending = 0
    for recall in recalls:
        if not families_compatible(appliance.make, recall.manufacturer):
            continue
        models = recall.model_numbers or []
        hit = match_model_to_recall(appliance.model or "", models)
        if not hit:
            continue
        matched_on, match_rule = hit
        existing = (
            db.query(ClientApplianceRecallMatch)
            .filter(
                ClientApplianceRecallMatch.appliance_id == appliance.id,
                ClientApplianceRecallMatch.cpsc_recall_id == recall.cpsc_recall_id,
            )
            .first()
        )
        if existing:
            continue
        db.add(
            ClientApplianceRecallMatch(
                appliance_id=appliance.id,
                cpsc_recall_id=recall.cpsc_recall_id,
                status="pending",
                matched_on=matched_on,
                match_rule=match_rule,
            )
        )
        new_pending += 1
    if new_pending:
        db.commit()
    return new_pending


def run_cpsc_recall_sync(db: Session) -> Tuple[int, int, int]:
    """
    Fetch from CPSC, upsert recalls, match appliances.
    Returns (new_recalls, new_pending_matches, total_new_pending_after_sync).
    """
    state = _get_sync_state(db)
    bootstrap = not state.bootstrap_completed
    last_start = state.last_publish_date_start
    if not bootstrap and last_start:
        incremental_start = last_start - timedelta(days=1)
    else:
        incremental_start = None

    rows = fetch_all_configured_manufacturers(
        bootstrap=bootstrap,
        last_publish_date_start=incremental_start,
    )
    new_recalls = upsert_recalls(db, rows)

    recall_ids = [r["cpsc_recall_id"] for r in rows] if rows else None
    new_pending = match_appliances_to_recalls(db, recall_ids)

    if rows:
        max_publish = max(
            (r.get("last_publish_date") for r in rows if r.get("last_publish_date")),
            default=None,
        )
        if max_publish:
            state.last_publish_date_start = max_publish
    state.bootstrap_completed = True
    db.add(state)
    db.commit()

    total_pending = (
        db.query(ClientApplianceRecallMatch)
        .filter(ClientApplianceRecallMatch.status == "pending")
        .count()
    )
    return new_recalls, new_pending, total_pending
