"""Apply serial decode + lifespan hints to appliances."""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.appliance_lifespan import ApplianceLifespanRange
from app.models.client_appliance import ClientAppliance
from app.models.work_order import WorkOrder
from app.services.appliance_serial_decode_service import decode_appliance_serial
from app.utils.datetime_utils import utcnow_naive

MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

STAFF_OVERRIDE_RULE = "staff_override"


def first_service_date(db: Session, appliance_id) -> Optional[date]:
    row = (
        db.query(WorkOrder.created_at)
        .filter(WorkOrder.appliance_id == appliance_id)
        .order_by(WorkOrder.created_at.asc())
        .first()
    )
    if not row or not row[0]:
        return None
    return row[0].date()


def apply_serial_decode(db: Session, appliance: ClientAppliance) -> None:
    if appliance.manufacture_decode_rule == STAFF_OVERRIDE_RULE:
        return
    fs = first_service_date(db, appliance.id)
    result = decode_appliance_serial(
        appliance.make,
        appliance.serial,
        model=appliance.model,
        first_service_date=fs,
    )
    if not result:
        appliance.manufacture_year = None
        appliance.manufacture_month = None
        appliance.manufacture_decode_rule = None
        appliance.manufacture_decode_confidence = None
        appliance.manufacture_decoded_at = None
        return
    appliance.manufacture_year = result.year
    appliance.manufacture_month = result.month
    appliance.manufacture_decode_rule = result.rule
    appliance.manufacture_decode_confidence = result.confidence
    appliance.manufacture_decoded_at = utcnow_naive()


def apply_staff_manufacture_override(
    appliance: ClientAppliance,
    *,
    year: int,
    month: int,
) -> None:
    if month < 1 or month > 12:
        raise ValueError("month must be 1–12")
    if year < 1970 or year > date.today().year + 1:
        raise ValueError("year out of range")
    appliance.manufacture_year = year
    appliance.manufacture_month = month
    appliance.manufacture_decode_rule = STAFF_OVERRIDE_RULE
    appliance.manufacture_decode_confidence = "high"
    appliance.manufacture_decoded_at = utcnow_naive()


def maybe_auto_decode_appliance(db: Session, appliance: ClientAppliance) -> bool:
    """Decode once when serial is present and no decode has been stored yet."""
    from app.services.feature_flags_service import feature_enabled_for_system

    if not feature_enabled_for_system(db, "appliance_age"):
        return False
    if appliance.manufacture_decode_rule == STAFF_OVERRIDE_RULE:
        return False
    if not (appliance.serial or "").strip():
        return False
    if appliance.manufacture_decoded_at is not None:
        return False
    apply_serial_decode(db, appliance)
    return True


def auto_decode_appliances(db: Session, appliances: List[ClientAppliance]) -> int:
    changed = 0
    for appliance in appliances:
        if maybe_auto_decode_appliance(db, appliance):
            changed += 1
    return changed


def _age_years(appliance: ClientAppliance, today: date) -> int:
    age_years = today.year - appliance.manufacture_year
    if today.month < appliance.manufacture_month:
        age_years -= 1
    return max(0, age_years)


def lifespan_for_appliance(db: Session, appliance: ClientAppliance) -> Optional[ApplianceLifespanRange]:
    if appliance.equipment_subtype:
        row = (
            db.query(ApplianceLifespanRange)
            .filter(
                ApplianceLifespanRange.equipment_type == appliance.equipment_type,
                ApplianceLifespanRange.equipment_subtype == appliance.equipment_subtype,
            )
            .first()
        )
        if row:
            return row
    return (
        db.query(ApplianceLifespanRange)
        .filter(
            ApplianceLifespanRange.equipment_type == appliance.equipment_type,
            ApplianceLifespanRange.equipment_subtype.is_(None),
        )
        .first()
    )


def age_display_payload(db: Session, appliance: ClientAppliance) -> Optional[Dict[str, Any]]:
    conf = appliance.manufacture_decode_confidence
    if conf not in ("high", "medium"):
        return None
    if not appliance.manufacture_year or not appliance.manufacture_month:
        return None
    today = date.today()
    age_years = _age_years(appliance, today)
    month_label = MONTH_NAMES[appliance.manufacture_month - 1]
    approx = conf == "medium"
    made_prefix = "~" if approx else ""
    made_label = f"Made {made_prefix}{month_label} {appliance.manufacture_year}"
    age_label = f"~{age_years} years"
    age_chip = f"~{age_years} yrs"

    lifespan = lifespan_for_appliance(db, appliance)
    payload: Dict[str, Any] = {
        "manufacture_year": appliance.manufacture_year,
        "manufacture_month": appliance.manufacture_month,
        "confidence": conf,
        "rule": appliance.manufacture_decode_rule,
        "age_years": age_years,
        "made_label": made_label,
        "age_label": age_label,
        "age_chip": age_chip,
        "display_line": f"{made_label} · about {age_years} years old",
        "staff_override": appliance.manufacture_decode_rule == STAFF_OVERRIDE_RULE,
    }
    if lifespan:
        payload["typical_lifespan_years"] = {
            "min": lifespan.typical_min_years,
            "max": lifespan.typical_max_years,
            "notes": lifespan.notes,
        }
        payload["lifespan_line"] = (
            f"Typical service life: {lifespan.typical_min_years}–{lifespan.typical_max_years} years"
        )
        span = max(lifespan.typical_max_years, 1)
        progress = min(1.0, age_years / span)
        payload["lifespan_bar"] = {
            "progress": round(progress, 3),
            "past_typical_min": age_years >= lifespan.typical_min_years,
            "typical_min_years": lifespan.typical_min_years,
            "typical_max_years": lifespan.typical_max_years,
        }
    return payload
