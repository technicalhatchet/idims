"""Schedule review requests via review_due_at (no immediate send / no Celery ETA)."""

from __future__ import annotations

import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.work_order import WorkOrder
from app.services.portal_review_request_service import review_request_eligibility
from app.services.portal_reviews_settings_service import get_portal_reviews_settings
from app.services.worker_feature_flags_service import worker_feature_enabled
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)


def schedule_review_due_after_payment(db: Session, work_order_id: UUID) -> None:
    if not worker_feature_enabled(db, "delayed_review_requests"):
        return
    wo = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not wo:
        return
    if wo.review_requested_at:
        return
    skip = review_request_eligibility(db, wo, force=False, automatic=True)
    if skip:
        return
    cfg = get_portal_reviews_settings(db)
    delay_hours = int(cfg.get("delay_hours") or 2)
    wo.review_due_at = utcnow_naive() + timedelta(hours=max(delay_hours, 0))
    db.add(wo)
    logger.debug("Scheduled review_due_at for WO %s at %s", wo.id, wo.review_due_at)
