"""Apply serial decode + lifespan hints to appliances."""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.appliance_lifespan import ApplianceLifespanRange
from app.models.client_appliance import ClientAppliance
from app.models.work_order import WorkOrder
from app.services.appliance_serial_decode_service import decode_appliance_serial
from app.utils.datetime_utils import utcnow_naive


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
    fs = first_service_date(db, appliance.id)
    result = decode_appliance_serial(
        appliance.make,
        appliance.serial,
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
    age_years = today.year - appliance.manufacture_year
    if today.month < appliance.manufacture_month:
        age_years -= 1
    age_years = max(0, age_years)
    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    month_label = month_names[appliance.manufacture_month - 1]
    prefix = "~" if conf == "medium" else ""
    lifespan = lifespan_for_appliance(db, appliance)
    payload = {
        "manufacture_year": appliance.manufacture_year,
        "manufacture_month": appliance.manufacture_month,
        "confidence": conf,
        "rule": appliance.manufacture_decode_rule,
        "display_line": f"Made {prefix}{month_label} {appliance.manufacture_year} · about {age_years} years old",
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
    return payload
