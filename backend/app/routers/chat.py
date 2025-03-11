from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Body, Path, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime
import json

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.config import settings

router = APIRouter()
auth_handler = AuthHandler()

# In a real app, this would be stored in a database or Redis
active_connections: Dict[str, Set[WebSocket]] = {}

@router.websocket("/chat/ws/{user_id}")
async def chat_websocket(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(...)
):
    """
    WebSocket endpoint for real-time chat.
    """
    # Authenticate user with token
    try:
        # Verify token and check if user_id matches
        token_data = auth_handler.verify_token(token)
        if token_data.sub != user_id:
            await websocket.close(code=1008, reason="Not authorized")
            return
        
        # Accept the connection
        await websocket.accept()
        
        # Add to active connections
        if user_id not in active_connections:
            active_connections[user_id] = set()
        active_connections[user_id].add(websocket)
        
        try:
            # Listen for messages
            while True:
                data = await websocket.receive_json()
                
                # Process the message
                await process_message(data, user_id)
                
        except WebSocketDisconnect:
            # Remove from active connections
            active_connections[user_id].remove(websocket)
            if len(active_connections[user_id]) == 0:
                del active_connections[user_id]
    except Exception as e:
        # Log the error
        print(f"WebSocket error: {str(e)}")
        if websocket in active_connections.get(user_id, set()):
            active_connections[user_id].remove(websocket)
            if len(active_connections[user_id]) == 0:
                del active_connections[user_id]

async def process_message(data: Dict[str, Any], sender_id: str):
    """Process an incoming chat message and dispatch it to recipients"""
    # Validate message format
    if "type" not in data or "content" not in data:
        return
    
    # Add sender and timestamp
    data["sender_id"] = sender_id
    data["timestamp"] = datetime.utcnow().isoformat()
    
    # Handle different message types
    if data["type"] == "direct":
        # Send to specific recipient
        if "recipient_id" not in data:
            return
        
        recipient_id = data["recipient_id"]
        await send_to_user(recipient_id, data)
        
        # Also send back to sender for confirmation
        await send_to_user(sender_id, data)
    
    elif data["type"] == "group":
        # Send to all members of a group
        if "group_id" not in data:
            return
        
        # In a real app, fetch group members from database
        group_members = ["user1", "user2", "user3"]  # Example
        
        for member_id in group_members:
            await send_to_user(member_id, data)

async def send_to_user(user_id: str, data: Dict[str, Any]):
    """Send a message to a specific user via all their active connections"""
    if user_id not in active_connections:
        return
    
    # Convert data to JSON string
    message_json = json.dumps(data)
    
    # Send to all connections for this user
    for connection in active_connections[user_id].copy():
        try:
            await connection.send_text(message_json)
        except Exception:
            # Remove dead connections
            active_connections[user_id].remove(connection)

@router.get("/chat/history/{conversation_id}")
async def get_chat_history(
    conversation_id: str = Path(..., description="ID of the conversation"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of messages to return"),
    before: Optional[str] = Query(None, description="ISO timestamp to get messages before"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get chat history for a specific conversation.
    """
    # In a real app, you would validate that the user has access to this conversation
    # and fetch messages from a database
    
    # Example placeholder response
    return {
        "conversation_id": conversation_id,
        "messages": [
            {
                "id": "msg1",
                "type": "direct",
                "content": "Hello, this is a sample message",
                "sender_id": "user1",
                "timestamp": "2023-01-01T12:00:00Z"
            }
        ],
        "has_more": False
    }

@router.get("/chat/conversations")
async def list_conversations(
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all conversations for the current user.
    """
    # In a real app, you would fetch conversations from a database
    
    # Example placeholder response
    return {
        "conversations": [
            {
                "id": "conv1",
                "type": "direct",
                "other_user": {
                    "id": "user2",
                    "name": "John Doe"
                },
                "last_message": {
                    "content": "Hello there",
                    "timestamp": "2023-01-01T12:00:00Z",
                    "sender_id": "user2"
                },
                "unread_count": 0
            }
        ]
    }

@router.post("/chat/send")
async def send_message(
    message: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a chat message via REST API (alternative to WebSocket).
    """
    # Add sender ID and timestamp
    message["sender_id"] = str(current_user.id)
    message["timestamp"] = datetime.utcnow().isoformat()
    
    # In a real app, you would save the message to a database
    # and dispatch it via WebSockets if recipients are online
    
    return {
        "success": True,
        "message_id": str(uuid.uuid4()),
        "timestamp": message["timestamp"]
    }

@router.post("/chat/mark-read")
async def mark_messages_read(
    data: Dict[str, Any] = Body(...),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark messages as read.
    """
    # Validate required fields
    if "conversation_id" not in data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="conversation_id is required")
    
    # In a real app, you would update the read status in the database
    
    return {"success": True}

@router.get("/chat/unread-count")
async def get_unread_count(
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the count of unread messages for the current user.
    """
    # In a real app, you would calculate this from the database
    
    return {"unread_count": 0}