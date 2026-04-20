from pydantic import BaseModel, UUID4, Field, EmailStr, field_validator, ConfigDict
from typing import List, Optional, Any, Dict, Union
from datetime import datetime, date
from enum import Enum

# Enums for service fields
class ServiceTypeEnum(str, Enum):
    DIAGNOSTIC = "diagnostic"
    REPAIR = "repair"
    INSTALLATION = "installation"
    ADDITIONAL_TIME = "additional_time"
    NETWORK = "network"
    REMOTE = "remote"
    CUSTOM = "custom"

class EquipmentTypeEnum(str, Enum):
    WASHER = "washer"
    DRYER = "dryer"
    STACKED_LAUNDRY = "stacked_laundry"
    AIO_LAUNDRY = "aio_laundry"
    REFRIGERATOR = "refrigerator"
    DISHWASHER = "dishwasher"
    RANGE = "range"
    WALL_OVEN = "wall_oven"
    TV = "tv"
    NETWORK = "network"
    OTHER = "other"

class ServiceSkillLevelEnum(str, Enum):
    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class ServiceBase(BaseModel):
    """Base schema for Service data"""
    sku_code: str = Field(..., description="Unique SKU code for the service", min_length=3, max_length=50)
    name: str = Field(..., description="Name of the service")
    description: Optional[str] = Field(None, description="Detailed description of the service")
    category: Optional[str] = Field(None, description="Category of the service")
    base_price: float = Field(..., description="Base price of the service", ge=0)
    unit: str = Field("hour", description="Unit of measurement for the service (hour, job, etc.)")
    is_active: bool = Field(True, description="Whether the service is active")
    
    # Additional SKU fields
    service_type: Optional[ServiceTypeEnum] = Field(None, description="Type of service")
    equipment_type: Optional[EquipmentTypeEnum] = Field(None, description="Type of equipment this service applies to")
    skill_level: Optional[ServiceSkillLevelEnum] = Field(None, description="Required skill level for this service")
    duration_minutes: Optional[int] = Field(None, description="Estimated duration in minutes", ge=0)
    is_bundle: bool = Field(False, description="Whether this service is a bundle of other services")
    is_custom_price: bool = Field(False, description="Whether this service has a custom/variable price")
    requires_diagnostic: bool = Field(False, description="Whether this service requires a diagnostic first")
    prerequisites: Optional[List[str]] = Field(None, description="List of prerequisites for this service")
    common_parts: Optional[List[str]] = Field(None, description="List of common part names for this service")
    equipment_compatibility: Optional[List[str]] = Field(None, description="List of equipment types compatible with this service")

class ServiceCreate(ServiceBase):
    """Schema for creating a new service"""
    pass

class ServiceUpdate(BaseModel):
    """Schema for updating an existing service"""
    sku_code: Optional[str] = Field(None, min_length=3, max_length=50)
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    base_price: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = None
    is_active: Optional[bool] = None
    
    # Additional SKU fields
    service_type: Optional[ServiceTypeEnum] = None
    equipment_type: Optional[EquipmentTypeEnum] = None
    skill_level: Optional[ServiceSkillLevelEnum] = None
    duration_minutes: Optional[int] = Field(None, ge=0)
    is_bundle: Optional[bool] = None
    is_custom_price: Optional[bool] = None
    requires_diagnostic: Optional[bool] = None
    prerequisites: Optional[List[str]] = None
    common_parts: Optional[List[str]] = None
    equipment_compatibility: Optional[List[str]] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        extra="ignore"
    )

class ServiceResponse(ServiceBase):
    """Schema for service response data"""
    id: UUID4 = Field(..., description="Unique identifier for the service")
    created_at: datetime = Field(..., description="When the service was created")
    updated_at: Optional[datetime] = Field(None, description="When the service was last updated")
    
    model_config = ConfigDict(
        from_attributes=True
    )

class ServiceListResponse(BaseModel):
    """Schema for returning a paginated list of services"""
    items: List[ServiceResponse]
    total: int
    page: int = 1
    pages: int = 1
    
    model_config = ConfigDict(
        from_attributes=True
    )

# Schema for service bundles
class ServiceBundleBase(BaseModel):
    bundle_service_id: UUID4 = Field(..., description="ID of the bundle service")
    included_service_id: UUID4 = Field(..., description="ID of the service included in the bundle")
    quantity: int = Field(1, description="Quantity of the included service", ge=1)
    discount_percent: float = Field(0, description="Discount percentage when in this bundle", ge=0, le=100)
    is_active: bool = Field(True, description="Whether this bundle item is active")

class ServiceBundleCreate(ServiceBundleBase):
    """Schema for creating a new service bundle item"""
    pass

class ServiceBundleUpdate(BaseModel):
    """Schema for updating a service bundle item"""
    quantity: Optional[int] = Field(None, ge=1)
    discount_percent: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None
    
    model_config = ConfigDict(
        from_attributes=True
    )

class ServiceBundleResponse(ServiceBundleBase):
    """Schema for returning a service bundle item"""
    id: UUID4 = Field(..., description="Unique identifier for the bundle item")
    created_at: datetime = Field(..., description="When the bundle item was created")
    updated_at: Optional[datetime] = Field(None, description="When the bundle item was last updated")
    bundle_service: ServiceResponse = Field(..., description="The bundle service")
    included_service: ServiceResponse = Field(..., description="The included service")
    
    model_config = ConfigDict(
        from_attributes=True
    )

# Schema for service surcharges
class ServiceSurchargeBase(BaseModel):
    name: str = Field(..., description="Name of the surcharge")
    description: Optional[str] = Field(None, description="Description of the surcharge")
    surcharge_type: str = Field(..., description="Type of surcharge (e.g., after_hours, emergency)")
    amount: float = Field(..., description="Amount of the surcharge", ge=0)
    is_percentage: bool = Field(False, description="Whether the amount is a percentage")
    is_active: bool = Field(True, description="Whether the surcharge is active")

class ServiceSurchargeCreate(ServiceSurchargeBase):
    """Schema for creating a new service surcharge"""
    pass

class ServiceSurchargeUpdate(BaseModel):
    """Schema for updating a service surcharge"""
    name: Optional[str] = None
    description: Optional[str] = None
    surcharge_type: Optional[str] = None
    amount: Optional[float] = Field(None, ge=0)
    is_percentage: Optional[bool] = None
    is_active: Optional[bool] = None
    
    model_config = ConfigDict(
        from_attributes=True
    )

class ServiceSurchargeResponse(ServiceSurchargeBase):
    """Schema for returning a service surcharge"""
    id: UUID4 = Field(..., description="Unique identifier for the surcharge")
    created_at: datetime = Field(..., description="When the surcharge was created")
    updated_at: Optional[datetime] = Field(None, description="When the surcharge was last updated")
    
    model_config = ConfigDict(
        from_attributes=True
    ) 