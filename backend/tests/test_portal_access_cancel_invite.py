"""Staff cancel pending portal invites."""

import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.models.client import Client
from app.models.client_portal_claim import ClientPortalClaim
from app.routers.clients import cancel_portal_person_invite
from app.services.portal_claim_service import validate_claim_for_register


def test_cancelled_claim_fails_validate_for_register():
    claim = SimpleNamespace(
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        revoked_at=datetime.utcnow(),
        used_at=None,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db = MagicMock()
    with patch("app.services.portal_claim_service._load_claim_by_token", return_value=claim):
        result = validate_claim_for_register(db, "any-token")
    assert result["valid"] is False
    assert "no longer valid" in result["message"]


@pytest.mark.asyncio
async def test_cancel_sets_revoked_at_and_idempotent():
    client_id = uuid.uuid4()
    claim_id = uuid.uuid4()
    claim = SimpleNamespace(
        id=claim_id,
        client_id=client_id,
        purpose="portal_invite",
        used_at=None,
        revoked_at=None,
    )

    db = MagicMock()

    def query(model):
        q = MagicMock()
        if model is Client:
            q.filter.return_value.first.return_value = SimpleNamespace(id=client_id)
        elif model is ClientPortalClaim:
            q.filter.return_value.first.return_value = claim
        return q

    db.query.side_effect = query

    result = await cancel_portal_person_invite(
        client_id=client_id,
        claim_id=claim_id,
        db=db,
        current_user=MagicMock(),
    )
    assert result["success"] is True
    assert claim.revoked_at is not None
    db.commit.assert_called_once()

    db.commit.reset_mock()
    result2 = await cancel_portal_person_invite(
        client_id=client_id,
        claim_id=claim_id,
        db=db,
        current_user=MagicMock(),
    )
    assert result2["success"] is True
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_cancel_wrong_client_returns_404():
    owner_id = uuid.uuid4()
    other_client_id = uuid.uuid4()
    claim_id = uuid.uuid4()

    db = MagicMock()

    def query(model):
        q = MagicMock()
        if model is Client:
            q.filter.return_value.first.return_value = SimpleNamespace(id=other_client_id)
        elif model is ClientPortalClaim:
            q.filter.return_value.first.return_value = None
        return q

    db.query.side_effect = query

    with pytest.raises(HTTPException) as exc:
        await cancel_portal_person_invite(
            client_id=other_client_id,
            claim_id=claim_id,
            db=db,
            current_user=MagicMock(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_cancel_used_invite_returns_404():
    client_id = uuid.uuid4()
    claim_id = uuid.uuid4()
    claim = SimpleNamespace(
        id=claim_id,
        client_id=client_id,
        purpose="portal_invite",
        used_at=datetime.utcnow(),
        revoked_at=None,
    )

    db = MagicMock()

    def query(model):
        q = MagicMock()
        if model is Client:
            q.filter.return_value.first.return_value = SimpleNamespace(id=client_id)
        elif model is ClientPortalClaim:
            q.filter.return_value.first.return_value = claim
        return q

    db.query.side_effect = query

    with pytest.raises(HTTPException) as exc:
        await cancel_portal_person_invite(
            client_id=client_id,
            claim_id=claim_id,
            db=db,
            current_user=MagicMock(),
        )
    assert exc.value.status_code == 404
