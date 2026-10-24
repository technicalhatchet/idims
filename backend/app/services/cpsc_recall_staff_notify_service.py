"""Staff alert when new pending recall matches need review."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.frontend_site_urls import build_frontend_url
from app.services.portal_staff_notify_service import _email_ops, portal_ops_email
from app.services.web_push_service import notify_admins_push

logger = logging.getLogger(__name__)


async def notify_staff_new_pending_recall_matches(db: Session, new_pending_count: int) -> None:
    if new_pending_count <= 0:
        return

    title = "Recall matches need review"
    body = f"{new_pending_count} possible recall match{'es' if new_pending_count != 1 else ''} to review"
    url = build_frontend_url("/techboard/recall-matches")

    try:
        notify_admins_push(
            db,
            title=title,
            body=body,
            url=url,
            tag="recall-pending-review",
            rule_key="recall_pending_review",
        )
    except Exception:
        logger.exception("Recall pending push failed")

    subject = f"{new_pending_count} possible recall matches to review"
    html = f"""
    <p>{body}.</p>
    <p><a href="{url}">Open Recall matches in TechDeck</a></p>
    """
    await _email_ops(subject, html)
    logger.info(
        "Recall pending staff notice sent count=%s to=%s",
        new_pending_count,
        portal_ops_email(),
    )
