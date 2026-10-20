"""Tests for household notification fan-out."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.client_portal_notification_service import notify_client_portal_users


@pytest.mark.asyncio
async def test_notify_falls_back_to_client_user_id_when_no_login_users():
    client_id = uuid.uuid4()
    placeholder_user_id = uuid.uuid4()
    client = MagicMock()
    client.id = client_id
    client.user_id = placeholder_user_id

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = client

    with patch(
        "app.services.client_portal_notification_service.active_login_user_ids",
        return_value=[],
    ):
        with patch(
            "app.services.client_portal_notification_service.NotificationService.create_notification",
            new_callable=AsyncMock,
        ) as create_mock:
            notified = await notify_client_portal_users(
                db,
                client_id,
                title="Hello",
                message="World",
            )

    assert notified == [placeholder_user_id]
    create_mock.assert_awaited_once()
    assert create_mock.await_args.args[1]["user_id"] == placeholder_user_id
