from fastapi import FastAPI, Depends, HTTPException, Security, Request, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sqlalchemy
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import uvicorn
import os
import logging
from datetime import datetime, timedelta
import json
from typing import List, Optional, Dict, Any
import redis.asyncio as redis
import uuid

# Local imports
from app.config import settings
from app.db.database import engine, get_db
from app.core.auth import get_auth_handler
from app.core.logger import setup_logging
from app.routers import (
    auth, clients, work_orders, scheduling, invoices, payments,
    #inventory,
    quotes, technicians, notifications, reports,
    media, mobile, admin, chat, dashboard
)
from app.core.middleware import (
    RequestLoggingMiddleware, 
    ErrorHandlingMiddleware,
    RateLimitingMiddleware,
    SecurityHeadersMiddleware
)
from app.services.notification_service import NotificationService
from app.background.worker import setup_background_tasks

# Setup logging
logger = setup_logging()

# Initialize Redis client
redis_client = None
if settings.REDIS_HOST and settings.REDIS_PORT:
    try:
        redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}"
        if settings.REDIS_PASSWORD:
            redis_url = f"redis://:{settings.REDIS_PASSWORD}@{settings.REDIS_HOST}:{settings.REDIS_PORT}"
        if settings.REDIS_DB:
            redis_url += f"/{settings.REDIS_DB}"
            
        redis_client = redis.from_url(redis_url)
        logger.info("Redis client initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize Redis client: {e}. Rate limiting will be disabled.")

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="API for service business management",
    version=settings.API_VERSION,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_tags=[
        {"name": "Authentication", "description": "Operations with authentication"},
        {"name": "Clients", "description": "Operations with clients"},
        {"name": "Work Orders", "description": "Operations with work orders"},
        {"name": "Scheduling", "description": "Operations for scheduling"},
        {"name": "Invoices", "description": "Operations with invoices"},
        {"name": "Payments", "description": "Operations with payments"},
        #{"name": "Inventory", "description": "Operations with inventory"},
        {"name": "Quotes", "description": "Operations with quotes"},
        {"name": "Technicians", "description": "Operations with technicians"},
        {"name": "Notifications", "description": "Operations with notifications"},
        {"name": "Reports", "description": "Operations for generating reports"},
        {"name": "Media", "description": "Operations with media files"},
        {"name": "Mobile", "description": "Mobile-specific operations"},
        {"name": "Admin", "description": "Administrative operations"},
        {"name": "Chat", "description": "Chat and AI assistant operations"},
        {"name": "Health", "description": "Health check endpoints"},
        {"name": "Dashboard", "description": "Dashboard statistics and metrics"},
    ]
)

# Validate Auth0 configuration
if not settings.AUTH0_DOMAIN:
    logger.error("AUTH0_DOMAIN is not configured")
    raise ValueError("AUTH0_DOMAIN is not configured")

if not settings.AUTH0_API_AUDIENCE:
    logger.error("AUTH0_API_AUDIENCE is not configured")
    raise ValueError("AUTH0_API_AUDIENCE is not configured")

# Initialize auth handler to validate configuration
auth_handler = get_auth_handler()
logger.info(f"Auth0 configuration loaded - Domain: {settings.AUTH0_DOMAIN}, Audience: {settings.AUTH0_API_AUDIENCE}")

# Add middlewares in correct order
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite default port
        "http://127.0.0.1:5173",
        f"https://{settings.AUTH0_DOMAIN}",
        # Add production domains if needed
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # 24 hours for preflight cache
)

# Add request logging middleware to see incoming headers
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Generate a request ID
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Log the request details
    auth_header = request.headers.get('Authorization')
    origin_header = request.headers.get('Origin')
    referer_header = request.headers.get('Referer')
    user_agent = request.headers.get('User-Agent', 'Unknown')
    content_type = request.headers.get('Content-Type', 'Not specified')
    request_path = request.url.path
    
    # Log basic request info
    logger.info(f"[REQUEST-{request_id}] {request.method} {request_path} - Started")
    logger.info(f"[REQUEST-{request_id}] Origin: {origin_header}")
    logger.info(f"[REQUEST-{request_id}] Referer: {referer_header}")
    logger.info(f"[REQUEST-{request_id}] Content-Type: {content_type}")
    logger.info(f"[REQUEST-{request_id}] User-Agent: {user_agent}")
    
    # Enhanced auth header logging
    if auth_header:
        # Only log the first few characters for security
        auth_prefix = auth_header[:15] if len(auth_header) > 15 else auth_header
        logger.info(f"[REQUEST-{request_id}] Auth header: {auth_prefix}...")
        logger.info(f"[REQUEST-{request_id}] Auth header length: {len(auth_header)}")
        
        # Check if it's bearer token format
        if auth_header.lower().startswith('bearer '):
            logger.info(f"[REQUEST-{request_id}] Auth header has correct Bearer prefix")
            token_part = auth_header[7:]  # Skip 'Bearer '
            logger.info(f"[REQUEST-{request_id}] Token length: {len(token_part)}")
            logger.info(f"[REQUEST-{request_id}] Token prefix: {token_part[:10]}...")
        else:
            logger.warning(f"[REQUEST-{request_id}] Auth header does not start with 'Bearer '")
    else:
        logger.warning(f"[REQUEST-{request_id}] No Authorization header found")
    
    # Log all headers for debugging (redact sensitive info)
    all_headers = {k: v if k.lower() not in ('authorization', 'cookie') else f"{v[:10]}..." 
                  for k, v in request.headers.items()}
    logger.debug(f"[REQUEST-{request_id}] All request headers: {all_headers}")
    
    # Log query params if present
    if request.query_params:
        logger.info(f"[REQUEST-{request_id}] Query params: {dict(request.query_params)}")
    
    # Log route path
    if request_path.startswith('/api/work-orders'):
        logger.info(f"[REQUEST-{request_id}] Work Orders endpoint called - checking auth setup")
    elif request_path.startswith('/api/dashboard'):
        logger.info(f"[REQUEST-{request_id}] Dashboard endpoint called - has optional auth")
    
    try:
        # Process the request
        start_time = datetime.utcnow()
        response = await call_next(request)
        process_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Log the response status
        logger.info(f"[REQUEST-{request_id}] Completed: {request.method} {request_path} - Status: {response.status_code} - Time: {process_time:.2f}ms")
        
        # Additional logging for authentication errors
        if response.status_code == 401:
            logger.warning(f"[REQUEST-{request_id}] Authentication failed - 401 Unauthorized response returned")
            
        # Add CORS headers to all responses
        origin = request.headers.get('Origin')
        # If the origin is known, use it; otherwise, don't add the header (don't use wildcard with credentials)
        if origin and origin in [
            "http://localhost:3000", 
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ]:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response.headers['Access-Control-Allow-Headers'] = '*'
        
        return response
    except Exception as e:
        logger.error(f"[REQUEST-{request_id}] Failed: {str(e)}", exc_info=True)
        raise

# Add other middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Temporarily disable rate limiting
# if redis_client:
#     app.add_middleware(RateLimitingMiddleware, redis_client=redis_client)

# Mount static files
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.API_VERSION
    }

# Include all routers
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(clients.router, prefix="/api", tags=["Clients"])
app.include_router(work_orders.router, prefix="/api", tags=["Work Orders"])
app.include_router(scheduling.router, prefix="/api", tags=["Scheduling"])
app.include_router(invoices.router, prefix="/api", tags=["Invoices"])
app.include_router(payments.router, prefix="/api", tags=["Payments"])
#app.include_router(inventory.router, prefix="/api", tags=["Inventory"])
app.include_router(quotes.router, prefix="/api", tags=["Quotes"])
app.include_router(technicians.router, prefix="/api", tags=["Technicians"])
app.include_router(notifications.router, prefix="/api", tags=["Notifications"])
app.include_router(reports.router, prefix="/api", tags=["Reports"])
app.include_router(media.router, prefix="/api", tags=["Media"])
app.include_router(mobile.router, prefix="/api", tags=["Mobile"])
app.include_router(admin.router, prefix="/api", tags=["Admin"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom handler for HTTP exceptions"""
    headers = getattr(exc, "headers", {}) or {}
    
    # Get origin header
    origin = request.headers.get('Origin')
    # If the origin is known, use it; otherwise, don't add the header (don't use wildcard with credentials)
    if origin and origin in [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]:
        # Ensure CORS headers are included
        headers.update({
            "Access-Control-Allow-Origin": origin, 
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
        })
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "request_id": getattr(request.state, "request_id", None)
        },
        headers=headers
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """General exception handler"""
    logger.exception("Unhandled exception")
    
    # Get origin header
    origin = request.headers.get('Origin')
    # If the origin is known, use it; otherwise, don't add the header (don't use wildcard with credentials)
    headers = {}
    if origin and origin in [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]:
        # Ensure CORS headers are included for all exceptions
        headers = {
            "Access-Control-Allow-Origin": origin, 
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
        }
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc),
            "request_id": getattr(request.state, "request_id", None)
        },
        headers=headers
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS
    )