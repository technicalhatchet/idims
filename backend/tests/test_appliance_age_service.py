from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.appliance_age_service import (
    apply_serial_decode,
    apply_staff_manufacture_override,
    maybe_auto_decode_appliance,
)


def test_staff_override_blocks_redecode():
    appliance = SimpleNamespace(
        make="Whirlpool",
        model="WFW8300",
        serial="VSB3250890",
        id=None,
        manufacture_decode_rule="staff_override",
        manufacture_year=2020,
        manufacture_month=3,
        manufacture_decode_confidence="high",
        manufacture_decoded_at=date(2024, 1, 1),
    )
    db = MagicMock()
    apply_serial_decode(db, appliance)
    assert appliance.manufacture_year == 2020
    assert appliance.manufacture_month == 3
    assert appliance.manufacture_decode_rule == "staff_override"


def test_staff_override_sets_rule():
    appliance = SimpleNamespace(
        manufacture_year=None,
        manufacture_month=None,
        manufacture_decode_rule=None,
        manufacture_decode_confidence=None,
        manufacture_decoded_at=None,
    )
    apply_staff_manufacture_override(appliance, year=2022, month=8)
    assert appliance.manufacture_year == 2022
    assert appliance.manufacture_month == 8
    assert appliance.manufacture_decode_rule == "staff_override"
    assert appliance.manufacture_decode_confidence == "high"
