"""Client appliance staff verification and portal source labels."""

from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

from app.services.client_appliance_service import (
    customer_source_label,
    verify_appliance_by_staff,
)


def _appliance(**kwargs):
    defaults = {
        "source": "portal",
        "verified_by_staff_at": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_customer_source_label_portal_unverified():
    assert customer_source_label(_appliance(source="portal")) == "added_by_you"


def test_customer_source_label_portal_verified():
    assert (
        customer_source_label(
            _appliance(source="portal", verified_by_staff_at=datetime.utcnow())
        )
        == "verified_by_atomic"
    )


def test_customer_source_label_staff_source_legacy():
    assert customer_source_label(_appliance(source="staff")) == "verified_by_atomic"


def test_customer_source_label_work_order_import():
    assert customer_source_label(_appliance(source="work_order_import")) == "verified_by_atomic"


def test_verify_appliance_by_staff_sets_columns_without_changing_source():
    from unittest.mock import MagicMock, patch

    client_id = uuid4()
    appliance_id = uuid4()
    staff_id = uuid4()
    appliance = SimpleNamespace(
        id=appliance_id,
        source="portal",
        verified_by_staff_at=None,
        verified_by_user_id=None,
        updated_at=None,
    )

    db = MagicMock()
    with patch(
        "app.services.client_appliance_service.get_client_appliance",
        return_value=appliance,
    ):
        result = verify_appliance_by_staff(db, client_id, appliance_id, staff_id)

    assert result.source == "portal"
    assert result.verified_by_staff_at is not None
    assert result.verified_by_user_id == staff_id
