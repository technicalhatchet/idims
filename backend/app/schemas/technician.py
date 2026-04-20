from pydantic import BaseModel, validator, Field, computed_field
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from uuid import UUID
from pydantic import ConfigDict
import uuid
from app.schemas.user import UserResponse  # Add this import for user relationship

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

class TechnicianCreate(BaseModel):
    """Schema for creating a new technician"""
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None
    employee_id: Optional[str] = None
    skills: List[str] = []
    certifications: Dict[str, Any] = {}
    hourly_rate: Optional[float] = None
    availability: Optional[Dict[str, Any]] = None
    max_daily_jobs: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = "active"
    service_radius: Optional[float] = None
    location: Optional[Dict[str, Any]] = None

    @validator('user_email')
    def validate_user_email(cls, v, values):
        """Validate that either user_id or user_email is provided"""
        if not values.get('user_id') and not v:
            raise ValueError("Either user_id or user_email must be provided")
        return v

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
    """Technician response schema"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    user: Optional['UserResponse'] = None  # Include user data in the response
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def name(self) -> str:
        """Display name for UIs (ORM `Technician.name` is not serialized by default)."""
        if self.user:
            parts = [self.user.first_name or "", self.user.last_name or ""]
            label = " ".join(p for p in parts if p).strip()
            if label:
                return label
            return str(self.user.email) if self.user.email else "Unknown"
        return "Unknown"
    
    @validator('certifications')
    def convert_certifications_to_dict(cls, v):
        """Convert empty lists or None to empty dictionary for certifications field"""
        if v is None or (isinstance(v, list) and len(v) == 0):
            return {}
        return v

class TechnicianListResponse(BaseModel):
    """Technician list response schema"""
    items: List[TechnicianResponse]
    total: int
    page: int
    pages: int
    model_config = ConfigDict(from_attributes=True)
    
    @validator('items')
    def validate_technician_items(cls, v):
        """Ensure certifications are dictionaries in all technician items"""
        for item in v:
            if hasattr(item, 'certifications'):
                if item.certifications is None or (isinstance(item.certifications, list) and len(item.certifications) == 0):
                    item.certifications = {}
        return v

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

class TechnicianAvailability(BaseModel):
    """Schema for technician availability"""
    technician_id: UUID
    technician_name: str
    date: datetime
    is_available: bool
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)