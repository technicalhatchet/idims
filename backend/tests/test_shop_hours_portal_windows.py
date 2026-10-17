"""Shop hours ∩ portal scheduling window resolution."""

from datetime import date

from app.services.shop_hours_scheduling import (
    portal_window_names_for_date,
    resolve_effective_portal_window,
)


def _evening_only_shop():
    base = {
        "regular": {"enabled": False, "start": "09:00", "end": "17:00"},
        "evening": {"enabled": True, "start": "17:00", "end": "21:00"},
    }
    return {day: dict(base) for day in [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
    ]}


def test_evening_only_shop_offers_evening_window_only():
    shop = _evening_only_shop()
    on_date = date(2026, 10, 19)  # Monday
    assert portal_window_names_for_date(shop, on_date) == ["evening"]


def test_portal_morning_disabled_when_shop_is_evening_only():
    shop = _evening_only_shop()
    on_date = date(2026, 10, 19)
    portal_morning = {"enabled": True, "start": "08:00", "end": "12:00"}
    assert resolve_effective_portal_window(shop, on_date, "morning", portal_morning) is None


def test_portal_evening_clipped_to_shop_evening():
    shop = _evening_only_shop()
    shop["monday"]["evening"] = {"enabled": True, "start": "18:00", "end": "21:00"}
    on_date = date(2026, 10, 19)
    portal_evening = {"enabled": True, "start": "17:00", "end": "21:00"}
    effective = resolve_effective_portal_window(shop, on_date, "evening", portal_evening)
    assert effective is not None
    assert effective["start"] == "18:00"
    assert effective["end"] == "21:00"


def test_regular_hours_enable_morning_and_afternoon():
    shop = _evening_only_shop()
    for day in shop:
        shop[day]["regular"] = {"enabled": True, "start": "09:00", "end": "17:00"}
    on_date = date(2026, 10, 19)
    names = portal_window_names_for_date(shop, on_date)
    assert "morning" in names
    assert "afternoon" in names
    assert "evening" in names

    morning_cfg = {"enabled": True, "start": "08:00", "end": "12:00"}
    effective = resolve_effective_portal_window(shop, on_date, "morning", morning_cfg)
    assert effective["start"] == "09:00"
    assert effective["end"] == "12:00"
