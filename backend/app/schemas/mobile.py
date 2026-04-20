from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import ConfigDict

class MobileDeviceBase(BaseModel):
    """Base schema for mobile device data"""
    device_id: str
    device_name: Optional[str] = None
    device_type: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    push_token: Optional[str] = None
    last_active: Optional[datetime] = None
    is_active: bool = True

class MobileDeviceCreate(MobileDeviceBase):
    """Schema for creating a new mobile device"""
    user_id: UUID

class MobileDeviceUpdate(BaseModel):
    """Schema for updating a mobile device"""
    device_name: Optional[str] = None
    device_type: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    push_token: Optional[str] = None
    is_active: Optional[bool] = None

class MobileDeviceResponse(MobileDeviceBase):
    """Mobile device response schema"""
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MobileDeviceListResponse(BaseModel):
    """Mobile device list response schema"""
    items: List[MobileDeviceResponse]
    total: int
    page: int
    pages: int
    model_config = ConfigDict(from_attributes=True)

class MobileAppConfig(BaseModel):
    """Schema for mobile app configuration"""
    version: str
    min_version: str
    features: Dict[str, bool]
    settings: Dict[str, Any]
    model_config = ConfigDict(from_attributes=True)

class MobileNotification(BaseModel):
    """Schema for mobile push notifications"""
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    priority: str = "normal"
    ttl: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)

class MobileNotificationResponse(BaseModel):
    """Response schema for mobile notification"""
    success: bool
    message: str
    notification_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class MobileSyncData(BaseModel):
    """Schema for mobile data synchronization"""
    last_sync: datetime
    entities: Dict[str, List[Dict[str, Any]]]
    deleted_entities: Dict[str, List[UUID]]
    model_config = ConfigDict(from_attributes=True)

class MobileSyncResponse(BaseModel):
    """Response schema for mobile sync"""
    success: bool
    message: str
    sync_data: Optional[MobileSyncData] = None
    model_config = ConfigDict(from_attributes=True)

class MobileWorkOrderBase(BaseModel):
    """Base schema for mobile work order data"""
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    assigned_to: Optional[UUID] = None
    client_id: UUID
    location: Optional[Dict[str, Any]] = None
    estimated_duration: Optional[int] = None
    actual_duration: Optional[int] = None
    notes: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None

class MobileWorkOrderCreate(MobileWorkOrderBase):
    """Schema for creating a new work order from mobile"""
    pass

class MobileWorkOrderUpdate(BaseModel):
    """Schema for updating a work order from mobile"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[UUID] = None
    location: Optional[Dict[str, Any]] = None
    estimated_duration: Optional[int] = None
    actual_duration: Optional[int] = None
    notes: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None

class MobileWorkOrderResponse(MobileWorkOrderBase):
    """Response schema for mobile work order"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    client_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class MobileWorkOrderListResponse(BaseModel):
    """Response schema for list of mobile work orders"""
    items: List[MobileWorkOrderResponse]
    total: int
    page: int
    pages: int
    model_config = ConfigDict(from_attributes=True)

class MobileWorkOrderStatusUpdate(BaseModel):
    """Schema for updating work order status from mobile"""
    status: str
    notes: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)

class MobileWorkOrderAttachment(BaseModel):
    """Schema for work order attachment from mobile"""
    filename: str
    file_type: str
    file_size: int
    file_path: str
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class MobileTechnicianBase(BaseModel):
    """Base schema for mobile technician data"""
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

class MobileTechnicianCreate(MobileTechnicianBase):
    """Schema for creating a new technician from mobile"""
    user_id: Optional[UUID] = None
    user_email: Optional[str] = None
    user_first_name: Optional[str] = None
    user_last_name: Optional[str] = None

class MobileTechnicianUpdate(BaseModel):
    """Schema for updating a technician from mobile"""
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

class MobileTechnicianResponse(MobileTechnicianBase):
    """Response schema for mobile technician"""
    id: UUID
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    updated_by: Optional[UUID] = None
    user_id: UUID
    user_email: str
    user_first_name: str
    user_last_name: str
    model_config = ConfigDict(from_attributes=True)

class MobileTechnicianListResponse(BaseModel):
    """Response schema for list of mobile technicians"""
    items: List[MobileTechnicianResponse]
    total: int
    page: int
    pages: int
    model_config = ConfigDict(from_attributes=True)

class MobileTechnicianAvailability(BaseModel):
    """Schema for technician availability from mobile"""
    date: datetime
    is_available: bool
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class MobileTechnicianLocation(BaseModel):
    """Schema for technician location update from mobile"""
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class MobileStatusUpdate(BaseModel):
    """Schema for updating status from mobile"""
    status: str
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class MobileLocationUpdate(BaseModel):
    """Schema for updating location from mobile"""
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True) 