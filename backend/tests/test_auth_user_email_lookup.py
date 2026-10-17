"""Auth0 user resolution: safe email fallback vs auth_id."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.auth import AuthHandler, TokenData, _token_email_verified


def test_token_email_verified_reads_auth0_claim():
    assert _token_email_verified({"email_verified": True}) is True
    assert _token_email_verified({"email_verified": False}) is False


def test_token_email_verified_reads_custom_namespace():
    assert _token_email_verified({"https://idimsapi/email_verified": True}) is True


@pytest.mark.asyncio
async def test_get_current_user_rejects_email_match_with_different_auth_id():
    handler = AuthHandler(domain="example.auth0.com", audience="https://api")
    token_data = TokenData(
        sub="auth0|attacker",
        exp=9999999999,
        email="staff@example.com",
        roles=["client"],
        raw_payload={"email": "staff@example.com", "email_verified": True},
    )

    existing = SimpleNamespace(
        id=uuid4(),
        auth_id="google-oauth2|victim",
        email="staff@example.com",
        first_name="Staff",
        last_name="User",
        roles=["technician"],
        last_login=None,
        avatar_url=None,
    )

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [None, existing]

    with patch.object(handler, "verify_token", new=AsyncMock(return_value=token_data)):
        with pytest.raises(HTTPException) as exc:
            await handler.get_current_user("fake-token", db=db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_current_user_adopts_verified_email_when_auth_id_null():
    handler = AuthHandler(domain="example.auth0.com", audience="https://api")
    auth_id = "google-oauth2|newlogin"
    token_data = TokenData(
        sub=auth_id,
        exp=9999999999,
        email="tech@example.com",
        roles=["technician"],
        raw_payload={
            "email": "tech@example.com",
            "email_verified": True,
            "given_name": "Tech",
            "family_name": "User",
        },
    )

    existing = SimpleNamespace(
        id=uuid4(),
        auth_id=None,
        email="tech@example.com",
        first_name="Tech",
        last_name="User",
        roles=["technician"],
        last_login=None,
        avatar_url=None,
    )

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [None, existing]

    with patch.object(handler, "verify_token", new=AsyncMock(return_value=token_data)):
        user = await handler.get_current_user("fake-token", db=db)

    assert user is existing
    assert existing.auth_id == auth_id
    db.commit.assert_called()

