from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, time
from uuid import UUID

class TimeRange(BaseModel):
    """Schema for a time range (start and end times)"""
    start: str  # Format: "HH:MM"
    end: str    # Format: "HH:MM"
    
    @validator('start', 'end')
    def validate_time_format(cls, v):
        import re
        if not re.match(r'^([01]\d|2[0-3]):([0-5]\d)$', v):
            raise ValueError("Time must be in format HH:MM")
        return v
    
    @validator('end')
    def validate_end_after_start(cls, v, values):
        if 'start' in values:
            start_hour, start_minute = map(int, values['start'].split(':'))
            end_hour, end_minute = map(int, v.split(':'))
            
            if (end_hour < start_hour) or (end_hour == start_hour and end_minute <= start_minute):
                raise ValueError("End time must be after start time")
        return v

class ExceptionDate(BaseModel):
    """Schema for exception dates in availability"""
    date: str  # Format: "YYYY-MM-DD"
    available: bool = False
    working_hours: Optional[TimeRange] = None
    reason: Optional[str] = None

class TechnicianAvailability(BaseModel):
    """Schema for technician availability settings"""
    work_days: List[str]
    work_hours: TimeRange
    exceptions: List[ExceptionDate] = []
    status: Optional[str] = None
    
    @validator('work_days')
    def validate_work_days(cls, v):
        allowed_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in v:
            if day.lower() not in allowed_days:
                raise ValueError(f"Day must be one of {allowed_days}")
        return v
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["active", "inactive", "on_leave"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class AppointmentSlot(BaseModel):
    """Schema for available appointment slots"""
    start_time: str  # ISO format datetime
    end_time: str    # ISO format datetime
    technician_id: str
    technician_name: str

class ScheduleRequest(BaseModel):
    """Schema for scheduling a work order"""
    work_order_id: UUID
    start_time: datetime
    end_time: datetime
    technician_id: Optional[UUID] = None
    notes: Optional[str] = None
    
    @validator('end_time')
    def validate_end_after_start(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError("End time must be after start time")
        return v

class AppointmentResponse(BaseModel):
    """Schema for appointment response"""
    id: str
    work_order_id: str
    order_number: str
    title: str
    start_time: str
    end_time: str
    client_id: Optional[str] = None
    client_name: str
    technician_id: Optional[str] = None
    technician_name: str
    status: str
    location: Optional[str] = None
    notes: Optional[str] = None

class ScheduleResponse(BaseModel):
    """Schema for full schedule response"""
    appointments: List[Dict[str, Any]]
    date_range: Dict[str, str]
    view_type: str
    available_technicians: Optional[List[Dict[str, str]]] = None

class AvailabilityResponse(BaseModel):
    """Schema for technician availability response"""
    technician_id: str
    technician_name: str
    status: str
    availability: Dict[str, Any]
    appointments: List[Dict[str, Any]]
    date_range: Dict[str, str]