from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.database import Base

class Notification(Base):
    """Notification model for storing user notifications"""
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    type = Column(Enum("in_app", "email", "sms", "push", name="notification_type_enum"), default="in_app")
    status = Column(Enum("pending", "sent", "delivered", "failed", name="notification_status_enum"), default="pending")
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    related_id = Column(UUID(as_uuid=True), nullable=True)  # ID of related entity (work order, invoice, etc.)
    related_type = Column(String(50), nullable=True)        # Type of related entity
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates.id"), nullable=True)
    meta_data = Column(JSONB, nullable=True)                # Additional data like email/sms details
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="notifications")
    template = relationship("NotificationTemplate", back_populates="notifications")
    
    def __repr__(self):
        return f"<Notification {self.id}: {self.title} ({self.type})>"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = datetime.utcnow()
    
    def mark_as_sent(self):
        """Mark notification as sent"""
        if self.status == "pending":
            self.status = "sent"
            self.sent_at = datetime.utcnow()


class NotificationTemplate(Base):
    """Notification template model for storing reusable notification templates"""
    __tablename__ = "notification_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    type = Column(Enum("in_app", "email", "sms", "push", name="notification_type_enum"), nullable=False)
    subject = Column(String(255), nullable=True)  # Email subject or notification title
    content = Column(Text, nullable=False)        # Template content with variables
    variables = Column(JSONB, nullable=True)      # Description of variables used in template
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    notifications = relationship("Notification", back_populates="template")
    
    def __repr__(self):
        return f"<NotificationTemplate {self.id}: {self.name}>"
    
    def format_content(self, variables: dict) -> str:
        """Format template content with provided variables"""
        try:
            return self.content.format(**variables)
        except KeyError as e:
            # Handle missing variables
            return f"Error formatting template: missing variable {str(e)}"
        except Exception as e:
            return f"Error formatting template: {str(e)}"