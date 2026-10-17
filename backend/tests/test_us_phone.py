from app.utils.us_phone import (
    format_us_phone_display,
    normalize_us_phone_e164,
    phones_equal,
    prefer_dial_phone,
)


def test_normalize_ten_digit():
    assert normalize_us_phone_e164("(419) 555-1234") == "+14195551234"


def test_normalize_eleven_digit():
    assert normalize_us_phone_e164("1-419-555-1234") == "+14195551234"


def test_normalize_invalid():
    assert normalize_us_phone_e164("123") is None


def test_phones_equal_different_formats():
    assert phones_equal("(419) 555-1234", "+14195551234")


def test_prefer_dial_mobile():
    assert prefer_dial_phone("+14195551234", "+14195559999") == "+14195551234"


def test_format_display():
    assert format_us_phone_display("+14195551234") == "(419) 555-1234"
