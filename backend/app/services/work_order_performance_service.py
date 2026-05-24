"""Work order performance metrics — field timing, adherence, and outcome signals."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, selectinload

from app.models.work_order import (
    WorkOrder,
    WorkOrderAppointment,
    WorkOrderPerformanceMetric,
)
from app.services import work_order_activity_service as activity

METRIC_ON_SITE = "on_site_duration"
METRIC_EN_ROUTE = "en_route_duration"
METRIC_SCHEDULE_ADHERENCE = "schedule_adherence"
METRIC_PARTS_HOLD = "parts_hold_duration"
METRIC_TIME_TO_CLOSE = "time_to_close"
METRIC_FIRST_VISIT_COMPLETION = "first_visit_completion"
METRIC_CALLBACK_REDO = "callback_redo"
METRIC_ACCESS_FAILURE = "access_failure"

ON_TIME_GRACE_MINUTES = 15
COMPLETED_APPT_STATUSES = frozenset({"completed", "completed_pending_payment"})
FOLLOW_UP_APPT_TYPES = frozenset({"repair", "follow-up", "follow_up", "recall", "redo", "callback"})
ACCESS_FAILURE_STATUSES = frozenset({"unreachable", "failed"})
WO_COMPLETED_STATUSES = frozenset({"completed", "completed_pending_payment"})


def _estimate_minutes_for_appointment(appointment: WorkOrderAppointment) -> Optional[float]:
    minutes = 0
    has_duration = False
    for service in appointment.services or []:
        if service.duration_minutes:
            minutes += float(service.duration_minutes)
            has_duration = True
    if has_duration:
        return minutes
    if appointment.scheduled_start and appointment.scheduled_end:
        delta = (appointment.scheduled_end - appointment.scheduled_start).total_seconds() / 60.0
        if delta > 0:
            return round(delta, 1)
    return None


def _travel_estimate_minutes(appointment: WorkOrderAppointment) -> Optional[float]:
    raw = appointment.travel_time_before
    if raw is None or raw <= 0:
        return None
    # Field stores minutes from travel calculator; guard if seconds were stored.
    if raw > 180:
        return round(raw / 60.0, 1)
    return float(raw)


def _percent_of_estimate(actual: float, estimated: Optional[float]) -> Optional[float]:
    if not estimated or estimated <= 0:
        return None
    return round((actual / estimated) * 100.0, 1)


def _minutes_between(start: datetime, end: datetime) -> float:
    return round(max((end - start).total_seconds() / 60.0, 0), 1)


def _log_performance_event(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
    event_type: str,
    headline: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    activity.log_work_order_activity(
        db,
        work_order_id=work_order_id,
        user_id=user_id,
        event_type=event_type,
        headline=headline,
        actor_label="Recorded for",
        metadata=metadata or {},
    )


def _upsert_metric(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    metric_type: str,
    actual_minutes: float,
    appointment_id: Optional[uuid.UUID] = None,
    estimated_minutes: Optional[float] = None,
    percent_of_estimate: Optional[float] = None,
    started_at: Optional[datetime] = None,
    ended_at: Optional[datetime] = None,
    event_metadata: Optional[Dict[str, Any]] = None,
) -> WorkOrderPerformanceMetric:
    query = db.query(WorkOrderPerformanceMetric).filter(
        WorkOrderPerformanceMetric.work_order_id == work_order_id,
        WorkOrderPerformanceMetric.metric_type == metric_type,
    )
    if appointment_id:
        query = query.filter(WorkOrderPerformanceMetric.appointment_id == appointment_id)
    else:
        query = query.filter(WorkOrderPerformanceMetric.appointment_id.is_(None))

    existing = query.first()
    if existing:
        existing.actual_minutes = actual_minutes
        existing.estimated_minutes = estimated_minutes
        existing.percent_of_estimate = percent_of_estimate
        existing.started_at = started_at
        existing.ended_at = ended_at
        existing.event_metadata = event_metadata
        return existing

    metric = WorkOrderPerformanceMetric(
        work_order_id=work_order_id,
        appointment_id=appointment_id,
        metric_type=metric_type,
        actual_minutes=actual_minutes,
        estimated_minutes=estimated_minutes,
        percent_of_estimate=percent_of_estimate,
        started_at=started_at,
        ended_at=ended_at,
        event_metadata=event_metadata,
    )
    db.add(metric)
    return metric


def _start_pending_metric(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    metric_type: str,
    started_at: datetime,
    appointment_id: Optional[uuid.UUID] = None,
) -> WorkOrderPerformanceMetric:
    open_query = db.query(WorkOrderPerformanceMetric).filter(
        WorkOrderPerformanceMetric.work_order_id == work_order_id,
        WorkOrderPerformanceMetric.metric_type == metric_type,
        WorkOrderPerformanceMetric.ended_at.is_(None),
    )
    if appointment_id:
        open_query = open_query.filter(WorkOrderPerformanceMetric.appointment_id == appointment_id)
    else:
        open_query = open_query.filter(WorkOrderPerformanceMetric.appointment_id.is_(None))

    existing = open_query.first()
    if existing:
        existing.started_at = started_at
        return existing

    metric = WorkOrderPerformanceMetric(
        work_order_id=work_order_id,
        appointment_id=appointment_id,
        metric_type=metric_type,
        actual_minutes=0,
        started_at=started_at,
    )
    db.add(metric)
    return metric


def _finalize_pending_metric(
    db: Session,
    *,
    work_order_id: uuid.UUID,
    metric_type: str,
    ended_at: datetime,
    appointment_id: Optional[uuid.UUID] = None,
) -> Optional[WorkOrderPerformanceMetric]:
    open_query = db.query(WorkOrderPerformanceMetric).filter(
        WorkOrderPerformanceMetric.work_order_id == work_order_id,
        WorkOrderPerformanceMetric.metric_type == metric_type,
        WorkOrderPerformanceMetric.ended_at.is_(None),
        WorkOrderPerformanceMetric.started_at.isnot(None),
    )
    if appointment_id:
        open_query = open_query.filter(WorkOrderPerformanceMetric.appointment_id == appointment_id)
    else:
        open_query = open_query.filter(WorkOrderPerformanceMetric.appointment_id.is_(None))

    pending = open_query.order_by(WorkOrderPerformanceMetric.started_at.desc()).first()
    if not pending or not pending.started_at:
        return None

    actual = _minutes_between(pending.started_at, ended_at)
    pending.actual_minutes = actual
    pending.ended_at = ended_at
    return pending


def record_on_site_duration(
    db: Session,
    *,
    appointment: WorkOrderAppointment,
    user_id: uuid.UUID,
    ended_at: Optional[datetime] = None,
) -> Optional[WorkOrderPerformanceMetric]:
    ended = ended_at or datetime.utcnow()
    started = appointment.actual_start
    if not started:
        return None

    actual_minutes = _minutes_between(started, ended)
    if actual_minutes <= 0:
        return None

    estimated_minutes = _estimate_minutes_for_appointment(appointment)
    pct = _percent_of_estimate(actual_minutes, estimated_minutes)

    metric = _upsert_metric(
        db,
        work_order_id=appointment.work_order_id,
        appointment_id=appointment.id,
        metric_type=METRIC_ON_SITE,
        actual_minutes=actual_minutes,
        estimated_minutes=estimated_minutes,
        percent_of_estimate=pct,
        started_at=started,
        ended_at=ended,
        event_metadata={
            "appointment_type": appointment.appointment_type,
            "ended_status": activity._status_val(appointment.status),
        },
    )

    est_label = f"{int(estimated_minutes)} min" if estimated_minutes else "no SKU estimate"
    pct_label = f"{pct}% of estimate" if pct is not None else "estimate unavailable"
    _log_performance_event(
        db,
        work_order_id=appointment.work_order_id,
        user_id=user_id,
        event_type="performance_on_site",
        headline=f"On-site time {int(actual_minutes)} min vs {est_label} ({pct_label})",
        metadata={
            "appointment_id": str(appointment.id),
            "appointment_type": appointment.appointment_type,
            "actual_minutes": actual_minutes,
            "estimated_minutes": estimated_minutes,
            "percent_of_estimate": pct,
        },
    )
    return metric


def _record_en_route_duration(
    db: Session,
    *,
    appointment: WorkOrderAppointment,
    user_id: uuid.UUID,
    ended_at: datetime,
) -> Optional[WorkOrderPerformanceMetric]:
    pending = _finalize_pending_metric(
        db,
        work_order_id=appointment.work_order_id,
        metric_type=METRIC_EN_ROUTE,
        ended_at=ended_at,
        appointment_id=appointment.id,
    )
    if not pending:
        return None

    estimated = _travel_estimate_minutes(appointment)
    pct = _percent_of_estimate(pending.actual_minutes, estimated)
    pending.estimated_minutes = estimated
    pending.percent_of_estimate = pct
    pending.event_metadata = {"appointment_type": appointment.appointment_type}

    est_label = f"{int(estimated)} min est travel" if estimated else "no travel estimate"
    _log_performance_event(
        db,
        work_order_id=appointment.work_order_id,
        user_id=user_id,
        event_type="performance_en_route",
        headline=f"En-route time {int(pending.actual_minutes)} min ({est_label})",
        metadata={
            "appointment_id": str(appointment.id),
            "actual_minutes": pending.actual_minutes,
            "estimated_minutes": estimated,
            "percent_of_estimate": pct,
        },
    )
    return pending


def _record_schedule_adherence(
    db: Session,
    *,
    appointment: WorkOrderAppointment,
    user_id: uuid.UUID,
    actual_arrival: datetime,
) -> Optional[WorkOrderPerformanceMetric]:
    if not appointment.scheduled_start:
        return None

    delta = (actual_arrival - appointment.scheduled_start).total_seconds() / 60.0
    on_time = abs(delta) <= ON_TIME_GRACE_MINUTES
    direction = "on_time" if on_time else ("late" if delta > 0 else "early")

    metric = _upsert_metric(
        db,
        work_order_id=appointment.work_order_id,
        appointment_id=appointment.id,
        metric_type=METRIC_SCHEDULE_ADHERENCE,
        actual_minutes=round(abs(delta), 1),
        estimated_minutes=0,
        percent_of_estimate=100.0 if on_time else None,
        started_at=appointment.scheduled_start,
        ended_at=actual_arrival,
        event_metadata={
            "minutes_delta": round(delta, 1),
            "direction": direction,
            "on_time": on_time,
            "grace_minutes": ON_TIME_GRACE_MINUTES,
        },
    )

    if on_time:
        headline = f"Arrived on time for {appointment.appointment_type} visit"
    elif delta > 0:
        headline = f"Arrived {int(abs(delta))} min late for {appointment.appointment_type} visit"
    else:
        headline = f"Arrived {int(abs(delta))} min early for {appointment.appointment_type} visit"

    _log_performance_event(
        db,
        work_order_id=appointment.work_order_id,
        user_id=user_id,
        event_type="performance_schedule_adherence",
        headline=headline,
        metadata={
            "appointment_id": str(appointment.id),
            "minutes_delta": round(delta, 1),
            "on_time": on_time,
            "direction": direction,
        },
    )
    return metric


def _normalize_appt_type(value: Optional[str]) -> str:
    return (value or "").lower().replace("-", "_")


def refresh_work_order_derived_metrics(
    db: Session,
    work_order_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    appointments = (
        db.query(WorkOrderAppointment)
        .filter(WorkOrderAppointment.work_order_id == work_order_id)
        .all()
    )

    non_canceled = [
        a for a in appointments if activity._status_val(a.status) != "canceled"
    ]
    completed = [
        a for a in non_canceled if activity._status_val(a.status) in COMPLETED_APPT_STATUSES
    ]
    follow_up_visits = [
        a for a in non_canceled if _normalize_appt_type(a.appointment_type) in FOLLOW_UP_APPT_TYPES
    ]
    access_failures = [
        a for a in appointments if activity._status_val(a.status) in ACCESS_FAILURE_STATUSES
    ]

    if completed:
        achieved = len(follow_up_visits) == 0
        _upsert_metric(
            db,
            work_order_id=work_order_id,
            metric_type=METRIC_FIRST_VISIT_COMPLETION,
            actual_minutes=1.0 if achieved else 0.0,
            event_metadata={
                "achieved": achieved,
                "completed_visits": len(completed),
                "follow_up_visits": len(follow_up_visits),
            },
        )

    repair_count = len(follow_up_visits)
    if repair_count > 0 or len(completed) > 1:
        _upsert_metric(
            db,
            work_order_id=work_order_id,
            metric_type=METRIC_CALLBACK_REDO,
            actual_minutes=float(max(repair_count, 1 if len(completed) > 1 else 0)),
            event_metadata={
                "follow_up_visits": repair_count,
                "completed_visits": len(completed),
                "is_callback": repair_count > 1 or len(completed) > 1,
            },
        )

    if access_failures:
        _upsert_metric(
            db,
            work_order_id=work_order_id,
            metric_type=METRIC_ACCESS_FAILURE,
            actual_minutes=float(len(access_failures)),
            event_metadata={
                "count": len(access_failures),
                "appointment_ids": [str(a.id) for a in access_failures],
                "statuses": [activity._status_val(a.status) for a in access_failures],
            },
        )


def record_time_to_close(
    db: Session,
    *,
    work_order: WorkOrder,
    user_id: uuid.UUID,
    ended_at: Optional[datetime] = None,
) -> Optional[WorkOrderPerformanceMetric]:
    ended = ended_at or work_order.actual_end or datetime.utcnow()
    if not work_order.created_at:
        return None

    minutes = _minutes_between(work_order.created_at, ended)
    metric = _upsert_metric(
        db,
        work_order_id=work_order.id,
        metric_type=METRIC_TIME_TO_CLOSE,
        actual_minutes=minutes,
        started_at=work_order.created_at,
        ended_at=ended,
        event_metadata={"order_number": work_order.order_number},
    )

    _log_performance_event(
        db,
        work_order_id=work_order.id,
        user_id=user_id,
        event_type="performance_time_to_close",
        headline=f"Work order closed in {int(minutes)} min from creation",
        metadata={"actual_minutes": minutes},
    )
    return metric


def handle_appointment_status_timing(
    db: Session,
    *,
    appointment: WorkOrderAppointment,
    previous_status: str,
    user_id: uuid.UUID,
) -> None:
    new_status = activity._status_val(appointment.status)
    now = datetime.utcnow()

    if new_status == "en_route" and previous_status != "en_route":
        _start_pending_metric(
            db,
            work_order_id=appointment.work_order_id,
            metric_type=METRIC_EN_ROUTE,
            started_at=now,
            appointment_id=appointment.id,
        )

    if new_status == "in_progress" and previous_status != "in_progress":
        if not appointment.actual_start:
            appointment.actual_start = now
        if previous_status == "en_route":
            _record_en_route_duration(db, appointment=appointment, user_id=user_id, ended_at=now)
        _record_schedule_adherence(db, appointment=appointment, user_id=user_id, actual_arrival=appointment.actual_start)

    if previous_status == "in_progress" and new_status != "in_progress":
        if not appointment.actual_end:
            appointment.actual_end = now
        record_on_site_duration(db, appointment=appointment, user_id=user_id, ended_at=appointment.actual_end)

    if new_status in ACCESS_FAILURE_STATUSES or new_status in COMPLETED_APPT_STATUSES:
        refresh_work_order_derived_metrics(db, appointment.work_order_id, user_id)


def handle_work_order_status_timing(
    db: Session,
    *,
    work_order: WorkOrder,
    previous_status: str,
    user_id: uuid.UUID,
) -> None:
    new_status = activity._status_val(work_order.status)
    now = datetime.utcnow()

    if new_status == "waiting_on_parts" and previous_status != "waiting_on_parts":
        _start_pending_metric(
            db,
            work_order_id=work_order.id,
            metric_type=METRIC_PARTS_HOLD,
            started_at=now,
        )

    if previous_status == "waiting_on_parts" and new_status != "waiting_on_parts":
        pending = _finalize_pending_metric(
            db,
            work_order_id=work_order.id,
            metric_type=METRIC_PARTS_HOLD,
            ended_at=now,
        )
        if pending:
            _log_performance_event(
                db,
                work_order_id=work_order.id,
                user_id=user_id,
                event_type="performance_parts_hold",
                headline=f"Parts hold lasted {int(pending.actual_minutes)} min",
                metadata={"actual_minutes": pending.actual_minutes},
            )

    if new_status in WO_COMPLETED_STATUSES and previous_status not in WO_COMPLETED_STATUSES:
        record_time_to_close(db, work_order=work_order, user_id=user_id, ended_at=work_order.actual_end or now)
        refresh_work_order_derived_metrics(db, work_order.id, user_id)


def _metric_row_dict(m: WorkOrderPerformanceMetric) -> Dict[str, Any]:
    return {
        "metric_type": m.metric_type,
        "appointment_id": str(m.appointment_id) if m.appointment_id else None,
        "actual_minutes": m.actual_minutes,
        "estimated_minutes": m.estimated_minutes,
        "percent_of_estimate": m.percent_of_estimate,
        "started_at": m.started_at.isoformat() if m.started_at else None,
        "ended_at": m.ended_at.isoformat() if m.ended_at else None,
        "metadata": m.event_metadata or {},
    }


def _summarize_on_site(metrics: List[WorkOrderPerformanceMetric], appointments: List[WorkOrderAppointment]) -> Dict[str, Any]:
    on_site = [m for m in metrics if m.metric_type == METRIC_ON_SITE]
    metric_by_appt = {m.appointment_id: m for m in on_site if m.appointment_id}
    visits: List[Dict[str, Any]] = []
    active_on_site: Optional[Dict[str, Any]] = None
    total_actual = 0.0
    total_estimated = 0.0
    est_count = 0

    for appt in appointments:
        est = _estimate_minutes_for_appointment(appt)
        stored = metric_by_appt.get(appt.id)
        status = activity._status_val(appt.status)

        if stored:
            visits.append(
                {
                    "appointment_id": str(appt.id),
                    "appointment_type": appt.appointment_type,
                    "status": status,
                    **_metric_row_dict(stored),
                }
            )
            total_actual += stored.actual_minutes
            if stored.estimated_minutes:
                total_estimated += stored.estimated_minutes
                est_count += 1
        elif status == "in_progress" and appt.actual_start:
            elapsed = _minutes_between(appt.actual_start, datetime.utcnow())
            active_on_site = {
                "appointment_id": str(appt.id),
                "appointment_type": appt.appointment_type,
                "elapsed_minutes": elapsed,
                "estimated_minutes": est,
                "percent_of_estimate": _percent_of_estimate(elapsed, est),
                "started_at": appt.actual_start.isoformat(),
            }

    summary_est = total_estimated if est_count else None
    percents = [m.percent_of_estimate for m in on_site if m.percent_of_estimate is not None]
    return {
        "summary": {
            "total_actual_minutes": round(total_actual, 1) if total_actual else 0,
            "total_estimated_minutes": round(summary_est, 1) if summary_est else None,
            "percent_of_estimate": _percent_of_estimate(total_actual, summary_est) if total_actual and summary_est else None,
            "avg_percent_of_estimate": round(sum(percents) / len(percents), 1) if percents else None,
            "completed_visits": len(visits),
        },
        "visits": visits,
        "active_on_site": active_on_site,
    }


def get_work_order_performance(db: Session, work_order_id: uuid.UUID) -> Dict[str, Any]:
    metrics = (
        db.query(WorkOrderPerformanceMetric)
        .filter(WorkOrderPerformanceMetric.work_order_id == work_order_id)
        .order_by(WorkOrderPerformanceMetric.started_at.asc().nullslast())
        .all()
    )

    appointments = (
        db.query(WorkOrderAppointment)
        .options(selectinload(WorkOrderAppointment.services))
        .filter(WorkOrderAppointment.work_order_id == work_order_id)
        .order_by(WorkOrderAppointment.scheduled_start.asc())
        .all()
    )

    on_site = _summarize_on_site(metrics, appointments)

    en_route_rows = [m for m in metrics if m.metric_type == METRIC_EN_ROUTE and m.ended_at]
    en_route_actual = sum(m.actual_minutes for m in en_route_rows)
    en_route_est = sum(m.estimated_minutes for m in en_route_rows if m.estimated_minutes)

    adherence_rows = [m for m in metrics if m.metric_type == METRIC_SCHEDULE_ADHERENCE]
    on_time = sum(1 for m in adherence_rows if (m.event_metadata or {}).get("on_time"))
    late = sum(1 for m in adherence_rows if (m.event_metadata or {}).get("direction") == "late")

    parts_rows = [m for m in metrics if m.metric_type == METRIC_PARTS_HOLD and m.ended_at]
    parts_open = [m for m in metrics if m.metric_type == METRIC_PARTS_HOLD and not m.ended_at]

    time_to_close = next((m for m in metrics if m.metric_type == METRIC_TIME_TO_CLOSE), None)
    first_visit = next((m for m in metrics if m.metric_type == METRIC_FIRST_VISIT_COMPLETION), None)
    callback = next((m for m in metrics if m.metric_type == METRIC_CALLBACK_REDO), None)
    access = next((m for m in metrics if m.metric_type == METRIC_ACCESS_FAILURE), None)

    return {
        "on_site": on_site,
        "en_route": {
            "summary": {
                "total_actual_minutes": round(en_route_actual, 1) if en_route_actual else 0,
                "total_estimated_minutes": round(en_route_est, 1) if en_route_est else None,
                "percent_of_estimate": _percent_of_estimate(en_route_actual, en_route_est) if en_route_actual and en_route_est else None,
            },
            "visits": [_metric_row_dict(m) for m in en_route_rows],
        },
        "schedule_adherence": {
            "summary": {
                "visit_count": len(adherence_rows),
                "on_time_count": on_time,
                "late_count": late,
                "early_count": max(len(adherence_rows) - on_time - late, 0),
            },
            "visits": [_metric_row_dict(m) for m in adherence_rows],
        },
        "parts_hold": {
            "total_minutes": round(sum(m.actual_minutes for m in parts_rows), 1),
            "active": bool(parts_open),
            "periods": [_metric_row_dict(m) for m in parts_rows + parts_open],
        },
        "time_to_close": _metric_row_dict(time_to_close) if time_to_close else None,
        "first_visit_completion": {
            "achieved": bool((first_visit.event_metadata or {}).get("achieved")) if first_visit else None,
            "recorded": first_visit is not None,
            "metadata": first_visit.event_metadata if first_visit else {},
        },
        "callback_redo": {
            "is_callback": bool((callback.event_metadata or {}).get("is_callback")) if callback else False,
            "follow_up_visits": (callback.event_metadata or {}).get("follow_up_visits", 0) if callback else 0,
            "recorded": callback is not None,
        },
        "access_failures": {
            "count": int(access.actual_minutes) if access else 0,
            "recorded": access is not None,
            "metadata": access.event_metadata if access else {},
        },
        # Back-compat for existing panel fields
        "summary": on_site["summary"],
        "visits": on_site["visits"],
        "active_on_site": on_site["active_on_site"],
    }


def _metrics_for_technician(
    db: Session,
    technician_id: uuid.UUID,
    start_date: datetime,
    end_date: datetime,
) -> List[WorkOrderPerformanceMetric]:
    return (
        db.query(WorkOrderPerformanceMetric)
        .outerjoin(
            WorkOrderAppointment,
            WorkOrderPerformanceMetric.appointment_id == WorkOrderAppointment.id,
        )
        .join(WorkOrder, WorkOrderPerformanceMetric.work_order_id == WorkOrder.id)
        .filter(
            or_(
                WorkOrderAppointment.assigned_technician_id == technician_id,
                and_(
                    WorkOrderPerformanceMetric.appointment_id.is_(None),
                    WorkOrder.assigned_technician_id == technician_id,
                ),
            ),
            or_(
                and_(
                    WorkOrderPerformanceMetric.started_at.isnot(None),
                    WorkOrderPerformanceMetric.started_at >= start_date,
                    WorkOrderPerformanceMetric.started_at <= end_date,
                ),
                and_(
                    WorkOrderPerformanceMetric.ended_at.isnot(None),
                    WorkOrderPerformanceMetric.ended_at >= start_date,
                    WorkOrderPerformanceMetric.ended_at <= end_date,
                ),
                and_(
                    WorkOrderPerformanceMetric.created_at >= start_date,
                    WorkOrderPerformanceMetric.created_at <= end_date,
                ),
            ),
        )
        .all()
    )


def get_technician_field_performance(
    db: Session,
    technician_id: uuid.UUID,
    start_date: datetime,
    end_date: datetime,
) -> Dict[str, Any]:
    """Aggregate stored field metrics for a technician over a date range."""
    metrics = _metrics_for_technician(db, technician_id, start_date, end_date)

    on_site = [m for m in metrics if m.metric_type == METRIC_ON_SITE and m.ended_at]
    en_route = [m for m in metrics if m.metric_type == METRIC_EN_ROUTE and m.ended_at]
    adherence = [m for m in metrics if m.metric_type == METRIC_SCHEDULE_ADHERENCE]
    parts = [m for m in metrics if m.metric_type == METRIC_PARTS_HOLD and m.ended_at]
    time_to_close = [m for m in metrics if m.metric_type == METRIC_TIME_TO_CLOSE]
    first_visit = [m for m in metrics if m.metric_type == METRIC_FIRST_VISIT_COMPLETION]
    callback = [m for m in metrics if m.metric_type == METRIC_CALLBACK_REDO]
    access = [m for m in metrics if m.metric_type == METRIC_ACCESS_FAILURE]

    on_site_actual = sum(m.actual_minutes for m in on_site)
    on_site_est = sum(m.estimated_minutes for m in on_site if m.estimated_minutes)
    on_site_pcts = [m.percent_of_estimate for m in on_site if m.percent_of_estimate is not None]

    en_route_actual = sum(m.actual_minutes for m in en_route)
    en_route_est = sum(m.estimated_minutes for m in en_route if m.estimated_minutes)

    on_time = sum(1 for m in adherence if (m.event_metadata or {}).get("on_time"))
    late = sum(1 for m in adherence if (m.event_metadata or {}).get("direction") == "late")
    early = max(len(adherence) - on_time - late, 0)

    first_visit_yes = sum(1 for m in first_visit if (m.event_metadata or {}).get("achieved"))
    callback_count = sum(1 for m in callback if (m.event_metadata or {}).get("is_callback"))
    access_count = int(sum(m.actual_minutes for m in access))

    avg_on_site = round(on_site_actual / len(on_site), 1) if on_site else None
    avg_time_to_close = (
        round(sum(m.actual_minutes for m in time_to_close) / len(time_to_close), 1)
        if time_to_close
        else None
    )

    work_order_ids = {str(m.work_order_id) for m in metrics}

    return {
        "visit_count": len(on_site),
        "work_orders_with_data": len(work_order_ids),
        "on_site": {
            "total_actual_minutes": round(on_site_actual, 1),
            "total_estimated_minutes": round(on_site_est, 1) if on_site_est else None,
            "avg_actual_minutes": avg_on_site,
            "percent_of_estimate": _percent_of_estimate(on_site_actual, on_site_est) if on_site_est else None,
            "avg_percent_of_estimate": round(sum(on_site_pcts) / len(on_site_pcts), 1) if on_site_pcts else None,
        },
        "en_route": {
            "total_actual_minutes": round(en_route_actual, 1),
            "total_estimated_minutes": round(en_route_est, 1) if en_route_est else None,
            "percent_of_estimate": _percent_of_estimate(en_route_actual, en_route_est) if en_route_est else None,
            "visit_count": len(en_route),
        },
        "schedule_adherence": {
            "visit_count": len(adherence),
            "on_time_count": on_time,
            "late_count": late,
            "early_count": early,
            "on_time_rate": round((on_time / len(adherence)) * 100, 1) if adherence else None,
        },
        "parts_hold_minutes": round(sum(m.actual_minutes for m in parts), 1),
        "avg_time_to_close_minutes": avg_time_to_close,
        "first_visit_fix_rate": round((first_visit_yes / len(first_visit)) * 100, 1) if first_visit else None,
        "first_visit_fix_count": first_visit_yes,
        "first_visit_total": len(first_visit),
        "callback_count": callback_count,
        "callback_total": len(callback),
        "access_failure_count": access_count,
    }
