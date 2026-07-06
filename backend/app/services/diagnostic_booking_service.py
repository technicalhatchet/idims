"""Shared diagnostic SKU resolution and trip estimates for booking flows."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.client_appliance import ClientAppliance
from app.models.service import EquipmentType, Service, ServiceType
from app.services.zone_service import ZoneService
from app.utils.address_utils import extract_zip_code
from app.utils.travel_calculator import (
    get_default_shop_address,
    get_travel_time_and_distance,
    sanitize_address_for_routing,
)

OUT_OF_SERVICE_AREA_MESSAGE = (
    "This address is outside our online booking area. "
    "We serve the greater Toledo and northwest Ohio region. "
    "If you think this is a mistake, call (419) 515-3394."
)

_BOOKING_APPLIANCE_EQUIPMENT = {
    "refrigerator": EquipmentType.refrigerator,
    "washer": EquipmentType.washer,
    "dryer": EquipmentType.dryer,
    "aiolaundry": EquipmentType.aio_laundry,
    "aio_laundry": EquipmentType.aio_laundry,
    "oven": EquipmentType.range,
    "range": EquipmentType.range,
    "wall_oven": EquipmentType.wall_oven,
    "dishwasher": EquipmentType.dishwasher,
    "tv": EquipmentType.tv,
    "other": EquipmentType.other,
}

_BOOKING_EQUIPMENT_TYPE_CHAIN = {
    "washer": (EquipmentType.washer, EquipmentType.stacked_laundry),
    "dryer": (EquipmentType.washer, EquipmentType.stacked_laundry),
    "washing_machine": (EquipmentType.washer, EquipmentType.stacked_laundry),
    "aiolaundry": (EquipmentType.aio_laundry,),
    "aio_laundry": (EquipmentType.aio_laundry,),
}

_BOOKING_NAME_KEYWORD_FALLBACKS = {
    "washer": ("laundry",),
    "dryer": ("laundry",),
    "washing_machine": ("laundry",),
    "aiolaundry": ("aio", "all-in-one"),
    "aio_laundry": ("aio", "all-in-one"),
}

_BOOKING_APPLIANCE_NAME_KEYWORD = {
    "microwave": "microwave",
    "freezer": "freezer",
    "cooktop": "range",
    "range_hood": "other",
}


def appliance_to_booking_key(appliance: ClientAppliance) -> str:
    """Map registry appliance type/subtype to public booking appliance id."""
    if appliance.equipment_type == "tv":
        return "tv"

    subtype = (appliance.equipment_subtype or "").strip().lower()
    if subtype:
        if subtype in _BOOKING_APPLIANCE_EQUIPMENT or subtype in _BOOKING_EQUIPMENT_TYPE_CHAIN:
            return subtype
        if subtype == "oven":
            return "oven"

    etype = (appliance.equipment_type or "").strip().lower()
    if etype == "tv":
        return "tv"
    return subtype or etype or "other"


def _query_diagnostic_by_equipment(db: Session, equipment_type: EquipmentType) -> Optional[Service]:
    return (
        db.query(Service)
        .filter(
            Service.is_active.is_(True),
            Service.service_type == ServiceType.diagnostic,
            Service.equipment_type == equipment_type,
        )
        .order_by(Service.base_price.desc())
        .first()
    )


def _query_diagnostic_by_name_keyword(db: Session, keyword: str) -> Optional[Service]:
    return (
        db.query(Service)
        .filter(
            Service.is_active.is_(True),
            Service.service_type == ServiceType.diagnostic,
            Service.name.ilike(f"%{keyword}%"),
        )
        .order_by(Service.base_price.desc())
        .first()
    )


def lookup_diagnostic_service(db: Session, appliance_key: str) -> Optional[Service]:
    """Resolve the diagnostic SKU for a booking appliance selection."""
    key = (appliance_key or "").strip().lower()

    chain = _BOOKING_EQUIPMENT_TYPE_CHAIN.get(key)
    if chain:
        for equipment_type in chain:
            service = _query_diagnostic_by_equipment(db, equipment_type)
            if service:
                return service
        for keyword in _BOOKING_NAME_KEYWORD_FALLBACKS.get(key, ()):
            service = _query_diagnostic_by_name_keyword(db, keyword)
            if service:
                return service
    else:
        equipment_type = _BOOKING_APPLIANCE_EQUIPMENT.get(key)
        if equipment_type is not None:
            service = _query_diagnostic_by_equipment(db, equipment_type)
            if service:
                return service

    keyword = _BOOKING_APPLIANCE_NAME_KEYWORD.get(key)
    if keyword:
        service = _query_diagnostic_by_name_keyword(db, keyword)
        if service:
            return service

    return (
        db.query(Service)
        .filter(
            Service.is_active.is_(True),
            Service.service_type == ServiceType.diagnostic,
            Service.equipment_type == EquipmentType.other,
        )
        .order_by(Service.base_price.asc())
        .first()
    )


def estimate_trip_charge(db: Session, address: str) -> dict:
    zone_service = ZoneService(db)
    property_zip = extract_zip_code(address)
    drive_time_minutes = None

    if address and (not property_zip or not zone_service.get_zone_by_zip(property_zip)):
        shop_address = get_default_shop_address()
        routed_address = sanitize_address_for_routing(address) or address
        travel_time, _ = get_travel_time_and_distance(shop_address, routed_address)
        if travel_time is not None:
            drive_time_minutes = float(travel_time)

    zone_result = zone_service.determine_zone(
        zip_code=property_zip,
        drive_time_minutes=drive_time_minutes,
        address=address,
    )

    return {
        "zone_key": zone_result.get("zoneKey", "custom"),
        "zone_name": zone_result.get("zoneName", "Custom"),
        "amount": zone_result.get("tripCharge"),
        "is_custom": bool(zone_result.get("isCustom")),
        "method": zone_result.get("method", "default"),
    }


def is_address_serviceable(trip: dict) -> bool:
    if trip.get("zone_key") == "custom":
        return False
    if trip.get("is_custom") and trip.get("amount") is None:
        return False
    return True


def build_booking_estimate(
    db: Session,
    appliance_key: str,
    address: str,
    *,
    zone_exempt: bool = False,
) -> dict:
    diagnostic_service = lookup_diagnostic_service(db, appliance_key)
    trip = estimate_trip_charge(db, address)
    serviceable = is_address_serviceable(trip)

    if zone_exempt:
        serviceable = True
        if not is_address_serviceable(trip):
            trip = {
                **trip,
                "zone_name": "Pre-approved client",
                "zone_exempt": True,
            }

    diagnostic = None
    diagnostic_price = None
    if diagnostic_service:
        diagnostic_price = float(diagnostic_service.base_price)
        diagnostic = {
            "service_id": str(diagnostic_service.id),
            "name": diagnostic_service.name,
            "price": diagnostic_price,
            "sku_code": diagnostic_service.sku_code,
            "duration_minutes": diagnostic_service.duration_minutes or 45,
        }

    estimated_total = None
    note = None
    if serviceable and diagnostic_price is not None:
        if trip.get("amount") is not None:
            estimated_total = round(diagnostic_price + float(trip["amount"]), 2)
            note = "Diagnostic fee is applied toward repair if you proceed."
        elif zone_exempt:
            estimated_total = diagnostic_price
            note = (
                "Diagnostic fee is applied toward repair if you proceed. "
                "Trip charge will be confirmed based on your service location."
            )

    return {
        "diagnostic": diagnostic,
        "trip_charge": trip,
        "estimated_total": estimated_total,
        "note": note,
        "serviceable": serviceable,
        "service_area_message": None if serviceable else OUT_OF_SERVICE_AREA_MESSAGE,
        "zone_exempt": zone_exempt,
    }
