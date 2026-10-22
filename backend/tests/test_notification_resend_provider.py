"""NotificationService routes resend provider to EmailService."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.notification_service import NotificationService


@pytest.mark.asyncio
async def test_send_email_uses_resend_provider():
    with patch("app.services.notification_service.settings") as mock_settings:
        mock_settings.EMAIL_PROVIDER = "resend"
        mock_settings.DEFAULT_FROM_EMAIL = "service@atomicrepair419.com"
        with patch(
            "app.services.email_service.EmailService.send_resend_email",
            new_callable=AsyncMock,
            return_value=True,
        ) as send_mock:
            ok = await NotificationService.send_email(
                "user@example.com",
                "Subject",
                "<p>Hi</p>",
            )
    assert ok is True
    send_mock.assert_awaited_once()
