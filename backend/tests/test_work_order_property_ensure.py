"""Staff work-order property find-or-create and address round-trips."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch
from uuid import uuid4

import pytest

from app.services.portal_property_service import normalized_address_key
from app.services.work_order_property_service import (
    ensure_client_property_for_service_address,
    extract_service_address_parts,
)
from app.services.work_order_service import WorkOrderService
from app.utils.address_format import (
    format_client_address,
    format_property_address,
    parse_formatted_service_address,
    strip_trailing_country,
)
from scripts.backfill_work_order_properties import plan_client_backfill


def test_strip_trailing_country_variants():
    assert (
        strip_trailing_country("928 W Wayne, Maumee, OH, 43537, USA")
        == "928 W Wayne, Maumee, OH, 43537"
    )
    assert strip_trailing_country("1 Main St, US") == "1 Main St"
    assert (
        strip_trailing_country("1 Main St, United States") == "1 Main St"
    )


def test_normalized_key_ignores_usa_and_punctuation():
    a = "928 W Wayne, Maumee, OH, 43537"
    b = "928 W Wayne, Maumee, OH, 43537, USA"
    assert normalized_address_key(a, None) == normalized_address_key(b, None)

    dotted = "2478 Franklin Ave. Toledo, OH 43620"
    comma = "2478 Franklin Ave, Toledo, OH 43620"
    assert normalized_address_key(dotted, None) == normalized_address_key(comma, None)


def test_parse_strips_country_for_storage():
    street, unit = parse_formatted_service_address(
        "928 W Wayne, Maumee, OH, 43537, USA"
    )
    assert street == "928 W Wayne, Maumee, OH, 43537"
    assert unit is None


def test_ensure_matches_existing_property_without_usa():
    """WO address with USA links to property stored without USA — no twin."""
    cid = uuid4()
    existing = SimpleNamespace(
        id=uuid4(),
        client_id=cid,
        address="928 W Wayne, Maumee, OH, 43537",
        unit_number=None,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [existing]

    prop = ensure_client_property_for_service_address(
        db,
        cid,
        {"address": "928 W Wayne, Maumee, OH, 43537, USA"},
    )
    assert prop is existing
    db.add.assert_not_called()


def test_ensure_stores_address_without_country():
    cid = uuid4()
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []

    prop = ensure_client_property_for_service_address(
        db,
        cid,
        {"address": "928 W Wayne, Maumee, OH, 43537, USA"},
    )
    assert prop.address == "928 W Wayne, Maumee, OH, 43537"
    db.add.assert_called_once()


def test_parse_unit_suffix_from_format_property_address():
    formatted = format_property_address("123 Main St", "4")
    assert formatted == "123 Main St, Unit 4"
    street, unit = parse_formatted_service_address(formatted)
    assert street == "123 Main St"
    assert unit == "4"


def test_parse_unit_already_prefixed():
    formatted = format_property_address("99 Oak", "Unit B")
    street, unit = parse_formatted_service_address(formatted)
    assert street == "99 Oak"
    assert unit == "B"


def test_client_address_format_has_no_unit():
    formatted = format_client_address(
        {
            "street1": "641 Barclay Drive",
            "city": "Toledo",
            "state": "OH",
            "zip": "43609",
            "country": "USA",
        }
    )
    assert formatted == "641 Barclay Drive, Toledo, OH, 43609"
    street, unit = parse_formatted_service_address(formatted)
    assert street == formatted
    assert unit is None


def test_extract_prefers_explicit_unit_field():
    street, unit = extract_service_address_parts(
        {"address": "123 Main St, Unit 9", "unit_number": "2"}
    )
    assert street == "123 Main St, Unit 9"
    assert unit == "2"


def test_ensure_creates_one_property_for_new_address():
    cid = uuid4()
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []

    prop = ensure_client_property_for_service_address(
        db,
        cid,
        {"address": "100 First St, Toledo, OH"},
    )
    assert prop is not None
    assert prop.client_id == cid
    assert prop.address == "100 First St, Toledo, OH"
    assert prop.unit_number is None
    assert prop.property_type == "residential"
    assert prop.nickname is None
    db.add.assert_called_once()
    db.flush.assert_called_once()


def test_ensure_reuses_on_spacing_and_case():
    cid = uuid4()
    existing = SimpleNamespace(
        id=uuid4(),
        client_id=cid,
        address="100 First St",
        unit_number=None,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [existing]

    prop = ensure_client_property_for_service_address(
        db,
        cid,
        {"address": "  100   FIRST st  "},
    )
    assert prop is existing
    db.add.assert_not_called()


def test_ensure_round_trip_formatted_property_with_unit():
    cid = uuid4()
    existing = SimpleNamespace(
        id=uuid4(),
        client_id=cid,
        address="55 Elm Ave",
        unit_number="3",
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [existing]

    formatted = format_property_address(existing.address, existing.unit_number)
    prop = ensure_client_property_for_service_address(
        db, cid, {"address": formatted}
    )
    assert prop is existing
    db.add.assert_not_called()


def test_ensure_round_trip_formatted_client_address():
    cid = uuid4()
    formatted = format_client_address(
        {"street1": "12 Pine", "city": "Toledo", "state": "OH", "zip": "43604"}
    )
    existing = SimpleNamespace(
        id=uuid4(),
        client_id=cid,
        address=formatted,
        unit_number=None,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [existing]

    prop = ensure_client_property_for_service_address(
        db, cid, {"address": formatted}
    )
    assert prop is existing
    db.add.assert_not_called()


def test_ensure_different_address_creates_second():
    cid = uuid4()
    existing = SimpleNamespace(
        id=uuid4(),
        client_id=cid,
        address="100 First St",
        unit_number=None,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [existing]

    prop = ensure_client_property_for_service_address(
        db, cid, {"address": "200 Second St"}
    )
    assert prop is not existing
    assert prop.address == "200 Second St"
    db.add.assert_called_once()


def test_ensure_does_not_call_assert_address_serviceable():
    cid = uuid4()
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    with patch(
        "app.services.portal_property_service.assert_address_serviceable"
    ) as mock_assert:
        ensure_client_property_for_service_address(
            db, cid, {"address": "1 Out Of Area Rd"}
        )
        mock_assert.assert_not_called()


def test_apply_default_service_location_only_autopicks_single_property():
    cid = uuid4()
    only = SimpleNamespace(
        id=uuid4(),
        address="1 Solo St",
        unit_number=None,
    )
    db = MagicMock()
    # Property query path for no property_id
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        only
    ]
    data = {"client_id": cid, "property_id": None, "service_location": None}
    WorkOrderService._apply_default_service_location(db, data)
    assert data["property_id"] == only.id
    assert data["service_location"]["address"] == "1 Solo St"


def test_apply_default_service_location_does_not_guess_with_two_properties():
    cid = uuid4()
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        SimpleNamespace(id=uuid4(), address="A", unit_number=None),
        SimpleNamespace(id=uuid4(), address="B", unit_number=None),
    ]
    # Client mailing fallback query
    client = SimpleNamespace(id=cid, address=None)
    db.query.return_value.filter.return_value.first.return_value = client

    data = {"client_id": cid, "property_id": None, "service_location": None}
    WorkOrderService._apply_default_service_location(db, data)
    assert data.get("property_id") is None
    assert not data.get("service_location")


def test_ensure_property_id_skips_when_already_set():
    cid = uuid4()
    existing_pid = uuid4()
    data = {
        "client_id": cid,
        "property_id": existing_pid,
        "service_location": {"address": "Should Not Matter"},
    }
    with patch(
        "app.services.work_order_property_service.ensure_client_property_for_service_address"
    ) as mock_ensure:
        WorkOrderService._ensure_property_id_from_service_location(MagicMock(), data)
        mock_ensure.assert_not_called()
    assert data["property_id"] == existing_pid


def test_ensure_property_id_sets_from_service_location():
    cid = uuid4()
    new_pid = uuid4()
    data = {
        "client_id": cid,
        "property_id": None,
        "service_location": {"address": "77 New Ave"},
    }
    with patch(
        "app.services.work_order_property_service.ensure_client_property_for_service_address",
        return_value=SimpleNamespace(id=new_pid),
    ) as mock_ensure:
        WorkOrderService._ensure_property_id_from_service_location(MagicMock(), data)
        mock_ensure.assert_called_once()
    assert data["property_id"] == new_pid


def test_backfill_plan_links_existing_property_no_twin():
    cid = uuid4()
    prop_id = uuid4()
    existing = SimpleNamespace(
        id=prop_id,
        client_id=cid,
        address="400 Link Me",
        unit_number=None,
        created_at=None,
    )
    client = SimpleNamespace(
        id=cid,
        first_name="Pat",
        last_name="Client",
        email="pat@example.com",
    )
    wo = SimpleNamespace(
        id=uuid4(),
        order_number="WO-100",
        property_id=None,
        service_location={"address": "  400   link me "},
    )
    db = MagicMock()
    # existing props query
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        existing
    ]
    # find_duplicate uses .all() without order_by
    db.query.return_value.filter.return_value.all.return_value = [existing]

    plan = plan_client_backfill(db, client, [wo])
    assert plan["would_create"] == []
    assert len(plan["would_link"]) == 1
    assert plan["would_link"][0]["create"] is False
    assert plan["would_link"][0]["property_id"] == str(prop_id)
    assert plan["would_link"][0]["order_numbers"] == ["WO-100"]


def test_backfill_dry_run_helper_does_not_add_or_commit():
    """plan_client_backfill is read-only — never db.add / commit."""
    cid = uuid4()
    client = SimpleNamespace(
        id=cid, first_name="A", last_name="B", email=None
    )
    wo = SimpleNamespace(
        order_number="WO-1",
        service_location={"address": "1 Dry Run Ln"},
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    db.query.return_value.filter.return_value.all.return_value = []

    plan = plan_client_backfill(db, client, [wo])
    assert len(plan["would_create"]) == 1
    db.add.assert_not_called()
    db.commit.assert_not_called()
    db.flush.assert_not_called()
