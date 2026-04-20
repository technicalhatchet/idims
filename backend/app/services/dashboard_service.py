from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, text
from datetime import datetime, timedelta
from typing import Dict, Any
import logging

from app.models.work_order import WorkOrder
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.client import Client
from app.models.technician import Technician

logger = logging.getLogger(__name__)

class DashboardService:
    """Service for handling dashboard operations"""
    
    @staticmethod
    async def get_dashboard_stats(db: Session) -> Dict[str, Any]:
        """Get dashboard statistics"""
        try:
            # Get current date and date ranges
            now = datetime.utcnow()
            today = now.date()
            this_month_start = today.replace(day=1)
            last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
            this_month_end = (this_month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            # Work Order Stats
            total_work_orders = db.query(func.count(WorkOrder.id)).scalar() or 0
            pending_work_orders = db.query(func.count(WorkOrder.id)).filter(
                WorkOrder.status.in_(["pending", "scheduled"])
            ).scalar() or 0
            completed_work_orders = db.query(func.count(WorkOrder.id)).filter(
                WorkOrder.status == "completed"
            ).scalar() or 0
            
            # This month's work orders
            this_month_work_orders = db.query(func.count(WorkOrder.id)).filter(
                WorkOrder.created_at >= this_month_start,
                WorkOrder.created_at <= this_month_end
            ).scalar() or 0
            
            # Last month's work orders for comparison
            last_month_work_orders = db.query(func.count(WorkOrder.id)).filter(
                WorkOrder.created_at >= last_month_start,
                WorkOrder.created_at < this_month_start
            ).scalar() or 0
            
            # Calculate work order growth
            work_order_growth = 0
            if last_month_work_orders > 0:
                work_order_growth = ((this_month_work_orders - last_month_work_orders) / last_month_work_orders) * 100
            
            # Revenue Stats
            this_month_revenue = db.query(func.sum(Payment.amount)).filter(
                Payment.status == "success",
                Payment.payment_date >= this_month_start,
                Payment.payment_date <= this_month_end
            ).scalar() or 0
            
            last_month_revenue = db.query(func.sum(Payment.amount)).filter(
                Payment.status == "success",
                Payment.payment_date >= last_month_start,
                Payment.payment_date < this_month_start
            ).scalar() or 0
            
            # Calculate revenue growth
            revenue_growth = 0
            if last_month_revenue > 0:
                revenue_growth = ((this_month_revenue - last_month_revenue) / last_month_revenue) * 100
            
            # Outstanding Invoices
            outstanding_amount = db.execute(
                text("SELECT SUM(total) FROM invoices WHERE status IN ('sent', 'overdue')")
            ).scalar() or 0
            
            overdue_invoices = db.query(func.count(Invoice.id)).filter(
                Invoice.status == "overdue"
            ).scalar() or 0
            
            # Client Stats
            total_clients = db.query(func.count(Client.id)).scalar() or 0
            active_clients = db.query(func.count(Client.id)).filter(
                Client.status == "active"
            ).scalar() or 0
            
            # Technician Stats
            total_technicians = db.query(func.count(Technician.id)).scalar() or 0
            available_technicians = db.query(func.count(Technician.id)).filter(
                Technician.status == "active"
            ).scalar() or 0
            
            # Return a plain dictionary with all stats
            return {
                "work_orders": {
                    "total": total_work_orders,
                    "pending": pending_work_orders,
                    "completed": completed_work_orders,
                    "this_month": this_month_work_orders,
                    "growth": work_order_growth
                },
                "revenue": {
                    "this_month": this_month_revenue,
                    "growth": revenue_growth,
                    "outstanding": outstanding_amount,
                    "overdue_invoices": overdue_invoices
                },
                "clients": {
                    "total": total_clients,
                    "active": active_clients
                },
                "technicians": {
                    "total": total_technicians,
                    "available": available_technicians
                },
                "last_updated": now.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {str(e)}")
            raise e 