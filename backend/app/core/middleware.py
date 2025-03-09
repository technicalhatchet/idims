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

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging requests and responses"""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        
        # Add request ID to request state
        request.state.request_id = request_id
        
        start_time = time.time()
        
        # Get client IP
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        # Get request body for debugging if needed
        request_body = None
        if settings.LOG_REQUEST_BODY and request.method in ["POST", "PUT", "PATCH"]:
            try:
                body_bytes = await request.body()
                if body_bytes:
                    # Store body bytes for later use
                    request_body = body_bytes.decode()
                    # Create a new request with the same body
                    await request._receive()
            except Exception as e:
                logger.warning(f"Failed to read request body: {str(e)}")
        
        # Log request
        logger.info(
            f"Request {request_id}: {request.method} {request.url.path} "
            f"from {client_ip} - {request.headers.get('User-Agent', 'unknown')}"
        )
        
        if request_body and not any(secret in request_body.lower() for secret in ['password', 'token', 'secret', 'key']):
            logger.debug(f"Request {request_id} body: {request_body}")
        
        # Process request
        try:
            response = await call_next(request)
            
            # Log response time and status
            process_time = time.time() - start_time
            status_code = response.status_code
            logger.info(
                f"Response {request_id}: {request.method} {request.url.path} "
                f"completed in {process_time:.4f}s with status {status_code}"
            )
            
            # Add custom headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"Error {request_id}: {request.method} {request.url.path} "
                f"failed in {process_time:.4f}s with error: {str(e)}"
            )
            logger.error(traceback.format_exc())
            
            # Determine if this is a known application exception
            if isinstance(e, ServiceBusinessException):
                return JSONResponse(
                    status_code=e.status_code,
                    content={"detail": e.detail, "request_id": request_id}
                )
            
            # Return generic error for unexpected exceptions
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "Internal server error",
                    "request_id": request_id
                }
            )

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for handling exceptions"""
    
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except ServiceBusinessException as e:
            # These are expected application exceptions
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail}
            )
        except Exception as e:
            logger.error(f"Unhandled exception: {str(e)}")
            logger.error(traceback.format_exc())
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Internal server error"}
            )

class RateLimitingMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting requests"""
    
    def __init__(self, app: FastAPI, redis_client=None):
        super().__init__(app)
        self.redis_client = redis_client
        
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for certain paths
        if request.url.path in settings.RATE_LIMIT_EXCLUDE_PATHS:
            return await call_next(request)
        
        # Get client IP
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        # Check if Redis is available for rate limiting
        if self.redis_client:
            # Rate limit key includes IP and endpoint path
            rate_key = f"ratelimit:{client_ip}:{request.url.path}"
            
            # Get current request count
            current = await self.redis_client.get(rate_key)
            
            if current is not None and int(current) > settings.RATE_LIMIT_MAX_REQUESTS:
                logger.warning(f"Rate limit exceeded for {client_ip} on {request.url.path}")
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Please try again later."}
                )
            
            # Increment request count
            pipe = self.redis_client.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, settings.RATE_LIMIT_WINDOW)
            await pipe.execute()
        
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = settings.RATE_LIMIT_MAX_REQUESTS - int(current or 0) if self.redis_client else "N/A"
        response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_MAX_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(settings.RATE_LIMIT_WINDOW)
        
        return response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware for adding security headers to responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy (CSP)
        if settings.ENVIRONMENT == "production":
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' https://cdn.jsdelivr.net; "
                "style-src 'self' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data:; "
                "connect-src 'self'"
            )
        
        return response