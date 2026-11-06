"""Phase 1 settings wiring: buffers, shop hours bounds, shop address, tax fallback."""

from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.services.shop_hours_scheduling import shop_day_bounds
from app.services.tax_service import (
    DEFAULT_TAX_JURISDICTIONS,
    TaxService,
    default_county_tax_rate,
    effective_work_order_tax_rate,
)
from app.services.work_order_billing_helpers import compute_balance_due
from app.utils.travel_calculator import get_default_shop_address


def test_shop_day_bounds_fallback_when_unconfigured():
    hours = {
        "monday": {
            "regular": {"enabled": False, "start": "09:00", "end": "17:00"},
            "evening": {"enabled": False, "start": "17:00", "end": "21:00"},
        }
    }
    # Monday 2026-11-09
    bounds = shop_day_bounds(hours, date(2026, 11, 9), configured=False)
    assert bounds == (8, 17)


def test_shop_day_bounds_closed_when_configured():
    hours = {
        "monday": {
            "regular": {"enabled": False, "start": "09:00", "end": "17:00"},
            "evening": {"enabled": False, "start": "17:00", "end": "21:00"},
        }
    }
    assert shop_day_bounds(hours, date(2026, 11, 9), configured=True) is None


def test_shop_day_bounds_evening_extends_end_hour_detroit_local():
    """Evening window widens day end; hours are shop-local wall clock (not UTC)."""
    hours = {
        "tuesday": {
            "regular": {"enabled": True, "start": "09:00", "end": "17:00"},
            "evening": {"enabled": True, "start": "17:00", "end": "21:00"},
        }
    }
    # Tuesday 2026-11-10 America/Detroit calendar day
    bounds = shop_day_bounds(hours, date(2026, 11, 10), configured=True)
    assert bounds == (9, 21)


def test_shop_address_prefers_trip_zones_setting():
    db = MagicMock()
    db.execute.return_value.fetchone.return_value = (
        {
            "driveTimeFallback": {
                "shopAddress": "100 Custom Shop St, Toledo, OH 43604",
            }
        },
    )
    assert get_default_shop_address(db) == "100 Custom Shop St, Toledo, OH 43604"


def test_shop_address_falls_back_to_hardcode_without_db(monkeypatch):
    monkeypatch.delenv("DEFAULT_SHOP_ADDRESS", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS", raising=False)
    addr = get_default_shop_address(None)
    assert "641 Barclay" in addr


def test_effective_tax_rate_uses_stored_when_truthy():
    wo = SimpleNamespace(tax_rate=0.0675)
    assert effective_work_order_tax_rate(wo, None) == pytest.approx(0.0675)


def test_effective_tax_rate_falsy_uses_default_county():
    wo = SimpleNamespace(tax_rate=0)
    assert effective_work_order_tax_rate(wo, None) == pytest.approx(
        float(DEFAULT_TAX_JURISDICTIONS["counties"]["lucas"]["rate"])
    )
    wo_null = SimpleNamespace(tax_rate=None)
    assert effective_work_order_tax_rate(wo_null, None) == pytest.approx(0.0775)


def test_balance_due_matches_api_resolved_tax_for_null_rate():
    """FE uses API tax_rate; BE compute_balance_due must use the same effective rate."""
    part = SimpleNamespace(price=100.0, status="installed")
    wo = SimpleNamespace(
        tax_rate=None,
        service_items=[],
        parts=[part],
        appointments=[],
        amount_previously_paid=0,
        diagnostic_discount_amount=0,
        diagnostic_credit_mode="half",
    )
    rate = effective_work_order_tax_rate(wo, None)
    due = float(compute_balance_due(wo, db=None))
    expected_tax = round(100.0 * rate, 2)
    assert due == pytest.approx(100.0 + expected_tax, abs=0.02)


def test_tax_service_default_county_rate_from_settings():
    db = MagicMock()
    db.execute.return_value.fetchone.return_value = (
        {
            "defaultCounty": "wood",
            "counties": {
                "wood": {"name": "Wood County", "rate": 0.0675, "zipCodes": []},
                "lucas": {"name": "Lucas County", "rate": 0.0775, "zipCodes": []},
            },
        },
    )
    assert TaxService(db).get_default_county_rate() == pytest.approx(0.0675)
    assert default_county_tax_rate(db) == pytest.approx(0.0675)


def test_job_gap_minutes_default_in_route_chain():
    from app.services.route_optimization_service import (
        DEFAULT_JOB_GAP_MINUTES,
        DayStop,
        build_time_chain,
    )
    from uuid import uuid4

    stops = [
        DayStop(
            appointment_id=uuid4(),
            work_order_id=uuid4(),
            label="A",
            address="1 Main St, Toledo, OH",
            scheduled_start=datetime(2026, 11, 10, 9, 0),
            scheduled_end=datetime(2026, 11, 10, 10, 0),
            duration_minutes=60,
        ),
        DayStop(
            appointment_id=uuid4(),
            work_order_id=uuid4(),
            label="B",
            address="2 Main St, Toledo, OH",
            scheduled_start=datetime(2026, 11, 10, 11, 0),
            scheduled_end=datetime(2026, 11, 10, 12, 0),
            duration_minutes=60,
        ),
    ]
    with patch(
        "app.services.route_optimization_service._travel_minutes",
        return_value=0,
    ):
        rows, _warnings, _dep = build_time_chain(
            stops,
            "641 Barclay Drive, Toledo, OH 43609, USA",
            date(2026, 11, 10),
            [],
            day_start_hour=9,
            job_gap_minutes=DEFAULT_JOB_GAP_MINUTES,
        )
    assert len(rows) == 2
    gap = (rows[1]["new_start"] - rows[0]["new_end"]).total_seconds() / 60
    assert gap == pytest.approx(DEFAULT_JOB_GAP_MINUTES)
