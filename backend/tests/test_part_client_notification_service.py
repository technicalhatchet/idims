"""Tests for client part status notifications."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.part_client_notification_service import notify_client_part_status_change


@pytest.mark.asyncio
async def test_notify_client_when_part_ordered():
    db = MagicMock()
    client = MagicMock()
    client.user_id = uuid.uuid4()
    db.query.return_value.filter.return_value.first.return_value = client

    work_order = MagicMock()
    work_order.id = uuid.uuid4()
    work_order.client_id = uuid.uuid4()
    work_order.order_number = "WO-1001"

    part = MagicMock()
    part.id = uuid.uuid4()
    part.description = "Drain pump"
    part.number = "W10899966"

    with patch(
        "app.services.part_client_notification_service.NotificationService.create_notification",
        new_callable=AsyncMock,
    ) as create_mock:
        await notify_client_part_status_change(db, work_order, part, "ordered", "needed")

    create_mock.assert_awaited_once()
    payload = create_mock.await_args.args[1]
    assert payload["user_id"] == client.user_id
    assert payload["related_type"] == "work_order"
    assert "Drain pump" in payload["message"]
    assert "WO-1001" in payload["message"]


@pytest.mark.asyncio
async def test_skips_when_status_unchanged():
    db = MagicMock()
    work_order = MagicMock()
    work_order.client_id = uuid.uuid4()
    part = MagicMock()

    with patch(
        "app.services.part_client_notification_service.NotificationService.create_notification",
        new_callable=AsyncMock,
    ) as create_mock:
        await notify_client_part_status_change(db, work_order, part, "ordered", "ordered")

    create_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_notify_client_when_part_received():
    db = MagicMock()
    client = MagicMock()
    client.user_id = uuid.uuid4()
    db.query.return_value.filter.return_value.first.return_value = client

    work_order = MagicMock()
    work_order.id = uuid.uuid4()
    work_order.client_id = uuid.uuid4()
    work_order.order_number = "WO-2002"

    part = MagicMock()
    part.id = uuid.uuid4()
    part.description = "Control board"
    part.number = "123"

    with patch(
        "app.services.part_client_notification_service.NotificationService.create_notification",
        new_callable=AsyncMock,
    ) as create_mock:
        await notify_client_part_status_change(db, work_order, part, "received", "ordered")

    create_mock.assert_awaited_once()
    payload = create_mock.await_args.args[1]
    assert "arrived" in payload["title"].lower() or "arrived" in payload["message"].lower()
