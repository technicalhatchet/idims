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


# ── Trip/Service Zone Schemas ────────────────────────────────────────────────

class TripZone(BaseModel):
    """Schema for a single service zone"""
    name: str = Field(..., description="Zone display name (e.g., 'Local', 'Extended')")
    tripCharge: float = Field(..., ge=0, description="Trip charge amount for this zone")
    zipCodes: List[str] = Field(default_factory=list, description="Zip codes explicitly in this zone")
    color: Optional[str] = Field(None, description="Optional color for UI display")


class DriveTimeRange(BaseModel):
    """Schema for drive time-based zone fallback"""
    maxMinutes: Optional[int] = Field(None, description="Max drive time in minutes for this range (null = unlimited)")
    charge: Optional[float] = Field(None, description="Trip charge (null = custom/manual)")
    zone: str = Field(..., description="Zone key this range maps to")


class TripZonesSettings(BaseModel):
    """Schema for trip/service zones setting"""
    zones: Dict[str, TripZone] = Field(
        ..., 
        description="Zone definitions keyed by zone ID (local, extended, far, custom)"
    )
    driveTimeFallback: Dict[str, Any] = Field(
        default_factory=lambda: {
            "enabled": True,
            "shopAddress": None,
            "ranges": []
        },
        description="Drive time-based fallback for zip codes not in explicit lists"
    )
    defaultTripChargeSku: Optional[str] = Field(
        None, 
        description="SKU code for trip charge service (auto-added to work orders)"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "zones": {
                    "local": {
                        "name": "Local",
                        "tripCharge": 0,
                        "zipCodes": ["43609", "43604", "43605"],
                        "color": "#22c55e"
                    },
                    "extended": {
                        "name": "Extended",
                        "tripCharge": 29,
                        "zipCodes": [],
                        "color": "#eab308"
                    },
                    "far": {
                        "name": "Far",
                        "tripCharge": 50,
                        "zipCodes": [],
                        "color": "#f97316"
                    },
                    "custom": {
                        "name": "Custom",
                        "tripCharge": 0,
                        "zipCodes": [],
                        "color": "#ef4444"
                    }
                },
                "driveTimeFallback": {
                    "enabled": True,
                    "shopAddress": "641 Barclay Drive, Toledo, OH 43609",
                    "ranges": [
                        {"maxMinutes": 20, "charge": 0, "zone": "local"},
                        {"maxMinutes": 35, "charge": 29, "zone": "extended"},
                        {"maxMinutes": 50, "charge": 50, "zone": "far"},
                        {"maxMinutes": None, "charge": None, "zone": "custom"}
                    ]
                },
                "defaultTripChargeSku": "TRIP-CHARGE"
            }
        }


# ── County Tax Jurisdiction Schemas ────────────────────────────────────────────

class TaxCounty(BaseModel):
    """Sales tax rate for a county"""
    name: str = Field(..., description="County display name")
    rate: float = Field(..., ge=0, le=0.2, description="Tax rate as decimal (0.0775 = 7.75%)")
    zipCodes: List[str] = Field(default_factory=list, description="Zip codes in this county")


class TaxJurisdictionsSettings(BaseModel):
    """County tax configuration keyed by county id"""
    defaultCounty: str = Field(
        "lucas",
        description="County key used when zip is unknown",
    )
    counties: Dict[str, TaxCounty] = Field(
        ...,
        description="County definitions (lucas, wood, fulton, etc.)",
    )


# ── Parts Tab Settings ─────────────────────────────────────────────────────────

class PartsLookupProvider(BaseModel):
    """External parts lookup tile (logo link on Model/Parts tab)."""
    id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    logoPath: str = Field(..., description="Public path to logo image")
    urlTemplate: str = Field(
        ...,
        description="URL with {model}, {manufacturer}, and/or {search} placeholders",
    )
    equipmentTypes: List[str] = Field(
        default_factory=list,
        description="Equipment types that show this provider (appliance, tv)",
    )
    enabled: bool = True

    @validator("logoPath")
    def valid_logo_path(cls, value: str) -> str:
        path = (value or "").strip()
        if not path or path.endswith("/"):
            raise ValueError("logoPath must be a file path (e.g. /images/logos/google.png), not a directory")
        filename = path.rsplit("/", 1)[-1]
        if not filename or filename in (".", ".."):
            raise ValueError("logoPath must include a filename")
        return path


class PartsVendorOption(BaseModel):
    """Vendor option on part line items."""
    id: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    enabled: bool = True


class PartsSettings(BaseModel):
    """Parts tab configuration."""
    lookupEnabled: bool = Field(True, description="Show parts lookup logo links")
    markupPercent: float = Field(28, ge=0, le=500, description="Default cost-to-price markup %")
    oemWarrantyDays: int = Field(365, ge=0, description="Default OEM parts warranty days")
    aftermarketWarrantyDays: int = Field(0, ge=0, description="Default aftermarket warranty days")
    lookupProviders: List[PartsLookupProvider] = Field(default_factory=list)
    partVendors: List[PartsVendorOption] = Field(default_factory=list)

    @validator("lookupProviders")
    def unique_provider_ids(cls, providers):
        ids = [p.id for p in providers]
        if len(ids) != len(set(ids)):
            raise ValueError("lookupProviders ids must be unique")
        return providers

    @validator("partVendors")
    def unique_vendor_ids(cls, vendors):
        ids = [v.id for v in vendors]
        if len(ids) != len(set(ids)):
            raise ValueError("partVendors ids must be unique")
        if not any(v.id == "Other" for v in vendors):
            raise ValueError("partVendors must include an Other option")
        return vendors
