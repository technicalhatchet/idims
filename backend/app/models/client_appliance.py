from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class ClientAppliance(Base):
    """Registered household appliance on a client profile."""

    __tablename__ = "client_appliances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    property_id = Column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    nickname = Column(String(120), nullable=True)
    equipment_type = Column(String(50), nullable=False)
    equipment_subtype = Column(String(50), nullable=True)
    make = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    serial = Column(String(100), nullable=True)
    equipment_version = Column(String(100), nullable=True)
    is_wall_mounted = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    photo_urls = Column(JSONB, nullable=True, default=list)
    source = Column(String(30), nullable=False, default="manual")
    verified_by_staff_at = Column(DateTime, nullable=True)
    verified_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    merged_into_id = Column(
        UUID(as_uuid=True),
        ForeignKey("client_appliances.id", ondelete="SET NULL"),
        nullable=True,
    )
    manufacture_year = Column(Integer, nullable=True)
    manufacture_month = Column(Integer, nullable=True)
    manufacture_decode_rule = Column(String(40), nullable=True)
    manufacture_decode_confidence = Column(String(10), nullable=True)
    manufacture_decoded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    verified_by_user = relationship("User", foreign_keys=[verified_by_user_id])
    client = relationship("Client", back_populates="appliances")
    property_ref = relationship("Property", back_populates="appliances")
    merged_into = relationship("ClientAppliance", remote_side=[id], foreign_keys=[merged_into_id])
    work_orders = relationship("WorkOrder", back_populates="appliance", foreign_keys="WorkOrder.appliance_id")
    recall_matches = relationship(
        "ClientApplianceRecallMatch",
        back_populates="appliance",
        cascade="all, delete-orphan",
    )
    maintenance_tasks = relationship(
        "ClientApplianceMaintenanceTask",
        back_populates="appliance",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        label = self.nickname or self.make or self.equipment_subtype or self.equipment_type
        return f"<ClientAppliance {self.id}: {label}>"
