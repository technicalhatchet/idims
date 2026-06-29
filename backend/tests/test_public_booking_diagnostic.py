"""Tests for public booking diagnostic SKU resolution."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import app.routers.public as public
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

    monkeypatch.setattr(public, "_query_diagnostic_by_equipment", mock_by_equipment)
    monkeypatch.setattr(public, "_query_diagnostic_by_name_keyword", lambda db, kw: None)

    resolved = _lookup_diagnostic_service(MagicMock(), "dryer")
    assert resolved is laundry


def test_dryer_falls_back_to_laundry_name_before_generic_other(monkeypatch):
    laundry = _service("Laundry Diagnostic", EquipmentType.stacked_laundry, 89.0)
    generic = _service("Additional Appliance Diagnostic", EquipmentType.other, 48.0)

    monkeypatch.setattr(public, "_query_diagnostic_by_equipment", lambda db, et: None)

    def mock_by_name(db, keyword):
        return laundry if keyword == "laundry" else None

    monkeypatch.setattr(public, "_query_diagnostic_by_name_keyword", mock_by_name)

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

    monkeypatch.setattr(public, "_query_diagnostic_by_equipment", mock_by_equipment)
    monkeypatch.setattr(public, "_query_diagnostic_by_name_keyword", mock_by_name)

    resolved = _lookup_diagnostic_service(MagicMock(), "aiolaundry")
    assert resolved is aio
    assert equipment_calls == [EquipmentType.aio_laundry]
    assert "laundry" not in [EquipmentType.washer, EquipmentType.stacked_laundry]
