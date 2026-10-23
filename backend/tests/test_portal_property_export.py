"""Portal property export (Wave 1D)."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.portal_property_export_service import (
    appliances_csv,
    build_appliance_summary_document,
    format_date_csv,
    format_date_mdy_eastern,
    generate_appliances_summary_pdf,
    repairs_csv,
)


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


def test_format_date_csv_uses_yyyy_mm_dd_eastern():
    iso = "2026-03-15T18:30:00Z"
    assert format_date_csv(iso) == "2026-03-15"
    assert format_date_mdy_eastern(iso) == "3/15/2026"


def test_repairs_csv_service_date_no_microseconds():
    client = SimpleNamespace(id=uuid4())
    db = MagicMock()
    wo = SimpleNamespace(
        created_at=datetime(2026, 1, 2, 15, 0, tzinfo=timezone.utc),
        order_number="WO-1",
        equipment_make="Whirlpool",
        equipment_model="WFW",
        equipment_subtype="washer",
        status=SimpleNamespace(value="completed"),
    )
    with patch(
        "app.services.portal_property_export_service._filter_appliances",
        return_value=[],
    ):
        with patch.object(db, "query") as q:
            q.return_value.filter.return_value.order_by.return_value.all.return_value = [wo]
            with patch(
                "app.services.portal_property_export_service.compute_net_invoice_total",
                return_value=100,
            ):
                text = repairs_csv(db, client)
    assert "2026-01-02" in text
    assert "T" not in text.splitlines()[1]


def test_appliance_summary_document_structure():
    client = SimpleNamespace(
        id=uuid4(),
        display_name="Jane Doe",
        first_name="Jane",
        last_name="Doe",
        company_name=None,
    )
    db = MagicMock()
    with patch(
        "app.services.portal_property_export_service._filter_appliances",
        return_value=[],
    ):
        doc = build_appliance_summary_document(db, client)
    assert "Jane Doe" in doc["customer_line"]
    assert doc["sections"] == []
    assert "Prepared" in doc["prepared_label"]


def test_generate_appliances_summary_pdf_bytes():
    client = SimpleNamespace(id=uuid4(), display_name="Jane Doe")
    db = MagicMock()
    with patch(
        "app.services.portal_property_export_service._filter_appliances",
        return_value=[],
    ):
        pdf = generate_appliances_summary_pdf(db, client)
    assert pdf[:4] == b"%PDF"
