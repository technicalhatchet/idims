from pydantic import BaseModel, EmailStr, validator, Field
from typing import Optional, Dict, List, Any
from datetime import datetime
from uuid import UUID

class UserBase(BaseModel):
    """Base schema for User data"""
    email: EmailStr
    first_name: str
    last_name: str
    role: Optional[str] = "client"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    
    @validator('role')
    def validate_role(cls, v):
        allowed_roles = ["admin", "manager", "technician", "client"]
        if v not in allowed_roles:
            raise ValueError(f"Role must be one of {allowed_roles}")
        return v

class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: Optional[str] = None
    auth_id: Optional[str] = None
    email_verified: Optional[bool] = False
    is_active: Optional[bool] = True
    preferences: Optional[Dict[str, Any]] = None
    
    @validator('password')
    def password_required_if_no_auth_id(cls, v, values):
        if not values.get('auth_id') and not v:
            raise ValueError("Password is required if no auth_id is provided")
        return v

class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    email_verified: Optional[bool] = None
    preferences: Optional[Dict[str, Any]] = None
    
    @validator('role')
    def validate_role(cls, v):
        if v is not None:
            allowed_roles = ["admin", "manager", "technician", "client"]
            if v not in allowed_roles:
                raise ValueError(f"Role must be one of {allowed_roles}")
        return v

class UserPasswordUpdate(BaseModel):
    """Schema for updating user password"""
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

class UserResponse(UserBase):
    """Schema for user response"""
    id: UUID
    is_active: bool
    email_verified: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class UserListResponse(BaseModel):
    """Schema for paginated list of users"""
    total: int
    items: List[UserResponse]
    page: int
    pages: int
    
    class Config:
        orm_mode = True

class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str

class Token(BaseModel):
    """Schema for authentication token"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
