from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class MediaBase(BaseModel):
    filename: str
    file_type: str
    file_size: int
    media_type: str
    reference_id: Optional[uuid.UUID] = None
    description: Optional[str] = None

class MediaCreate(MediaBase):
    pass

class MediaUpdate(BaseModel):
    description: Optional[str] = None

class MediaResponse(MediaBase):
    id: uuid.UUID
    file_path: str
    uploaded_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MediaListResponse(BaseModel):
    total: int
    media: list[MediaResponse]
    page: int
    pages: int

class MediaUploadResponse(BaseModel):
    success: bool
    file_path: Optional[str] = None
    error: Optional[str] = None 