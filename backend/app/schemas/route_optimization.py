"""Schemas for technician day route optimization (preview + apply)."""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RouteOptimizePreviewRequest(BaseModel):
    technician_id: UUID
    schedule_date: date
    day_start_hour: int = Field(8, ge=5, le=12, description="Local hour to start route from shop")


class RouteStopChange(BaseModel):
    appointment_id: UUID
    route_sequence: int
    label: str
    address: Optional[str] = None
    work_order_id: Optional[UUID] = None
    old_start: datetime
    old_end: datetime
    new_start: datetime
    new_end: datetime
    start_delta_minutes: int
    end_delta_minutes: int
    duration_minutes: int
    travel_from_previous_minutes: Optional[int] = None


class RouteOptimizePreviewResponse(BaseModel):
    technician_id: UUID
    schedule_date: date
    shop_address: str
    optimization_method: str
    stop_count: int
    warnings: List[str] = []
    total_travel_minutes_before: Optional[int] = None
    total_travel_minutes_after: Optional[int] = None
    stops: List[RouteStopChange] = []


class RouteOptimizeApplyItem(BaseModel):
    appointment_id: UUID
    new_start: datetime
    new_end: datetime
    route_sequence: int


class RouteOptimizeApplyRequest(BaseModel):
    technician_id: UUID
    schedule_date: date
    changes: List[RouteOptimizeApplyItem]


class RouteOptimizeApplyResponse(BaseModel):
    applied_count: int
    skipped: List[str] = []
