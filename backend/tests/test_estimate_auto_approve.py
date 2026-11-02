"""Estimate auto-approve after pending_estimate_approval promotion."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.estimate_auto_approve_service import (
    effective_estimate_auto_approve_limit,
    try_auto_approve_pending_estimate,
)


def test_effective_limit_property_overrides_client():
    db = MagicMock()
    client = SimpleNamespace(estimate_auto_approve_limit=Decimal("100"))
    prop = SimpleNamespace(estimate_auto_approve_limit=Decimal("250"))
    db.query.return_value.filter.return_value.first.return_value = prop
    limit = effective_estimate_auto_approve_limit(
        db, client=client, property_id=uuid4()
    )
    assert limit == Decimal("250")


@patch("app.services.feature_flags_service.feature_enabled", return_value=True)
@patch("app.services.estimate_auto_approve_service.record_estimate_approval")
@patch("app.services.estimate_auto_approve_service.build_portal_estimate_snapshot")
def test_auto_approve_when_total_under_limit(mock_snapshot, mock_record, _flag):
    db = MagicMock()
    client_id = uuid4()
    client = SimpleNamespace(id=client_id, estimate_auto_approve_limit=Decimal("500"))
    wo = SimpleNamespace(id=uuid4(), client_id=client_id, property_id=None, order_number="WO-1")
    db.query.return_value.filter.return_value.first.return_value = client
    mock_snapshot.return_value = {"total": 200.0, "estimate_content_hash": "abc"}

    with patch(
        "app.services.client_portal_notification_service.notify_owner_portal_logins_sync",
        return_value=[],
    ):
        assert try_auto_approve_pending_estimate(db, wo) is True
    mock_record.assert_called_once()
    assert mock_record.call_args.kwargs["decision_source"] == "auto"


@patch("app.services.feature_flags_service.feature_enabled", return_value=True)
@patch("app.services.estimate_auto_approve_service.build_portal_estimate_snapshot")
def test_skip_auto_approve_when_over_limit(mock_snapshot, _flag):
    db = MagicMock()
    client_id = uuid4()
    client = SimpleNamespace(id=client_id, estimate_auto_approve_limit=Decimal("100"))
    wo = SimpleNamespace(id=uuid4(), client_id=client_id, property_id=None)
    db.query.return_value.filter.return_value.first.return_value = client
    mock_snapshot.return_value = {"total": 150.0, "estimate_content_hash": "abc"}
    assert try_auto_approve_pending_estimate(db, wo) is False
