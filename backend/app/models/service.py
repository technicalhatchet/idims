from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, JSON, Boolean, Float, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
import uuid
import enum

class ServiceSkillLevel(str, enum.Enum):
    """Enum for service skill levels"""
    basic = "basic"
    intermediate = "intermediate"
    advanced = "advanced"

class ServiceType(str, enum.Enum):
    """Enum for service types"""
    diagnostic = "diagnostic"
    repair = "repair"
    installation = "installation"
    additional_time = "additional_time"
    network = "network"
    remote = "remote"
    custom = "custom"

class EquipmentType(str, enum.Enum):
    """Enum for equipment types"""
    washer = "washer"
    dryer = "dryer"
    stacked_laundry = "stacked_laundry"
    aio_laundry = "aio_laundry"
    refrigerator = "refrigerator"
    dishwasher = "dishwasher"
    range = "range"
    wall_oven = "wall_oven"
    tv = "tv"
    network = "network"
    other = "other"

class Service(Base):
    """Service model for storing service definitions"""
    __tablename__ = "services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    base_price = Column(Float, nullable=False)
    unit = Column(String(50), default="hour")  # hour, piece, job, etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional SKU fields
    service_type = Column(Enum(ServiceType, name="service_type", create_constraint=True, validate_strings=True), nullable=True)
    equipment_type = Column(Enum(EquipmentType, name="equipment_type", create_constraint=True, validate_strings=True), nullable=True)
    skill_level = Column(Enum(ServiceSkillLevel, name="skill_level", create_constraint=True, validate_strings=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    is_bundle = Column(Boolean, default=False)
    is_custom_price = Column(Boolean, default=False)
    requires_diagnostic = Column(Boolean, default=False)
    prerequisites = Column(JSON, nullable=True)
    common_parts = Column(JSON, nullable=True)
    equipment_compatibility = Column(JSON, nullable=True)
    
    def to_dict(self) -> dict:
        """Convert service to dictionary"""
        # Get enum values and convert to uppercase
        service_type_value = self.service_type.value if self.service_type else None
        equipment_type_value = self.equipment_type.value if self.equipment_type else None
        skill_level_value = self.skill_level.value if self.skill_level else None
        
        return {
            "id": str(self.id),
            "sku_code": self.sku_code,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "base_price": self.base_price,
            "unit": self.unit,
            "is_active": self.is_active,
            "service_type": service_type_value,
            "equipment_type": equipment_type_value,
            "skill_level": skill_level_value,
            "duration_minutes": self.duration_minutes,
            "is_bundle": self.is_bundle,
            "is_custom_price": self.is_custom_price,
            "requires_diagnostic": self.requires_diagnostic,
            "prerequisites": self.prerequisites,
            "common_parts": self.common_parts,
            "equipment_compatibility": self.equipment_compatibility,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class ServiceCategory(Base):
    """Service category model for organizing services"""
    __tablename__ = "service_categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("service_categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Self-referential relationship for hierarchical categories
    parent = relationship("ServiceCategory", remote_side=[id], backref="subcategories")
    
    def __repr__(self):
        return f"<ServiceCategory {self.id}: {self.name}>"

class ServiceBundle(Base):
    """Model for service bundles (packages)"""
    __tablename__ = "service_bundles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bundle_service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    included_service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    quantity = Column(Integer, default=1)
    discount_percent = Column(Float, default=0)  # Discount to apply when in this bundle
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    bundle_service = relationship("Service", foreign_keys=[bundle_service_id])
    included_service = relationship("Service", foreign_keys=[included_service_id])
    
    def __repr__(self):
        return f"<ServiceBundle {self.id}: {self.bundle_service_id} includes {self.included_service_id}>"

class ServiceSurcharge(Base):
    """Model for service surcharges"""
    __tablename__ = "service_surcharges"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    surcharge_type = Column(String(50), nullable=False)  # after_hours, emergency, holiday, complex_installation, etc.
    amount = Column(Float, nullable=False)  # Fixed amount or percentage
    is_percentage = Column(Boolean, default=False)  # True if amount is percentage, False if fixed amount
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ServiceSurcharge {self.id}: {self.name}>"