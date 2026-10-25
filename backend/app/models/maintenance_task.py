from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class MaintenanceTaskDefinition(Base):
    __tablename__ = "maintenance_task_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_type = Column(String(50), nullable=False)
    equipment_subtype = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)
    interval_months = Column(Integer, nullable=False)
    kind = Column(String(20), nullable=False)
    how_to_text = Column(Text, nullable=True)
    parts_search_term = Column(String(120), nullable=True)
    bookable_service_id = Column(UUID(as_uuid=True), ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    appliance_tasks = relationship(
        "ClientApplianceMaintenanceTask",
        back_populates="definition",
        cascade="all, delete-orphan",
    )


class ClientApplianceMaintenanceTask(Base):
    __tablename__ = "client_appliance_maintenance_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appliance_id = Column(
        UUID(as_uuid=True),
        ForeignKey("client_appliances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_definition_id = Column(
        UUID(as_uuid=True),
        ForeignKey("maintenance_task_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    last_done_at = Column(DateTime, nullable=True)
    next_due_at = Column(Date, nullable=False)
    snoozed_until = Column(Date, nullable=True)
    disabled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    appliance = relationship("ClientAppliance", back_populates="maintenance_tasks")
    definition = relationship("MaintenanceTaskDefinition", back_populates="appliance_tasks")
