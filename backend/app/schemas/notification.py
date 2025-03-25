from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str
    reference_id: Optional[uuid.UUID] = None
    priority: str = "normal"

class NotificationCreate(NotificationBase):
    user_id: uuid.UUID

class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None

class NotificationResponse(NotificationBase):
    id: uuid.UUID
    user_id: uuid.UUID
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    total: int
    notifications: list[NotificationResponse]
    page: int
    pages: int
    unread_count: int

class NotificationTemplateBase(BaseModel):
    name: str
    title_template: str
    message_template: str
    notification_type: str
    variables: list[str] = Field(default_factory=list)

class NotificationTemplateCreate(NotificationTemplateBase):
    pass

class NotificationTemplateUpdate(NotificationTemplateBase):
    pass

class NotificationTemplateResponse(NotificationTemplateBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True