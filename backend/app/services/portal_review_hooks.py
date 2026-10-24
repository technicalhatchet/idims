"""Schedule review requests after payment (review_due_at + beat, no Celery ETA)."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.portal_review_schedule_service import schedule_review_due_after_payment

logger = logging.getLogger(__name__)


def maybe_schedule_review_request(db: Session, work_order_id: UUID) -> None:
    """Set review_due_at when worker flag delayed_review_requests is enabled."""
    try:
        schedule_review_due_after_payment(db, work_order_id)
    except Exception:
        logger.exception("Failed to schedule review_due_at for WO %s", work_order_id)
