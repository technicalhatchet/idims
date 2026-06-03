"""
Technician day route optimization: reorder stops and propose new times.

Uses nearest-neighbor ordering with Google Routes (traffic-unaware) leg times,
then rechains scheduled_start/end from shop with calendar-block avoidance.
"""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.utils.technician_assignment import appointment_matches_technician_filter
from app.services.scheduling_constraints_service import (
    appointment_local_naive,
    block_db_utc_naive_to_local,
    get_busy_calendar_blocks,
)
from app.utils.travel_calculator import get_formatted_address, get_travel_time_and_distance

logger = logging.getLogger(__name__)

BUFFER_MINUTES = 10
BLOCK_GAP_MINUTES = 5
WORK_DAY_END_HOUR = 17
MAX_STOPS = 12
DEFAULT_DAY_START_HOUR = int(os.getenv("ROUTE_DAY_START_HOUR", "9"))


def _default_day_start_hour() -> int:
    hour = DEFAULT_DAY_START_HOUR
    if hour < 5 or hour > 12:
        return 9
    return hour


def shop_local_day_datetime(schedule_date: date, hour: int, minute: int = 0) -> datetime:
    """Shop wall-clock naive datetime (aligned with appointment storage)."""
    return datetime(schedule_date.year, schedule_date.month, schedule_date.day, hour, minute, 0)


@dataclass
class DayStop:
    appointment_id: uuid.UUID
    work_order_id: uuid.UUID
    label: str
    address: str
    scheduled_start: datetime
    scheduled_end: datetime
    duration_minutes: int


@dataclass
class BlockInterval:
    start: datetime
    end: datetime
    label: str


def get_default_shop_address() -> str:
    return (
        os.getenv("DEFAULT_SHOP_ADDRESS")
        or os.getenv("NEXT_PUBLIC_DEFAULT_SHOP_ADDRESS")
        or "641 Barclay Drive, Toledo, OH 43609, USA"
    ).strip()


def _day_bounds(schedule_date: date) -> Tuple[datetime, datetime]:
    start = datetime.combine(schedule_date, datetime.min.time())
    end = datetime.combine(schedule_date, datetime.max.time())
    return start, end


def _appointment_duration_minutes(appt: WorkOrderAppointment) -> int:
    total = 0
    for service in appt.services or []:
        if service.duration_minutes:
            total += int(service.duration_minutes)
    if total > 0:
        return total
    if appt.scheduled_start and appt.scheduled_end:
        delta = appt.scheduled_end - appt.scheduled_start
        minutes = int(delta.total_seconds() / 60)
        if minutes > 0:
            return minutes
    return 60


def _appointment_label(appt: WorkOrderAppointment) -> str:
    wo = appt.work_order
    if wo and wo.order_number:
        return f"WO {wo.order_number}"
    return appt.appointment_type or "Appointment"


def _resolve_address(appt: WorkOrderAppointment) -> Optional[str]:
    wo = appt.work_order
    if not wo:
        return None
    return get_formatted_address(wo.service_location) or (
        f"{wo.property_ref.address}, {wo.property_ref.city or ''}".strip(", ")
        if wo.property_ref and wo.property_ref.address
        else None
    )


def load_day_stops(
    db: Session,
    technician_id: uuid.UUID,
    schedule_date: date,
) -> Tuple[List[DayStop], List[BlockInterval], List[str]]:
    """Load optimizable appointments (scheduled/reschedule) and active blocks."""
    warnings: List[str] = []
    day_start, day_end = _day_bounds(schedule_date)

    stmt = (
        select(WorkOrderAppointment)
        .join(WorkOrder, WorkOrderAppointment.work_order_id == WorkOrder.id)
        .options(
            joinedload(WorkOrderAppointment.work_order).joinedload(WorkOrder.property_ref),
            joinedload(WorkOrderAppointment.services),
        )
        .where(appointment_matches_technician_filter(technician_id))
        .where(WorkOrderAppointment.scheduled_start < day_end)
        .where(WorkOrderAppointment.scheduled_end > day_start)
        .where(WorkOrderAppointment.status.in_(["scheduled", "reschedule"]))
    )
    appointments = list(db.execute(stmt).scalars().unique().all())

    stops: List[DayStop] = []
    for appt in appointments:
        address = _resolve_address(appt)
        if not address:
            warnings.append(
                f"Skipped {_appointment_label(appt)} — no service address on work order."
            )
            continue
        stops.append(
            DayStop(
                appointment_id=appt.id,
                work_order_id=appt.work_order_id,
                label=_appointment_label(appt),
                address=address,
                scheduled_start=appointment_local_naive(appt.scheduled_start),
                scheduled_end=appointment_local_naive(appt.scheduled_end),
                duration_minutes=_appointment_duration_minutes(appt),
            )
        )

    blocks_raw = get_busy_calendar_blocks(db, technician_id, day_start, day_end)
    blocks: List[BlockInterval] = []
    for block in blocks_raw:
        blocks.append(
            BlockInterval(
                start=block_db_utc_naive_to_local(block.start_at),
                end=block_db_utc_naive_to_local(block.end_at),
                label=(block.title or str(block.block_type or "Block")),
            )
        )

    return stops, blocks, warnings


def _travel_minutes(origin: str, destination: str, cache: Dict[Tuple[str, str], int]) -> int:
    key = (origin, destination)
    if key in cache:
        return cache[key]
    minutes, _distance = get_travel_time_and_distance(origin, destination)
    value = int(minutes) if minutes is not None else 30
    cache[key] = value
    return value


def _total_route_minutes(order: List[DayStop], shop: str, cache: Dict[Tuple[str, str], int]) -> int:
    if not order:
        return 0
    total = _travel_minutes(shop, order[0].address, cache)
    for i in range(len(order) - 1):
        total += _travel_minutes(order[i].address, order[i + 1].address, cache)
    total += _travel_minutes(order[-1].address, shop, cache)
    return total


def optimize_stop_order(stops: List[DayStop], shop_address: str) -> Tuple[List[DayStop], str]:
    """Nearest-neighbor using drive-time legs from Routes API."""
    if len(stops) <= 1:
        return stops, "unchanged"

    cache: Dict[Tuple[str, str], int] = {}
    remaining = stops.copy()
    ordered: List[DayStop] = []
    current_location = shop_address

    while remaining:
        best_idx = 0
        best_cost = None
        for idx, stop in enumerate(remaining):
            cost = _travel_minutes(current_location, stop.address, cache)
            if best_cost is None or cost < best_cost:
                best_cost = cost
                best_idx = idx
        chosen = remaining.pop(best_idx)
        ordered.append(chosen)
        current_location = chosen.address

    return ordered, "nearest_neighbor_routes_api"


def _advance_past_blocks(cursor: datetime, blocks: List[BlockInterval]) -> datetime:
    if not blocks:
        return cursor
    changed = True
    while changed:
        changed = False
        for block in blocks:
            if block.start <= cursor < block.end:
                cursor = block.end + timedelta(minutes=BLOCK_GAP_MINUTES)
                changed = True
    return cursor


def _interval_hits_blocked_time(
    start: datetime,
    end: datetime,
    blocks: List[BlockInterval],
) -> Optional[BlockInterval]:
    """True when [start, end] touches a block or its pre/post gap."""
    for block in blocks:
        gap_start = block.start - timedelta(minutes=BLOCK_GAP_MINUTES)
        gap_end = block.end + timedelta(minutes=BLOCK_GAP_MINUTES)
        if start < gap_end and end > gap_start:
            return block
    return None


def _fit_appointment_around_blocks(
    proposed_start: datetime,
    duration_minutes: int,
    blocks: List[BlockInterval],
) -> Tuple[datetime, datetime, Optional[str]]:
    """
    Keep full job duration; shift after blocks (with gap) when the interval would
    overlap lunch/breaks. Prevents proposals that end the minute a block starts.
    """
    start = appointment_local_naive(proposed_start)
    duration = timedelta(minutes=duration_minutes)
    end = start + duration
    warning: Optional[str] = None

    for _ in range(len(blocks) + 2):
        hit = _interval_hits_blocked_time(start, end, blocks)
        if not hit:
            return start, end, warning
        start = hit.end + timedelta(minutes=BLOCK_GAP_MINUTES)
        end = start + duration
        warning = f"{hit.label}: moved after calendar block"

    return start, end, warning


def build_time_chain(
    ordered_stops: List[DayStop],
    shop_address: str,
    schedule_date: date,
    blocks: List[BlockInterval],
    day_start_hour: int = 9,
) -> Tuple[List[dict], List[str], datetime]:
    """
    Assign new start/end along optimized visit order.

    ``cursor`` is departure time from the previous location (shop at day start).
    First appointment starts after drive time from shop, not at shop-departure time.
    Buffer minutes apply between stops only, not before leaving the shop.
    """
    warnings: List[str] = []
    if not ordered_stops:
        return [], warnings, shop_local_day_datetime(schedule_date, day_start_hour)

    cache: Dict[Tuple[str, str], int] = {}
    shop_departure = shop_local_day_datetime(schedule_date, day_start_hour)
    shop_departure = _advance_past_blocks(shop_departure, blocks)
    cursor = shop_departure
    previous_location = shop_address
    results: List[dict] = []

    work_day_end = shop_local_day_datetime(schedule_date, WORK_DAY_END_HOUR)

    for sequence, stop in enumerate(ordered_stops, start=1):
        travel_min = _travel_minutes(previous_location, stop.address, cache)
        cursor = cursor + timedelta(minutes=travel_min)
        if sequence > 1:
            cursor = cursor + timedelta(minutes=BUFFER_MINUTES)
        cursor = _advance_past_blocks(cursor, blocks)

        new_start = appointment_local_naive(cursor)
        new_end = appointment_local_naive(
            new_start + timedelta(minutes=stop.duration_minutes)
        )
        new_start, new_end, block_warning = _fit_appointment_around_blocks(
            new_start, stop.duration_minutes, blocks
        )
        if block_warning:
            warnings.append(f"{stop.label}: {block_warning}")

        if new_end > work_day_end:
            warnings.append(
                f"{stop.label} would end after {WORK_DAY_END_HOUR}:00 — consider fewer stops or an earlier start."
            )

        old_start_delta = int((new_start - stop.scheduled_start).total_seconds() / 60)
        old_end_delta = int((new_end - stop.scheduled_end).total_seconds() / 60)

        results.append(
            {
                "appointment_id": stop.appointment_id,
                "work_order_id": stop.work_order_id,
                "route_sequence": sequence,
                "label": stop.label,
                "address": stop.address,
                "old_start": stop.scheduled_start,
                "old_end": stop.scheduled_end,
                "new_start": new_start,
                "new_end": new_end,
                "start_delta_minutes": old_start_delta,
                "end_delta_minutes": old_end_delta,
                "duration_minutes": stop.duration_minutes,
                "travel_from_previous_minutes": travel_min,
            }
        )

        cursor = new_end
        previous_location = stop.address

    return results, warnings, shop_departure


def build_route_preview(
    db: Session,
    technician_id: uuid.UUID,
    schedule_date: date,
    day_start_hour: Optional[int] = None,
) -> dict:
    if day_start_hour is None:
        day_start_hour = _default_day_start_hour()
    shop = get_default_shop_address()
    stops, blocks, warnings = load_day_stops(db, technician_id, schedule_date)

    if not stops:
        return {
            "technician_id": technician_id,
            "schedule_date": schedule_date,
            "shop_address": shop,
            "optimization_method": "none",
            "stop_count": 0,
            "warnings": warnings + ["No schedulable appointments with addresses for this day."],
            "total_travel_minutes_before": None,
            "total_travel_minutes_after": None,
            "stops": [],
        }

    if len(stops) > MAX_STOPS:
        warnings.append(
            f"Only the first {MAX_STOPS} stops can be optimized at once; split the day or optimize manually."
        )
        stops = stops[:MAX_STOPS]

    original_order = sorted(stops, key=lambda s: s.scheduled_start)
    cache: Dict[Tuple[str, str], int] = {}
    travel_before = _total_route_minutes(original_order, shop, cache)

    ordered, method = optimize_stop_order(stops, shop)
    stop_changes, chain_warnings, shop_departure = build_time_chain(
        ordered, shop, schedule_date, blocks, day_start_hour
    )
    warnings.extend(chain_warnings)
    if stop_changes:
        first = stop_changes[0]
        warnings.insert(
            0,
            (
                f"Leave shop at {shop_departure.strftime('%I:%M %p').lstrip('0')} "
                f"(~{first['travel_from_previous_minutes']} min drive to first stop at "
                f"{first['new_start'].strftime('%I:%M %p').lstrip('0')})."
            ),
        )

    cache_after: Dict[Tuple[str, str], int] = {}
    ordered_stops = [
        next(s for s in stops if s.appointment_id == row["appointment_id"]) for row in stop_changes
    ]
    travel_after = _total_route_minutes(ordered_stops, shop, cache_after)

    batch_ids = [row["appointment_id"] for row in stop_changes]
    from app.services.scheduling_constraints_service import find_occupancy_conflicts

    for row in stop_changes:
        conflicts = find_occupancy_conflicts(
            db,
            technician_id,
            row["new_start"],
            row["new_end"],
            exclude_appointment_ids=batch_ids,
        )
        if conflicts:
            first = conflicts[0]
            warnings.append(
                f"{row['label']}: still conflicts with {first.label} after routing — "
                "refresh preview or adjust blocks before applying."
            )

    return {
        "technician_id": technician_id,
        "schedule_date": schedule_date,
        "shop_address": shop,
        "shop_departure_at": shop_departure if stop_changes else None,
        "day_start_hour": day_start_hour,
        "optimization_method": method,
        "stop_count": len(stop_changes),
        "warnings": warnings,
        "total_travel_minutes_before": travel_before,
        "total_travel_minutes_after": travel_after,
        "stops": stop_changes,
    }


def apply_route_preview(
    db: Session,
    technician_id: uuid.UUID,
    schedule_date: date,
    changes: List[dict],
    user_id: uuid.UUID,
) -> Tuple[int, List[str]]:
    """Persist proposed times; refresh travel legs for the day."""
    from app.services.scheduling_constraints_service import assert_technician_available
    from app.utils import travel_calculator

    skipped: List[str] = []
    applied = 0

    sorted_changes = sorted(changes, key=lambda c: c["route_sequence"])
    batch_exclude_ids = [item["appointment_id"] for item in sorted_changes]

    for item in sorted_changes:
        appt_id = item["appointment_id"]
        appt = db.query(WorkOrderAppointment).filter(WorkOrderAppointment.id == appt_id).first()
        if not appt:
            skipped.append(f"Appointment {appt_id} not found")
            continue
        if appt.assigned_technician_id != technician_id:
            skipped.append(f"{appt_id} is not assigned to this technician")
            continue
        if appt.is_forced_schedule:
            skipped.append(
                f"{_appointment_label(appt)} is force-scheduled — clear force or reschedule manually."
            )
            continue

        new_start = appointment_local_naive(item["new_start"])
        new_end = appointment_local_naive(item["new_end"])
        if new_end <= new_start:
            skipped.append(f"Invalid times for {appt_id}")
            continue

        from app.core.exceptions import ConflictException

        if not appt.is_forced_schedule:
            try:
                assert_technician_available(
                    db,
                    technician_id,
                    new_start,
                    new_end,
                    exclude_appointment_ids=batch_exclude_ids,
                )
            except ConflictException as exc:
                skipped.append(f"{_appointment_label(appt)}: {exc}")
                continue

        appt.scheduled_start = new_start
        appt.scheduled_end = new_end
        appt.updated_by = user_id
        appt.updated_at = datetime.utcnow()
        db.add(appt)
        applied += 1

    if applied:
        db.flush()
        travel_calculator.update_technician_day_travel_info(db, str(technician_id), schedule_date)
        db.commit()

    return applied, skipped
