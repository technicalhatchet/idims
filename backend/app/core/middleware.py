import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from fastapi import status, FastAPI
import traceback
import json
from app.core.exceptions import ServiceBusinessException
from app.config import settings
import uuid
from starlette.types import ASGIApp
from typing import Optional, Dict, Any
import os

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging requests and responses"""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.log_request_body = False

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        start_time = time.time()
        
        # Log request
        logger.info(f"Request {request_id} started: {request.method} {request.url}")
        
        # Log headers
        headers = dict(request.headers)
        logger.debug(f"Request {request_id} headers: {json.dumps(headers)}")
        
        try:
            response = await call_next(request)
            
            # Log response
            process_time = time.time() - start_time
            logger.info(
                f"Request {request_id} completed: {request.method} {request.url} "
                f"- Status: {response.status_code} - Time: {process_time:.4f}s"
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            logger.exception(f"Request {request_id} failed: {str(e)}")
            raise

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for handling exceptions"""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.exception(f"Unhandled error in request {getattr(request.state, 'request_id', 'unknown')}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": str(e),
                    "request_id": getattr(request.state, "request_id", None)
                }
            )

class RateLimitingMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting requests"""
    
    def __init__(self, app: ASGIApp, redis_client: Optional[Any] = None):
        super().__init__(app)
        self.redis_client = redis_client

    async def dispatch(self, request: Request, call_next) -> Response:
        if not self.redis_client:
            # If Redis is not available, skip rate limiting
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host
        path = request.url.path

        # Skip rate limiting for excluded paths
        if any(path.startswith(excluded) for excluded in ["/docs", "/redoc", "/openapi.json"]):
            return await call_next(request)

        # Create rate limit key
        rate_key = f"rate_limit:{client_ip}:{path}"

        try:
            # Get current request count
            requests = await self.redis_client.get(rate_key)
            requests = int(requests) if requests else 0

            # Check if rate limit exceeded
            if requests >= 100:  # 100 requests per minute
                logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
                return Response(
                    content=json.dumps({"detail": "Rate limit exceeded"}),
                    status_code=429,
                    media_type="application/json"
                )

            # Increment request count
            pipe = self.redis_client.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, 60)  # 1 minute window
            await pipe.execute()

            response = await call_next(request)
            
            # Add rate limit headers
            remaining = 100 - (requests + 1)
            response.headers["X-RateLimit-Limit"] = "100"
            response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
            response.headers["X-RateLimit-Reset"] = "60"
            
            return response

        except Exception as e:
            logger.error(f"Rate limiting error: {str(e)}")
            # If rate limiting fails, allow the request
            return await call_next(request)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware for adding security headers to responses"""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Use a more permissive Content-Security-Policy in development
        if os.environ.get("ENVIRONMENT", "development").lower() == "development":
            # In development, use a policy that allows communication with the frontend
            response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        else:
            # More restrictive policy for production
            response.headers["Content-Security-Policy"] = "default-src 'self'; connect-src 'self' https://*.auth0.com"
        
        return response