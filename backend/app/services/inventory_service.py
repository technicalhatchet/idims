"""Shop inventory CRUD and stock adjustments."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.inventory import InventoryCategory, InventoryItem, InventoryTransaction
from app.schemas.inventory import (
    InventoryCategoryCreate,
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryStockAdjust,
)

logger = logging.getLogger(__name__)


def _serialize_item(item: InventoryItem) -> InventoryItemResponse:
    return InventoryItemResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        sku=item.sku,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        unit_price=float(item.unit_price or 0),
        cost_price=float(item.cost_price or 0),
        quantity_in_stock=int(item.quantity_in_stock or 0),
        reorder_threshold=int(item.reorder_threshold or 0),
        location=item.location,
        is_active=bool(item.is_active),
        is_low_stock=item.is_low_stock,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


class InventoryService:
    @staticmethod
    def list_categories(db: Session) -> List[InventoryCategory]:
        return db.query(InventoryCategory).order_by(InventoryCategory.name).all()

    @staticmethod
    def create_category(db: Session, data: InventoryCategoryCreate) -> InventoryCategory:
        existing = db.query(InventoryCategory).filter(InventoryCategory.name == data.name).first()
        if existing:
            raise ConflictException(f"Category '{data.name}' already exists")
        row = InventoryCategory(name=data.name.strip(), description=data.description)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def list_items(
        db: Session,
        *,
        search: Optional[str] = None,
        category_id: Optional[uuid.UUID] = None,
        low_stock_only: bool = False,
        active_only: bool = True,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[List[InventoryItem], int]:
        query = db.query(InventoryItem).options(joinedload(InventoryItem.category))

        if active_only:
            query = query.filter(InventoryItem.is_active.is_(True))
        if category_id:
            query = query.filter(InventoryItem.category_id == category_id)
        if search:
            term = f"%{search.strip()}%"
            query = query.filter(
                (InventoryItem.name.ilike(term))
                | (InventoryItem.sku.ilike(term))
                | (InventoryItem.description.ilike(term))
                | (InventoryItem.location.ilike(term))
            )
        if low_stock_only:
            query = query.filter(InventoryItem.quantity_in_stock <= InventoryItem.reorder_threshold)

        total = query.count()
        skip = (page - 1) * limit
        items = (
            query.order_by(InventoryItem.name)
            .offset(skip)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def list_low_stock(db: Session, limit: int = 100) -> List[InventoryItem]:
        items, _ = InventoryService.list_items(
            db, low_stock_only=True, active_only=True, page=1, limit=limit,
        )
        return items

    @staticmethod
    def get_item(db: Session, item_id: uuid.UUID) -> InventoryItem:
        item = (
            db.query(InventoryItem)
            .options(joinedload(InventoryItem.category))
            .filter(InventoryItem.id == item_id)
            .first()
        )
        if not item:
            raise NotFoundException(f"Inventory item {item_id} not found")
        return item

    @staticmethod
    def create_item(db: Session, data: InventoryItemCreate) -> InventoryItem:
        sku = (data.sku or "").strip() or None
        if sku:
            dup = db.query(InventoryItem).filter(InventoryItem.sku == sku).first()
            if dup:
                raise ConflictException(f"SKU '{sku}' already exists")

        item = InventoryItem(
            name=data.name.strip(),
            description=data.description,
            sku=sku,
            category_id=data.category_id,
            unit_price=data.unit_price,
            cost_price=data.cost_price,
            quantity_in_stock=data.quantity_in_stock,
            reorder_threshold=data.reorder_threshold,
            location=(data.location or "").strip() or None,
            is_active=data.is_active,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return InventoryService.get_item(db, item.id)

    @staticmethod
    def update_item(
        db: Session,
        item_id: uuid.UUID,
        data: InventoryItemUpdate,
    ) -> InventoryItem:
        item = InventoryService.get_item(db, item_id)
        updates = data.model_dump(exclude_unset=True)

        if "sku" in updates and updates["sku"]:
            updates["sku"] = updates["sku"].strip()
            dup = (
                db.query(InventoryItem)
                .filter(InventoryItem.sku == updates["sku"], InventoryItem.id != item_id)
                .first()
            )
            if dup:
                raise ConflictException(f"SKU '{updates['sku']}' already exists")

        if "name" in updates and updates["name"]:
            updates["name"] = updates["name"].strip()
        if "location" in updates:
            updates["location"] = (updates["location"] or "").strip() or None

        for key, value in updates.items():
            setattr(item, key, value)
        item.updated_at = datetime.utcnow()

        db.commit()
        return InventoryService.get_item(db, item_id)

    @staticmethod
    def adjust_stock(
        db: Session,
        item_id: uuid.UUID,
        body: InventoryStockAdjust,
        user_id: Optional[uuid.UUID],
    ) -> InventoryItem:
        if body.quantity_delta == 0:
            raise ValidationException("quantity_delta must not be zero")

        item = InventoryService.get_item(db, item_id)
        previous = int(item.quantity_in_stock or 0)
        new_qty = previous + body.quantity_delta
        if new_qty < 0:
            raise ValidationException(
                f"Cannot remove {abs(body.quantity_delta)} — only {previous} in stock"
            )

        InventoryService.apply_stock_delta(
            db,
            item_id,
            body.quantity_delta,
            user_id,
            reference_id=body.reference_id,
            reference_type=body.reference_type,
            notes=body.notes,
        )
        db.commit()
        return InventoryService.get_item(db, item_id)

    @staticmethod
    def apply_stock_delta(
        db: Session,
        item_id: uuid.UUID,
        quantity_delta: int,
        user_id: Optional[uuid.UUID],
        *,
        reference_id: Optional[uuid.UUID] = None,
        reference_type: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> InventoryItem:
        """Adjust stock in the current session without committing."""
        if quantity_delta == 0:
            raise ValidationException("quantity_delta must not be zero")

        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        if not item:
            raise NotFoundException(f"Inventory item {item_id} not found")

        previous = int(item.quantity_in_stock or 0)
        new_qty = previous + quantity_delta
        if new_qty < 0:
            raise ValidationException(
                f"Cannot remove {abs(quantity_delta)} — only {previous} in stock for {item.name}"
            )

        item.quantity_in_stock = new_qty
        item.updated_at = datetime.utcnow()

        tx_type = "adjustment"
        if reference_type == "work_order_part" and quantity_delta < 0:
            tx_type = "sale"
        elif reference_type == "work_order_part" and quantity_delta > 0:
            tx_type = "return"
        elif reference_type == "purchase":
            tx_type = "purchase"

        db.add(
            InventoryTransaction(
                item_id=item.id,
                transaction_type=tx_type,
                quantity=quantity_delta,
                reference_id=reference_id,
                reference_type=reference_type,
                notes=notes,
                created_by=user_id,
            )
        )
        return item
