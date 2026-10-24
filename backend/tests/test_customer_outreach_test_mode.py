"""Customer outreach test mode gating."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.customer_outreach_service import (
    automatic_outreach_allowed,
    automatic_outreach_allowed_for_client,
    invalidate_customer_outreach_test_mode_cache,
)


@pytest.fixture(autouse=True)
def _clear_outreach_cache():
    invalidate_customer_outreach_test_mode_cache()
    yield
    invalidate_customer_outreach_test_mode_cache()


def test_test_mode_blocks_non_test_client():
    db = MagicMock()
    client = MagicMock()
    client.is_test_client = False
    with patch(
        "app.services.customer_outreach_service.customer_outreach_test_mode_enabled",
        return_value=True,
    ):
        assert automatic_outreach_allowed_for_client(db, client) is False


def test_test_mode_allows_test_client():
    db = MagicMock()
    client = MagicMock()
    client.is_test_client = True
    with patch(
        "app.services.customer_outreach_service.customer_outreach_test_mode_enabled",
        return_value=True,
    ):
        assert automatic_outreach_allowed_for_client(db, client) is True


def test_test_mode_off_allows_everyone():
    db = MagicMock()
    client_id = uuid.uuid4()
    with patch(
        "app.services.customer_outreach_service.customer_outreach_test_mode_enabled",
        return_value=False,
    ):
        assert automatic_outreach_allowed(db, client_id) is True
