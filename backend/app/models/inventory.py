"""Shop / van inventory models."""

from datetime import datetime
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Integer, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.database import Base


class InventoryCategory(Base):
    __tablename__ = "inventory_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship("InventoryItem", back_populates="category")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sku = Column(String(100), unique=True, nullable=True)
    unit_price = Column(Numeric(19, 4), nullable=False, default=0)
    cost_price = Column(Numeric(19, 4), nullable=False, default=0)
    quantity_in_stock = Column(Integer, nullable=False, default=0)
    reorder_threshold = Column(Integer, nullable=False, default=5)
    location = Column(String(100), nullable=True)
    supplier_info = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    category = relationship("InventoryCategory", back_populates="items")
    transactions = relationship("InventoryTransaction", back_populates="item", cascade="all, delete-orphan")

    @property
    def is_low_stock(self) -> bool:
        return int(self.quantity_in_stock or 0) <= int(self.reorder_threshold or 0)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transaction_type = Column(String(20), nullable=False)
    quantity = Column(Integer, nullable=False)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    reference_type = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("InventoryItem", back_populates="transactions")
