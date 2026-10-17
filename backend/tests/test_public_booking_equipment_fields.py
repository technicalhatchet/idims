"""Public booking optional equipment model/serial on BookingRequest."""

from app.routers.public import BookingRequest


def test_booking_request_accepts_optional_equipment_fields():
    req = BookingRequest(
        name="Jane Doe",
        mobile="4195550100",
        email="jane@example.com",
        address="641 Barclay Dr, Toledo, OH 43609",
        appliance="washer",
        issue="Not spinning",
        time_preference="flexible",
        contact_preference_primary="phone",
        equipment_model="WFW5620HW",
        equipment_serial="SN123456",
    )
    assert req.equipment_model == "WFW5620HW"
    assert req.equipment_serial == "SN123456"
