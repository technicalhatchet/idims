from fastapi import FastAPI, Depends, HTTPException, Security, Request, BackgroundTasks, status, Header, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sqlalchemy
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import uvicorn
import os
import re
import logging
from datetime import datetime, timedelta
import json
from typing import List, Optional, Dict, Any
import redis.asyncio as redis
import uuid
from sqlalchemy.orm import Session
from pydantic import BaseModel, ValidationError

# Local imports
from app.config import settings
from app.db.database import engine, get_db
from app.core.auth import get_auth_handler
from app.core.logger import setup_logging
from app.routers import (
    auth, clients, work_orders, scheduling, calendar_blocks, invoices, payments,
    inventory,
    quotes, technicians, notifications, reports, public,
    media, mobile, admin, chat, dashboard, properties, app_settings,
    health, users, debug, services, skills, stripe, distance, dma, job_economics, push, diagnostics, logit
)
from app.core.middleware import (
    RequestLoggingMiddleware, 
    ErrorHandlingMiddleware,
    RateLimitingMiddleware,
    SecurityHeadersMiddleware
)
from app.services.notification_service import NotificationService
from app.background.worker import setup_background_tasks
from app.services.user_service import UserService
from app.schemas.work_order import WorkOrderUpdate, WorkOrderCreate, WorkOrderResponse
from app.core.dependencies import get_current_user as deps_get_current_user, get_admin_or_manager_user
from app.utils.travel_calculator import get_travel_time_and_distance

# Setup logging
logger = setup_logging()

# Define security for OAuth2 with Bearer
security = HTTPBearer()

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
    #redirect_slashes=False,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_tags=[
        {"name": "Authentication", "description": "Operations with authentication"},
        {"name": "Clients", "description": "Operations with clients"},
        {"name": "Work Orders", "description": "Operations with work orders"},
        {"name": "Scheduling", "description": "Operations for scheduling"},
        {"name": "Invoices", "description": "Operations with invoices"},
        {"name": "Payments", "description": "Operations with payments"},
        {"name": "Inventory", "description": "Shop and van stock"},
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
        {"name": "Services", "description": "Operations with services"},
        {"name": "Skills", "description": "Operations with technician skills"},
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

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
    f"https://{settings.AUTH0_DOMAIN}",
    "https://v0-idims.vercel.app",
    "https://dma-eight.vercel.app",
]

_frontend_origin = (settings.FRONTEND_URL or "").strip().rstrip("/")
if _frontend_origin and _frontend_origin not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(_frontend_origin)

_extra_origins = os.getenv("CORS_EXTRA_ORIGINS", "")
for _part in _extra_origins.split(","):
    _origin = _part.strip().rstrip("/")
    if _origin and _origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(_origin)

# Solomon / preview Vercel deployments (e.g. dma-eight.vercel.app)
CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"
_VERCEL_ORIGIN_RE = re.compile(r"^https://([a-z0-9-]+\.)*vercel\.app$", re.I)


def _origin_is_allowed(origin: Optional[str]) -> bool:
    if not origin:
        return False
    normalized = origin.strip().rstrip("/")
    if normalized in CORS_ALLOWED_ORIGINS:
        return True
    return _VERCEL_ORIGIN_RE.match(normalized) is not None


def cors_headers_for_request(request: Request) -> Dict[str, str]:
    origin = request.headers.get("Origin")
    if _origin_is_allowed(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


# Add middlewares in correct order
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],  # Using wildcard to allow all headers including Authorization
    expose_headers=["*"],  # Using wildcard to expose all headers
    max_age=86400,  # 24 hours for preflight cache
)


@app.get("/")
async def root():
    """So http://127.0.0.1:8000/ returns something useful (API has no HTML shell)."""
    return {
        "service": settings.APP_NAME,
        "status": "running",
        "docs": "/api/docs",
        "health": "/api/health/health",
    }


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    request_path = request.url.path
    verbose = settings.DEBUG

    if verbose:
        auth_header = request.headers.get('Authorization') or request.headers.get('authorization')
        auth_header_log = auth_header[:15] + "..." if auth_header else "Not found"
        logger.info(f"[REQUEST-{request_id}] {request.method} {request_path} - Started")
        logger.info(f"[REQUEST-{request_id}] Origin: {request.headers.get('Origin')}")
        logger.info(f"[REQUEST-{request_id}] Referer: {request.headers.get('Referer')}")
        logger.info(f"[REQUEST-{request_id}] Auth header: {auth_header_log}")
    else:
        logger.debug(f"[REQUEST-{request_id}] {request.method} {request_path}")

    try:
        start_time = datetime.utcnow()
        response = await call_next(request)
        process_time = (datetime.utcnow() - start_time).total_seconds() * 1000

        log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
        if verbose or response.status_code >= 400 or process_time > 2000:
            logger.log(
                log_level,
                f"[REQUEST-{request_id}] {request.method} {request_path} - "
                f"Status: {response.status_code} - Time: {process_time:.2f}ms",
            )

        return response
    except Exception as e:
        logger.error(f"[REQUEST-{request_id}] Failed: {str(e)}", exc_info=True)
        raise

# Add other middlewares
app.add_middleware(SecurityHeadersMiddleware)
# app.add_middleware(ErrorHandlingMiddleware) # Commented out
app.add_middleware(RequestLoggingMiddleware)

# Temporarily disable rate limiting
# if redis_client:
#     app.add_middleware(RateLimitingMiddleware, redis_client=redis_client)

# Mount static files (parts logos, etc.)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Health check endpoint at root level
@app.get("/health")
@app.post("/health")
@app.put("/health")
@app.options("/health")
async def direct_health_check():
    """Direct health check endpoint without using router"""
    return {
        "status": "ok",
        "service": "idims-backend"
    }

# Health check endpoint with /api prefix
@app.get("/api/health")
@app.post("/api/health")
@app.put("/api/health")
@app.options("/api/health")
async def api_health_check():
    """Direct health check endpoint with /api prefix"""
    return {
        "status": "ok",
        "service": "idims-backend"
    }

# Health check endpoint with /api prefix (direct)
@app.get("/api/health-direct")
@app.options("/api/health-direct")
async def api_direct_health_check():
    """Direct health check endpoint with /api prefix"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.API_VERSION,
        "path": "/api/health-direct"
    }

# Test route accessible both with and without /api prefix
@app.get("/test-route")
@app.post("/test-route")
@app.put("/test-route")
@app.options("/test-route")
async def test_route():
    """Test route to check routing configuration"""
    return {
        "status": "ok",
        "message": "Test route working",
        "path": "/test-route",
        "timestamp": datetime.utcnow().isoformat()
    }
    
@app.get("/api/test-route")
@app.post("/api/test-route")
@app.put("/api/test-route")
@app.options("/api/test-route")
async def api_test_route():
    """Test route with /api prefix to check routing configuration"""
    return {
        "status": "ok",
        "message": "API test route working",
        "path": "/api/test-route",
        "timestamp": datetime.utcnow().isoformat()
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom handler for HTTP exceptions"""
    headers = {**(getattr(exc, "headers", {}) or {}), **cors_headers_for_request(request)}

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

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc),
            "request_id": getattr(request.state, "request_id", None)
        },
        headers=cors_headers_for_request(request),
    )

# Direct access to key endpoints
@app.get("/auth-debug")
@app.options("/auth-debug")
async def direct_auth_debug(request: Request, authorization: Optional[str] = Header(None)):
    """Direct auth debug endpoint"""
    # If this is an OPTIONS request, return an empty response (CORS middleware will add headers)
    if request.method == "OPTIONS":
        return {}
        
    request_id = str(uuid.uuid4())
    
    # Log all headers
    headers = dict(request.headers)
    safe_headers = {k: v if k.lower() != "authorization" else f"{v[:15]}..." for k, v in headers.items()}
    
    # Get auth header
    auth_header = authorization or headers.get("Authorization") or headers.get("authorization")
    
    result = {
        "request_id": request_id,
        "is_authenticated": False,
        "headers_received": safe_headers
    }
    
    # Try to verify token if present
    if auth_header:
        try:
            auth_handler = get_auth_handler()
            
            # Extract token
            token = None
            if auth_header.startswith("Bearer "):
                token = auth_header.split(None, 1)[1]
            else:
                token = auth_header
                
            if token:
                try:
                    # Verify token
                    token_data = await auth_handler.verify_token(token)
                    result["is_authenticated"] = True
                    result["user_info"] = {
                        "id": token_data.sub,
                        "email": token_data.email if hasattr(token_data, "email") else None,
                        "name": token_data.name if hasattr(token_data, "name") else None,
                    }
                except Exception as e:
                    result["error_message"] = f"Error verifying token: {str(e)}"
            else:
                result["error_message"] = "No token found in Authorization header"
        except Exception as e:
            result["error_message"] = f"Authentication error: {str(e)}"
    
    return result

# Direct work order list endpoint
@app.get("/work-orders")
@app.post("/work-orders")
@app.options("/work-orders")
async def direct_work_orders(
    request: Request,
    authorization: Optional[str] = Header(None),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    client_id: Optional[str] = None,
    technician_id: Optional[str] = None,
    page: int = 1,
    limit: int = 10
):
    """
    This is a legacy direct endpoint handler that was using mock data.
    It is now disabled in favor of the router implementation that uses the database.
    """
    # Redirect to the router implementation
    query_params = request.query_params
    query_string = str(query_params) if query_params else ""
    return RedirectResponse(url=f"/api/work-orders?{query_string}")

@app.get("/api/work-orders")
@app.post("/api/work-orders")
@app.options("/api/work-orders")
async def api_work_orders(
    request: Request,
    authorization: Optional[str] = Header(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    client_id: Optional[str] = None,
    technician_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    List work orders, compatible with the new router setup.
    This endpoint acts as a proxy to the new router structure,
    ensuring that authentication and other logic is handled consistently.

    POST must create a work order; previously this handler only listed and returned
    a paginated payload for every method, which broke the create flow.
    """
    request_id = str(uuid.uuid4()) # Use a new request_id for this context

    if request.method == "POST":
        logger.info(f"[REQUEST-{request_id}] Forwarding POST /api/work-orders to work_orders.create_work_order")
        try:
            body = await request.json()
            wo_create = WorkOrderCreate(**body)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors(),
            )
        except Exception as e:
            logger.error(f"[REQUEST-{request_id}] Invalid JSON or body for POST /api/work-orders: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid request body",
            )

        try:
            current_user = await deps_get_current_user(request, authorization, db=db)
            admin_user = await get_admin_or_manager_user(current_user=current_user)
            created = await work_orders.create_work_order(
                work_order=wo_create,
                db=db,
                current_user=admin_user,
            )
            payload = jsonable_encoder(WorkOrderResponse.model_validate(created))
            return JSONResponse(content=payload, status_code=status.HTTP_201_CREATED)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[REQUEST-{request_id}] Error creating work order via POST /api/work-orders: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating work order: {str(e)}",
            )

    logger.info(f"[REQUEST-{request_id}] Forwarding GET /api/work-orders to new router with query params: {{'page': {page}, 'limit': {limit}, 'status': '{status_filter}'}}")

    try:
        # Simulate a request object that the router expects
        # We need to ensure current_user is correctly obtained and passed.
        # The `get_current_user` dependency will handle token verification from the `authorization` header.
        # This part is tricky because `get_current_user` is a dependency usually resolved by FastAPI.
        # We'll call it manually after extracting the token.

        token = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
        
        if not token:
            logger.warning(f"[REQUEST-{request_id}] No valid token found in Authorization header for /api/work-orders")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        # Manually invoke get_current_user (this is a simplified approach)
        # In a real scenario, you might need to handle `HTTPException` from `auth_handler.verify_token`
        try:
            current_user = await auth_handler.get_current_user(db=db, token=token)
        except HTTPException as e:
            logger.error(f"[REQUEST-{request_id}] Authentication error in /api/work-orders proxy: {e.detail}")
            raise e # Re-raise the HTTPException from auth_handler

        # Call the new router function directly
        # Ensure all parameters expected by the router are passed
        response_data = await work_orders.list_work_orders(
            request=request, # Pass the original request
            status_filter=status_filter,
            client_id=client_id,
            technician_id=technician_id,
            start_date=start_date,
            end_date=end_date,
            page=page,
            limit=limit,
            db=db,
            current_user=current_user # Pass the authenticated user
        )

        # The `response_data` is now a WorkOrderListResponse Pydantic model.
        # Access its attributes directly.
        logger.info(f"[REQUEST-{request_id}] Successfully retrieved data from new work orders router. Total items: {response_data.total}")
        
        # Ensure the response is JSON serializable (Pydantic models are by default)
        return JSONResponse(
            content={
                "total": response_data.total,
                "page": response_data.page,
                "pages": response_data.pages,
                "items": [jsonable_encoder(item) for item in response_data.items] # Use jsonable_encoder for each item
            },
            status_code=status.HTTP_200_OK
        )

    except HTTPException as e:
        logger.error(f"[REQUEST-{request_id}] HTTPException in /api/work-orders: {e.detail}", exc_info=True)
        raise e  # Re-raise HTTPExceptions
        
    except Exception as e:
        logger.error(f"[REQUEST-{request_id}] Error proxying to work_orders.list_work_orders: {str(e)}", exc_info=True)
        # Log the full traceback for detailed debugging
        # logger.exception(f"[REQUEST-{request_id}] Full traceback for error in /api/work-orders:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while fetching work orders: {str(e)}"
        )

# Direct work orders with ID must be defined BEFORE including routers
@app.get("/work-orders/{work_order_id}")
@app.put("/work-orders/{work_order_id}")
@app.delete("/work-orders/{work_order_id}")
@app.options("/work-orders/{work_order_id}")
async def direct_work_order_detail(work_order_id: str, request: Request, authorization: Optional[str] = Header(None)):
    """
    This is a legacy direct endpoint handler that was using mock data.
    It is now disabled in favor of the router implementation that uses the database.
    """
    # Redirect to the API endpoint
    return RedirectResponse(url=f"/api/work-orders/{work_order_id}")

# PDF endpoints — must be BEFORE the broad /{work_order_id} catch-all
@app.get("/api/work-orders/{work_order_id}/estimate.pdf")
async def api_work_order_estimate_pdf(
    work_order_id: str,
    request: Request,
    variant: str = Query("light", pattern="^(dark|light)$"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    from app.core.dependencies import get_current_user
    auth = authorization or request.headers.get('Authorization') or request.headers.get('authorization')
    current_user = await get_current_user(request, auth, db=db)
    return await work_orders.get_work_order_estimate_pdf(
        work_order_id=uuid.UUID(work_order_id), variant=variant, db=db, current_user=current_user
    )

@app.get("/api/work-orders/{work_order_id}/invoice.pdf")
async def api_work_order_invoice_pdf(
    work_order_id: str,
    request: Request,
    variant: str = Query("light", pattern="^(dark|light)$"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    from app.core.dependencies import get_current_user
    auth = authorization or request.headers.get('Authorization') or request.headers.get('authorization')
    current_user = await get_current_user(request, auth, db=db)
    return await work_orders.get_work_order_invoice_pdf(
        work_order_id=uuid.UUID(work_order_id), variant=variant, db=db, current_user=current_user
    )


@app.get("/api/work-orders/square-payment-config")
async def api_work_order_square_payment_config(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Must be registered before /api/work-orders/{work_order_id} catch-all."""
    from app.core.dependencies import get_current_user

    auth = authorization or request.headers.get("Authorization") or request.headers.get("authorization")
    current_user = await get_current_user(request, auth, db=db)
    return await work_orders.get_square_payment_config(db=db, current_user=current_user)


# API prefixed version of the work order detail endpoint
@app.get("/api/work-orders/{work_order_id}")
@app.put("/api/work-orders/{work_order_id}")
@app.delete("/api/work-orders/{work_order_id}")
@app.options("/api/work-orders/{work_order_id}")
async def api_work_order_detail(
    work_order_id: str, 
    request: Request, 
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    This endpoint now forwards to the work_orders router implementation
    that uses the database.
    """
    # Handle OPTIONS request
    if request.method == "OPTIONS":
        response = JSONResponse(content={})
        # Ensure CORS headers are present
        origin_header = request.headers.get('Origin', '*')
        response.headers["Access-Control-Allow-Origin"] = origin_header
        response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    
    try:
        from app.core.dependencies import get_current_user, get_admin_or_manager_user
        
        # Call the appropriate router handler based on the HTTP method
        if request.method == "GET":
            # Check if this is a PDF sub-route that slipped through
            if str(work_order_id).endswith('/estimate.pdf') or str(work_order_id).endswith('/invoice.pdf'):
                raise HTTPException(status_code=404, detail="Use the dedicated PDF endpoints")
            # For GET requests, we only need regular user authentication
            current_user = await get_current_user(request, authorization, db=db)
            # Convert string UUID to UUID object
            work_order_uuid = uuid.UUID(work_order_id)
            logger.info(f"Forwarding GET request for work order {work_order_id} to work_orders.get_work_order with user {current_user.email}")
            response_data = await work_orders.get_work_order(
                work_order_id=work_order_uuid,
                db=db,
                current_user=current_user
            )
            
            serializable_data = jsonable_encoder(response_data)
            
            # Return a response with proper CORS headers
            response = JSONResponse(content=serializable_data)
            origin_header = request.headers.get('Origin', '*')
            response.headers["Access-Control-Allow-Origin"] = origin_header
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
            
        elif request.method == "PUT":
            # For PUT requests, we need admin or manager user authentication
            current_user = await get_admin_or_manager_user(
                current_user=await get_current_user(request, authorization, db=db)
            )
            body = await request.json()
            logger.info(f"Forwarding PUT request for work order {work_order_id} to work_orders.update_work_order with user {current_user.email}")
            response_data = await work_orders.update_work_order(
                work_order_id=uuid.UUID(work_order_id),
                work_order_update=WorkOrderUpdate(**body),
                db=db,
                current_user=current_user
            )
            
            serializable_data = jsonable_encoder(response_data)
            
            # Return a response with proper CORS headers
            response = JSONResponse(content=serializable_data)
            origin_header = request.headers.get('Origin', '*')
            response.headers["Access-Control-Allow-Origin"] = origin_header
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
            
        elif request.method == "DELETE":
            # For DELETE requests, we need admin or manager user authentication
            current_user = await get_admin_or_manager_user(
                current_user=await get_current_user(request, authorization, db=db)
            )
            logger.info(f"Forwarding DELETE request for work order {work_order_id} to work_orders.delete_work_order with user {current_user.email}")
            # The router's delete_work_order is expected to return None on success and have a 204 status.
            await work_orders.delete_work_order(
                work_order_id=uuid.UUID(work_order_id),
                db=db,
                current_user=current_user
            )
            
            # Return a 204 No Content response
            response = JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)
            origin_header = request.headers.get('Origin', '*')
            response.headers["Access-Control-Allow-Origin"] = origin_header
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
            
        else:
            # Method not allowed
            response = JSONResponse(
                status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
                content={"detail": "Method not allowed"}
            )
            origin_header = request.headers.get('Origin', '*')
            response.headers["Access-Control-Allow-Origin"] = origin_header
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
            
    except HTTPException as e:
        response = JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail},
        )
        origin_header = request.headers.get('Origin', '*')
        response.headers["Access-Control-Allow-Origin"] = origin_header
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    except Exception as e:
        logger.error(f"Error forwarding to work orders router: {str(e)}", exc_info=True)
        # Return a properly formatted error response with CORS headers
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Error processing request: {str(e)}"}
        )
        origin_header = request.headers.get('Origin', '*')
        response.headers["Access-Control-Allow-Origin"] = origin_header
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

# Include routers - both with and without /api prefix
# app.include_router(auth.router, prefix="/auth", tags=["auth"])
# app.include_router(clients.router, prefix="/clients", tags=["clients"])
# app.include_router(technicians.router, prefix="/technicians", tags=["technicians"])
# app.include_router(work_orders.router, prefix="/work-orders", tags=["work_orders"])
# app.include_router(scheduling.router, prefix="/scheduling", tags=["scheduling"])
# app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
# app.include_router(payments.router, prefix="/payments", tags=["payments"])
# #app.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
# app.include_router(quotes.router, prefix="/quotes", tags=["quotes"])
# app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
# app.include_router(reports.router, prefix="/reports", tags=["reports"])
# app.include_router(media.router, prefix="/media", tags=["media"])
# app.include_router(mobile.router, prefix="/mobile", tags=["mobile"])
# app.include_router(admin.router, prefix="/admin", tags=["admin"])
# app.include_router(chat.router, prefix="/chat", tags=["chat"])
# app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
# app.include_router(health.router, prefix="/health", tags=["health"])
# app.include_router(users.router, prefix="/users", tags=["users"])
# app.include_router(debug.router, prefix="/debug", tags=["debug"])
# app.include_router(services.router, prefix="/services", tags=["services"])

# Include API prefix routers (same routes but with /api prefix)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(technicians.router, prefix="/api/technicians", tags=["technicians"])
app.include_router(work_orders.router, prefix="/api/work-orders", tags=["work_orders"])
app.include_router(dma.router, prefix="/api/dma", tags=["dma"])
app.include_router(diagnostics.router, prefix="/api/diagnostics", tags=["diagnostics"])
app.include_router(logit.router, prefix="/api/logit", tags=["logit"])
app.include_router(job_economics.router, prefix="/api/job-economics", tags=["job_economics"])

from app.services.google_drive_service import log_drive_status_on_startup

log_drive_status_on_startup()
app.include_router(scheduling.router, prefix="/api/scheduling", tags=["scheduling"])
app.include_router(calendar_blocks.router, prefix="/api/scheduling", tags=["scheduling"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["invoices"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.include_router(quotes.router, prefix="/api/quotes", tags=["quotes"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(media.router, prefix="/api/media", tags=["media"])
app.include_router(mobile.router, prefix="/api/mobile", tags=["mobile"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(debug.router, prefix="/api/debug", tags=["debug"])
app.include_router(services.router, prefix="/api/services", tags=["services"])
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
app.include_router(stripe.router, prefix="/api/stripe", tags=["stripe"])
app.include_router(properties.router, prefix="/api/properties", tags=["properties"])
app.include_router(public.router, prefix="/api/public", tags=["public"])
app.include_router(push.router, prefix="/api/push", tags=["push"])
app.include_router(app_settings.router, prefix="/api/settings", tags=["settings"])
from app.routers import client_portal
app.include_router(client_portal.router, prefix="/api", tags=["client-portal"])
# Mock endpoints for clients, technicians, and services
# NOTE: These mock endpoints have been replaced with real database-backed endpoints in the router files.
# The include_router() calls above now handle these endpoints.
# The mock versions below are kept for reference but are disabled.

# @app.get("/api/clients")
# @app.options("/api/clients")
# async def api_clients(
#     request: Request,
#     credentials: HTTPAuthorizationCredentials = Depends(security),
#     status: Optional[str] = None,
#     page: int = 1,
#     limit: int = 10
# ):
#     """Get all clients with optional filtering"""
#     request_id = str(uuid.uuid4())
#     logger.info(f"[REQUEST-{request_id}] Clients endpoint called with filters: status={status}")
#     
#     # Handle preflight OPTIONS request
#     if request.method == "OPTIONS":
#         response = JSONResponse(content={"message": "OK"})
#         origin = request.headers.get("Origin", "*")
#         response.headers["Access-Control-Allow-Origin"] = origin
#         response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
#         response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
#         response.headers["Access-Control-Allow-Credentials"] = "true"
#         return response
#     
#     # Create mock clients data
#     clients_data = [
#         {
#             "id": str(uuid.uuid4()),
#             "first_name": "John",
#             "last_name": "Smith",
#             "company_name": "Smith Residence",
#             "email": "john.smith@example.com",
#             "phone": "123-456-7890",
#             "status": "active",
#             "created_at": (datetime.utcnow() - timedelta(days=30)).isoformat(),
#         },
#         {
#             "id": str(uuid.uuid4()),
#             "first_name": "Jane",
#             "last_name": "Doe",
#             "company_name": "Doe Family",
#             "email": "jane.doe@example.com",
#             "phone": "098-765-4321",
#             "status": "active",
#             "created_at": (datetime.utcnow() - timedelta(days=15)).isoformat(),
#         },
#         {
#             "id": str(uuid.uuid4()),
#             "first_name": "Bob",
#             "last_name": "Johnson",
#             "company_name": "Johnson Residence",
#             "email": "bob.johnson@example.com",
#             "phone": "555-555-5555",
#             "status": "inactive",
#             "created_at": (datetime.utcnow() - timedelta(days=60)).isoformat(),
#         }
#     ]
#     
#     # Apply filters
#     filtered_data = clients_data
#     
#     if status:
#         filtered_data = [client for client in filtered_data if client["status"] == status]
#     
#     # Calculate pagination
#     total_items = len(filtered_data)
#     total_pages = max(1, (total_items + limit - 1) // limit)
#     start_idx = (page - 1) * limit
#     end_idx = min(start_idx + limit, total_items)
#     
#     # Get items for current page
#     paged_items = filtered_data[start_idx:end_idx]
#     
#     # Create response
#     response = {
#         "items": paged_items,
#         "total": total_items,
#         "page": page,
#         "limit": limit,
#         "total_pages": total_pages
#     }
#     
#     logger.info(f"[REQUEST-{request_id}] Returning mock clients data")
#     return response

@app.get("/api/auth0-test")
@app.options("/api/auth0-test")
async def auth0_test(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Endpoint to test Auth0 authentication and synchronize user with database"""
    request_id = str(uuid.uuid4())
    logger.info(f"[REQUEST-{request_id}] Auth0 test endpoint called")
    
    # We'll get the token from the security dependency
    token = credentials.credentials
    
    try:
        # Use the Auth0 handler to verify the token
        auth_handler = get_auth_handler()
        
        # Verify token
        token_data = await auth_handler.verify_token(token)
        
        # Synchronize the user with our database
        try:
            user = await UserService.sync_auth0_user(db, token_data)
            logger.info(f"[REQUEST-{request_id}] User synchronized with database: {user.id}")
            
            # Get associated records
            client = None
            technician = None
            
            if "client" in user.roles:
                client = UserService.get_client_by_user_id(db, user.id)
            elif "technician" in user.roles:
                technician = UserService.get_technician_by_user_id(db, user.id)
                
            db_user_info = {
                "id": user.id,
                "auth_id": user.auth_id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_active": user.is_active,
                "has_client_record": client is not None,
                "has_technician_record": technician is not None,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
        except Exception as db_error:
            logger.error(f"[REQUEST-{request_id}] Database sync error: {str(db_error)}")
            db_user_info = {"error": str(db_error)}
        
        # Extract user information with more details
        user_info = {
            "user_id": token_data.sub,
            "email": token_data.email,
            "name": token_data.name,
            "given_name": token_data.given_name,
            "family_name": token_data.family_name,
            "nickname": token_data.nickname,
            "picture": token_data.picture,
            "roles": token_data.roles or [],
            "verified": True,
            "token_valid": True,
            "raw_payload_keys": list(token_data.raw_payload.keys() if token_data.raw_payload else []),
        }
        
        # Add debug info about where roles were found
        role_source = None
        if 'roles' in token_data.raw_payload:
            role_source = "standard 'roles' claim"
        elif f'https://{auth_handler.domain}/roles' in token_data.raw_payload:
            role_source = f"Auth0 namespace 'https://{auth_handler.domain}/roles'"
        elif 'https://idimsapi/app_metadata' in token_data.raw_payload and 'roles' in token_data.raw_payload['https://idimsapi/app_metadata']:
            role_source = "custom namespace 'https://idimsapi/app_metadata'"
        
        # Add app_metadata if present
        if 'https://idimsapi/app_metadata' in token_data.raw_payload:
            user_info["app_metadata"] = token_data.raw_payload['https://idimsapi/app_metadata']
        
        # Add user_metadata if present
        if 'https://idimsapi/user_metadata' in token_data.raw_payload:
            user_info["user_metadata"] = token_data.raw_payload['https://idimsapi/user_metadata']
        
        logger.info(f"[REQUEST-{request_id}] Auth0 token successfully verified")
        return {
            "message": "Auth0 authentication successful",
            "user": user_info,
            "database_user": db_user_info,
            "status": "success",
            "role_source": role_source,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"[REQUEST-{request_id}] Auth0 token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Auth0 authentication failed: {str(e)}"
        )

@app.post("/api/work-orders")
@app.options("/api/work-orders")
async def create_work_order(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Create a new work order - this is a duplicate endpoint
    
    Note: There are two POST handlers for /api/work-orders in this file:
    1. The one in api_work_orders (around line 370) which forwards to the router
    2. This one which was previously using mock data
    
    To avoid conflicts, this handler now defers to the api_work_orders implementation.
    """
    logger.info(f"Duplicate create_work_order endpoint called, forwarding to main implementation")
    
    # Forward to the main API implementation
    from app.core.dependencies import get_db
    db = next(get_db())
    
    # For OPTIONS requests, handle CORS
    if request.method == "OPTIONS":
        response = JSONResponse(content={"message": "OK"})
        origin = request.headers.get("Origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
        
    # For POST requests, forward to the other handler
    return await api_work_orders(
        request=request,
        authorization=f"Bearer {credentials.credentials}",
        db=db
    )

# update_work_order duplicate removed — handled by api_work_order_detail above

# Legacy endpoints that have been replaced by the router implementation
# @app.put("/api/work-orders/{work_order_id}")
# @app.options("/api/work-orders/{work_order_id}")
async def legacy_update_work_order(work_order_id: str, request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Update a work order - LEGACY ENDPOINT, DISABLED"""
    request_id = str(uuid.uuid4())
    logger.info(f"[REQUEST-{request_id}] Legacy update work order endpoint called for ID: {work_order_id}")
    
    # This endpoint is now disabled in favor of the router implementation
    return RedirectResponse(url=f"/api/work-orders/{work_order_id}")
    
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        response = JSONResponse(content={"message": "OK"})
        origin = request.headers.get("Origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "PUT, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

# --- New Maps API Route --- #
class DistanceRequest(BaseModel):
    origin: str
    destination: str

@app.post("/api/calculate-distance", tags=["Maps"])
async def calculate_distance_endpoint(request_data: DistanceRequest):
    """
    Calculates estimated travel time (seconds) and distance (meters) 
    between two addresses using Google Routes API (traffic-unaware).
    """
    origin = request_data.origin
    destination = request_data.destination
    logger.info(f"calculate-distance: Origin=\"{origin}\", Destination=\"{destination}\"")

    if not origin or not destination:
        raise HTTPException(status_code=400, detail="Origin and destination addresses are required.")

    try:
        travel_time_minutes, travel_distance_miles = get_travel_time_and_distance(origin, destination)
    except Exception as e:
        logger.error(f"Exception in get_travel_time_and_distance: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error during travel calculation: {str(e)}")

    if travel_time_minutes is None or travel_distance_miles is None:
        raise HTTPException(status_code=500, detail="Failed to calculate distance or time.")

    travel_time_seconds = int(travel_time_minutes * 60)
    travel_distance_meters = int(travel_distance_miles * 1609.34)
    logger.info(f"calculate-distance result: {travel_time_seconds}s, {travel_distance_meters}m")

    return {"travelTime": travel_time_seconds, "distance": travel_distance_meters}
# --- End New Maps API Route --- #

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS
    )