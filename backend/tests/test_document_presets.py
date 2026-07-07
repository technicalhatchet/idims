from pdf.document_presets import (
    apply_line_preset_to_rd,
    diagnostic_discount_applies,
    filter_services_for_preset,
    has_billable_repair_service,
    is_trip_service,
)
from pdf.work_order_adapter import work_order_to_estimate

BILLABLE_PARTS = frozenset({"phone_payment", "paid_not_installed", "upfront_50", "installed"})


def test_trip_sku_detection():
    assert is_trip_service({"sku_code": "TRIP-LOCAL"})
    assert not is_trip_service({"sku_code": "DIAG-RANGE"})


def test_diagnostic_preset_excludes_repair_and_parts():
    rd = {
        "services": [
            {"name": "Trip Charge", "sku_code": "TRIP-LOCAL", "billing_status": "billable", "price": 49},
            {"name": "Range Diagnostic", "service_type": "diagnostic", "billing_status": "billable", "price": 89},
            {"name": "Element Repair", "service_type": "repair", "billing_status": "billable", "price": 185},
            {"name": "Old Diagnostic", "service_type": "diagnostic", "billing_status": "waived", "price": 89},
        ],
        "parts": [
            {"number": "P1", "status": "installed", "price": 40},
        ],
    }
    filtered = apply_line_preset_to_rd(rd, "diagnostic", billable_part_statuses=BILLABLE_PARTS)
    assert len(filtered["services"]) == 2
    assert filtered["parts"] == []


def test_repair_preset_excludes_trip():
    services = [
        {"name": "Trip", "sku_code": "TRIP-FAR", "billing_status": "billable"},
        {"name": "Repair", "service_type": "repair", "billing_status": "billable"},
    ]
    assert len(filter_services_for_preset(services, "repair")) == 1


def test_repair_estimate_includes_not_billable_services_and_parts():
    rd = {
        "services": [
            {"name": "Trip", "sku_code": "TRIP-LOCAL", "billing_status": "billable", "price": 49},
            {"name": "Element Repair", "service_type": "repair", "billing_status": "not_billable", "price": 185},
        ],
        "parts": [
            {"number": "P1", "status": "needed", "price": 40, "description": "Element"},
            {"number": "P2", "status": "ordered", "price": 25, "description": "Bracket"},
        ],
        "tax_rate": 0,
        "diagnostic_discount_amount": 0,
    }
    filtered = apply_line_preset_to_rd(
        rd, "repair", billable_part_statuses=BILLABLE_PARTS, for_estimate=True
    )
    assert len(filtered["services"]) == 1
    assert filtered["services"][0]["billing_status"] == "not_billable"
    assert len(filtered["parts"]) == 2

    estimate = work_order_to_estimate(rd, line_preset="repair")
    assert len(estimate["services"]) == 1
    assert estimate["services"][0]["billing_status"] == "Estimated"
    assert len(estimate["parts"]) == 2
    assert estimate["totals"]["service_subtotal"] == 185
    assert estimate["totals"]["parts_subtotal"] == 65


def test_invoice_repair_preset_still_billable_only():
    rd = {
        "services": [
            {"name": "Repair", "service_type": "repair", "billing_status": "not_billable", "price": 185},
            {"name": "Repair", "service_type": "repair", "billing_status": "billable", "price": 200},
        ],
        "parts": [
            {"number": "P1", "status": "needed", "price": 40},
            {"number": "P2", "status": "installed", "price": 25},
        ],
    }
    filtered = apply_line_preset_to_rd(rd, "repair", billable_part_statuses=BILLABLE_PARTS, for_estimate=False)
    assert len(filtered["services"]) == 1
    assert filtered["services"][0]["billing_status"] == "billable"
    assert len(filtered["parts"]) == 1
    assert filtered["parts"][0]["status"] == "installed"


def test_billable_repair_discount_gate():
    assert not has_billable_repair_service(
        [{"name": "Repair", "service_type": "repair", "billing_status": "not_billable"}]
    )
    assert has_billable_repair_service(
        [{"name": "Repair", "service_type": "repair", "billing_status": "billable"}]
    )


def test_repair_preset_omits_diagnostic_discount():
    rd = {
        "line_preset": "repair",
        "diagnostic_discount_amount": 98,
        "services": [
            {"name": "Repair", "service_type": "repair", "billing_status": "billable", "price": 200},
        ],
        "parts": [],
        "tax_rate": 0,
    }
    assert not diagnostic_discount_applies(rd, rd["services"])


def test_full_preset_applies_diagnostic_discount():
    rd = {
        "line_preset": "full",
        "diagnostic_discount_amount": 98,
        "services": [
            {"name": "Repair", "service_type": "repair", "billing_status": "billable", "price": 200},
        ],
        "parts": [],
    }
    assert diagnostic_discount_applies(rd, rd["services"])


def test_repair_estimate_total_excludes_discount():
    rd = {
        "order_number": "WO-1",
        "diagnostic_discount_amount": 98,
        "tax_rate": 0,
        "services": [
            {"name": "Diag", "service_type": "diagnostic", "billing_status": "billable", "price": 89},
            {"name": "Repair", "service_type": "repair", "billing_status": "billable", "price": 200},
        ],
        "parts": [{"number": "P1", "status": "installed", "price": 100, "description": "Part"}],
    }
    estimate = work_order_to_estimate(rd, line_preset="repair")
    assert estimate["totals"]["discount"] == 0
    assert estimate["totals"]["total"] == estimate["totals"]["gross_total"]
