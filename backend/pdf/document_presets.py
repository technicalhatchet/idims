"""Line-item presets for work-order invoice / estimate PDFs."""

from __future__ import annotations

from typing import Any, Dict, List, Literal

LinePreset = Literal["diagnostic", "repair", "full"]

BILLABLE_SERVICE_STATUSES = frozenset({"billable", "paid"})
TRIP_SKU_PREFIX = "TRIP-"


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def is_trip_service(service: dict) -> bool:
    sku = str(service.get("sku_code") or "").upper()
    return sku.startswith(TRIP_SKU_PREFIX) or sku == "TRIP-CHARGE"


def is_diagnostic_service(service: dict) -> bool:
    if is_trip_service(service):
        return True
    if _norm(service.get("service_type")) == "diagnostic":
        return True
    name = _norm(service.get("name"))
    return "diagnostic" in name and "repair" not in name


def is_repair_service(service: dict) -> bool:
    if is_trip_service(service):
        return False
    if _norm(service.get("service_type")) == "diagnostic":
        return False
    if _norm(service.get("service_type")) == "repair":
        return True
    return "repair" in _norm(service.get("name"))


def is_billable_service(service: dict) -> bool:
    return _norm(service.get("billing_status")) in BILLABLE_SERVICE_STATUSES


def has_billable_repair_service(services: List[dict]) -> bool:
    """True when a repair SKU line is billable or paid (diagnostic discount gate)."""
    return any(is_repair_service(s) and is_billable_service(s) for s in services or [])


def repair_line_for_discount(services: List[dict], *, for_estimate: bool = False) -> bool:
    """Whether diagnostic credit applies — billable repair on invoices, any repair SKU on estimates."""
    if for_estimate:
        return any(
            is_repair_service(s) and _norm(s.get("billing_status")) != "waived"
            for s in services or []
        )
    return has_billable_repair_service(services)


def diagnostic_discount_applies(rd: dict, services: List[dict], *, for_estimate: bool = False) -> bool:
    """
    Diagnostic credit applies only on the full document view.

    Repair-only and diagnostic-only presets omit the discount so totals match
    the lines shown on that PDF.
    """
    preset = _norm(rd.get("line_preset")) or "full"
    if preset != "full":
        return False
    diag = float(rd.get("diagnostic_discount_amount") or 0)
    return diag > 0 and repair_line_for_discount(services, for_estimate=for_estimate)


def service_matches_preset(
    service: dict,
    preset: LinePreset,
    *,
    for_estimate: bool = False,
) -> bool:
    status = _norm(service.get("billing_status"))
    if not for_estimate:
        if not is_billable_service(service):
            return False
    elif status == "waived":
        return False
    if preset == "full":
        return True
    if preset == "diagnostic":
        return is_diagnostic_service(service)
    if preset == "repair":
        return is_repair_service(service)
    return True


def part_matches_preset(
    part: dict,
    preset: LinePreset,
    *,
    billable_statuses: frozenset,
    for_estimate: bool = False,
) -> bool:
    if preset == "diagnostic":
        return False
    if preset == "full":
        # Full estimate/invoice shows quoted parts (needed, ordered, etc.), not only billable statuses.
        return _norm(part.get("status")) != "not_installed"
    if for_estimate:
        return _norm(part.get("status")) != "not_installed"
    return part.get("status") in billable_statuses


def filter_services_for_preset(
    services: List[dict],
    preset: LinePreset,
    *,
    for_estimate: bool = False,
) -> List[dict]:
    return [
        s
        for s in (services or [])
        if service_matches_preset(s, preset, for_estimate=for_estimate)
    ]


def filter_parts_for_preset(
    parts: List[dict],
    preset: LinePreset,
    *,
    billable_statuses: frozenset,
    for_estimate: bool = False,
) -> List[dict]:
    return [
        p
        for p in (parts or [])
        if part_matches_preset(
            p,
            preset,
            billable_statuses=billable_statuses,
            for_estimate=for_estimate,
        )
    ]


def apply_line_preset_to_rd(
    rd: dict,
    preset: LinePreset,
    *,
    billable_part_statuses: frozenset,
    for_estimate: bool = False,
) -> dict:
    """Return a shallow copy of ``rd`` with services/parts filtered for the preset."""
    out = dict(rd)
    out["services"] = filter_services_for_preset(
        rd.get("services") or [],
        preset,
        for_estimate=for_estimate,
    )
    out["parts"] = filter_parts_for_preset(
        rd.get("parts") or [],
        preset,
        billable_statuses=billable_part_statuses,
        for_estimate=for_estimate,
    )
    out["line_preset"] = preset
    return out


def normalize_line_preset(value: str | None, *, doc_type: str = "estimate") -> LinePreset:
    """Invoice documents always use the full billable line set."""
    if doc_type == "invoice":
        return "full"
    key = _norm(value)
    if key in ("diagnostic", "repair", "full"):
        return key  # type: ignore[return-value]
    return "full"
