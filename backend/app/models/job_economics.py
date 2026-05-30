from datetime import datetime, date
import uuid

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Date,
    ForeignKey,
    Numeric,
    Integer,
    Boolean,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class ExpenseVendor(Base):
    __tablename__ = "expense_vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(120), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WorkOrderExpense(Base):
    __tablename__ = "work_order_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(
        UUID(as_uuid=True), ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category = Column(String(32), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("expense_vendors.id", ondelete="SET NULL"), nullable=True)
    vendor_name = Column(String(120), nullable=True)
    description = Column(String(500), nullable=True)
    expense_date = Column(Date, nullable=False, default=date.today)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="expenses")
    vendor = relationship("ExpenseVendor")
    receipts = relationship("ExpenseReceipt", back_populates="expense")


class ExpenseReceipt(Base):
    __tablename__ = "expense_receipts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_order_id = Column(
        UUID(as_uuid=True), ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expense_id = Column(
        UUID(as_uuid=True), ForeignKey("work_order_expenses.id", ondelete="SET NULL"), nullable=True
    )
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    storage_backend = Column(String(20), nullable=False, default="local")
    local_path = Column(String(512), nullable=True)
    drive_file_id = Column(String(128), nullable=True)
    drive_web_view_link = Column(String(512), nullable=True)
    drive_folder_id = Column(String(128), nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    work_order = relationship("WorkOrder", back_populates="expense_receipts")
    expense = relationship("WorkOrderExpense", back_populates="receipts")


class AppointmentMileage(Base):
    __tablename__ = "appointment_mileage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_order_appointments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    work_order_id = Column(
        UUID(as_uuid=True), ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method = Column(String(20), nullable=False, default="estimated")
    miles = Column(Numeric(8, 2), nullable=False, default=0)
    odometer_start = Column(Numeric(10, 1), nullable=True)
    odometer_end = Column(Numeric(10, 1), nullable=True)
    notes = Column(String(500), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    appointment = relationship("WorkOrderAppointment", back_populates="mileage")
    work_order = relationship("WorkOrder", back_populates="appointment_mileage")
