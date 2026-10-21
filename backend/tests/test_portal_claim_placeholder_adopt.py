"""Claim-link redeem adopts client placeholder user without verified email."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.portal_user_link import ensure_db_user_for_portal_link


def test_ensure_db_user_for_portal_link_passes_client_placeholder():
    db = MagicMock()
    placeholder_id = uuid4()
    client = SimpleNamespace(
        id=uuid4(),
        user_id=placeholder_id,
    )
    placeholder = SimpleNamespace(
        id=placeholder_id,
        auth_id=f"client|{uuid4()}",
        email="a@example.com",
        first_name="A",
        last_name="B",
        roles=["client"],
    )
    token_data = SimpleNamespace(
        sub="auth0|from-claim",
        email="a@example.com",
        roles=["client"],
        raw_payload={"email_verified": False},
    )

    user_query = MagicMock()
    user_query.filter.return_value.first.return_value = placeholder
    db.query.return_value = user_query

    handler = MagicMock()
    handler.ensure_db_user_from_token.return_value = placeholder

    with patch("app.services.portal_user_link.get_auth_handler", return_value=handler):
        ensure_db_user_for_portal_link(db, token_data, client=client)

    handler.ensure_db_user_from_token.assert_called_once()
    _args, kwargs = handler.ensure_db_user_from_token.call_args
    assert kwargs["trusted_placeholder_user"] is placeholder
