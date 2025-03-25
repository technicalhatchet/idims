from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional, Dict, List, Any
from datetime import datetime
from uuid import UUID

class UserBase(BaseModel):
    """Base user schema"""
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: str = Field(..., pattern="^(admin|manager|technician|client)$")
    is_active: bool = True
    avatar_url: Optional[str] = None
    company: Optional[str] = None
    preferences: Dict[str, Any] = {}

class UserCreate(UserBase):
    """Schema for creating a new user"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+1234567890",
                "role": "client",
                "preferences": {"theme": "light"}
            }
        }
    )

class UserUpdate(BaseModel):
    """Schema for updating a user"""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+1234567890",
                "is_active": True,
                "preferences": {"theme": "dark"}
            }
        }
    )

    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None
    company: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None

class UserResponse(UserBase):
    """Schema for user response"""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "role": "client",
                "is_active": True,
                "created_at": "2023-01-01T00:00:00Z",
                "updated_at": "2023-01-01T00:00:00Z"
            }
        }
    )

    id: UUID
    auth_id: Optional[str] = None
    email_verified: bool = False
    permissions: List[str] = []
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

class UserLogin(BaseModel):
    """Schema for user login"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "strongpassword123"
            }
        }
    )

    email: EmailStr
    password: str = Field(..., min_length=8)

class Token(BaseModel):
    """Schema for authentication token"""
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1...",
                "token_type": "bearer",
                "expires_in": 3600,
                "user": {
                    "id": "123e4567-e89b-12d3-a456-426614174000",
                    "email": "user@example.com",
                    "role": "client"
                }
            }
        }
    )

    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse

class UserListResponse(BaseModel):
    """Schema for paginated user list response"""
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "items": [
                    {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "email": "user@example.com",
                        "first_name": "John",
                        "last_name": "Doe",
                        "role": "client",
                        "is_active": True,
                        "created_at": "2023-01-01T00:00:00Z",
                        "updated_at": "2023-01-01T00:00:00Z"
                    }
                ],
                "total": 100,
                "page": 1,
                "pages": 10
            }
        }
    )

    items: List[UserResponse]
    total: int
    page: int
    pages: int
