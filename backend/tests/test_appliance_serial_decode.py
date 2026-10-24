from datetime import date

from app.services.appliance_serial_decode_service import decode_appliance_serial


def test_whirlpool_vsb_week32_is_august_2022():
    r = decode_appliance_serial(
        "Whirlpool",
        "VSB3250890",
        today=date(2026, 1, 1),
    )
    assert r is not None
    assert r.year == 2022
    assert r.month == 8
    assert r.rule == "whirlpool_2010_plus"


def test_electrolux_ba43923181_week39_2024():
    r = decode_appliance_serial(
        "Frigidaire",
        "BA43923181",
        today=date(2026, 1, 1),
    )
    assert r is not None
    assert r.year == 2024
    assert r.rule == "electrolux_week_year"
    assert r.confidence == "medium"


def test_kenmore_106_uses_whirlpool_rule():
    r = decode_appliance_serial(
        "Kenmore",
        "VSB3250890",
        model="106.123456",
        today=date(2026, 1, 1),
    )
    assert r is not None
    assert r.year == 2022
    assert r.month == 8


def test_kenmore_253_uses_electrolux_rule():
    r = decode_appliance_serial(
        "Kenmore",
        "BA43923181",
        model="253.123",
        today=date(2026, 1, 1),
    )
    assert r is not None
    assert r.year == 2024


def test_kenmore_unknown_prefix_no_decode():
    r = decode_appliance_serial("Kenmore", "BA43923181", model="999.123", today=date(2026, 1, 1))
    assert r is None


def test_samsung_oct_2022_example():
    r = decode_appliance_serial(
        "Samsung",
        "0B2G4BBTA00165F",
        today=date(2026, 1, 1),
    )
    assert r and r.year == 2022 and r.month == 10
