"""Tests for pending_estimate_approval promotion."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.work_order_estimate_gate_service import (
    should_promote_pending_estimate_approval,
    work_order_has_unscheduled_estimate_labor,
)


def test_unscheduled_estimate_labor_query():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = object()
    assert work_order_has_unscheduled_estimate_labor(db, uuid4()) is True


@patch("app.services.work_order_estimate_gate_service.completed_diagnostic_date")
@patch("app.services.work_order_estimate_gate_service.work_order_diagnostic_visits_settled")
@patch("app.services.work_order_estimate_gate_service.work_order_has_unscheduled_estimate_labor")
def test_should_promote_when_estimate_and_settled_diagnostic(mock_est, mock_settled, mock_diag_date):
    mock_est.return_value = True
    mock_settled.return_value = True
    mock_diag_date.return_value = datetime(2026, 10, 22)
    wo = SimpleNamespace(id=uuid4(), status="completed_pending_payment", is_closed=False)
    db = MagicMock()
    assert should_promote_pending_estimate_approval(db, wo) is True


@patch("app.services.work_order_estimate_gate_service.work_order_has_unscheduled_estimate_labor")
def test_should_not_promote_without_estimate_labor(mock_est):
    mock_est.return_value = False
    wo = SimpleNamespace(id=uuid4(), status="completed", is_closed=False)
    assert should_promote_pending_estimate_approval(MagicMock(), wo) is False
