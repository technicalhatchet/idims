"""Portal customer property CRUD (scoped to client, service-area checks)."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.models.property import Property
from app.models.work_order import WorkOrder
from app.schemas.portal_property import PortalPropertyUpdate, PortalPropertyWrite
from app.services.diagnostic_booking_service import (
    OUT_OF_SERVICE_AREA_MESSAGE,
    estimate_trip_charge,
    is_address_serviceable,
)
from app.utils.us_phone import normalize_phone_field

ALLOWED_PROPERTY_TYPES = frozenset({"residential", "rental", "commercial"})
DUPLICATE_ADDRESS_MESSAGE = "You already have this address saved."
ADDRESS_HISTORY_MESSAGE = (
    "This address has service history. Add a new property or call us to update it."
)
DELETE_BLOCKED_MESSAGE = (
    "This property has appliances or service history attached. "
    "Move or remove appliances first, or call us for help."
)


class PortalPropertyError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _collapse_ws(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalized_address_key(address: str, unit: Optional[str]) -> tuple[str, str]:
    return (_collapse_ws(address).lower(), _collapse_ws(unit or "").lower())


def normalize_nickname(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    trimmed = (value or "").strip()
    if not trimmed:
        return None
    return trimmed[:60]


def assert_address_serviceable(db: Session, client: Client, address: str) -> None:
    zone_exempt = bool(getattr(client, "scheduling_zone_exempt", False))
    trip = estimate_trip_charge(db, address, skip_drive_time_lookup=zone_exempt)
    if zone_exempt:
        return
    if not is_address_serviceable(trip):
        raise PortalPropertyError(
            "out_of_service_area",
            OUT_OF_SERVICE_AREA_MESSAGE,
            status_code=403,
        )


def property_has_work_orders(db: Session, property_id: UUID) -> bool:
    return (
        db.query(WorkOrder.id)
        .filter(WorkOrder.property_id == property_id)
        .limit(1)
        .first()
        is not None
    )


def property_has_appliances(db: Session, property_id: UUID) -> bool:
    return (
        db.query(ClientAppliance.id)
        .filter(
            ClientAppliance.property_id == property_id,
            ClientAppliance.is_active.is_(True),
            ClientAppliance.merged_into_id.is_(None),
        )
        .limit(1)
        .first()
        is not None
    )


def find_duplicate_property(
    db: Session,
    client_id: UUID,
    address: str,
    unit: Optional[str],
    *,
    exclude_id: Optional[UUID] = None,
) -> Optional[Property]:
    target = normalized_address_key(address, unit)
    props = db.query(Property).filter(Property.client_id == client_id).all()
    for prop in props:
        if exclude_id and prop.id == exclude_id:
            continue
        if normalized_address_key(prop.address or "", prop.unit_number) == target:
            return prop
    return None


def get_client_property(db: Session, client_id: UUID, property_id: UUID) -> Property:
    prop = (
        db.query(Property)
        .filter(Property.id == property_id, Property.client_id == client_id)
        .first()
    )
    if not prop:
        raise PortalPropertyError("not_found", "Property not found", status_code=404)
    return prop


def _apply_write_fields(prop: Property, data: Dict[str, Any]) -> None:
    if "address" in data and data["address"] is not None:
        prop.address = _collapse_ws(data["address"])
    if "nickname" in data:
        prop.nickname = normalize_nickname(data.get("nickname"))
    if "unit_number" in data:
        unit = data.get("unit_number")
        prop.unit_number = _collapse_ws(unit) if unit else None
    if "property_type" in data and data["property_type"] is not None:
        ptype = data["property_type"]
        if ptype not in ALLOWED_PROPERTY_TYPES:
            raise PortalPropertyError("invalid_type", "Invalid property type")
        prop.property_type = ptype
    for field in (
        "gate_code",
        "access_instructions",
        "tenant_name",
        "tenant_email",
    ):
        if field in data:
            val = data.get(field)
            prop.__setattr__(field, (val.strip() if isinstance(val, str) and val else None))
    if "tenant_phone" in data:
        prop.tenant_phone = normalize_phone_field(data.get("tenant_phone"))


def create_portal_property(
    db: Session,
    client: Client,
    payload: PortalPropertyWrite,
) -> Property:
    address = _collapse_ws(payload.address)
    if not address:
        raise PortalPropertyError("invalid_address", "Address is required")

    if find_duplicate_property(db, client.id, address, payload.unit_number):
        raise PortalPropertyError("duplicate", DUPLICATE_ADDRESS_MESSAGE, status_code=409)

    assert_address_serviceable(db, client, address)

    now = datetime.utcnow()
    prop = Property(client_id=client.id, address=address, created_at=now, updated_at=now)
    _apply_write_fields(
        prop,
        payload.model_dump(),
    )
    db.add(prop)
    db.flush()
    return prop


def update_portal_property(
    db: Session,
    client: Client,
    property_id: UUID,
    payload: PortalPropertyUpdate,
) -> Property:
    prop = get_client_property(db, client.id, property_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return prop

    has_history = property_has_work_orders(db, prop.id)
    if has_history:
        if "address" in updates and updates["address"] is not None:
            new_addr = _collapse_ws(updates["address"])
            if normalized_address_key(new_addr, prop.unit_number) != normalized_address_key(
                prop.address or "", prop.unit_number
            ):
                raise PortalPropertyError("address_locked", ADDRESS_HISTORY_MESSAGE)
        if "unit_number" in updates:
            new_unit = updates.get("unit_number")
            if normalized_address_key(prop.address or "", new_unit) != normalized_address_key(
                prop.address or "", prop.unit_number
            ):
                raise PortalPropertyError("address_locked", ADDRESS_HISTORY_MESSAGE)

    if "address" in updates or "unit_number" in updates:
        if "address" in updates and updates["address"] is not None:
            address = _collapse_ws(updates["address"])
        else:
            address = _collapse_ws(prop.address or "")
        if not address:
            raise PortalPropertyError("invalid_address", "Address is required")
        unit_for_dup = (
            updates["unit_number"] if "unit_number" in updates else prop.unit_number
        )
        if find_duplicate_property(
            db, client.id, address, unit_for_dup, exclude_id=prop.id
        ):
            raise PortalPropertyError("duplicate", DUPLICATE_ADDRESS_MESSAGE, status_code=409)
        if normalized_address_key(address, unit_for_dup) != normalized_address_key(
            prop.address or "", prop.unit_number
        ):
            assert_address_serviceable(db, client, address)

    _apply_write_fields(prop, updates)
    prop.updated_at = datetime.utcnow()
    return prop


def delete_portal_property(db: Session, client_id: UUID, property_id: UUID) -> None:
    prop = get_client_property(db, client_id, property_id)
    if property_has_work_orders(db, prop.id) or property_has_appliances(db, prop.id):
        raise PortalPropertyError("delete_blocked", DELETE_BLOCKED_MESSAGE, status_code=409)
    db.delete(prop)


def _work_order_status(wo: WorkOrder) -> str:
    status = wo.status
    return status.value if hasattr(status, "value") else str(status or "")


def serialize_portal_property_list_item(
    db: Session,
    prop: Property,
    *,
    now: Optional[datetime] = None,
    warranty_is_active=None,
) -> Dict[str, Any]:
    now = now or datetime.utcnow()
    work_orders_list = (
        db.query(WorkOrder)
        .filter(WorkOrder.property_id == prop.id)
        .order_by(WorkOrder.created_at.desc())
        .all()
    )
    terminal = frozenset({"completed", "cancelled", "closed"})
    active_wo = [w for w in work_orders_list if _work_order_status(w) not in terminal]
    if warranty_is_active:
        warranty_active = any(warranty_is_active(w, db, now) for w in work_orders_list)
    else:
        warranty_active = False
    has_history = len(work_orders_list) > 0
    appliance_count = (
        db.query(ClientAppliance)
        .filter(
            ClientAppliance.property_id == prop.id,
            ClientAppliance.is_active.is_(True),
            ClientAppliance.merged_into_id.is_(None),
        )
        .count()
    )

    return {
        "id": str(prop.id),
        "nickname": prop.nickname,
        "address": prop.address,
        "unit_number": prop.unit_number,
        "property_type": prop.property_type,
        "gate_code": prop.gate_code,
        "access_instructions": prop.access_instructions,
        "tenant_name": prop.tenant_name,
        "tenant_phone": prop.tenant_phone,
        "tenant_email": prop.tenant_email,
        "has_service_history": has_history,
        "appliance_count": appliance_count,
        "address_editable": not has_history,
        "stats": {
            "active_repairs": len(active_wo),
            "total_repairs": len(work_orders_list),
            "warranty_active": warranty_active,
        },
        "recent_work_orders": [
            {
                "id": str(w.id),
                "order_number": w.order_number,
                "status": w.status,
                "equipment_make": w.equipment_make,
                "equipment_model": w.equipment_model,
                "equipment_subtype": w.equipment_subtype,
                "created_at": w.created_at.isoformat() if w.created_at else None,
                "invoice_total": float(w.invoice_total) if w.invoice_total else None,
            }
            for w in work_orders_list[:5]
        ],
    }
