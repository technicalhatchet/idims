from fastapi import FastAPI, Depends, HTTPException, Security, Request, BackgroundTasks
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

# Local imports
from app.config import settings
from app.db.database import engine, get_db
from app.core.auth import AuthHandler
from app.core.logger import setup_logging
from app.routers import (
    auth, clients, work_orders, scheduling, invoices, payments,
    #inventory,
    quotes, technicians, notifications, reports,
    media, mobile, admin, chat
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

# Initialize Redis for caching and rate limiting
redis_client = None
if settings.REDIS_URL:
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        logger.info("Redis client initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Redis: {str(e)}")

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
    ]
)

# Add middlewares in correct order
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if redis_client:
    app.add_middleware(RateLimitingMiddleware, redis_client=redis_client)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Authentication handler
auth_handler = AuthHandler()
security = HTTPBearer()

# Setup background tasks
background_tasks = setup_background_tasks()

# Middleware to set current user ID in PostgreSQL session
@app.middleware("http")
async def set_current_user_in_db(request: Request, call_next):
    """Set the current user ID in PostgreSQL session for audit logging"""
    # Extract token from request if present
    authorization = request.headers.get("Authorization")
    user_id = None
    
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        try:
            # Verify token and extract user ID
            token_data = auth_handler.verify_token(token)
            user_id = token_data.sub
        except Exception:
            pass
    
    response = await call_next(request)
    
    # If user ID was found, we could use it for audit logging
    # This would be implemented in the database functions
    
    return response

# Root endpoint
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring"""
    status = {
        "status": "ok",
        "version": settings.API_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "ok",
        "redis": "ok" if redis_client else "not_configured",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Check database connection
    try:
        db = next(get_db())
        db.execute("SELECT 1")
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        status["database"] = "error"
        status["status"] = "degraded"
    
    # Check Redis connection
    if redis_client:
        try:
            await redis_client.ping()
        except Exception as e:
            logger.error(f"Redis health check failed: {str(e)}")
            status["redis"] = "error"
            status["status"] = "degraded"
    
    return status

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

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom handler for HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": getattr(request.state, "request_id", None)},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unexpected errors"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": getattr(request.state, "request_id", None)
        },
    )

# Serve static files in development
if settings.ENVIRONMENT != "production":
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Shutdown event handlers
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("Application shutting down")
    
    # Close Redis connection if exists
    if redis_client:
        await redis_client.close()
        logger.info("Redis connection closed")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT != "production",
        workers=settings.WORKERS,
    )