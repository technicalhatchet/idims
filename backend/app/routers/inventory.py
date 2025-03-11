from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.inventory import InventoryItem, Vendor
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/inventory", response_model=Dict[str, Any])
async def list_inventory_items(
    search: Optional[str] = Query(None, description="Search by name or SKU"),
    category: Optional[str] = Query(None, description="Filter by category"),
    in_stock: Optional[bool] = Query(None, description="Filter by in stock status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List inventory items with filtering and pagination.
    """
    # Only staff can access inventory
    if current_user.role not in ["admin", "manager", "technician"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view inventory"
        )
    
    skip = (page - 1) * limit
    
    # Build the query
    query = db.query(InventoryItem)
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (InventoryItem.name.ilike(search_term)) | 
            (InventoryItem.sku.ilike(search_term))
        )
    
    if category:
        query = query.filter(InventoryItem.category == category)
    
    if in_stock is not None:
        if in_stock:
            query = query.filter(InventoryItem.quantity_in_stock > 0)
        else:
            query = query.filter(InventoryItem.quantity_in_stock <= 0)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    items = query.order_by(InventoryItem.name).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "items": items,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.post("/inventory", status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    item_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new inventory item.
    Only managers and admins can create inventory items.
    """
    try:
        # Check if SKU already exists
        if "sku" in item_data and item_data["sku"]:
            existing = db.query(InventoryItem).filter(InventoryItem.sku == item_data["sku"]).first()
            if existing:
                raise ConflictException(f"Item with SKU {item_data['sku']} already exists")
        
        # Create new item
        new_item = InventoryItem(
            name=item_data["name"],
            sku=item_data.get("sku"),
            description=item_data.get("description"),
            category=item_data.get("category"),
            unit_price=item_data.get("unit_price", 0.0),
            cost_price=item_data.get("cost_price"),
            quantity_in_stock=item_data.get("quantity_in_stock", 0.0),
            reorder_level=item_data.get("reorder_level"),
            location=item_data.get("location"),
            is_active=item_data.get("is_active", True),
            vendor_id=item_data.get("vendor_id"),
            meta_data=item_data.get("meta_data")
        )
        
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        
        return new_item
    
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating inventory item: {str(e)}"
        )

@router.get("/inventory/{item_id}")
async def get_inventory_item(
    item_id: uuid.UUID = Path(..., description="The ID of the inventory item"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific inventory item by ID.
    """
    # Only staff can access inventory
    if current_user.role not in ["admin", "manager", "technician"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view inventory"
        )
    
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item with ID {item_id} not found"
        )
    
    return item

@router.put("/inventory/{item_id}")
async def update_inventory_item(
    item_id: uuid.UUID = Path(..., description="The ID of the inventory item"),
    item_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Update an inventory item.
    Only managers and admins can update inventory items.
    """
    try:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        
        if not item:
            raise NotFoundException(f"Inventory item with ID {item_id} not found")
        
        # Check SKU uniqueness if changing
        if "sku" in item_data and item_data["sku"] != item.sku:
            existing = db.query(InventoryItem).filter(
                InventoryItem.sku == item_data["sku"],
                InventoryItem.id != item_id
            ).first()
            if existing:
                raise ConflictException(f"Item with SKU {item_data['sku']} already exists")
        
        # Update fields
        for key, value in item_data.items():
            if hasattr(item, key):
                setattr(item, key, value)
        
        item.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(item)
        
        return item
    
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating inventory item: {str(e)}"
        )

@router.delete("/inventory/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: uuid.UUID = Path(..., description="The ID of the inventory item"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete an inventory item.
    Only admins can delete inventory items.
    """
    try:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        
        if not item:
            raise NotFoundException(f"Inventory item with ID {item_id} not found")
        
        # Check if item is used in work orders
        # This would be implemented in a real service
        
        db.delete(item)
        db.commit()
        
        return None
    
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting inventory item: {str(e)}"
        )

@router.post("/inventory/{item_id}/adjust-stock")
async def adjust_inventory_stock(
    item_id: uuid.UUID = Path(..., description="The ID of the inventory item"),
    adjustment: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Adjust the stock quantity for an inventory item.
    """
    try:
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        
        if not item:
            raise NotFoundException(f"Inventory item with ID {item_id} not found")
        
        # Update stock quantity
        quantity = adjustment.get("quantity")
        if quantity is None:
            raise ValidationException("Quantity is required")
        
        # Record the adjustment in history
        new_quantity = item.quantity_in_stock + quantity
        
        # Update the item
        item.quantity_in_stock = new_quantity
        item.updated_at = datetime.utcnow()
        
        # In a real implementation, would record this in a stock adjustment history table
        
        db.commit()
        db.refresh(item)
        
        return {
            "item_id": str(item.id),
            "name": item.name,
            "previous_quantity": item.quantity_in_stock - quantity,
            "adjustment": quantity,
            "new_quantity": item.quantity_in_stock,
            "reason": adjustment.get("reason", "Manual adjustment"),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error adjusting inventory: {str(e)}"
        )

@router.get("/vendors", response_model=Dict[str, Any])
async def list_vendors(
    search: Optional[str] = Query(None, description="Search by name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    List vendors with filtering and pagination.
    Only managers and admins can view vendors.
    """
    skip = (page - 1) * limit
    
    # Build the query
    query = db.query(Vendor)
    
    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Vendor.name.ilike(search_term)) | 
            (Vendor.contact_name.ilike(search_term))
        )
    
    if is_active is not None:
        query = query.filter(Vendor.is_active == is_active)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    vendors = query.order_by(Vendor.name).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "items": vendors,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.post("/vendors", status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new vendor.
    Only managers and admins can create vendors.
    """
    try:
        # Create new vendor
        new_vendor = Vendor(
            name=vendor_data["name"],
            contact_name=vendor_data.get("contact_name"),
            email=vendor_data.get("email"),
            phone=vendor_data.get("phone"),
            address=vendor_data.get("address"),
            website=vendor_data.get("website"),
            notes=vendor_data.get("notes"),
            is_active=vendor_data.get("is_active", True)
        )
        
        db.add(new_vendor)
        db.commit()
        db.refresh(new_vendor)
        
        return new_vendor
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating vendor: {str(e)}"
        )

@router.get("/vendors/{vendor_id}")
async def get_vendor(
    vendor_id: uuid.UUID = Path(..., description="The ID of the vendor"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Get a specific vendor by ID.
    Only managers and admins can view vendors.
    """
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID {vendor_id} not found"
        )
    
    return vendor

@router.put("/vendors/{vendor_id}")
async def update_vendor(
    vendor_id: uuid.UUID = Path(..., description="The ID of the vendor"),
    vendor_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Update a vendor.
    Only managers and admins can update vendors.
    """
    try:
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        
        if not vendor:
            raise NotFoundException(f"Vendor with ID {vendor_id} not found")
        
        # Update fields
        for key, value in vendor_data.items():
            if hasattr(vendor, key):
                setattr(vendor, key, value)
        
        vendor.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(vendor)
        
        return vendor
    
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating vendor: {str(e)}"
        )

@router.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor_id: uuid.UUID = Path(..., description="The ID of the vendor"),
    current_user: User = Depends(auth_handler.verify_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a vendor.
    Only admins can delete vendors.
    """
    try:
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        
        if not vendor:
            raise NotFoundException(f"Vendor with ID {vendor_id} not found")
        
        # Check if vendor has associated inventory items
        items_count = db.query(InventoryItem).filter(InventoryItem.vendor_id == vendor_id).count()
        
        if items_count > 0:
            raise ConflictException(f"Cannot delete vendor with {items_count} associated inventory items")
        
        db.delete(vendor)
        db.commit()
        
        return None
    
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting vendor: {str(e)}"
        )