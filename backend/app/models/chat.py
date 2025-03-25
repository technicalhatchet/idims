import uuid
from sqlalchemy import Column, String, ForeignKey, Text, TIMESTAMP, DateTime, Boolean, text, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin

class ChatSession(Base, TimestampMixin):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"))
    status = Column(String(20), nullable=False, default="active")
    closed_at = Column(TIMESTAMP(timezone=True))
    title = Column(String(255), nullable=True)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    is_read = Column(Boolean, default=False)

    # Relationships
    user = relationship("User")
    client = relationship("Client")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    sender_type = Column(String(20), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    message_type = Column(String(20), nullable=False, default="text")
    is_read = Column(Boolean, default=False)
    message_metadata = Column(JSON, nullable=True)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")
    sender = relationship("User")