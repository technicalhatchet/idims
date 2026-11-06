"""users.roles stays authoritative over JWT role claims."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.core.auth import AuthHandler, TokenData


@pytest.mark.asyncio
async def test_existing_user_keeps_db_roles_when_token_differs():
    handler = AuthHandler(domain="example.auth0.com", audience="https://api")
    token_data = TokenData(
        sub="google-oauth2|keep-db",
        exp=9999999999,
        email="keep-db@example.com",
        roles=["client"],
        raw_payload={
            "email": "keep-db@example.com",
            "email_verified": True,
            "https://idimsapi/app_metadata": {"roles": ["client"]},
        },
    )
    existing = SimpleNamespace(
        id=uuid4(),
        auth_id="google-oauth2|keep-db",
        email="keep-db@example.com",
        first_name="Keep",
        last_name="Db",
        roles=["admin"],
        last_login=None,
        avatar_url=None,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [existing, None]

    user = handler.ensure_db_user_from_token(db, token_data)
    assert user.roles == ["admin"]


@pytest.mark.asyncio
async def test_new_user_seeds_roles_from_token():
    handler = AuthHandler(domain="example.auth0.com", audience="https://api")
    token_data = TokenData(
        sub="google-oauth2|new-tech",
        exp=9999999999,
        email="new-tech@example.com",
        roles=["technician"],
        raw_payload={
            "email": "new-tech@example.com",
            "email_verified": True,
            "https://idimsapi/app_metadata": {"roles": ["technician"]},
        },
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    created = []
    db.add.side_effect = lambda u: created.append(u)
    db.commit = MagicMock()
    db.refresh = MagicMock()

    user = handler.ensure_db_user_from_token(db, token_data)
    assert created[0].roles == ["technician"]


@pytest.mark.asyncio
async def test_new_user_defaults_client_when_token_has_no_roles():
    handler = AuthHandler(domain="example.auth0.com", audience="https://api")
    token_data = TokenData(
        sub="google-oauth2|new-client",
        exp=9999999999,
        email="new-client@example.com",
        roles=[],
        raw_payload={"email": "new-client@example.com", "email_verified": True},
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    created = []
    db.add.side_effect = lambda u: created.append(u)
    db.commit = MagicMock()
    db.refresh = MagicMock()

    handler.ensure_db_user_from_token(db, token_data)
    assert created[0].roles == ["client"]
