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
from app.services.scheduling_constraints_service import (
    block_db_utc_naive_to_local,
    get_busy_calendar_blocks,
)
from app.utils.travel_calculator import get_formatted_address, get_travel_time_and_distance

logger = logging.getLogger(__name__)

BUFFER_MINUTES = 10
WORK_DAY_END_HOUR = 17
MAX_STOPS = 12


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
        .options(
            joinedload(WorkOrderAppointment.work_order).joinedload(WorkOrder.property_ref),
            joinedload(WorkOrderAppointment.services),
        )
        .where(WorkOrderAppointment.assigned_technician_id == technician_id)
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
                scheduled_start=appt.scheduled_start,
                scheduled_end=appt.scheduled_end,
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
                cursor = block.end + timedelta(minutes=1)
                changed = True
    return cursor


def build_time_chain(
    ordered_stops: List[DayStop],
    shop_address: str,
    schedule_date: date,
    blocks: List[BlockInterval],
    day_start_hour: int = 8,
) -> Tuple[List[dict], List[str]]:
    """Assign new start/end along optimized visit order."""
    warnings: List[str] = []
    if not ordered_stops:
        return [], warnings

    cache: Dict[Tuple[str, str], int] = {}
    cursor = datetime.combine(schedule_date, datetime.min.time()).replace(
        hour=day_start_hour, minute=0, second=0, microsecond=0
    )
    cursor = _advance_past_blocks(cursor, blocks)
    previous_location = shop_address
    results: List[dict] = []

    work_day_end = datetime.combine(schedule_date, datetime.min.time()).replace(
        hour=WORK_DAY_END_HOUR, minute=0, second=0, microsecond=0
    )

    for sequence, stop in enumerate(ordered_stops, start=1):
        travel_min = _travel_minutes(previous_location, stop.address, cache)
        cursor = cursor + timedelta(minutes=travel_min + BUFFER_MINUTES)
        cursor = _advance_past_blocks(cursor, blocks)

        new_start = cursor
        new_end = new_start + timedelta(minutes=stop.duration_minutes)

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

    return results, warnings


def build_route_preview(
    db: Session,
    technician_id: uuid.UUID,
    schedule_date: date,
    day_start_hour: int = 8,
) -> dict:
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
    stop_changes, chain_warnings = build_time_chain(
        ordered, shop, schedule_date, blocks, day_start_hour
    )
    warnings.extend(chain_warnings)

    cache_after: Dict[Tuple[str, str], int] = {}
    ordered_stops = [
        next(s for s in stops if s.appointment_id == row["appointment_id"]) for row in stop_changes
    ]
    travel_after = _total_route_minutes(ordered_stops, shop, cache_after)

    return {
        "technician_id": technician_id,
        "schedule_date": schedule_date,
        "shop_address": shop,
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

        new_start = item["new_start"]
        new_end = item["new_end"]
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
                    exclude_appointment_id=appt.id,
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
