"""Portal property export (Wave 1D)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.portal_property_export_service import appliances_csv


def test_appliances_csv_empty():
    client = SimpleNamespace(id=uuid4())
    db = MagicMock()
    with patch(
        "app.services.portal_property_export_service._filter_appliances",
        return_value=[],
    ):
        csv_text = appliances_csv(db, client)
    assert "property_nickname" in csv_text
    assert csv_text.strip().endswith("property_nickname,property_address,appliance,brand,model,serial,added_verified,last_service_date,warranty_status") or "property_nickname" in csv_text.splitlines()[0]
