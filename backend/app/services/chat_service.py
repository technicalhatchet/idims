from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import (
    ChatMessageCreate, ChatMessageResponse,
    ChatSessionCreate, ChatSessionResponse,
    ChatSessionListResponse
)
from app.core.exceptions import NotFoundException, ValidationException

class ChatService:
    """Service for handling chat operations"""

    def __init__(self, db: Session):
        self.db = db

    async def get_chat_sessions(
        self,
        user_id: UUID,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None
    ) -> ChatSessionListResponse:
        """Get paginated list of chat sessions for a user"""
        query = self.db.query(ChatSession).filter(ChatSession.user_id == user_id)
        
        if status:
            query = query.filter(ChatSession.status == status)
            
        total = query.count()
        sessions = query.offset(skip).limit(limit).all()
        
        return ChatSessionListResponse(
            items=sessions,
            total=total,
            page=skip // limit + 1,
            pages=(total + limit - 1) // limit
        )

    async def get_chat_session(self, session_id: UUID) -> ChatSessionResponse:
        """Get a specific chat session by ID"""
        session = self.db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if not session:
            raise NotFoundException(f"Chat session with ID {session_id} not found")
        return session

    async def create_chat_session(
        self,
        user_id: UUID,
        session_data: ChatSessionCreate
    ) -> ChatSessionResponse:
        """Create a new chat session"""
        session = ChatSession(
            user_id=user_id,
            client_id=session_data.client_id,
            title=session_data.title,
            status=session_data.status
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    async def get_chat_messages(
        self,
        session_id: UUID,
        skip: int = 0,
        limit: int = 50
    ) -> List[ChatMessageResponse]:
        """Get paginated list of messages for a chat session"""
        messages = self.db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(
            ChatMessage.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        return messages

    async def create_chat_message(
        self,
        session_id: UUID,
        message_data: ChatMessageCreate,
        sender_id: Optional[UUID] = None
    ) -> ChatMessageResponse:
        """Create a new chat message"""
        # Verify session exists
        session = await self.get_chat_session(session_id)
        
        message = ChatMessage(
            session_id=session_id,
            sender_type=message_data.sender_type,
            sender_id=sender_id,
            content=message_data.content,
            message_type=message_data.message_type,
            metadata=message_data.metadata
        )
        
        self.db.add(message)
        
        # Update session's last_message_at
        session.last_message_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(message)
        return message

    async def mark_messages_read(
        self,
        session_id: UUID,
        user_id: UUID
    ) -> None:
        """Mark all messages in a session as read for a specific user"""
        # Update messages
        self.db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id,
            ChatMessage.sender_id != user_id,
            ChatMessage.is_read == False
        ).update({"is_read": True})
        
        # Update session
        self.db.query(ChatSession).filter(
            ChatSession.id == session_id
        ).update({"is_read": True})
        
        self.db.commit()

    async def close_chat_session(self, session_id: UUID) -> ChatSessionResponse:
        """Close a chat session"""
        session = await self.get_chat_session(session_id)
        session.status = "closed"
        session.closed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(session)
        return session 