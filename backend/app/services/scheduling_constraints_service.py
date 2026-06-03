"""
Central scheduling occupancy rules.

Busy:
  - WorkOrderAppointment rows whose status is NOT canceled
  - TechnicianCalendarBlock rows with status active

Free:
  - Canceled appointments
  - Canceled calendar blocks
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence
from zoneinfo import ZoneInfo
import uuid

from sqlalchemy.orm import Session

from app.models.technician_calendar_block import TechnicianCalendarBlock
from app.models.work_order import WorkOrderAppointment
from app.services import calendar_block_service as block_svc

APPOINTMENT_STATUS_CANCELED = "canceled"
BLOCK_STATUS_ACTIVE = "active"

# Appointments use naive local wall-clock; blocks are saved from browser ISO (UTC) as naive UTC.
SHOP_TIMEZONE = ZoneInfo(os.getenv("SHOP_TIMEZONE", "America/Detroit"))


def _status_str(value) -> str:
    if value is None:
        return ""
    return (value.value if hasattr(value, "value") else str(value)).lower()


def appointment_status_occupies_schedule(status) -> bool:
    """All appointment statuses occupy the calendar except canceled."""
    return _status_str(status) != APPOINTMENT_STATUS_CANCELED


def block_status_occupies_schedule(status) -> bool:
    return _status_str(status) == BLOCK_STATUS_ACTIVE


def appointment_local_naive(dt: datetime) -> datetime:
    """Work-order appointment times: naive = shop wall clock."""
    if dt.tzinfo is not None:
        return dt.astimezone(SHOP_TIMEZONE).replace(tzinfo=None)
    return dt


def block_db_utc_naive_to_local(dt: datetime) -> datetime:
    """Calendar block columns: naive values are UTC instants from frontend ISO."""
    if dt.tzinfo is not None:
        return dt.astimezone(SHOP_TIMEZONE).replace(tzinfo=None)
    return dt.replace(tzinfo=timezone.utc).astimezone(SHOP_TIMEZONE).replace(tzinfo=None)


def local_naive_to_block_db_utc(dt: datetime) -> datetime:
    """Convert shop-local naive bounds to naive UTC for block SQL filters."""
    local = appointment_local_naive(dt)
    return local.replace(tzinfo=SHOP_TIMEZONE).astimezone(timezone.utc).replace(tzinfo=None)


def intervals_overlap(
    start_a: datetime,
    end_a: datetime,
    start_b: datetime,
    end_b: datetime,
) -> bool:
    return start_a < end_b and end_a > start_b


@dataclass
class OccupancyConflict:
    kind: str  # "appointment" | "calendar_block"
    id: str
    start: datetime
    end: datetime
    label: str


def _normalize_exclude_appointment_ids(
    exclude_appointment_id: Optional[uuid.UUID] = None,
    exclude_appointment_ids: Optional[Sequence[uuid.UUID]] = None,
) -> List[uuid.UUID]:
    ids: List[uuid.UUID] = []
    if exclude_appointment_id:
        ids.append(exclude_appointment_id)
    if exclude_appointment_ids:
        for value in exclude_appointment_ids:
            if value and value not in ids:
                ids.append(value)
    return ids


def _busy_appointments_query(
    db: Session,
    technician_id: uuid.UUID,
    range_start: datetime,
    range_end: datetime,
    *,
    exclude_appointment_id: Optional[uuid.UUID] = None,
    exclude_appointment_ids: Optional[Sequence[uuid.UUID]] = None,
):
    q = db.query(WorkOrderAppointment).filter(
        WorkOrderAppointment.assigned_technician_id == technician_id,
        WorkOrderAppointment.scheduled_start.isnot(None),
        WorkOrderAppointment.scheduled_end.isnot(None),
        WorkOrderAppointment.scheduled_start < range_end,
        WorkOrderAppointment.scheduled_end > range_start,
        WorkOrderAppointment.status != APPOINTMENT_STATUS_CANCELED,
    )
    excluded = _normalize_exclude_appointment_ids(
        exclude_appointment_id, exclude_appointment_ids
    )
    if excluded:
        q = q.filter(WorkOrderAppointment.id.notin_(excluded))
    return q.order_by(WorkOrderAppointment.scheduled_start.asc())


def get_busy_appointments(
    db: Session,
    technician_id: uuid.UUID,
    range_start: datetime,
    range_end: datetime,
    *,
    exclude_appointment_id: Optional[uuid.UUID] = None,
    exclude_appointment_ids: Optional[Sequence[uuid.UUID]] = None,
) -> List[WorkOrderAppointment]:
    return _busy_appointments_query(
        db,
        technician_id,
        range_start,
        range_end,
        exclude_appointment_id=exclude_appointment_id,
        exclude_appointment_ids=exclude_appointment_ids,
    ).all()


def get_busy_calendar_blocks(
    db: Session,
    technician_id: uuid.UUID,
    range_start: datetime,
    range_end: datetime,
) -> List[TechnicianCalendarBlock]:
    block_range_start = local_naive_to_block_db_utc(range_start)
    block_range_end = local_naive_to_block_db_utc(range_end)
    return (
        db.query(TechnicianCalendarBlock)
        .filter(
            TechnicianCalendarBlock.technician_id == technician_id,
            TechnicianCalendarBlock.status == BLOCK_STATUS_ACTIVE,
            TechnicianCalendarBlock.start_at < block_range_end,
            TechnicianCalendarBlock.end_at > block_range_start,
        )
        .order_by(TechnicianCalendarBlock.start_at.asc())
        .all()
    )


def find_occupancy_conflicts(
    db: Session,
    technician_id: uuid.UUID,
    start: datetime,
    end: datetime,
    *,
    exclude_appointment_id: Optional[uuid.UUID] = None,
    exclude_appointment_ids: Optional[Sequence[uuid.UUID]] = None,
) -> List[OccupancyConflict]:
    conflicts: List[OccupancyConflict] = []
    slot_start = appointment_local_naive(start)
    slot_end = appointment_local_naive(end)
    for appt in get_busy_appointments(
        db,
        technician_id,
        start,
        end,
        exclude_appointment_id=exclude_appointment_id,
        exclude_appointment_ids=exclude_appointment_ids,
    ):
        if appt.scheduled_start and appt.scheduled_end and intervals_overlap(
            slot_start,
            slot_end,
            appointment_local_naive(appt.scheduled_start),
            appointment_local_naive(appt.scheduled_end),
        ):
            conflicts.append(
                OccupancyConflict(
                    kind="appointment",
                    id=str(appt.id),
                    start=appt.scheduled_start,
                    end=appt.scheduled_end,
                    label=f"Appointment ({_status_str(appt.status)})",
                )
            )
    for block in get_busy_calendar_blocks(db, technician_id, start, end):
        if intervals_overlap(
            slot_start,
            slot_end,
            block_db_utc_naive_to_local(block.start_at),
            block_db_utc_naive_to_local(block.end_at),
        ):
            block_type = _status_str(block.block_type)
            label = (block.title or "").strip() or block_svc.BLOCK_TYPE_LABELS.get(block_type, "Block")
            conflicts.append(
                OccupancyConflict(
                    kind="calendar_block",
                    id=str(block.id),
                    start=block.start_at,
                    end=block.end_at,
                    label=f"Time block ({label})",
                )
            )
    return conflicts


def slot_is_available(
    db: Session,
    technician_id: uuid.UUID,
    slot_start: datetime,
    slot_end: datetime,
    *,
    exclude_appointment_id: Optional[uuid.UUID] = None,
    exclude_appointment_ids: Optional[Sequence[uuid.UUID]] = None,
) -> bool:
    return len(
        find_occupancy_conflicts(
            db,
            technician_id,
            slot_start,
            slot_end,
            exclude_appointment_id=exclude_appointment_id,
            exclude_appointment_ids=exclude_appointment_ids,
        )
    ) == 0


def assert_technician_available(
    db: Session,
    technician_id: uuid.UUID,
    start: datetime,
    end: datetime,
    *,
    exclude_appointment_id: Optional[uuid.UUID] = None,
    exclude_appointment_ids: Optional[Sequence[uuid.UUID]] = None,
) -> None:
    """Raise ConflictException when the interval overlaps busy time."""
    from app.core.exceptions import ConflictException

    conflicts = find_occupancy_conflicts(
        db,
        technician_id,
        start,
        end,
        exclude_appointment_id=exclude_appointment_id,
        exclude_appointment_ids=exclude_appointment_ids,
    )
    if not conflicts:
        return
    first = conflicts[0]
    raise ConflictException(
        f"Scheduling conflicts with {first.label} "
        f"({first.start.isoformat()} – {first.end.isoformat()})"
    )


def schedule_item_sort_key(item: Dict[str, Any]) -> str:
    """Normalize scheduled_start for sorting appointment + block rows together."""
    raw = item.get("scheduled_start")
    if raw is None:
        return ""
    if isinstance(raw, datetime):
        return raw.isoformat()
    return str(raw)


def calendar_block_to_schedule_item(block: TechnicianCalendarBlock) -> Dict[str, Any]:
    """Shape calendar blocks like appointments for technician day schedule APIs."""
    block_type = _status_str(block.block_type)
    title = (block.title or "").strip() or block_svc.BLOCK_TYPE_LABELS.get(block_type, "Block")
    return {
        "id": str(block.id),
        "work_order_id": None,
        "appointment_type": "calendar_block",
        "status": BLOCK_STATUS_ACTIVE,
        "scheduled_start": (
            block_db_utc_naive_to_local(block.start_at).isoformat() if block.start_at else None
        ),
        "scheduled_end": (
            block_db_utc_naive_to_local(block.end_at).isoformat() if block.end_at else None
        ),
        "assigned_technician_id": str(block.technician_id),
        "source": "calendar_block",
        "block_type": block_type,
        "title": title,
        "notes": block.notes,
        "is_forced_schedule": False,
        "time_window": None,
        "location": None,
    }


def generate_available_slots(
    db: Session,
    on_date: date,
    technicians: Sequence,
    duration_minutes: int,
    *,
    business_start_hour: int = 8,
    business_end_hour: int = 17,
    slot_interval_minutes: int = 30,
    exclude_appointment_id: Optional[uuid.UUID] = None,
) -> List[Dict[str, str]]:
    """Return open slots for each technician on a calendar day."""
    range_start = datetime.combine(on_date, datetime.min.time())
    range_end = datetime.combine(on_date, datetime.max.time())
    slots: List[Dict[str, str]] = []

    for tech in technicians:
        if not tech:
            continue
        tech_id = tech.id
        day_start = datetime.combine(on_date, datetime.min.time().replace(hour=business_start_hour))
        day_end = datetime.combine(on_date, datetime.min.time().replace(hour=business_end_hour))
        current = day_start

        while current + timedelta(minutes=duration_minutes) <= day_end:
            slot_end = current + timedelta(minutes=duration_minutes)
            if slot_is_available(
                db,
                tech_id,
                current,
                slot_end,
                exclude_appointment_id=exclude_appointment_id,
            ):
                slots.append(
                    {
                        "start_time": current.isoformat(),
                        "end_time": slot_end.isoformat(),
                        "technician_id": str(tech_id),
                        "technician_name": tech.name,
                    }
                )
            current += timedelta(minutes=slot_interval_minutes)

    return slots
