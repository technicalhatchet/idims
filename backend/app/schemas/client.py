from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from uuid import UUID

class AddressSchema(BaseModel):
    """Schema for address data"""
    street1: str
    street2: Optional[str] = None
    city: str
    state: str
    zip: str
    country: Optional[str] = "USA"
    
    class Config:
        schema_extra = {
            "example": {
                "street1": "123 Main St",
                "street2": "Apt 4B",
                "city": "Anytown",
                "state": "CA",
                "zip": "12345",
                "country": "USA"
            }
        }

class ClientBase(BaseModel):
    """Base schema for Client data"""
    company_name: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    billing_address: Optional[Dict[str, Any]] = None
    shipping_address: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    status: Optional[str] = "active"
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[int] = 30
    credit_limit: Optional[float] = None

class ClientCreate(ClientBase):
    """Schema for creating a new client"""
    user_id: Optional[UUID] = None
    
    @validator('status')
    def validate_status(cls, v):
        allowed_statuses = ["active", "inactive", "lead"]
        if v not in allowed_statuses:
            raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class ClientUpdate(BaseModel):
    """Schema for updating a client"""
    company_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[Dict[str, Any]] = None
    billing_address: Optional[Dict[str, Any]] = None
    shipping_address: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[int] = None
    credit_limit: Optional[float] = None
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            allowed_statuses = ["active", "inactive", "lead"]
            if v not in allowed_statuses:
                raise ValueError(f"Status must be one of {allowed_statuses}")
        return v

class ClientResponse(ClientBase):
    """Schema for client response"""
    id: UUID
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class ClientListResponse(BaseModel):
    """Schema for paginated list of clients"""
    total: int
    items: List[ClientResponse]
    page: int
    pages: int
    
    class Config:
        orm_mode = True
