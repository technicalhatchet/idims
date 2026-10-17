"""Per-client portal booking payment waiver."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.portal_square_payment_service import portal_booking_payment_required


def test_waived_client_skips_payment_when_global_requires():
    db = MagicMock()
    client = SimpleNamespace(portal_booking_payment_waived=True)
    with patch(
        "app.services.portal_square_payment_service.get_square_config",
        return_value={"requires_payment": True},
    ):
        assert portal_booking_payment_required(db, client) is False


def test_non_waived_client_pays_when_global_requires():
    db = MagicMock()
    client = SimpleNamespace(portal_booking_payment_waived=False)
    with patch(
        "app.services.portal_square_payment_service.get_square_config",
        return_value={"requires_payment": True},
    ):
        assert portal_booking_payment_required(db, client) is True
