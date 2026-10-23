"""Portal estimate snapshot + approval hash."""

from app.services.portal_estimate_content import (
    build_canonical_estimate_payload,
    estimate_approval_content_changed,
    hash_estimate_content,
)


def test_line_total_uses_mapped_service_total_not_price_key():
    estimate = {
        "line_preset": "full",
        "services": [
            {
                "name": "Washing Machine Repair FL",
                "qty": 1,
                "unit_price": 128.0,
                "total": 128.0,
            }
        ],
        "parts": [],
        "totals": {"total": 128.0},
    }
    canonical = build_canonical_estimate_payload(estimate, legacy=False)
    assert canonical["lines"][0]["line_total"] == "128.00"
    assert canonical["total"] == "128.00"


def test_hash_ignores_preset_legacy_compat():
    estimate = {
        "line_preset": "repair",
        "services": [
            {"name": "Repair", "qty": 1, "unit_price": 100.0, "total": 100.0},
        ],
        "parts": [],
        "totals": {"total": 100.0},
    }
    current = build_canonical_estimate_payload(estimate, legacy=False)
    legacy = build_canonical_estimate_payload(estimate, legacy=True)
    current_hash = hash_estimate_content(current)
    legacy_hash = hash_estimate_content(legacy)
    assert current_hash != legacy_hash
    snapshot = {
        "estimate_content_hash": current_hash,
        "estimate_content_hash_legacy": legacy_hash,
    }
    assert not estimate_approval_content_changed(legacy_hash, snapshot)
    assert estimate_approval_content_changed("deadbeef", snapshot)
