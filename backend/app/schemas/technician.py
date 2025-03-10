from pydantic import BaseModel, validator, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID

class TechnicianBase(BaseModel):
    """Base schema for Technician data"""
    employee_id: Optional[str] = None
    skills: Optional[List[str]] = None
    certifications: Optional[Dict[str, Any]] = None
    hourly_rate: Optional[float] = None
    availability: Optional[Dict[str, Any]] = None
    max_daily_jobs: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = "active"
    service_radius: Optional[float] = None
    location: Optional[Dict[str, Any]] = None

class TechnicianCreate(TechnicianBase):
    """Schema for creating a new technician"""
    user_id: Optional[UUID] = None
    user_email: Optional[str] = None
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "on_leave"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('hourly_rate')
    def validate_hourly_rate(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Hourly rate must be greater than zero")
        return v
    
    @validator('max_daily_jobs')
    def validate_max_daily_jobs(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Max daily jobs must be greater than zero")
        return v
    
    @validator('service_radius')
    def validate_service_radius(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Service radius must be greater than zero")
        return v
    
    @validator('user_id', 'user_email')
    def validate_user_info(cls, v, values):
        # Either user_id or (user_email + names) must be provided
        if not values.get('user_id') and not values.get('user_email'):
            raise ValueError("Either user_id or user_email must be provided")
        return v

class TechnicianUpdate(BaseModel):
    """Schema for updating a technician"""
    employee_id: Optional[str] = None
    skills: Optional[List[str]] = None
    certifications: Optional[Dict[str, Any]] = None
    hourly_rate: Optional[float] = None
    availability: Optional[Dict[str, Any]] = None
    max_daily_jobs: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    service_radius: Optional[float] = None
    location: Optional[Dict[str, Any]] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["active", "inactive", "on_leave"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v
    
    @validator('hourly_rate')
    def validate_hourly_rate(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Hourly rate must be greater than zero")
        return v
    
    @validator('max_daily_jobs')
    def validate_max_daily_jobs(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Max daily jobs must be greater than zero")
        return v
    
    @validator('service_radius')
    def validate_service_radius(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Service radius must be greater than zero")
        return v

class TechnicianResponse(TechnicianBase):
    """Schema for technician response"""
    id: UUID
    user_id: UUID
    user: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class TechnicianListResponse(BaseModel):
    """Schema for paginated list of technicians"""
    total: int
    items: List[TechnicianResponse]
    page: int
    pages: int
    
    class Config:
        orm_mode = True

class TechnicianPerformanceMetric(BaseModel):
    """Schema for technician performance metric"""
    name: str
    value: Any
    comparison: Optional[float] = None  # Percentage change from previous period
    target: Optional[float] = None

class TechnicianPerformance(BaseModel):
    """Schema for technician performance"""
    technician_id: UUID
    technician_name: str
    period: str
    date_range: Dict[str, str]
    metrics: List[TechnicianPerformanceMetric]

class TechnicianWorkload(BaseModel):
    """Schema for technician workload"""
    technician_id: UUID
    technician_name: str
    date_range: Dict[str, str]
    total_jobs: int
    completed_jobs: int
    in_progress_jobs: int
    total_hours: float
    jobs_by_day: Dict[str, int]
    utilization_rate: float  # Percentage of available hours used
    jobs: List[Dict[str, Any]]  # Simplified list of jobs