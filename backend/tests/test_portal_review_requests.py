"""Portal review requests (Wave 1B)."""

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.portal_review_request_service import review_request_eligibility


def _wo(**kwargs):
    return SimpleNamespace(
        id=kwargs.pop("id", uuid4()),
        client_id=kwargs.pop("client_id", uuid4()),
        status=kwargs.pop("status", "completed"),
        is_redo=kwargs.pop("is_redo", False),
        review_requested_at=kwargs.pop("review_requested_at", None),
        client=kwargs.pop("client", SimpleNamespace(email="a@example.com")),
        **kwargs,
    )


def test_skip_when_disabled():
    db = MagicMock()
    wo = _wo()
    with patch(
        "app.services.portal_review_request_service.get_portal_reviews_settings",
        return_value={"enabled": False, "google_review_url": "https://example.com"},
    ):
        assert review_request_eligibility(db, wo) == "disabled"


def test_skip_redo():
    db = MagicMock()
    wo = _wo(is_redo=True, status="completed")
    with patch(
        "app.services.portal_review_request_service.get_portal_reviews_settings",
        return_value={"enabled": True, "google_review_url": "https://example.com"},
    ):
        assert review_request_eligibility(db, wo) == "redo_recall_refund"
