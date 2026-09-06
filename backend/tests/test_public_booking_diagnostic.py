"""Tests for public booking diagnostic SKU resolution."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import app.services.diagnostic_booking_service as booking_svc
from app.models.service import EquipmentType, ServiceType
from app.routers.public import _lookup_diagnostic_service


def _service(name: str, equipment_type, price: float):
    return SimpleNamespace(
        id=uuid4(),
        name=name,
        sku_code="TEST",
        base_price=price,
        equipment_type=equipment_type,
        service_type=ServiceType.diagnostic,
        is_active=True,
    )


def test_dryer_prefers_washer_laundry_diagnostic(monkeypatch):
    laundry = _service("Laundry Diagnostic", EquipmentType.washer, 89.0)

    def mock_by_equipment(db, equipment_type):
        return laundry if equipment_type == EquipmentType.washer else None

    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_equipment", mock_by_equipment)
    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_name_keyword", lambda db, kw: None)

    resolved = _lookup_diagnostic_service(MagicMock(), "dryer")
    assert resolved is laundry


def test_dryer_falls_back_to_laundry_name_before_generic_other(monkeypatch):
    laundry = _service("Laundry Diagnostic", EquipmentType.stacked_laundry, 89.0)
    generic = _service("Additional Appliance Diagnostic", EquipmentType.other, 48.0)

    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_equipment", lambda db, et: None)

    def mock_by_name(db, keyword):
        return laundry if keyword == "laundry" else None

    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_name_keyword", mock_by_name)

    resolved = _lookup_diagnostic_service(MagicMock(), "dryer")
    assert resolved is laundry
    assert resolved.name == "Laundry Diagnostic"
    assert resolved is not generic


def test_aiolaundry_uses_aio_sku_not_laundry_or_washer(monkeypatch):
    aio = _service("AIO Laundry Diagnostic", EquipmentType.aio_laundry, 109.0)
    laundry = _service("Laundry Diagnostic", EquipmentType.washer, 89.0)
    equipment_calls = []

    def mock_by_equipment(db, equipment_type):
        equipment_calls.append(equipment_type)
        return aio if equipment_type == EquipmentType.aio_laundry else None

    def mock_by_name(db, keyword):
        if keyword in ("aio", "all-in-one"):
            return aio
        if keyword == "laundry":
            return laundry
        return None

    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_equipment", mock_by_equipment)
    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_name_keyword", mock_by_name)

    resolved = _lookup_diagnostic_service(MagicMock(), "aiolaundry")
    assert resolved is aio
    assert equipment_calls == [EquipmentType.aio_laundry]
    assert "laundry" not in [EquipmentType.washer, EquipmentType.stacked_laundry]


def test_electric_dryer_uses_fuel_specific_diagnostic(monkeypatch):
    electric = _service("Electric Dryer Diagnostic", EquipmentType.dryer, 99.0)
    laundry = _service("Laundry Diagnostic", EquipmentType.washer, 89.0)
    name_calls = []

    def mock_by_name(db, keyword):
        name_calls.append(keyword)
        if keyword == "electric dryer":
            return electric
        if keyword == "laundry":
            return laundry
        return None

    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_name_keyword", mock_by_name)
    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_equipment", lambda db, et: None)

    resolved = _lookup_diagnostic_service(MagicMock(), "dryer", "electric_dryer")
    assert resolved is electric
    assert name_calls[0] == "electric dryer"


def test_gas_range_uses_fuel_specific_diagnostic(monkeypatch):
    gas_range = _service("Gas Range Diagnostic", EquipmentType.range, 109.0)

    def mock_by_name(db, keyword):
        return gas_range if keyword == "gas range" else None

    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_name_keyword", mock_by_name)
    monkeypatch.setattr(booking_svc, "_query_diagnostic_by_equipment", lambda db, et: None)

    resolved = _lookup_diagnostic_service(MagicMock(), "oven", "gas_range")
    assert resolved is gas_range


def test_resolve_booking_equipment_fields_for_electric_dryer():
    fields = booking_svc.resolve_booking_equipment_fields(
        "dryer",
        equipment_subtype="electric_dryer",
    )
    assert fields["equipment_type"] == "appliance"
    assert fields["equipment_subtype"] == "electric_dryer"
    assert fields["display_label"] == "Electric Dryer"
