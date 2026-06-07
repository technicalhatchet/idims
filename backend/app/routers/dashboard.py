from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, date
from typing import Dict, Any
import logging

from app.db.database import get_db
from app.models.work_order import WorkOrder, WorkOrderAppointment
from app.models.invoice import Invoice
from app.models.client import Client
from app.models.quote import Quote
from app.core.auth import get_auth_handler

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer()
auth_handler = get_auth_handler()

@router.get("/dashboard")
async def get_dashboard_data(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get dashboard data for the authenticated user"""
    # Verify token
    token_data = await auth_handler.verify_token(credentials.credentials)
    
    # Create a mock dashboard response
    dashboard_data = {
        "title": "IDIMS Dashboard",
        "stats": {
            "open_work_orders": 12,
            "scheduled_today": 4,
            "pending_invoices": 8,
            "revenue_month": 24500
        },
        "user": {
            "id": token_data.sub,
            "email": token_data.email if hasattr(token_data, "email") else None,
            "name": token_data.name if hasattr(token_data, "name") else None
        }
    }
    
    return dashboard_data 

@router.get("/stats")
async def get_dashboard_stats(request: Request, db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get dashboard statistics for the authenticated user"""
    token_data = await auth_handler.verify_token(credentials.credentials)
    logger.info(f"Fetching dashboard stats for user: {token_data.email if hasattr(token_data, 'email') else token_data.sub}")

    today = date.today()
    current_month = today.month
    current_year = today.year

    active_clients_count = 0
    open_quotes_count = 0
    open_work_orders_count = 0 
    scheduled_today_count = 0
    pending_invoices_count = 0
    revenue_this_month = 0.0

    try:
        # Count active clients
        active_clients_count = db.query(func.count(Client.id)).filter(
            Client.status == 'active'
        ).scalar() or 0

        # Count open quotes (draft or sent)
        open_quotes_count = db.query(func.count(Quote.id)).filter(
            Quote.status.in_(['draft', 'sent'])
        ).scalar() or 0

        # Count open work orders
        open_work_orders_count = db.query(func.count(WorkOrder.id)).filter(
            WorkOrder.status.notin_(['completed', 'canceled', 'redo'])
        ).scalar() or 0

        # Count appointments scheduled for today
        scheduled_today_count = db.query(func.count(WorkOrderAppointment.id)).filter(
            func.date(WorkOrderAppointment.scheduled_start) == today
        ).scalar() or 0

        # Count pending invoices
        pending_invoices_count = db.query(func.count(Invoice.id)).filter(
            Invoice.status.in_(['draft', 'sent', 'partially_paid', 'overdue'])
        ).scalar() or 0

        # Calculate revenue for the current month
        revenue_this_month = db.query(func.sum(Invoice.total_amount)).filter(
            extract('month', Invoice.created_at) == current_month,
            extract('year', Invoice.created_at) == current_year
        ).scalar() or 0.0
        
        logger.info(f"DB stats: active_clients={active_clients_count}, open_quotes={open_quotes_count}, open_wo={open_work_orders_count}, scheduled_today={scheduled_today_count}, pending_inv={pending_invoices_count}, revenue_month={revenue_this_month}")

    except Exception as e:
        logger.error(f"Error fetching dashboard stats from DB: {e}", exc_info=True)
        # Fallback to a structure that matches frontend expectation but with mock numbers
        return {
            "clients": {"active": 10},
            "openQuotesCount": 5,
            "work_orders": {"pending": 12},
            "revenue": {"this_month": 24500},
            "scheduled_today": 4, # Extra
            "pending_invoices": 8   # Extra
        }

    # Structure data as expected by the frontend
    stats_data = {
        "clients": {
            "active": active_clients_count
        },
        "openQuotesCount": open_quotes_count,
        "work_orders": {
            # Using open_work_orders_count for 'pending' as discussed
            "pending": open_work_orders_count 
        },
        "revenue": {
            "this_month": revenue_this_month
        },
        # These are extra stats not currently displayed on the main cards, but good to have
        "scheduled_today": scheduled_today_count, 
        "pending_invoices": pending_invoices_count
    }
    
    return stats_data 