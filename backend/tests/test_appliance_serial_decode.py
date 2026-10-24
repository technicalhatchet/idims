from datetime import date

from app.services.appliance_serial_decode_service import decode_appliance_serial


def test_whirlpool_vsb_example():
    r = decode_appliance_serial(
        "Whirlpool",
        "VSB3250890",
        today=date(2026, 1, 1),
    )
    assert r and r.year == 2022 and r.rule == "whirlpool_2010_plus"


def test_samsung_oct_2022_example():
    r = decode_appliance_serial(
        "Samsung",
        "0B2G4BBTA00165F",
        today=date(2026, 1, 1),
    )
    assert r and r.year == 2022 and r.month == 10
