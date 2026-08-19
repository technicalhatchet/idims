from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class InventoryCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None


class InventoryCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class InventoryItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=100)
    category_id: Optional[UUID] = None
    unit_price: float = 0
    cost_price: float = 0
    quantity_in_stock: int = 0
    reorder_threshold: int = Field(default=5, ge=0)
    location: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=100)
    category_id: Optional[UUID] = None
    unit_price: Optional[float] = None
    cost_price: Optional[float] = None
    quantity_in_stock: Optional[int] = None
    reorder_threshold: Optional[int] = Field(None, ge=0)
    location: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class InventoryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    unit_price: float
    cost_price: float
    quantity_in_stock: int
    reorder_threshold: int
    location: Optional[str] = None
    is_active: bool
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime


class InventoryItemListResponse(BaseModel):
    total: int
    items: List[InventoryItemResponse]
    page: int
    pages: int


class InventoryStockAdjust(BaseModel):
    quantity_delta: int = Field(..., description="Positive to add stock, negative to remove")
    notes: Optional[str] = Field(None, max_length=500)
    reference_id: Optional[UUID] = None
    reference_type: Optional[str] = Field(None, max_length=50)


class InventoryStockAdjustResponse(BaseModel):
    item_id: UUID
    name: str
    previous_quantity: int
    adjustment: int
    new_quantity: int
    notes: Optional[str] = None
