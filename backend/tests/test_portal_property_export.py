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
    _format_summary_count_line,
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


def test_format_summary_count_line_singular_and_plural():
    assert _format_summary_count_line(1, 1) == "1 property · 1 appliance"
    assert _format_summary_count_line(7, 7) == "7 properties · 7 appliances"


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


def test_appliance_summary_multi_property_document_and_pdf():
    """Covers _build_property_sections sort over multiple group keys (id: vs addr:)."""
    client = SimpleNamespace(id=uuid4(), display_name="Jane Doe")
    db = MagicMock()
    prop_id = uuid4()
    appliance_with_property = SimpleNamespace(id=uuid4())
    appliance_service_address_only = SimpleNamespace(id=uuid4())

    def fake_serialize(appliance, _db):
        if appliance is appliance_with_property:
            return {
                "property": {
                    "id": str(prop_id),
                    "nickname": "Lake House",
                    "address": "1 Main St, Toledo, OH",
                },
                "nickname": "Kitchen Washer",
                "make": "Whirlpool",
                "model": "WFW5620",
                "serial": "SN1",
                "last_service_date": None,
            }
        return {
            "property": None,
            "service_address": "99 Rental Ave, Toledo, OH",
            "equipment_subtype": "electric_dryer",
            "make": "Samsung",
            "model": "DVE45",
            "serial": "SN2",
            "last_service_date": None,
        }

    appliances = [appliance_with_property, appliance_service_address_only]
    with patch(
        "app.services.portal_property_export_service._filter_appliances",
        return_value=appliances,
    ):
        with patch(
            "app.services.portal_property_export_service.appliance_svc.serialize_appliance",
            side_effect=fake_serialize,
        ):
            with patch(
                "app.services.portal_property_export_service.work_orders_for_appliance",
                return_value=[],
            ):
                doc = build_appliance_summary_document(db, client)
                pdf = generate_appliances_summary_pdf(db, client)

    assert len(doc["sections"]) == 2
    titles = {section["title"] for section in doc["sections"]}
    assert "Lake House" in titles
    assert "99 Rental Ave, Toledo, OH" in titles
    assert doc["summary_line"] == "2 properties · 2 appliances"
    assert pdf[:4] == b"%PDF"
