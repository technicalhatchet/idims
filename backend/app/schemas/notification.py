from pydantic import BaseModel, validator, Field
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from uuid import UUID

class NotificationBase(BaseModel):
    """Base schema for Notification data"""
    user_id: UUID
    title: str
    content: str
    type: str = "in_app"  # in_app, email, sms, push
    related_id: Optional[UUID] = None
    related_type: Optional[str] = None
    template_id: Optional[UUID] = None
    
    @validator('type')
    def validate_type(cls, v):
        allowed_types = ["in_app", "email", "sms", "push"]
        if v not in allowed_types:
            raise ValueError(f"Type must be one of {allowed_types}")
        return v

class NotificationCreate(NotificationBase):
    """Schema for creating a new notification"""
    pass

class NotificationUpdate(BaseModel):
    """Schema for updating a notification"""
    is_read: Optional[bool] = None
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None
    
    @validator('type')
    def validate_type(cls, v):
        if v is not None:
            allowed_types = ["in_app", "email", "sms", "push"]
            if v not in allowed_types:
                raise ValueError(f"Type must be one of {allowed_types}")
        return v

class NotificationResponse(NotificationBase):
    """Schema for notification response"""
    id: UUID
    is_read: bool
    created_at: datetime
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    status: str
    
    class Config:
        orm_mode = True

class NotificationListResponse(BaseModel):
    """Schema for paginated list of notifications"""
    total: int
    items: List[NotificationResponse]
    page: int
    pages: int
    
    class Config:
        orm_mode = True

class NotificationTemplateBase(BaseModel):
    """Base schema for notification templates"""
    name: str
    type: str
    subject: Optional[str] = None
    content: str
    variables: Optional[Dict[str, Any]] = None
    
    @validator('type')
    def validate_type(cls, v):
        allowed_types = ["in_app", "email", "sms", "push"]
        if v not in allowed_types:
            raise ValueError(f"Type must be one of {allowed_types}")
        return v

class NotificationTemplateCreate(NotificationTemplateBase):
    """Schema for creating a notification template"""
    pass

class NotificationTemplateUpdate(BaseModel):
    """Schema for updating a notification template"""
    name: Optional[str] = None
    type: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    
    @validator('type')
    def validate_type(cls, v):
        if v is not None:
            allowed_types = ["in_app", "email", "sms", "push"]
            if v not in allowed_types:
                raise ValueError(f"Type must be one of {allowed_types}")
        return v

class NotificationTemplateResponse(NotificationTemplateBase):
    """Schema for notification template response"""
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True