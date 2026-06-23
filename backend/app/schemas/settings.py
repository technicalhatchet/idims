"""
Pydantic schemas for application settings
"""

from pydantic import BaseModel, Field, validator
from typing import Any, Optional, Dict, List
from datetime import datetime
from uuid import UUID

class SettingBase(BaseModel):
    """Base schema for a setting"""
    key: str = Field(..., max_length=100, description="Unique setting key")
    value: Any = Field(..., description="Setting value (stored as JSONB)")
    description: Optional[str] = Field(None, description="Human-readable description")

class SettingCreate(SettingBase):
    """Schema for creating a new setting"""
    pass

class SettingUpdate(BaseModel):
    """Schema for updating an existing setting"""
    value: Any = Field(..., description="New setting value")

class SettingResponse(SettingBase):
    """Schema for setting response"""
    updated_at: datetime
    updated_by: Optional[UUID] = None
    
    class Config:
        from_attributes = True

class SettingsListResponse(BaseModel):
    """Schema for listing all settings"""
    settings: Dict[str, Any] = Field(..., description="All settings as key-value pairs")

# Specific setting value schemas for validation

def validate_time_format(v):
    """Validate HH:MM time format"""
    if v is not None:
        try:
            hour, minute = v.split(':')
            h, m = int(hour), int(minute)
            if not (0 <= h <= 23 and 0 <= m <= 59):
                raise ValueError
        except (ValueError, AttributeError):
            raise ValueError(f"Time must be in HH:MM format (00:00 to 23:59)")
    return v

class ShopHoursPeriod(BaseModel):
    """Schema for a time period (regular or evening)"""
    enabled: bool = Field(False, description="Whether this period is enabled")
    start: Optional[str] = Field(None, description="Start time in HH:MM format")
    end: Optional[str] = Field(None, description="End time in HH:MM format")
    
    @validator('start', 'end')
    def validate_time(cls, v):
        return validate_time_format(v)

class ShopHoursDay(BaseModel):
    """Schema for a single day's shop hours - supports both old and new format"""
    # New format fields
    regular: Optional[ShopHoursPeriod] = Field(None, description="Regular business hours")
    evening: Optional[ShopHoursPeriod] = Field(None, description="Evening extended hours")
    
    # Old format fields (for backward compatibility)
    enabled: Optional[bool] = Field(None, description="(Legacy) Whether the shop is open this day")
    open: Optional[str] = Field(None, description="(Legacy) Opening time in HH:MM format")
    close: Optional[str] = Field(None, description="(Legacy) Closing time in HH:MM format")
    
    @validator('open', 'close')
    def validate_time(cls, v):
        return validate_time_format(v)

class ShopHours(BaseModel):
    """Schema for shop hours setting"""
    monday: ShopHoursDay
    tuesday: ShopHoursDay
    wednesday: ShopHoursDay
    thursday: ShopHoursDay
    friday: ShopHoursDay
    saturday: ShopHoursDay
    sunday: ShopHoursDay

class AppointmentWindow(BaseModel):
    """Schema for an appointment time window"""
    label: str = Field(..., description="Display label (e.g., 'Morning')")
    hours: str = Field(..., description="Time range text (e.g., '8 AM – 12 PM')")
    startHour: int = Field(..., ge=0, le=23, description="Starting hour (0-23)")
    endHour: int = Field(..., ge=0, le=23, description="Ending hour (0-23)")

class NotificationChannel(BaseModel):
    """Schema for notification channel preferences"""
    sms: bool = Field(False, description="Send SMS notification")
    email: bool = Field(False, description="Send email notification")

class NotificationPreferences(BaseModel):
    """Schema for notification preferences setting"""
    appointment_confirmed: NotificationChannel
    tech_en_route: NotificationChannel
    payment_received: NotificationChannel
    appointment_reminder_24hr: NotificationChannel
    appointment_reminder_1hr: NotificationChannel

# Validation helpers

VALID_ACCENT_COLORS = ['orange', 'cyan']
VALID_DIAGNOSTIC_BEHAVIORS = ['auto_waive', 'manual', 'always_charge']
VALID_INVOICE_TERMS = ['due_on_receipt', 'net_15', 'net_30']

def validate_accent_color(value: str) -> str:
    if value not in VALID_ACCENT_COLORS:
        raise ValueError(f"Accent color must be one of {VALID_ACCENT_COLORS}")
    return value

def validate_diagnostic_behavior(value: str) -> str:
    if value not in VALID_DIAGNOSTIC_BEHAVIORS:
        raise ValueError(f"Diagnostic behavior must be one of {VALID_DIAGNOSTIC_BEHAVIORS}")
    return value

def validate_invoice_terms(value: str) -> str:
    if value not in VALID_INVOICE_TERMS:
        raise ValueError(f"Invoice terms must be one of {VALID_INVOICE_TERMS}")
    return value
