"""Work order performance metrics — on-site time vs SKU estimate."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, selectinload

from app.models.work_order import (
    WorkOrderAppointment,
    WorkOrderPerformanceMetric,
)
from app.services import work_order_activity_service as activity

METRIC_ON_SITE = "on_site_duration"


def _estimate_minutes_for_appointment(db: Session, appointment: WorkOrderAppointment) -> Optional[float]:
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


def _percent_of_estimate(actual: float, estimated: Optional[float]) -> Optional[float]:
    if not estimated or estimated <= 0:
        return None
    return round((actual / estimated) * 100.0, 1)


def record_on_site_duration(
    db: Session,
    *,
    appointment: WorkOrderAppointment,
    user_id: uuid.UUID,
    ended_at: Optional[datetime] = None,
) -> Optional[WorkOrderPerformanceMetric]:
    """Persist on-site minutes when an appointment leaves in_progress."""
    ended = ended_at or datetime.utcnow()
    started = appointment.actual_start
    if not started:
        return None

    actual_minutes = round(max((ended - started).total_seconds() / 60.0, 0), 1)
    if actual_minutes <= 0:
        return None

    estimated_minutes = _estimate_minutes_for_appointment(db, appointment)
    pct = _percent_of_estimate(actual_minutes, estimated_minutes)

    existing = (
        db.query(WorkOrderPerformanceMetric)
        .filter(
            WorkOrderPerformanceMetric.appointment_id == appointment.id,
            WorkOrderPerformanceMetric.metric_type == METRIC_ON_SITE,
        )
        .first()
    )
    if existing:
        existing.actual_minutes = actual_minutes
        existing.estimated_minutes = estimated_minutes
        existing.percent_of_estimate = pct
        existing.started_at = started
        existing.ended_at = ended
        metric = existing
    else:
        metric = WorkOrderPerformanceMetric(
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
        db.add(metric)

    est_label = f"{int(estimated_minutes)} min" if estimated_minutes else "no SKU estimate"
    pct_label = f"{pct}% of estimate" if pct is not None else "estimate unavailable"
    activity.log_work_order_activity(
        db,
        work_order_id=appointment.work_order_id,
        user_id=user_id,
        event_type="performance_on_site",
        headline=f"On-site time {int(actual_minutes)} min vs {est_label} ({pct_label})",
        actor_label="Recorded for",
        metadata={
            "appointment_id": str(appointment.id),
            "appointment_type": appointment.appointment_type,
            "actual_minutes": actual_minutes,
            "estimated_minutes": estimated_minutes,
            "percent_of_estimate": pct,
        },
    )
    return metric


def handle_appointment_status_timing(
    db: Session,
    *,
    appointment: WorkOrderAppointment,
    previous_status: str,
    user_id: uuid.UUID,
) -> None:
    """Set actual_start/end and record on-site metric on status transitions."""
    new_status = activity._status_val(appointment.status)
    now = datetime.utcnow()

    if new_status == "in_progress" and previous_status != "in_progress":
        if not appointment.actual_start:
            appointment.actual_start = now
        return

    if previous_status == "in_progress" and new_status != "in_progress":
        if not appointment.actual_end:
            appointment.actual_end = now
        record_on_site_duration(db, appointment=appointment, user_id=user_id, ended_at=appointment.actual_end)


def get_work_order_performance(db: Session, work_order_id: uuid.UUID) -> Dict[str, Any]:
    metrics = (
        db.query(WorkOrderPerformanceMetric)
        .filter(WorkOrderPerformanceMetric.work_order_id == work_order_id)
        .order_by(WorkOrderPerformanceMetric.started_at.asc())
        .all()
    )

    appointments = (
        db.query(WorkOrderAppointment)
        .options(selectinload(WorkOrderAppointment.services))
        .filter(WorkOrderAppointment.work_order_id == work_order_id)
        .order_by(WorkOrderAppointment.scheduled_start.asc())
        .all()
    )

    metric_by_appt = {m.appointment_id: m for m in metrics if m.appointment_id}
    visits: List[Dict[str, Any]] = []
    active_on_site: Optional[Dict[str, Any]] = None

    total_actual = 0.0
    total_estimated = 0.0
    est_count = 0

    for appt in appointments:
        est = _estimate_minutes_for_appointment(db, appt)
        stored = metric_by_appt.get(appt.id)
        status = activity._status_val(appt.status)

        if stored:
            visits.append(
                {
                    "appointment_id": str(appt.id),
                    "appointment_type": appt.appointment_type,
                    "status": status,
                    "actual_minutes": stored.actual_minutes,
                    "estimated_minutes": stored.estimated_minutes,
                    "percent_of_estimate": stored.percent_of_estimate,
                    "started_at": stored.started_at.isoformat() if stored.started_at else None,
                    "ended_at": stored.ended_at.isoformat() if stored.ended_at else None,
                }
            )
            total_actual += stored.actual_minutes
            if stored.estimated_minutes:
                total_estimated += stored.estimated_minutes
                est_count += 1
        elif status == "in_progress" and appt.actual_start:
            elapsed = round(max((datetime.utcnow() - appt.actual_start).total_seconds() / 60.0, 0), 1)
            active_on_site = {
                "appointment_id": str(appt.id),
                "appointment_type": appt.appointment_type,
                "elapsed_minutes": elapsed,
                "estimated_minutes": est,
                "percent_of_estimate": _percent_of_estimate(elapsed, est),
                "started_at": appt.actual_start.isoformat(),
            }

    summary_est = total_estimated if est_count else None
    return {
        "summary": {
            "total_actual_minutes": round(total_actual, 1) if total_actual else 0,
            "total_estimated_minutes": round(summary_est, 1) if summary_est else None,
            "percent_of_estimate": _percent_of_estimate(total_actual, summary_est) if total_actual and summary_est else None,
            "completed_visits": len(visits),
        },
        "visits": visits,
        "active_on_site": active_on_site,
    }
