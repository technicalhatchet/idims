import uuid
import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Request, HTTPException, status, Header
from pydantic import BaseModel
import logging
from app.core.auth import AuthHandler, get_auth_handler

router = APIRouter()
# Setup logger
logger = logging.getLogger(__name__)

class TokenDebugResponse(BaseModel):
    request_id: str
    is_authenticated: bool
    headers_received: Dict[str, str]
    token_info: Optional[Dict[str, Any]] = None
    user_info: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

@router.get("/auth-debug", response_model=TokenDebugResponse)
async def debug_auth_token(
    request: Request,
    auth_handler: AuthHandler = Depends(get_auth_handler)
):
    """
    Debug endpoint to verify JWT token processing
    """
    request_id = str(uuid.uuid4())
    logger.info(f"[REQUEST-{request_id}] Accessing auth debug endpoint")
    
    # Get all headers for debugging
    headers = dict(request.headers)
    safe_headers = {k: v if k.lower() != "authorization" else f"{v[:20]}..." for k, v in headers.items()}
    logger.info(f"[REQUEST-{request_id}] Headers received: {safe_headers}")
    
    # Extract auth header
    auth_header = headers.get('Authorization') or headers.get('authorization')
    
    response = TokenDebugResponse(
        request_id=request_id,
        is_authenticated=False,
        headers_received=safe_headers
    )
    
    if not auth_header:
        response.error_message = "No Authorization header found"
        logger.warning(f"[REQUEST-{request_id}] No Authorization header found")
        return response
    
    if not auth_header.startswith('Bearer '):
        response.error_message = "Authorization header does not start with 'Bearer '"
        logger.warning(f"[REQUEST-{request_id}] Invalid header format: {auth_header[:15]}...")
        return response
    
    token = auth_header.replace('Bearer ', '')
    
    try:
        # Verify the token
        token_data = await auth_handler.verify_token(token)
        user = None
        
        if token_data:
            # Sanitize token data for response
            token_dict = token_data.dict()
            # Don't include raw token in response
            response.token_info = {
                "sub": token_dict.get("sub"),
                "exp": token_dict.get("exp"),
                "iat": token_dict.get("iat"),
                "iss": token_dict.get("iss"),
                "roles": token_dict.get("roles", []),
                "permissions": token_dict.get("permissions", [])
            }
            
            # Get user from token
            user = await auth_handler.get_current_user(token)
            
            if user:
                response.is_authenticated = True
                response.user_info = {
                    "id": str(user.id) if hasattr(user, "id") else None,
                    "email": user.email,
                    "name": user.name if hasattr(user, "name") else None,
                    "roles": user.roles if hasattr(user, "roles") else []
                }
                logger.info(f"[REQUEST-{request_id}] Authentication successful for user: {user.email}")
            else:
                response.error_message = "Token verified but no user found"
                logger.warning(f"[REQUEST-{request_id}] Token verified but no user found")
        else:
            response.error_message = "Token verification failed"
            logger.warning(f"[REQUEST-{request_id}] Token verification failed")
            
    except Exception as e:
        response.error_message = f"Error verifying token: {str(e)}"
        logger.error(f"[REQUEST-{request_id}] Token verification error: {str(e)}")
    
    return response

@router.get("/headers-debug")
async def debug_headers(request: Request):
    """
    Debug endpoint to view all received headers
    """
    headers = dict(request.headers)
    
    # Filter out sensitive parts of headers
    safe_headers = {}
    for key, value in headers.items():
        if key.lower() == 'authorization':
            # Only show the first part of the token
            if value.startswith('Bearer '):
                token_part = value[7:20] + "..." if len(value) > 27 else value[7:]
                safe_headers[key] = f"Bearer {token_part}"
            else:
                safe_headers[key] = f"{value[:15]}..."
        else:
            safe_headers[key] = value
    
    logger.info(f"Headers debug endpoint accessed: {json.dumps(safe_headers)}")
    return {"headers": safe_headers} 