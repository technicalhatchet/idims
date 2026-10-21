"""Portal customer photo uploads (Wave 1C)."""

import pytest

from app.services.work_order_photos_service import (
    MAX_CUSTOMER_FILE_BYTES,
    validate_customer_media,
)


def test_rejects_oversize():
    with pytest.raises(ValueError, match="25 MB"):
        validate_customer_media(b"x" * (MAX_CUSTOMER_FILE_BYTES + 1), "image/jpeg")


def test_rejects_unknown_mime():
    with pytest.raises(ValueError, match="Unsupported"):
        validate_customer_media(b"abc", "application/pdf")
