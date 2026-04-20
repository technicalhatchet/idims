from sqlalchemy import Column, String, ForeignKey, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class EmailCampaign(Base, TimestampMixin):
    __tablename__ = "email_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    scheduled_at = Column(TIMESTAMP(timezone=True))
    sent_at = Column(TIMESTAMP(timezone=True))
    target_segment = Column(JSONB)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False)

    # Relationships
    created_by_user = relationship("User")
    recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")

class CampaignRecipient(Base, TimestampMixin):
    __tablename__ = "campaign_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("email_campaigns.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    sent_at = Column(TIMESTAMP(timezone=True))
    opened_at = Column(TIMESTAMP(timezone=True))
    clicked_at = Column(TIMESTAMP(timezone=True))

    # Relationships
    campaign = relationship("EmailCampaign", back_populates="recipients")
    client = relationship("Client")