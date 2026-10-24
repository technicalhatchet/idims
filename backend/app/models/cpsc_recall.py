from datetime import datetime
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class CpscRecall(Base):
    __tablename__ = "cpsc_recalls"

    cpsc_recall_id = Column(BigInteger, primary_key=True)
    title = Column(Text, nullable=False)
    recall_date = Column(Date, nullable=True)
    last_publish_date = Column(Date, nullable=True)
    url = Column(Text, nullable=True)
    hazard = Column(Text, nullable=True)
    remedy = Column(Text, nullable=True)
    manufacturer = Column(Text, nullable=True)
    product_name = Column(Text, nullable=True)
    model_numbers = Column(JSONB, nullable=False, default=list)
    raw_payload = Column(JSONB, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    matches = relationship("ClientApplianceRecallMatch", back_populates="recall")


class CpscRecallSyncState(Base):
    __tablename__ = "cpsc_recall_sync_state"

    id = Column(BigInteger, primary_key=True, default=1)  # singleton row id=1
    last_publish_date_start = Column(Date, nullable=True)
    bootstrap_completed = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClientApplianceRecallMatch(Base):
    __tablename__ = "client_appliance_recall_matches"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'dismissed')",
            name="client_appliance_recall_matches_status_check",
        ),
        UniqueConstraint("appliance_id", "cpsc_recall_id", name="client_appliance_recall_matches_unique"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appliance_id = Column(
        UUID(as_uuid=True),
        ForeignKey("client_appliances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cpsc_recall_id = Column(
        BigInteger,
        ForeignKey("cpsc_recalls.cpsc_recall_id", ondelete="CASCADE"),
        nullable=False,
    )
    status = Column(String(20), nullable=False, default="pending")
    matched_on = Column(Text, nullable=False)
    match_rule = Column(String(40), nullable=False)
    first_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    confirmed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    dismissed_at = Column(DateTime, nullable=True)
    dismissed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    customer_notified_at = Column(DateTime, nullable=True)

    appliance = relationship("ClientAppliance", back_populates="recall_matches")
    recall = relationship("CpscRecall", back_populates="matches")
