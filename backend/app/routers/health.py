from fastapi import APIRouter, Request, Depends, Header
from typing import Optional
import logging
import uuid

from app.core.auth import get_auth_handler

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/health")
async def health_check():
    """Health check endpoint that doesn't require authentication"""
    return {"status": "ok", "service": "idims-backend"}

@router.get("/health-auth")
async def health_check_auth(request: Request, authorization: Optional[str] = Header(None)):
    """Health check that includes authentication status"""
    request_id = str(uuid.uuid4())
    logger.info(f"[REQUEST-{request_id}] Health check with auth requested")
    
    # Log the authorization header (safely)
    auth_header = authorization or request.headers.get("Authorization") or request.headers.get("authorization")
    auth_status = "present" if auth_header else "missing"
    
    # Get all headers for debugging
    headers = dict(request.headers)
    safe_headers = {k: v if k.lower() != "authorization" else f"{v[:15]}..." for k, v in headers.items()}
    
    result = {
        "status": "ok",
        "service": "idims-backend",
        "request_id": request_id,
        "auth_header_status": auth_status,
        "headers": safe_headers
    }
    
    # Try to get user info if token is present
    if auth_header:
        try:
            auth_handler = get_auth_handler()
            
            # Extract token from header
            token = None
            if auth_header.startswith("Bearer "):
                token = auth_header.split(None, 1)[1]
            else:
                token = auth_header
                
            if token:
                try:
                    # Verify token
                    token_data = await auth_handler.verify_token(token)
                    result["token_verified"] = True
                    result["token_subject"] = token_data.sub
                    result["token_email"] = token_data.email if hasattr(token_data, "email") else None
                    result["token_scopes"] = token_data.scopes if hasattr(token_data, "scopes") else []
                except Exception as e:
                    result["token_verified"] = False
                    result["token_error"] = str(e)
        except Exception as e:
            result["auth_error"] = str(e)
    
    logger.info(f"[REQUEST-{request_id}] Health check with auth completed: {auth_status}")
    return result 