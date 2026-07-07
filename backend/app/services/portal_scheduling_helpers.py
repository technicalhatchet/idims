"""Shared helpers for portal scheduling — shop time, cutoffs, tier pricing."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from app.config import settings as app_settings

SERVICE_TIER_STANDARD = "standard"
SERVICE_TIER_PRIORITY = "priority"
SERVICE_TIER_EMERGENCY = "emergency"

REQUEST_STATUS_PENDING = "pending"
REQUEST_STATUS_APPROVED = "approved"
REQUEST_STATUS_DENIED = "denied"
REQUEST_STATUS_AUTO_DENIED = "auto_denied"


def shop_timezone() -> ZoneInfo:
    try:
        return ZoneInfo(app_settings.SHOP_TIMEZONE or "America/Detroit")
    except Exception:
        return ZoneInfo("America/Detroit")


def shop_now() -> datetime:
    """Current shop-local wall time as naive datetime (matches combine_shop_local)."""
    return datetime.now(shop_timezone()).replace(tzinfo=None)


def shop_local_naive(dt: datetime) -> datetime:
    """Normalize any datetime to naive shop-local for cutoff comparisons."""
    if dt.tzinfo is not None:
        return dt.astimezone(shop_timezone()).replace(tzinfo=None)
    return dt


def shop_today() -> date:
    return shop_now().date()


def parse_hhmm(value: str) -> Tuple[int, int]:
    hour, minute = (value or "00:00").split(":")
    return int(hour), int(minute)


def combine_shop_local(on_date: date, hhmm: str) -> datetime:
    h, m = parse_hhmm(hhmm)
    return datetime.combine(on_date, time(h, m))


def shop_close_time(settings: dict, on_date: Optional[date] = None) -> datetime:
    """Latest end time among enabled scheduling windows for the given shop-local day."""
    on_date = on_date or shop_today()
    windows = settings.get("scheduling_windows") or {}
    latest: Optional[datetime] = None
    for name in ("morning", "afternoon", "evening"):
        cfg = windows.get(name) or {}
        if not cfg.get("enabled"):
            continue
        end = combine_shop_local(on_date, cfg.get("end", "17:00"))
        if latest is None or end > latest:
            latest = end
    if latest is None:
        latest = combine_shop_local(on_date, "17:00")
    return latest


def same_day_submission_cutoff(settings: dict, on_date: Optional[date] = None) -> datetime:
    """Shop close minus same_day_lead_minutes_before_close."""
    on_date = on_date or shop_today()
    lead = int(settings.get("same_day_lead_minutes_before_close", 60))
    return shop_close_time(settings, on_date) - timedelta(minutes=lead)


def priority_cutoff_time(settings: dict, on_date: Optional[date] = None) -> datetime:
    """Midnight at end of shop-local day (priority requests allowed until then)."""
    on_date = on_date or shop_today()
    priority = settings.get("priority_service") or {}
    cutoff_hhmm = priority.get("request_cutoff_time", "23:59")
    return combine_shop_local(on_date, cutoff_hhmm)


def is_standard_same_day_open(settings: dict, *, now: Optional[datetime] = None) -> bool:
    now = shop_local_naive(now) if now is not None else shop_now()
    today = now.date()
    cutoff = same_day_submission_cutoff(settings, today)
    return now <= cutoff


def is_priority_request_open(settings: dict, *, now: Optional[datetime] = None) -> bool:
    priority = settings.get("priority_service") or {}
    if not priority.get("enabled", True):
        return False
    now = shop_local_naive(now) if now is not None else shop_now()
    return now <= priority_cutoff_time(settings, now.date())


def resolve_service_tier(
    settings: dict,
    *,
    scheduled_date: date,
    priority_requested: bool,
    now: Optional[datetime] = None,
) -> str:
    """Pick standard / priority / emergency tier for a same-day request."""
    now = shop_local_naive(now) if now is not None else shop_now()
    today = now.date()
    if scheduled_date != today:
        return SERVICE_TIER_STANDARD

    if not priority_requested:
        return SERVICE_TIER_STANDARD

    priority = settings.get("priority_service") or {}
    if not priority.get("enabled", True):
        return SERVICE_TIER_STANDARD

    if now > same_day_submission_cutoff(settings, today):
        return SERVICE_TIER_EMERGENCY
    return SERVICE_TIER_PRIORITY


def apply_tier_pricing(estimate: dict, tier: str, settings: dict) -> dict:
    """Return estimate copy with tier-adjusted diagnostic/trip/total."""
    if tier == SERVICE_TIER_STANDARD:
        return estimate

    priority = settings.get("priority_service") or {}
    diagnostic = estimate.get("diagnostic") or {}
    trip = estimate.get("trip_charge") or {}

    diag_price = float(diagnostic.get("price") or 0)
    trip_amount = trip.get("amount")
    trip_val = float(trip_amount) if trip_amount is not None else 0.0

    if tier == SERVICE_TIER_PRIORITY:
        diag_mult = float(priority.get("priority_diagnostic_multiplier", 1.5))
        trip_mult = float(priority.get("priority_trip_multiplier", 1.0))
        flat_fee = float(priority.get("priority_flat_fee", 75.0))
        tier_label = "Priority service"
    else:
        diag_mult = float(priority.get("emergency_diagnostic_multiplier", 2.0))
        trip_mult = float(priority.get("emergency_trip_multiplier", 1.5))
        flat_fee = float(priority.get("emergency_flat_fee", 125.0))
        tier_label = "Emergency service"

    new_diag = round(diag_price * diag_mult, 2)
    new_trip = round(trip_val * trip_mult, 2) if trip_amount is not None else None
    total_parts = [new_diag]
    if new_trip is not None:
        total_parts.append(new_trip)
    total_parts.append(flat_fee)
    estimated_total = round(sum(total_parts), 2)

    out = dict(estimate)
    out["service_tier"] = tier
    out["tier_label"] = tier_label
    out["tier_flat_fee"] = flat_fee
    out["diagnostic"] = {**diagnostic, "price": new_diag, "base_price": diag_price}
    if trip_amount is not None:
        out["trip_charge"] = {**trip, "amount": new_trip, "base_amount": trip_val}
    out["estimated_total"] = estimated_total
    out["note"] = (
        f"{tier_label} rates apply. Diagnostic fee is applied toward repair if you proceed."
    )
    return out


def scheduling_context(settings: dict, *, now: Optional[datetime] = None) -> dict:
    """Client-facing same-day / priority availability snapshot."""
    now = shop_local_naive(now) if now is not None else shop_now()
    today = now.date()
    standard_open = is_standard_same_day_open(settings, now=now)
    priority_open = is_priority_request_open(settings, now=now)
    priority_cfg = settings.get("priority_service") or {}

    cutoff = same_day_submission_cutoff(settings, today)
    priority_end = priority_cutoff_time(settings, today)

    message = None
    if not standard_open and priority_open and priority_cfg.get("enabled", True):
        message = (
            "Standard same-day scheduling has closed for today. "
            "You can request priority service (higher rates) or schedule for tomorrow."
        )
    elif not standard_open and not priority_open:
        message = (
            "Same-day scheduling is closed for today. "
            "Please schedule for tomorrow or call us."
        )

    return {
        "shop_date": today.isoformat(),
        "standard_same_day_open": standard_open,
        "priority_service_open": priority_open and bool(priority_cfg.get("enabled", True)),
        "standard_cutoff_at": cutoff.isoformat(),
        "priority_cutoff_at": priority_end.isoformat(),
        "shop_close_at": shop_close_time(settings, today).isoformat(),
        "message": message,
    }


def format_display_time(dt: datetime) -> str:
    label = dt.strftime("%I:%M %p")
    return label[1:] if label.startswith("0") else label


def pending_scheduling_request(meta: Optional[dict]) -> bool:
    if not meta or not isinstance(meta, dict):
        return False
    return (
        meta.get("type") == "scheduling_request"
        and meta.get("status") == REQUEST_STATUS_PENDING
    )


def denied_scheduling_request(meta: Optional[dict]) -> bool:
    if not meta or not isinstance(meta, dict):
        return False
    return meta.get("type") == "scheduling_request" and meta.get("status") in (
        REQUEST_STATUS_DENIED,
        REQUEST_STATUS_AUTO_DENIED,
    )


def reschedulable_after_denial(meta: Optional[dict]) -> bool:
    """True when a same-day request was denied but the work order should stay open for rebooking."""
    return denied_scheduling_request(meta)
