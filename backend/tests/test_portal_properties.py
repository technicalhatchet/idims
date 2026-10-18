"""Portal property CRUD (phase 2d)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.portal_property import PortalPropertyUpdate, PortalPropertyWrite
from app.services.portal_property_service import (
    ADDRESS_HISTORY_MESSAGE,
    DELETE_BLOCKED_MESSAGE,
    DUPLICATE_ADDRESS_MESSAGE,
    PortalPropertyError,
    create_portal_property,
    delete_portal_property,
    find_duplicate_property,
    normalized_address_key,
    update_portal_property,
    serialize_portal_property_list_item,
)


def test_normalized_address_key_case_insensitive():
    assert normalized_address_key(" 123 Main St ", " Apt 2 ") == normalized_address_key(
        "123 main st", "apt 2"
    )


def test_find_duplicate_property_detects_mixed_case():
    cid = uuid4()
    existing = SimpleNamespace(
        id=uuid4(),
        client_id=cid,
        address="User@Example.com St",
        unit_number="A",
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [existing]
    dup = find_duplicate_property(db, cid, "user@example.com st", "a")
    assert dup is existing


@patch("app.services.portal_property_service.assert_address_serviceable")
def test_create_portal_property_duplicate_409(mock_serviceable):
    cid = uuid4()
    client = SimpleNamespace(id=cid, scheduling_zone_exempt=False)
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(id=uuid4(), address="123 Main", unit_number=None)
    ]
    with pytest.raises(PortalPropertyError) as exc:
        create_portal_property(
            db,
            client,
            PortalPropertyWrite(address="123 Main", property_type="residential"),
        )
    assert exc.value.status_code == 409
    assert exc.value.message == DUPLICATE_ADDRESS_MESSAGE


@patch("app.services.portal_property_service.assert_address_serviceable")
def test_create_portal_property_success(mock_serviceable):
    cid = uuid4()
    client = SimpleNamespace(id=cid, scheduling_zone_exempt=False)
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    db.add = MagicMock()
    db.flush = MagicMock()

    prop = create_portal_property(
        db,
        client,
        PortalPropertyWrite(
            address="456 Oak Ave, Toledo, OH",
            nickname="Home",
            property_type="residential",
        ),
    )
    assert prop.address == "456 Oak Ave, Toledo, OH"
    assert prop.nickname == "Home"


@patch("app.services.portal_property_service.property_has_work_orders", return_value=True)
@patch("app.services.portal_property_service.get_client_property")
def test_update_address_locked_with_history(mock_get, _history):
    client = SimpleNamespace(id=uuid4())
    prop = SimpleNamespace(
        id=uuid4(),
        address="123 Main",
        unit_number=None,
        property_type="residential",
    )
    mock_get.return_value = prop
    db = MagicMock()
    with pytest.raises(PortalPropertyError) as exc:
        update_portal_property(
            db,
            client,
            prop.id,
            PortalPropertyUpdate(address="999 Other St"),
        )
    assert exc.value.message == ADDRESS_HISTORY_MESSAGE


@patch("app.services.portal_property_service.property_has_appliances", return_value=True)
@patch("app.services.portal_property_service.property_has_work_orders", return_value=False)
@patch("app.services.portal_property_service.get_client_property")
def test_delete_blocked_with_appliances(mock_get, _wo, _app):
    cid = uuid4()
    prop = SimpleNamespace(id=uuid4())
    mock_get.return_value = prop
    db = MagicMock()
    with pytest.raises(PortalPropertyError) as exc:
        delete_portal_property(db, cid, prop.id)
    assert exc.value.status_code == 409
    assert DELETE_BLOCKED_MESSAGE in exc.value.message


@patch("app.services.portal_property_service.assert_address_serviceable")
def test_out_of_service_area_on_create(mock_serviceable):
    mock_serviceable.side_effect = PortalPropertyError(
        "out_of_service_area", "Outside area", status_code=403
    )
    client = SimpleNamespace(id=uuid4())
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    with pytest.raises(PortalPropertyError) as exc:
        create_portal_property(
            db,
            client,
            PortalPropertyWrite(address="Far Away", property_type="residential"),
        )
    assert exc.value.status_code == 403


def test_portal_serialize_omits_staff_notes():
    prop = SimpleNamespace(
        id=uuid4(),
        nickname=None,
        address="123 Main",
        unit_number=None,
        property_type="residential",
        gate_code=None,
        access_instructions="Ring bell",
        notes="Internal staff note — do not expose",
        tenant_name=None,
        tenant_phone=None,
        tenant_email=None,
    )
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    db.query.return_value.filter.return_value.count.return_value = 0

    payload = serialize_portal_property_list_item(db, prop)
    assert "notes" not in payload
    assert payload["access_instructions"] == "Ring bell"


@patch("app.services.portal_property_service.property_has_work_orders", return_value=False)
@patch("app.services.portal_property_service.get_client_property")
def test_portal_update_does_not_change_staff_notes(mock_get, _history):
    client = SimpleNamespace(id=uuid4())
    prop = SimpleNamespace(
        id=uuid4(),
        address="123 Main",
        unit_number=None,
        property_type="residential",
        gate_code=None,
        access_instructions=None,
        notes="Staff-only note",
        tenant_name=None,
        tenant_phone=None,
        tenant_email=None,
        updated_at=None,
    )
    mock_get.return_value = prop
    db = MagicMock()

    update_portal_property(
        db,
        client,
        prop.id,
        PortalPropertyUpdate(gate_code="*1234#"),
    )
    assert prop.notes == "Staff-only note"
    assert prop.gate_code == "*1234#"


def test_portal_write_schema_rejects_notes_field():
    with pytest.raises(ValidationError):
        PortalPropertyWrite(
            address="123 Main St",
            property_type="residential",
            notes="should not be accepted",
        )


@pytest.mark.asyncio
@patch("app.services.portal_property_service.create_portal_property")
async def test_create_route_maps_errors(mock_create):
    from app.routers.client_portal import create_portal_property_route

    mock_create.side_effect = PortalPropertyError("not_found", "Property not found", 404)
    client = SimpleNamespace(id=uuid4())
    db = MagicMock()
    db.commit = MagicMock()
    db.rollback = MagicMock()

    with pytest.raises(HTTPException) as exc:
        await create_portal_property_route(
            PortalPropertyWrite(address="x", property_type="residential"),
            client,
            db,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_route_other_client_404():
    from app.routers.client_portal import update_portal_property_route

    client = SimpleNamespace(id=uuid4())
    db = MagicMock()
    db.rollback = MagicMock()
    other_prop_id = uuid4()

    with patch(
        "app.routers.client_portal.update_portal_property",
        side_effect=PortalPropertyError("not_found", "Property not found", 404),
    ):
        with pytest.raises(HTTPException) as exc:
            await update_portal_property_route(
                other_prop_id,
                PortalPropertyUpdate(gate_code="1234"),
                client,
                db,
            )
        assert exc.value.status_code == 404
