from sqlalchemy import Column, ForeignKey, Integer, Text, Boolean, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base

class CustomerReview(Base):
    __tablename__ = "customer_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("technicians.id", ondelete="SET NULL"))
    rating = Column(Integer, nullable=False)
    comments = Column(Text)
    is_public = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    client = relationship("Client", back_populates="reviews")
    work_order = relationship("WorkOrder", back_populates="reviews")
    technician = relationship("Technician")

    # Constraints
    __table_args__ = (
        CheckConstraint('rating BETWEEN 1 AND 5', name='check_rating_range'),
    )