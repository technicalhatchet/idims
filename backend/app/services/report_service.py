import logging
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, text
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, timedelta, date
import uuid
import csv
import json
import os
from pathlib import Path
from io import StringIO
import tempfile

from app.models.work_order import WorkOrder
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.client import Client
from app.models.technician import Technician
from app.models.user import User
from app.core.exceptions import NotFoundException, ValidationException
from app.config import settings

logger = logging.getLogger(__name__)

# Ensure reports directory exists
reports_dir = Path("storage/reports")
reports_dir.mkdir(parents=True, exist_ok=True)

class ReportService:
    """Service for generating and retrieving reports"""
    
    @staticmethod
    async def generate_financial_report(
        db: Session,
        start_date: datetime,
        end_date: datetime,
        report_type: str = "summary",
        format: str = "json"
    ) -> Dict[str, Any]:
        """Generate a financial report for the given period"""
        logger.info(f"Generating {report_type} financial report from {start_date} to {end_date}")
        
        try:
            report_data = {}
            
            # Basic revenue metrics
            invoices = db.query(Invoice).filter(
                and_(Invoice.issue_date >= start_date.date(), Invoice.issue_date <= end_date.date())
            ).all()
            
            payments = db.query(Payment).filter(
                and_(Payment.payment_date >= start_date, Payment.payment_date <= end_date)
            ).all()
            
            # Calculate key metrics
            total_invoiced = sum(inv.total for inv in invoices)
            total_collected = sum(payment.amount for payment in payments if payment.status == "success")
            
            # Categorize invoices by status
            invoices_by_status = {}
            for inv in invoices:
                if inv.status not in invoices_by_status:
                    invoices_by_status[inv.status] = {
                        "count": 0, 
                        "total": 0
                    }
                invoices_by_status[inv.status]["count"] += 1
                invoices_by_status[inv.status]["total"] += inv.total
            
            # Payments by method
            payments_by_method = {}
            for payment in payments:
                if payment.status != "success":
                    continue
                
                if payment.payment_method not in payments_by_method:
                    payments_by_method[payment.payment_method] = {
                        "count": 0,
                        "total": 0
                    }
                payments_by_method[payment.payment_method]["count"] += 1
                payments_by_method[payment.payment_method]["total"] += payment.amount
            
            # Basic report data
            report_data = {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "revenue": {
                    "total_invoiced": total_invoiced,
                    "total_collected": total_collected,
                    "collection_rate": (total_collected / total_invoiced * 100) if total_invoiced > 0 else 0
                },
                "invoices": {
                    "total_count": len(invoices),
                    "by_status": invoices_by_status
                },
                "payments": {
                    "total_count": len(payments),
                    "by_method": payments_by_method
                }
            }
            
            # Add detailed data for complete reports
            if report_type == "detailed":
                # Daily revenue trends
                daily_revenue = {}
                
                # Create a date range of all days in the period
                delta = end_date.date() - start_date.date()
                for i in range(delta.days + 1):
                    current_date = (start_date + timedelta(days=i)).date()
                    daily_revenue[current_date.isoformat()] = {
                        "invoiced": 0,
                        "collected": 0
                    }
                
                # Fill in invoice data
                for inv in invoices:
                    if inv.issue_date.isoformat() in daily_revenue:
                        daily_revenue[inv.issue_date.isoformat()]["invoiced"] += inv.total
                
                # Fill in payment data
                for payment in payments:
                    if payment.status == "success":
                        payment_date = payment.payment_date.date().isoformat()
                        if payment_date in daily_revenue:
                            daily_revenue[payment_date]["collected"] += payment.amount
                
                # Top clients by revenue
                client_revenue = {}
                for payment in payments:
                    if payment.status != "success" or not payment.invoice:
                        continue
                    
                    client_id = payment.invoice.client_id
                    if not client_id:
                        continue
                    
                    if client_id not in client_revenue:
                        client = db.query(Client).filter(Client.id == client_id).first()
                        client_name = "Unknown"
                        if client:
                            client_name = client.company_name or f"{client.first_name} {client.last_name}"
                        
                        client_revenue[client_id] = {
                            "client_id": str(client_id),
                            "client_name": client_name,
                            "total": 0,
                            "payments_count": 0
                        }
                    
                    client_revenue[client_id]["total"] += payment.amount
                    client_revenue[client_id]["payments_count"] += 1
                
                # Sort clients by revenue
                top_clients = sorted(
                    list(client_revenue.values()),
                    key=lambda x: x["total"],
                    reverse=True
                )[:10]  # Top 10
                
                # Add detailed data to report
                report_data["daily_revenue"] = daily_revenue
                report_data["top_clients"] = top_clients
            
            # Convert to requested format
            if format == "csv":
                return await ReportService._convert_to_csv(report_data, "financial_report")
            
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating financial report: {str(e)}")
            raise ValidationException(f"Failed to generate financial report: {str(e)}")
    
    @staticmethod
    async def generate_operations_report(
        db: Session,
        start_date: datetime,
        end_date: datetime,
        report_type: str = "summary",
        format: str = "json"
    ) -> Dict[str, Any]:
        """Generate an operations report for work orders and technicians"""
        logger.info(f"Generating {report_type} operations report from {start_date} to {end_date}")
        
        try:
            # Get work orders for the period
            work_orders = db.query(WorkOrder).filter(
                or_(
                    and_(WorkOrder.created_at >= start_date, WorkOrder.created_at <= end_date),
                    and_(WorkOrder.scheduled_start >= start_date, WorkOrder.scheduled_start <= end_date),
                    and_(WorkOrder.actual_start >= start_date, WorkOrder.actual_start <= end_date),
                    and_(WorkOrder.actual_end >= start_date, WorkOrder.actual_end <= end_date)
                )
            ).all()
            
            # Basic metrics
            total_work_orders = len(work_orders)
            completed_orders = sum(1 for wo in work_orders if wo.status == "completed")
            completion_rate = (completed_orders / total_work_orders * 100) if total_work_orders > 0 else 0
            
            # Work orders by status
            work_orders_by_status = {}
            for wo in work_orders:
                if wo.status not in work_orders_by_status:
                    work_orders_by_status[wo.status] = 0
                work_orders_by_status[wo.status] += 1
            
            # Work orders by priority
            work_orders_by_priority = {}
            for wo in work_orders:
                if wo.priority not in work_orders_by_priority:
                    work_orders_by_priority[wo.priority] = 0
                work_orders_by_priority[wo.priority] += 1
            
            # Basic report data
            report_data = {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "work_orders": {
                    "total_count": total_work_orders,
                    "completed_count": completed_orders,
                    "completion_rate": completion_rate,
                    "by_status": work_orders_by_status,
                    "by_priority": work_orders_by_priority
                }
            }
            
            # Add detailed data for complete reports
            if report_type == "detailed":
                # Technician performance
                technician_performance = {}
                for wo in work_orders:
                    if not wo.assigned_technician_id:
                        continue
                    
                    tech_id = wo.assigned_technician_id
                    if tech_id not in technician_performance:
                        technician = db.query(Technician).filter(Technician.id == tech_id).first()
                        tech_name = "Unknown"
                        if technician:
                            tech_name = technician.name
                        
                        technician_performance[tech_id] = {
                            "technician_id": str(tech_id),
                            "technician_name": tech_name,
                            "total_jobs": 0,
                            "completed_jobs": 0,
                            "total_duration": 0,  # in minutes
                            "job_count_with_duration": 0
                        }
                    
                    technician_performance[tech_id]["total_jobs"] += 1
                    
                    if wo.status == "completed":
                        technician_performance[tech_id]["completed_jobs"] += 1
                    
                    # Calculate duration if actual start and end times are available
                    if wo.actual_start and wo.actual_end:
                        duration = (wo.actual_end - wo.actual_start).total_seconds() / 60
                        technician_performance[tech_id]["total_duration"] += duration
                        technician_performance[tech_id]["job_count_with_duration"] += 1
                
                # Calculate completion rate and average duration
                for tech_id, data in technician_performance.items():
                    if data["total_jobs"] > 0:
                        data["completion_rate"] = (data["completed_jobs"] / data["total_jobs"]) * 100
                    else:
                        data["completion_rate"] = 0
                    
                    if data["job_count_with_duration"] > 0:
                        data["avg_duration"] = data["total_duration"] / data["job_count_with_duration"]
                    else:
                        data["avg_duration"] = 0
                    
                    # Remove intermediate calculation fields
                    data.pop("job_count_with_duration", None)
                
                # Sort technicians by completion rate
                top_technicians = sorted(
                    list(technician_performance.values()),
                    key=lambda x: x["completion_rate"],
                    reverse=True
                )
                
                # Add detailed data to report
                report_data["technician_performance"] = top_technicians
                
                # Job duration statistics
                durations = []
                for wo in work_orders:
                    if wo.actual_start and wo.actual_end:
                        duration = (wo.actual_end - wo.actual_start).total_seconds() / 60
                        durations.append(duration)
                
                if durations:
                    report_data["job_duration"] = {
                        "average": sum(durations) / len(durations),
                        "min": min(durations),
                        "max": max(durations),
                        "median": sorted(durations)[len(durations) // 2]
                    }
                else:
                    report_data["job_duration"] = {
                        "average": 0,
                        "min": 0,
                        "max": 0,
                        "median": 0
                    }
            
            # Convert to requested format
            if format == "csv":
                return await ReportService._convert_to_csv(report_data, "operations_report")
            
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating operations report: {str(e)}")
            raise ValidationException(f"Failed to generate operations report: {str(e)}")
    
    @staticmethod
    async def generate_client_report(
        db: Session,
        client_id: uuid.UUID,
        start_date: datetime,
        end_date: datetime,
        format: str = "json"
    ) -> Dict[str, Any]:
        """Generate a report for a specific client"""
        logger.info(f"Generating report for client {client_id} from {start_date} to {end_date}")
        
        # Check if client exists
        client = db.query(Client).filter(Client.id == client_id).first()
        if not client:
            raise NotFoundException(f"Client with ID {client_id} not found")
        
        try:
            # Get work orders for this client
            work_orders = db.query(WorkOrder).filter(
                WorkOrder.client_id == client_id,
                or_(
                    and_(WorkOrder.created_at >= start_date, WorkOrder.created_at <= end_date),
                    and_(WorkOrder.scheduled_start >= start_date, WorkOrder.scheduled_start <= end_date),
                    and_(WorkOrder.actual_start >= start_date, WorkOrder.actual_start <= end_date),
                    and_(WorkOrder.actual_end >= start_date, WorkOrder.actual_end <= end_date)
                )
            ).all()
            
            # Get invoices for this client
            invoices = db.query(Invoice).filter(
                Invoice.client_id == client_id,
                and_(Invoice.issue_date >= start_date.date(), Invoice.issue_date <= end_date.date())
            ).all()
            
            # Get payments for this client's invoices
            invoice_ids = [inv.id for inv in invoices]
            payments = []
            if invoice_ids:
                payments = db.query(Payment).filter(
                    Payment.invoice_id.in_(invoice_ids),
                    and_(Payment.payment_date >= start_date, Payment.payment_date <= end_date)
                ).all()
            
            # Calculate metrics
            total_work_orders = len(work_orders)
            completed_orders = sum(1 for wo in work_orders if wo.status == "completed")
            completion_rate = (completed_orders / total_work_orders * 100) if total_work_orders > 0 else 0
            
            total_invoiced = sum(inv.total for inv in invoices)
            total_paid = sum(payment.amount for payment in payments if payment.status == "success")
            payment_rate = (total_paid / total_invoiced * 100) if total_invoiced > 0 else 0
            
            # Compile the report
            client_name = client.company_name or f"{client.first_name} {client.last_name}"
            report_data = {
                "client": {
                    "id": str(client.id),
                    "name": client_name,
                    "email": client.email,
                    "phone": client.phone,
                    "address": client.address
                },
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "summary": {
                    "work_orders_count": total_work_orders,
                    "completed_orders": completed_orders,
                    "completion_rate": completion_rate,
                    "total_invoiced": total_invoiced,
                    "total_paid": total_paid,
                    "payment_rate": payment_rate
                },
                "work_orders": [
                    {
                        "id": str(wo.id),
                        "order_number": wo.order_number,
                        "title": wo.title,
                        "status": wo.status,
                        "created_at": wo.created_at.isoformat() if wo.created_at else None,
                        "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
                        "scheduled_end": wo.scheduled_end.isoformat() if wo.scheduled_end else None,
                        "actual_start": wo.actual_start.isoformat() if wo.actual_start else None,
                        "actual_end": wo.actual_end.isoformat() if wo.actual_end else None,
                        "technician": wo.technician.name if wo.technician else "Unassigned"
                    } for wo in work_orders
                ],
                "invoices": [
                    {
                        "id": str(inv.id),
                        "invoice_number": inv.invoice_number,
                        "status": inv.status,
                        "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
                        "due_date": inv.due_date.isoformat() if inv.due_date else None,
                        "total": inv.total,
                        "amount_paid": inv.amount_paid,
                        "balance": inv.balance
                    } for inv in invoices
                ]
            }
            
            # Convert to requested format
            if format == "csv":
                return await ReportService._convert_to_csv(report_data, "client_report")
            
            return report_data
            
        except Exception as e:
            logger.error(f"Error generating client report: {str(e)}")
            raise ValidationException(f"Failed to generate client report: {str(e)}")
    
    @staticmethod
    async def get_saved_reports(report_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get a list of saved reports"""
        try:
            reports = []
            
            # Define paths based on report type
            if report_type:
                paths = [reports_dir / report_type]
            else:
                paths = [
                    reports_dir / "daily",
                    reports_dir / "weekly",
                    reports_dir / "monthly",
                    reports_dir / "custom"
                ]
            
            # Scan directories
            for path in paths:
                if not path.exists():
                    continue
                
                for report_dir in path.iterdir():
                    if report_dir.is_dir():
                        # Check for summary.json
                        summary_file = report_dir / "summary.json"
                        if summary_file.exists():
                            try:
                                with open(summary_file, "r") as f:
                                    summary = json.load(f)
                                    
                                    reports.append({
                                        "id": report_dir.name,
                                        "type": path.name,
                                        "date": summary.get("date") or report_dir.name,
                                        "title": summary.get("title", f"{path.name.capitalize()} Report"),
                                        "files": [f.name for f in report_dir.iterdir() if f.is_file()],
                                        "summary": summary
                                    })
                            except json.JSONDecodeError:
                                logger.error(f"Error parsing summary.json in {summary_file}")
                        else:
                            # Just list files without summary
                            files = [f.name for f in report_dir.iterdir() if f.is_file()]
                            if files:
                                reports.append({
                                    "id": report_dir.name,
                                    "type": path.name,
                                    "date": report_dir.name,
                                    "title": f"{path.name.capitalize()} Report",
                                    "files": files
                                })
            
            # Sort by date descending
            reports.sort(key=lambda x: x["date"], reverse=True)
            
            return reports
            
        except Exception as e:
            logger.error(f"Error retrieving saved reports: {str(e)}")
            return []
    
    @staticmethod
    async def get_report_file(report_type: str, report_id: str, file_name: str) -> dict:
        """Get a specific report file"""
        file_path = reports_dir / report_type / report_id / file_name
        
        if not file_path.exists():
            raise NotFoundException(f"Report file not found: {file_path}")
        
        try:
            # Read the file based on extension
            if file_name.endswith(".json"):
                with open(file_path, "r") as f:
                    data = json.load(f)
                return data
            elif file_name.endswith(".csv"):
                with open(file_path, "r") as f:
                    reader = csv.DictReader(f)
                    data = list(reader)
                return {"data": data, "format": "csv"}
            else:
                with open(file_path, "r") as f:
                    content = f.read()
                return {"content": content, "format": "txt"}
        except Exception as e:
            logger.error(f"Error reading report file: {str(e)}")
            raise ValidationException(f"Failed to read report file: {str(e)}")
    
    @staticmethod
    async def _convert_to_csv(data: Dict[str, Any], report_name: str) -> Dict[str, Any]:
        """Convert report data to CSV format"""
        csv_files = {}
        
        # Main summary file
        summary_io = StringIO()
        summary_writer = csv.writer(summary_io)
        
        # Write period info
        if "period" in data:
            summary_writer.writerow(["Period Start", "Period End"])
            summary_writer.writerow([data["period"]["start"], data["period"]["end"]])
            summary_writer.writerow([])
        
        # Write client info if available
        if "client" in data:
            summary_writer.writerow(["Client ID", "Client Name", "Email"])
            summary_writer.writerow([
                data["client"]["id"], 
                data["client"]["name"], 
                data["client"]["email"]
            ])
            summary_writer.writerow([])
        
        # Write summary data
        if "summary" in data:
            summary_writer.writerow(["Metric", "Value"])
            for key, value in data["summary"].items():
                summary_writer.writerow([key.replace("_", " ").title(), value])
        
        # Write revenue data if available
        if "revenue" in data:
            summary_writer.writerow([])
            summary_writer.writerow(["Revenue Metrics", "Value"])
            for key, value in data["revenue"].items():
                summary_writer.writerow([key.replace("_", " ").title(), value])
        
        # Write work order summary if available
        if "work_orders" in data and isinstance(data["work_orders"], dict):
            summary_writer.writerow([])
            summary_writer.writerow(["Work Order Metrics", "Value"])
            for key, value in data["work_orders"].items():
                if not isinstance(value, dict) and not isinstance(value, list):
                    summary_writer.writerow([key.replace("_", " ").title(), value])
            
            # Write status breakdown if available
            if "by_status" in data["work_orders"]:
                summary_writer.writerow([])
                summary_writer.writerow(["Status", "Count"])
                for status, count in data["work_orders"]["by_status"].items():
                    if isinstance(count, dict):
                        summary_writer.writerow([status.title(), f"{count['count']} (${count['total']})"])
                    else:
                        summary_writer.writerow([status.title(), count])
        
        # Add summary CSV to files
        csv_files["summary.csv"] = summary_io.getvalue()
        
        # Create detailed CSVs for different sections
        # Work orders detail
        if "work_orders" in data and isinstance(data["work_orders"], list) and data["work_orders"]:
            wo_io = StringIO()
            wo_writer = csv.DictWriter(wo_io, fieldnames=data["work_orders"][0].keys())
            wo_writer.writeheader()
            for wo in data["work_orders"]:
                wo_writer.writerow(wo)
            csv_files["work_orders.csv"] = wo_io.getvalue()
        
        # Invoices detail
        if "invoices" in data and data["invoices"]:
            inv_io = StringIO()
            inv_writer = csv.DictWriter(inv_io, fieldnames=data["invoices"][0].keys())
            inv_writer.writeheader()
            for inv in data["invoices"]:
                inv_writer.writerow(inv)
            csv_files["invoices.csv"] = inv_io.getvalue()
        
        # Technician performance if available
        if "technician_performance" in data and data["technician_performance"]:
            tech_io = StringIO()
            tech_writer = csv.DictWriter(tech_io, fieldnames=data["technician_performance"][0].keys())
            tech_writer.writeheader()
            for tech in data["technician_performance"]:
                tech_writer.writerow(tech)
            csv_files["technician_performance.csv"] = tech_io.getvalue()
        
        # Return as a dict of CSV strings
        return {
            "format": "csv",
            "files": csv_files,
            "primary_file": "summary.csv"
        }