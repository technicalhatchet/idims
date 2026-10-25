"""Maintenance task catalog matching, lazy materialization, and schedules."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.models.maintenance_task import ClientApplianceMaintenanceTask, MaintenanceTaskDefinition
from app.models.work_order import WorkOrder
from app.services.parts_links_service import REFRIGERATOR_SUBTYPES, get_parts_links_settings

DUE_SOON_DAYS = 14
SNOOZE_MONTHS = 1


def _norm_subtype(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _norm_equipment_type(value: Optional[str]) -> str:
    return (value or "").strip().lower()


_FREEZER_SUBTYPES = frozenset({"freezer", "chest_freezer", "upright_freezer"})
_FRIDGE_FAMILY_EXTRA = frozenset(
    {
        "top_freezer_fridge",
        "bottom_freezer_fridge",
    }
)
# In-door / dispenser water filters — fridge configurations only (not standalone freezers).
FRIDGE_WATER_FILTER_SUBTYPES = frozenset(
    _norm_subtype(s)
    for s in (set(REFRIGERATOR_SUBTYPES) - _FREEZER_SUBTYPES) | _FRIDGE_FAMILY_EXTRA
)

MAINTENANCE_SUBTYPE_FAMILIES: Dict[str, frozenset] = {
    "refrigerator": frozenset(
        _norm_subtype(s)
        for s in (
            set(REFRIGERATOR_SUBTYPES)
            | _FRIDGE_FAMILY_EXTRA
            | _FREEZER_SUBTYPES
        )
    ),
    "dryer": frozenset(
        _norm_subtype(s)
        for s in (
            "dryer",
            "electric_dryer",
            "gas_dryer",
            "stacked_dryer",
        )
    ),
    "washing_machine": frozenset(
        _norm_subtype(s)
        for s in (
            "washing_machine",
            "washer",
            "front_load_washer",
            "top_load_washer",
            "aio_laundry",
        )
    ),
    "dishwasher": frozenset({_norm_subtype("dishwasher")}),
    "range_hood": frozenset(_norm_subtype(s) for s in ("range_hood", "hood")),
}


def _is_water_filter_task(defn: MaintenanceTaskDefinition) -> bool:
    term = (defn.parts_search_term or "").strip().lower()
    name = (defn.name or "").strip().lower()
    return term == "water filter" or "water filter" in name


def appliance_matches_task_definition(defn: MaintenanceTaskDefinition, appliance: ClientAppliance) -> bool:
    if _norm_equipment_type(defn.equipment_type) != _norm_equipment_type(appliance.equipment_type):
        return False
    if not defn.equipment_subtype:
        return True
    family_key = _norm_subtype(defn.equipment_subtype)
    app_sub = _norm_subtype(appliance.equipment_subtype)
    if not app_sub:
        return False
    family = MAINTENANCE_SUBTYPE_FAMILIES.get(family_key)
    if family:
        if app_sub not in family:
            return False
        if _is_water_filter_task(defn) and app_sub not in FRIDGE_WATER_FILTER_SUBTYPES:
            return False
        return True
    return family_key == app_sub

DEFAULT_DEFINITION_ROWS: List[Dict[str, Any]] = [
    {
        "equipment_type": "appliance",
        "equipment_subtype": "refrigerator",
        "name": "Replace water filter",
        "interval_months": 6,
        "kind": "diy",
        "how_to_text": "Turn off water supply if needed, twist out the old filter, install the OEM replacement, and run a few gallons to clear air.",
        "parts_search_term": "water filter",
        "sort_order": 10,
    },
    {
        "equipment_type": "appliance",
        "equipment_subtype": "refrigerator",
        "name": "Clean condenser coils",
        "interval_months": 12,
        "kind": "diy",
        "how_to_text": "Unplug the unit, pull it forward safely, vacuum dust from the coils, and restore airflow clearance.",
        "parts_search_term": None,
        "sort_order": 20,
    },
    {
        "equipment_type": "appliance",
        "equipment_subtype": "dryer",
        "name": "Dryer vent cleaning",
        "interval_months": 12,
        "kind": "service",
        "how_to_text": "Professional vent cleaning reduces fire risk and improves drying performance.",
        "parts_search_term": None,
        "sort_order": 30,
    },
    {
        "equipment_type": "appliance",
        "equipment_subtype": "dishwasher",
        "name": "Clean dishwasher filter",
        "interval_months": 3,
        "kind": "diy",
        "how_to_text": "Remove and rinse the filter assembly under warm water; clear debris from the sump before reinstalling.",
        "parts_search_term": None,
        "sort_order": 40,
    },
    {
        "equipment_type": "appliance",
        "equipment_subtype": "washing_machine",
        "name": "Washer tub clean + door gasket care",
        "interval_months": 3,
        "kind": "diy",
        "how_to_text": "Run a tub clean cycle with washer cleaner, then wipe the door gasket and leave the door open to dry.",
        "parts_search_term": None,
        "sort_order": 50,
    },
    {
        "equipment_type": "appliance",
        "equipment_subtype": "range_hood",
        "name": "Clean or replace range hood filter",
        "interval_months": 6,
        "kind": "diy",
        "how_to_text": "Remove metal mesh or charcoal filters; wash mesh filters with degreaser or replace disposable filters.",
        "parts_search_term": "range hood filter",
        "sort_order": 60,
    },
]


def add_months(start: date, months: int) -> date:
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def definition_matches_appliance(defn: MaintenanceTaskDefinition, appliance: ClientAppliance) -> bool:
    if not defn.enabled:
        return False
    return appliance_matches_task_definition(defn, appliance)


def matching_definitions(db: Session, appliance: ClientAppliance) -> List[MaintenanceTaskDefinition]:
    rows = (
        db.query(MaintenanceTaskDefinition)
        .filter(MaintenanceTaskDefinition.enabled.is_(True))
        .order_by(MaintenanceTaskDefinition.sort_order, MaintenanceTaskDefinition.name)
        .all()
    )
    return [r for r in rows if definition_matches_appliance(r, appliance)]


def build_task_parts_search_url(
    db: Session,
    *,
    model: Optional[str],
    parts_search_term: Optional[str],
) -> Optional[str]:
    if not (model or "").strip():
        return None
    cfg = get_parts_links_settings(db)
    query = (model or "").strip()
    if (parts_search_term or "").strip():
        query = f"{query} {parts_search_term.strip()}"
    encoded = quote(query)
    return cfg["model_search_url_template"].replace("{model}", encoded)


def _task_status(row: ClientApplianceMaintenanceTask, today: date) -> str:
    if row.disabled_at:
        return "disabled"
    if row.snoozed_until and row.snoozed_until > today:
        return "snoozed"
    if row.next_due_at <= today:
        return "due_now"
    if row.next_due_at <= today + timedelta(days=DUE_SOON_DAYS):
        return "due_soon"
    return "ok"


def is_actionable_due(row: ClientApplianceMaintenanceTask, today: date) -> bool:
    status = _task_status(row, today)
    return status in ("due_now", "due_soon")


def materialize_missing_tasks(
    db: Session,
    appliance: ClientAppliance,
    *,
    anchor_date: Optional[date] = None,
) -> int:
    """Create per-appliance rows for catalog tasks that are not present yet."""
    if not appliance.is_active or appliance.merged_into_id:
        return 0
    anchor = anchor_date or date.today()
    existing_ids = {
        r.task_definition_id
        for r in db.query(ClientApplianceMaintenanceTask.task_definition_id)
        .filter(ClientApplianceMaintenanceTask.appliance_id == appliance.id)
        .all()
    }
    created = 0
    for defn in matching_definitions(db, appliance):
        if defn.id in existing_ids:
            continue
        next_due = add_months(anchor, defn.interval_months)
        db.add(
            ClientApplianceMaintenanceTask(
                appliance_id=appliance.id,
                task_definition_id=defn.id,
                next_due_at=next_due,
            )
        )
        created += 1
    if created:
        db.flush()
    return created


def materialize_on_appliance_created(db: Session, appliance: ClientAppliance) -> None:
    from app.services.feature_flags_service import feature_enabled_for_system

    if not feature_enabled_for_system(db, "maintenance_reminders"):
        return
    anchor = appliance.created_at.date() if appliance.created_at else date.today()
    materialize_missing_tasks(db, appliance, anchor_date=anchor)


def _load_task_rows(db: Session, appliance_id: UUID) -> List[ClientApplianceMaintenanceTask]:
    return (
        db.query(ClientApplianceMaintenanceTask)
        .options(joinedload(ClientApplianceMaintenanceTask.definition))
        .filter(ClientApplianceMaintenanceTask.appliance_id == appliance_id)
        .all()
    )


def serialize_task_row(
    db: Session,
    row: ClientApplianceMaintenanceTask,
    appliance: ClientAppliance,
    today: Optional[date] = None,
) -> Dict[str, Any]:
    today = today or date.today()
    defn = row.definition
    parts_url = None
    if defn and defn.parts_search_term:
        parts_url = build_task_parts_search_url(
            db,
            model=appliance.model,
            parts_search_term=defn.parts_search_term,
        )
    return {
        "id": str(row.id),
        "task_definition_id": str(row.task_definition_id),
        "name": defn.name if defn else "",
        "kind": defn.kind if defn else "diy",
        "how_to_text": defn.how_to_text if defn else None,
        "interval_months": defn.interval_months if defn else None,
        "bookable_service_id": str(defn.bookable_service_id) if defn and defn.bookable_service_id else None,
        "parts_search_url": parts_url,
        "last_done_at": row.last_done_at.isoformat() + "Z" if row.last_done_at else None,
        "next_due_at": row.next_due_at.isoformat(),
        "snoozed_until": row.snoozed_until.isoformat() if row.snoozed_until else None,
        "disabled": bool(row.disabled_at),
        "status": _task_status(row, today),
    }


def list_appliance_maintenance(
    db: Session,
    appliance: ClientAppliance,
) -> List[Dict[str, Any]]:
    materialize_missing_tasks(db, appliance, anchor_date=date.today())
    today = date.today()
    rows = _load_task_rows(db, appliance.id)
    rows.sort(key=lambda r: (r.definition.sort_order if r.definition else 0, r.definition.name if r.definition else ""))
    return [serialize_task_row(db, r, appliance, today) for r in rows if r.definition]


def count_due_soon_for_appliance(db: Session, appliance: ClientAppliance) -> int:
    materialize_missing_tasks(db, appliance, anchor_date=date.today())
    today = date.today()
    rows = _load_task_rows(db, appliance.id)
    return sum(1 for r in rows if is_actionable_due(r, today))


def household_due_summary(db: Session, client_id: UUID) -> Dict[str, Any]:
    appliances = (
        db.query(ClientAppliance)
        .filter(
            ClientAppliance.client_id == client_id,
            ClientAppliance.is_active.is_(True),
            ClientAppliance.merged_into_id.is_(None),
        )
        .all()
    )
    total = 0
    items: List[Dict[str, Any]] = []
    today = date.today()
    for appliance in appliances:
        materialize_missing_tasks(db, appliance, anchor_date=date.today())
        for row in _load_task_rows(db, appliance.id):
            if not is_actionable_due(row, today) or not row.definition:
                continue
            total += 1
            items.append(
                {
                    "appliance_id": str(appliance.id),
                    "appliance_label": appliance.nickname or appliance.make or appliance.equipment_subtype,
                    "task_id": str(row.id),
                    "task_name": row.definition.name,
                    "next_due_at": row.next_due_at.isoformat(),
                    "status": _task_status(row, today),
                }
            )
    return {"due_within_days": DUE_SOON_DAYS, "count": total, "items": items}


def _get_task_row(db: Session, appliance_id: UUID, task_row_id: UUID) -> Optional[ClientApplianceMaintenanceTask]:
    return (
        db.query(ClientApplianceMaintenanceTask)
        .options(joinedload(ClientApplianceMaintenanceTask.definition))
        .filter(
            ClientApplianceMaintenanceTask.id == task_row_id,
            ClientApplianceMaintenanceTask.appliance_id == appliance_id,
        )
        .first()
    )


def mark_task_done(
    db: Session,
    appliance: ClientAppliance,
    task_row_id: UUID,
    *,
    done_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    row = _get_task_row(db, appliance.id, task_row_id)
    if not row or not row.definition:
        raise ValueError("Maintenance task not found")
    done = done_at or datetime.utcnow()
    row.last_done_at = done
    row.next_due_at = add_months(done.date(), row.definition.interval_months)
    row.snoozed_until = None
    row.disabled_at = None
    row.updated_at = datetime.utcnow()
    db.flush()
    return serialize_task_row(db, row, appliance)


def snooze_task(db: Session, appliance: ClientAppliance, task_row_id: UUID) -> Dict[str, Any]:
    row = _get_task_row(db, appliance.id, task_row_id)
    if not row:
        raise ValueError("Maintenance task not found")
    row.snoozed_until = add_months(date.today(), SNOOZE_MONTHS)
    row.updated_at = datetime.utcnow()
    db.flush()
    return serialize_task_row(db, row, appliance)


def disable_task(db: Session, appliance: ClientAppliance, task_row_id: UUID) -> Dict[str, Any]:
    row = _get_task_row(db, appliance.id, task_row_id)
    if not row:
        raise ValueError("Maintenance task not found")
    row.disabled_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    db.flush()
    return serialize_task_row(db, row, appliance)


def _active_appliances_query(db: Session):
    return db.query(ClientAppliance).filter(
        ClientAppliance.is_active.is_(True),
        ClientAppliance.merged_into_id.is_(None),
    )


def count_appliances_for_definition(db: Session, defn: MaintenanceTaskDefinition) -> int:
    appliances = _active_appliances_query(db).all()
    return sum(1 for a in appliances if appliance_matches_task_definition(defn, a))


def serialize_definition(defn: MaintenanceTaskDefinition, *, matching_appliance_count: Optional[int] = None) -> Dict[str, Any]:
    payload = {
        "id": str(defn.id),
        "equipment_type": defn.equipment_type,
        "equipment_subtype": defn.equipment_subtype,
        "name": defn.name,
        "interval_months": defn.interval_months,
        "kind": defn.kind,
        "how_to_text": defn.how_to_text,
        "parts_search_term": defn.parts_search_term,
        "bookable_service_id": str(defn.bookable_service_id) if defn.bookable_service_id else None,
        "enabled": defn.enabled,
        "sort_order": defn.sort_order,
    }
    if matching_appliance_count is not None:
        payload["matching_appliance_count"] = matching_appliance_count
    return payload


def list_task_definitions(db: Session) -> List[Dict[str, Any]]:
    rows = (
        db.query(MaintenanceTaskDefinition)
        .order_by(MaintenanceTaskDefinition.sort_order, MaintenanceTaskDefinition.name)
        .all()
    )
    appliances = _active_appliances_query(db).all()
    out: List[Dict[str, Any]] = []
    for row in rows:
        count = sum(1 for a in appliances if appliance_matches_task_definition(row, a))
        out.append(serialize_definition(row, matching_appliance_count=count))
    return out


def materialize_all_appliances(db: Session) -> Dict[str, int]:
    appliances = _active_appliances_query(db).all()
    tasks_created = 0
    for appliance in appliances:
        tasks_created += materialize_missing_tasks(db, appliance, anchor_date=date.today())
    return {"appliances": len(appliances), "tasks_created": tasks_created}


def validate_definition_payload(payload: Dict[str, Any], *, exclude_id: Optional[UUID] = None) -> None:
    kind = payload.get("kind")
    if kind not in ("diy", "service"):
        raise ValueError("kind must be diy or service")
    interval = int(payload.get("interval_months", 0))
    if interval < 1 or interval > 120:
        raise ValueError("interval_months must be between 1 and 120")
    if not (payload.get("name") or "").strip():
        raise ValueError("name is required")
    if not (payload.get("equipment_type") or "").strip():
        raise ValueError("equipment_type is required")


def create_task_definition(db: Session, payload: Dict[str, Any]) -> Dict[str, Any]:
    validate_definition_payload(payload)
    row = MaintenanceTaskDefinition(
        equipment_type=payload["equipment_type"].strip(),
        equipment_subtype=(payload.get("equipment_subtype") or None) and str(payload["equipment_subtype"]).strip() or None,
        name=payload["name"].strip(),
        interval_months=int(payload["interval_months"]),
        kind=payload["kind"],
        how_to_text=payload.get("how_to_text"),
        parts_search_term=(payload.get("parts_search_term") or None) and str(payload["parts_search_term"]).strip() or None,
        bookable_service_id=payload.get("bookable_service_id"),
        enabled=bool(payload.get("enabled", True)),
        sort_order=int(payload.get("sort_order") or 0),
    )
    db.add(row)
    db.flush()
    return serialize_definition(row)


def update_task_definition(db: Session, row_id: UUID, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    row = db.query(MaintenanceTaskDefinition).filter(MaintenanceTaskDefinition.id == row_id).first()
    if not row:
        return None
    merged = {**serialize_definition(row), **payload}
    validate_definition_payload(merged, exclude_id=row_id)
    for key in (
        "equipment_type",
        "equipment_subtype",
        "name",
        "interval_months",
        "kind",
        "how_to_text",
        "parts_search_term",
        "bookable_service_id",
        "enabled",
        "sort_order",
    ):
        if key in payload:
            val = payload[key]
            if key == "equipment_subtype":
                val = (val or None) and str(val).strip() or None
            elif key == "parts_search_term":
                val = (val or None) and str(val).strip() or None
            elif key == "name" or key == "equipment_type":
                val = str(val).strip()
            setattr(row, key, val)
    row.updated_at = datetime.utcnow()
    db.flush()
    return serialize_definition(row)


def delete_task_definition(db: Session, row_id: UUID) -> bool:
    row = db.query(MaintenanceTaskDefinition).filter(MaintenanceTaskDefinition.id == row_id).first()
    if not row:
        return False
    db.delete(row)
    db.flush()
    return True


def reset_definition_defaults(db: Session) -> int:
    db.query(MaintenanceTaskDefinition).delete()
    db.flush()
    for item in DEFAULT_DEFINITION_ROWS:
        create_task_definition(db, item)
    return len(DEFAULT_DEFINITION_ROWS)


def maybe_complete_from_work_order(db: Session, work_order: WorkOrder) -> int:
    from app.services.feature_flags_service import feature_enabled_for_system

    if not feature_enabled_for_system(db, "maintenance_reminders"):
        return 0
    if not work_order.appliance_id:
        return 0
    appliance = (
        db.query(ClientAppliance)
        .filter(ClientAppliance.id == work_order.appliance_id)
        .first()
    )
    if not appliance:
        return 0
    service_ids = {line.service_id for line in (work_order.service_items or []) if line.service_id}
    if not service_ids:
        return 0
    materialize_missing_tasks(db, appliance, anchor_date=date.today())
    completed = 0
    done_at = work_order.actual_end or datetime.utcnow()
    for row in _load_task_rows(db, appliance.id):
        defn = row.definition
        if not defn or defn.kind != "service" or not defn.bookable_service_id:
            continue
        if defn.bookable_service_id not in service_ids:
            continue
        mark_task_done(db, appliance, row.id, done_at=done_at)
        completed += 1
    return completed


def client_email_allowed_this_month(client: Client, now: Optional[datetime] = None) -> bool:
    now = now or datetime.utcnow()
    last = client.last_maintenance_email_at
    if not last:
        return True
    return last.year != now.year or last.month != now.month


def set_maintenance_email_opt_out(db: Session, client_id: UUID, opt_out: bool = True) -> None:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise ValueError("Client not found")
    client.maintenance_emails_opt_out = opt_out
    client.updated_at = datetime.utcnow()
