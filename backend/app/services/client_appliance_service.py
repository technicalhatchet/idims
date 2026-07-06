"""Client household appliance registry and work-order import."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.models.property import Property
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.schemas.client_appliance import (
    ClientApplianceCreate,
    ClientApplianceUpdate,
    ImportConfirmRequest,
)

logger = logging.getLogger(__name__)

WARRANTY_DAYS = 90
WARRANTY_ELIGIBLE_STATUSES = frozenset({
    "completed",
    "closed",
    "completed_pending_payment",
})

OPEN_REPAIR_STATUSES = frozenset({
    "pending",
    "scheduled",
    "en_route",
    "waiting_on_parts",
    "in_progress",
    "on_hold",
    "parts_on_order",
    "reschedule",
    "need_to_contact",
    "unreachable",
    "recall",
    "redo",
    "completed_pending_payment",
    "pending_estimate_approval",
})


def _enum_value(value) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


def _norm(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _has_equipment_signal(wo: WorkOrder) -> bool:
    return any([
        _norm(wo.equipment_type),
        _norm(wo.equipment_subtype),
        _norm(wo.equipment_make),
        _norm(wo.equipment_model),
        _norm(wo.equipment_serial),
    ])


def _candidate_key(wo: WorkOrder) -> str:
    serial = _norm(wo.equipment_serial)
    if serial:
        return f"serial:{serial}"
    parts = [
        str(wo.property_id or ""),
        _norm(wo.equipment_type),
        _norm(wo.equipment_subtype),
        _norm(wo.equipment_make),
        _norm(wo.equipment_model),
    ]
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"bundle:{digest}"


def _merge_hint_key(wo: WorkOrder) -> str:
    """Looser key for suggesting merge candidates (same make/model/subtype at property)."""
    serial = _norm(wo.equipment_serial)
    if serial:
        return f"serial:{serial}"
    parts = [
        str(wo.property_id or ""),
        _norm(wo.equipment_type),
        _norm(wo.equipment_subtype),
        _norm(wo.equipment_make),
        _norm(wo.equipment_model),
    ]
    return "hint:" + "|".join(parts)


def _work_order_status(wo: WorkOrder) -> str:
    return _enum_value(wo.status)


def _warranty_service_date(wo: WorkOrder, db: Session) -> Optional[datetime]:
    if wo.actual_end:
        return wo.actual_end
    closed_at = getattr(wo, "closed_at", None)
    if closed_at:
        return closed_at
    latest_completed = (
        db.query(WorkOrderAppointment)
        .filter(
            WorkOrderAppointment.work_order_id == wo.id,
            WorkOrderAppointment.status == "completed",
        )
        .order_by(desc(WorkOrderAppointment.scheduled_start))
        .first()
    )
    if latest_completed and latest_completed.scheduled_start:
        return latest_completed.scheduled_start
    if _work_order_status(wo) in WARRANTY_ELIGIBLE_STATUSES and wo.created_at:
        return wo.created_at
    return None


def _warranty_expires_at(wo: WorkOrder, db: Session) -> Optional[datetime]:
    if _work_order_status(wo) not in WARRANTY_ELIGIBLE_STATUSES:
        return None
    service_date = _warranty_service_date(wo, db)
    if not service_date:
        return None
    return service_date + timedelta(days=WARRANTY_DAYS)


def _warranty_is_active(wo: WorkOrder, db: Session, now: Optional[datetime] = None) -> bool:
    expiry = _warranty_expires_at(wo, db)
    if not expiry:
        return False
    now = now or datetime.utcnow()
    return expiry > now


def get_portal_self_scheduling_enabled(db: Session) -> bool:
    from app.services.portal_scheduling_settings_service import is_self_scheduling_globally_enabled

    return is_self_scheduling_globally_enabled(db)


def client_self_scheduling_allowed(client: Client, db: Session) -> bool:
    if client.self_scheduling_blocked:
        return False
    return get_portal_self_scheduling_enabled(db)


def client_scheduling_zone_exempt(client: Client) -> bool:
    return bool(getattr(client, "scheduling_zone_exempt", False))


def _property_payload(prop: Optional[Property], wo: WorkOrder) -> Optional[Dict[str, Any]]:
    if prop:
        return {
            "id": str(prop.id),
            "address": prop.address,
            "unit_number": prop.unit_number,
        }
    loc = wo.service_location or {}
    if loc.get("address"):
        return {
            "id": None,
            "address": loc.get("address"),
            "unit_number": None,
        }
    return None


def build_import_candidates(db: Session, client_id: UUID) -> List[Dict[str, Any]]:
    work_orders = (
        db.query(WorkOrder)
        .filter(WorkOrder.client_id == client_id)
        .order_by(WorkOrder.created_at.desc())
        .all()
    )

    groups: Dict[str, List[WorkOrder]] = {}
    hint_groups: Dict[str, List[str]] = {}

    for wo in work_orders:
        if not _has_equipment_signal(wo):
            continue
        key = _candidate_key(wo)
        groups.setdefault(key, []).append(wo)
        hint = _merge_hint_key(wo)
        hint_groups.setdefault(hint, []).append(key)

    duplicate_hints = {hint for hint, keys in hint_groups.items() if len(set(keys)) > 1}

    candidates: List[Dict[str, Any]] = []
    for key, wos in groups.items():
        wos_sorted = sorted(wos, key=lambda w: w.created_at or datetime.min, reverse=True)
        latest = wos_sorted[0]
        prop = (
            db.query(Property).filter(Property.id == latest.property_id).first()
            if latest.property_id
            else None
        )
        hint = _merge_hint_key(latest)
        candidates.append({
            "candidate_id": key,
            "equipment_type": latest.equipment_type,
            "equipment_subtype": latest.equipment_subtype,
            "make": latest.equipment_make,
            "model": latest.equipment_model,
            "serial": latest.equipment_serial,
            "equipment_version": latest.equipment_version,
            "is_wall_mounted": bool(latest.is_wall_mounted),
            "property": _property_payload(prop, latest),
            "work_order_ids": [str(w.id) for w in wos_sorted],
            "service_count": len(wos_sorted),
            "last_service_date": latest.created_at.isoformat() if latest.created_at else None,
            "merge_group_hint": hint if hint in duplicate_hints else None,
        })

    candidates.sort(key=lambda c: c.get("last_service_date") or "", reverse=True)
    return candidates


def _wo_matches_appliance(wo: WorkOrder, appliance: ClientAppliance) -> bool:
    if wo.appliance_id and appliance.id:
        return wo.appliance_id == appliance.id

    if appliance.serial and wo.equipment_serial:
        return _norm(appliance.serial) == _norm(wo.equipment_serial)

    if not appliance.property_id or not wo.property_id:
        return False
    if appliance.property_id != wo.property_id:
        return False

    subtype_a = _norm(appliance.equipment_subtype)
    subtype_w = _norm(wo.equipment_subtype)
    if subtype_a and subtype_w and subtype_a != subtype_w:
        return False

    make_a = _norm(appliance.make)
    make_w = _norm(wo.equipment_make)
    if make_a and make_w and make_a != make_w:
        return False

    model_a = _norm(appliance.model)
    model_w = _norm(wo.equipment_model)
    if model_a and model_w and model_a != model_w:
        return False

    signals = 0
    if subtype_a and subtype_w and subtype_a == subtype_w:
        signals += 1
    if make_a and make_w and make_a == make_w:
        signals += 1
    if model_a and model_w and model_a == model_w:
        signals += 1

    return signals >= 1


def resolve_property_for_appliance(
    db: Session,
    appliance: ClientAppliance,
    work_orders: Optional[List[WorkOrder]] = None,
) -> Optional[Property]:
    """Property on the appliance record, or from linked / matching work orders."""
    if appliance.property_id:
        prop = db.query(Property).filter(Property.id == appliance.property_id).first()
        if prop:
            return prop

    orders = work_orders if work_orders is not None else work_orders_for_appliance(db, appliance)
    for wo in orders:
        if wo.property_id:
            prop = db.query(Property).filter(Property.id == wo.property_id).first()
            if prop:
                return prop
        loc = wo.service_location or {}
        if isinstance(loc, dict) and (loc.get("address") or "").strip():
            # Work order has a service address but no property row — still schedulable.
            return None
    return None


def service_address_for_appliance(
    db: Session,
    appliance: ClientAppliance,
    work_orders: Optional[List[WorkOrder]] = None,
) -> Optional[str]:
    prop = resolve_property_for_appliance(db, appliance, work_orders)
    if prop and prop.address:
        return prop.address.strip()

    orders = work_orders if work_orders is not None else work_orders_for_appliance(db, appliance)
    for wo in orders:
        loc = wo.service_location or {}
        if isinstance(loc, dict):
            addr = (loc.get("address") or "").strip()
            if addr:
                return addr
    return None


def scheduling_missing_fields(
    appliance: ClientAppliance,
    *,
    has_service_address: bool,
) -> List[str]:
    missing: List[str] = []
    if not appliance.equipment_type:
        missing.append("equipment_type")
    if not appliance.equipment_subtype:
        missing.append("equipment_subtype")
    if not appliance.make:
        missing.append("make")
    if not has_service_address:
        missing.append("service_address")
    return missing


def work_orders_for_appliance(db: Session, appliance: ClientAppliance) -> List[WorkOrder]:
    """All work orders for an appliance: linked by id plus legacy equipment matching."""
    seen: Dict[UUID, WorkOrder] = {}

    for wo in db.query(WorkOrder).filter(WorkOrder.appliance_id == appliance.id).all():
        seen[wo.id] = wo

    for wo in (
        db.query(WorkOrder)
        .filter(WorkOrder.client_id == appliance.client_id)
        .order_by(WorkOrder.created_at.desc())
        .all()
    ):
        if wo.id in seen:
            continue
        if wo.appliance_id and wo.appliance_id != appliance.id:
            continue
        if _wo_matches_appliance(wo, appliance):
            seen[wo.id] = wo

    return sorted(seen.values(), key=lambda w: w.created_at or datetime.min, reverse=True)


def link_work_orders_to_appliance(db: Session, appliance: ClientAppliance, work_order_ids: Optional[List[str]] = None) -> int:
    query = db.query(WorkOrder).filter(WorkOrder.client_id == appliance.client_id)
    if work_order_ids:
        query = query.filter(WorkOrder.id.in_(work_order_ids))
    work_orders = query.all()

    linked = 0
    for wo in work_orders:
        if work_order_ids or _wo_matches_appliance(wo, appliance):
            wo.appliance_id = appliance.id
            linked += 1
    return linked


def serialize_appliance(
    appliance: ClientAppliance,
    db: Session,
    *,
    include_history: bool = False,
) -> Dict[str, Any]:
    work_orders = work_orders_for_appliance(db, appliance)
    prop = resolve_property_for_appliance(db, appliance, work_orders)
    service_address = service_address_for_appliance(db, appliance, work_orders)
    suggested_property_id = None
    if not appliance.property_id and prop:
        suggested_property_id = str(prop.id)

    now = datetime.utcnow()

    open_work_orders = [wo for wo in work_orders if _work_order_status(wo) in OPEN_REPAIR_STATUSES]
    active_repair = bool(open_work_orders)
    warranty_active = any(_warranty_is_active(wo, db, now) for wo in work_orders)
    latest = work_orders[0] if work_orders else None
    missing = scheduling_missing_fields(appliance, has_service_address=bool(service_address))
    scheduling_ready = len(missing) == 0

    payload = {
        "id": str(appliance.id),
        "client_id": str(appliance.client_id),
        "property_id": str(appliance.property_id) if appliance.property_id else suggested_property_id,
        "suggested_property_id": suggested_property_id,
        "nickname": appliance.nickname,
        "equipment_type": appliance.equipment_type,
        "equipment_subtype": appliance.equipment_subtype,
        "make": appliance.make,
        "model": appliance.model,
        "serial": appliance.serial,
        "equipment_version": appliance.equipment_version,
        "is_wall_mounted": appliance.is_wall_mounted,
        "notes": appliance.notes,
        "photo_urls": appliance.photo_urls or [],
        "source": appliance.source,
        "is_active": appliance.is_active,
        "property": {
            "id": str(prop.id),
            "address": prop.address,
            "unit_number": prop.unit_number,
        } if prop else (
            {"id": None, "address": service_address, "unit_number": None}
            if service_address
            else None
        ),
        "service_address": service_address,
        "service_count": len(work_orders),
        "last_service_date": latest.created_at.isoformat() if latest and latest.created_at else None,
        "last_status": _work_order_status(latest) if latest else None,
        "warranty_active": warranty_active,
        "active_repair": active_repair,
        "open_work_order_id": str(open_work_orders[0].id) if open_work_orders else None,
        "open_work_order_number": open_work_orders[0].order_number if open_work_orders else None,
        "scheduling_ready": scheduling_ready,
        "scheduling_missing": missing,
        "can_schedule": scheduling_ready and not active_repair,
    }

    if include_history:
        history = []
        for wo in work_orders:
            warranty_expires = _warranty_expires_at(wo, db)
            history.append({
                "id": str(wo.id),
                "order_number": wo.order_number,
                "status": _work_order_status(wo),
                "created_at": wo.created_at.isoformat() if wo.created_at else None,
                "description": wo.description,
                "symptoms": wo.symptoms or [],
                "invoice_total": float(wo.invoice_total) if wo.invoice_total else None,
                "warranty_expires": warranty_expires.isoformat() if warranty_expires else None,
                "warranty_active": _warranty_is_active(wo, db, now),
                "parts": [
                    {"name": p.description, "part_number": p.number, "status": p.status}
                    for p in (wo.parts or [])
                ],
            })
        payload["history"] = history

    return payload


def list_client_appliances(db: Session, client_id: UUID, *, active_only: bool = True) -> List[Dict[str, Any]]:
    query = db.query(ClientAppliance).filter(ClientAppliance.client_id == client_id)
    if active_only:
        query = query.filter(ClientAppliance.is_active.is_(True), ClientAppliance.merged_into_id.is_(None))
    appliances = query.order_by(ClientAppliance.updated_at.desc()).all()
    return [serialize_appliance(a, db) for a in appliances]


def get_client_appliance(db: Session, client_id: UUID, appliance_id: UUID) -> ClientAppliance:
    appliance = (
        db.query(ClientAppliance)
        .filter(
            ClientAppliance.id == appliance_id,
            ClientAppliance.client_id == client_id,
            ClientAppliance.is_active.is_(True),
            ClientAppliance.merged_into_id.is_(None),
        )
        .first()
    )
    if not appliance:
        raise ValueError("Appliance not found")
    return appliance


def create_client_appliance(
    db: Session,
    client_id: UUID,
    data: ClientApplianceCreate,
    *,
    source: str = "manual",
    work_order_ids: Optional[List[str]] = None,
) -> ClientAppliance:
    if data.property_id:
        prop = (
            db.query(Property)
            .filter(Property.id == data.property_id, Property.client_id == client_id)
            .first()
        )
        if not prop:
            raise ValueError("Property not found for this client")

    appliance = ClientAppliance(
        client_id=client_id,
        property_id=data.property_id,
        nickname=data.nickname,
        equipment_type=data.equipment_type,
        equipment_subtype=data.equipment_subtype,
        make=data.make,
        model=data.model,
        serial=data.serial,
        equipment_version=data.equipment_version,
        is_wall_mounted=data.is_wall_mounted,
        notes=data.notes,
        photo_urls=data.photo_urls or [],
        source=source,
    )
    db.add(appliance)
    db.flush()
    link_work_orders_to_appliance(db, appliance, work_order_ids)
    return appliance


def update_client_appliance(
    db: Session,
    client_id: UUID,
    appliance_id: UUID,
    data: ClientApplianceUpdate,
) -> ClientAppliance:
    appliance = get_client_appliance(db, client_id, appliance_id)
    updates = data.model_dump(exclude_unset=True)

    if "property_id" in updates and updates["property_id"]:
        prop = (
            db.query(Property)
            .filter(Property.id == updates["property_id"], Property.client_id == client_id)
            .first()
        )
        if not prop:
            raise ValueError("Property not found for this client")

    for field, value in updates.items():
        setattr(appliance, field, value)
    appliance.updated_at = datetime.utcnow()
    return appliance


def soft_delete_client_appliance(db: Session, client_id: UUID, appliance_id: UUID) -> None:
    appliance = get_client_appliance(db, client_id, appliance_id)
    appliance.is_active = False
    appliance.updated_at = datetime.utcnow()


def confirm_import(
    db: Session,
    client: Client,
    payload: ImportConfirmRequest,
) -> List[ClientAppliance]:
    created: List[ClientAppliance] = []
    for item in payload.appliances:
        create_data = ClientApplianceCreate(
            property_id=item.property_id,
            nickname=item.nickname,
            equipment_type=item.equipment_type,
            equipment_subtype=item.equipment_subtype,
            make=item.make,
            model=item.model,
            serial=item.serial,
            equipment_version=item.equipment_version,
            is_wall_mounted=item.is_wall_mounted,
            notes=item.notes,
        )
        appliance = create_client_appliance(
            db,
            client.id,
            create_data,
            source="work_order_import",
            work_order_ids=item.work_order_ids or None,
        )
        created.append(appliance)

    client.appliances_import_completed = True
    client.updated_at = datetime.utcnow()
    return created


def merge_appliances(
    db: Session,
    client_id: UUID,
    keep_id: UUID,
    merge_ids: List[UUID],
) -> ClientAppliance:
    keep = get_client_appliance(db, client_id, keep_id)
    merge_ids = [mid for mid in merge_ids if mid != keep_id]

    for merge_id in merge_ids:
        other = (
            db.query(ClientAppliance)
            .filter(
                ClientAppliance.id == merge_id,
                ClientAppliance.client_id == client_id,
                ClientAppliance.is_active.is_(True),
            )
            .first()
        )
        if not other:
            continue

        for wo in db.query(WorkOrder).filter(WorkOrder.appliance_id == other.id).all():
            wo.appliance_id = keep.id

        link_work_orders_to_appliance(db, keep)

        other.is_active = False
        other.merged_into_id = keep.id
        other.updated_at = datetime.utcnow()

    keep.updated_at = datetime.utcnow()
    return keep
