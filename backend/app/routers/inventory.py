"""Shop / van inventory API."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.db.database import get_db
from app.core.dependencies import get_current_user, get_admin_or_manager_user
from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.user import User
from app.schemas.inventory import (
    InventoryCategoryCreate,
    InventoryCategoryResponse,
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemListResponse,
    InventoryStockAdjust,
    InventoryStockAdjustResponse,
)
from app.services.inventory_service import InventoryService, _serialize_item

router = APIRouter()


def _staff_can_view(user: User) -> bool:
    return any(role in user.roles for role in ("admin", "manager", "technician"))


@router.get("/categories", response_model=List[InventoryCategoryResponse])
async def list_inventory_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _staff_can_view(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return InventoryService.list_categories(db)


@router.post("/categories", response_model=InventoryCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_category(
    body: InventoryCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    try:
        return InventoryService.create_category(db, body)
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/items", response_model=InventoryItemListResponse)
async def list_inventory_items(
    search: Optional[str] = Query(None),
    category_id: Optional[uuid.UUID] = Query(None),
    low_stock_only: bool = Query(False),
    include_inactive: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _staff_can_view(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    items, total = InventoryService.list_items(
        db,
        search=search,
        category_id=category_id,
        low_stock_only=low_stock_only,
        active_only=not include_inactive,
        page=page,
        limit=limit,
    )
    return {
        "total": total,
        "items": [_serialize_item(i) for i in items],
        "page": page,
        "pages": (total + limit - 1) // limit if total else 0,
    }


@router.get("/items/low-stock", response_model=List[InventoryItemResponse])
async def list_low_stock_items(
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _staff_can_view(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    items = InventoryService.list_low_stock(db, limit=limit)
    return [_serialize_item(i) for i in items]


@router.post("/items", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    body: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    try:
        item = InventoryService.create_item(db, body)
        return _serialize_item(item)
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _staff_can_view(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    try:
        item = InventoryService.get_item(db, item_id)
        return _serialize_item(item)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: uuid.UUID,
    body: InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    try:
        item = InventoryService.update_item(db, item_id, body)
        return _serialize_item(item)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/items/{item_id}/adjust", response_model=InventoryStockAdjustResponse)
async def adjust_inventory_item_stock(
    item_id: uuid.UUID,
    body: InventoryStockAdjust,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    try:
        previous_item = InventoryService.get_item(db, item_id)
        previous_qty = int(previous_item.quantity_in_stock or 0)
        item = InventoryService.adjust_stock(db, item_id, body, current_user.id)
        return InventoryStockAdjustResponse(
            item_id=item.id,
            name=item.name,
            previous_quantity=previous_qty,
            adjustment=body.quantity_delta,
            new_quantity=int(item.quantity_in_stock or 0),
            notes=body.notes,
        )
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
