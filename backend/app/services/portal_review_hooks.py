"""Enqueue review requests after payment commits (BackgroundTasks only)."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder
from app.services.portal_review_request_service import (
    send_portal_review_request,
    work_order_paid_and_ready,
)

logger = logging.getLogger(__name__)


def maybe_enqueue_review_request(
    background_tasks: BackgroundTasks,
    db: Session,
    work_order_id: UUID,
) -> None:
    from app.services.feature_flags_service import feature_enabled

    if not feature_enabled(db, "review_requests", None):
        return
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo or not work_order_paid_and_ready(db, wo):
        return
    background_tasks.add_task(_run_review_request, str(work_order_id))


def _run_review_request(work_order_id: str) -> None:
    from app.db.database import SessionLocal

    session = SessionLocal()
    try:
        asyncio.run(send_portal_review_request(session, UUID(work_order_id)))
    except Exception:
        logger.exception("Review request background task failed for WO %s", work_order_id)
    finally:
        session.close()
