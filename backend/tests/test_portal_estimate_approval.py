"""Portal estimate approval (Wave 1A)."""

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.portal_estimate_approval_service import (
    EstimateApprovalError,
    assert_can_decide_estimate,
    record_estimate_approval,
)


def _wo(**kwargs):
    return SimpleNamespace(
        id=uuid4(),
        order_number="WO-100",
        status=kwargs.get("status", "pending_estimate_approval"),
        client_id=uuid4(),
        **{k: v for k, v in kwargs.items() if k != "status"},
    )


@patch("app.services.portal_estimate_approval_service.portal_estimate_meta")
@patch("app.services.portal_estimate_approval_service.build_portal_estimate_snapshot")
def test_decline_then_approve_allowed(mock_snapshot, mock_meta):
    db = MagicMock()
    wo = _wo()
    mock_meta.return_value = {"estimate_available": True}
    mock_snapshot.return_value = {"estimate_content_hash": "abc", "total": 100.0, "lines": []}

    latest = SimpleNamespace(decision="declined")
    with patch(
        "app.services.portal_estimate_approval_service._latest_for_hash",
        return_value=latest,
    ):
        assert_can_decide_estimate(db, wo, decision="approved", content_hash="abc")


@patch("app.services.portal_estimate_approval_service.portal_estimate_meta")
@patch("app.services.portal_estimate_approval_service.build_portal_estimate_snapshot")
def test_approved_then_decline_blocked(mock_snapshot, mock_meta):
    db = MagicMock()
    wo = _wo()
    mock_meta.return_value = {"estimate_available": True}
    mock_snapshot.return_value = {"estimate_content_hash": "abc", "total": 100.0, "lines": []}

    latest = SimpleNamespace(decision="approved")
    with patch(
        "app.services.portal_estimate_approval_service._latest_for_hash",
        return_value=latest,
    ):
        with pytest.raises(EstimateApprovalError) as exc:
            assert_can_decide_estimate(db, wo, decision="declined", content_hash="abc")
        assert exc.value.code == "already_approved"


@patch("app.services.portal_estimate_approval_service._upload_bytes_to_drive", return_value="drive-1")
@patch("app.services.portal_estimate_approval_service.generate_work_order_estimate_pdf_v2", return_value=b"%PDF")
@patch(
    "app.services.portal_estimate_approval_service._decode_signature_png",
    return_value=b"\x89PNG" + b"x" * 120,
)
@patch("app.services.portal_estimate_approval_service.build_portal_estimate_snapshot")
@patch("app.services.portal_estimate_approval_service.portal_estimate_meta")
def test_record_approval_does_not_mutate_work_order_status(
    mock_meta, mock_snapshot, _sig, _pdf, _drive
):
    mock_meta.return_value = {"estimate_available": True}
    mock_snapshot.return_value = {"estimate_content_hash": "hash1", "total": 50.0, "lines": []}
    db = MagicMock()
    wo = _wo(status="pending_estimate_approval")
    client = SimpleNamespace(id=uuid4())
    login = SimpleNamespace(id=uuid4())

    png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

    with patch(
        "app.services.portal_estimate_approval_service._latest_for_hash",
        return_value=None,
    ):
        before_status = wo.status
        record_estimate_approval(
            db,
            work_order=wo,
            client=client,
            login=login,
            decision="approved",
            signer_name="Jane Doe",
            signature_png_b64=png,
            decline_reason=None,
            ip="127.0.0.1",
            user_agent="test",
        )
        assert wo.status == before_status
    db.add.assert_called_once()
