from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class ChatMessageBase(BaseModel):
    """Base schema for chat messages"""
    content: str
    message_type: str = "text"
    metadata: Optional[Dict[str, Any]] = None

class ChatMessageCreate(ChatMessageBase):
    """Schema for creating a new chat message"""
    session_id: UUID
    sender_type: str

class ChatMessageResponse(ChatMessageBase):
    """Schema for chat message response"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    sender_type: str
    sender_id: Optional[UUID] = None
    created_at: datetime
    is_read: bool = False

class ChatSessionBase(BaseModel):
    """Base schema for chat sessions"""
    title: Optional[str] = None
    status: str = "active"

class ChatSessionCreate(ChatSessionBase):
    """Schema for creating a new chat session"""
    client_id: Optional[UUID] = None

class ChatSessionResponse(ChatSessionBase):
    """Schema for chat session response"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    client_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    last_message_at: Optional[datetime] = None
    is_read: bool = False
    messages: List[ChatMessageResponse] = []

class ChatSessionListResponse(BaseModel):
    """Schema for paginated chat session list response"""
    model_config = ConfigDict(from_attributes=True)

    items: List[ChatSessionResponse]
    total: int
    page: int
    pages: int 