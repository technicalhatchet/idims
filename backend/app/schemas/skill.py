from pydantic import BaseModel, UUID4, Field
from typing import List, Optional
from datetime import datetime

class SkillBase(BaseModel):
    """Base schema for Skill data"""
    name: str = Field(..., description="Name of the skill")
    description: Optional[str] = Field(None, description="Detailed description of the skill")
    category: Optional[str] = Field(None, description="Category of the skill")
    is_active: bool = Field(True, description="Whether the skill is active")

class SkillCreate(SkillBase):
    """Schema for creating a new skill"""
    pass

class SkillUpdate(BaseModel):
    """Schema for updating an existing skill"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class SkillResponse(SkillBase):
    """Schema for skill response data"""
    id: UUID4 = Field(..., description="Unique identifier for the skill")
    created_at: datetime = Field(..., description="When the skill was created")
    updated_at: Optional[datetime] = Field(None, description="When the skill was last updated")
    
    class Config:
        from_attributes = True

class SkillListResponse(BaseModel):
    """Schema for returning a paginated list of skills"""
    items: List[SkillResponse]
    total: int
    page: int = 1
    pages: int = 1
    
    class Config:
        from_attributes = True 