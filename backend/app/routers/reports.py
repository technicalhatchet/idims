from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path, status, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uuid
import os
from datetime import datetime, date, timedelta

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.services.report_service import ReportService
from app.core.exceptions import NotFoundException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/reports/financial")
async def generate_financial_report(
    start_date: date = Query(..., description="Start date for the report period"),
    end_date: date = Query(..., description="End date for the report period"),
    report_type: str = Query("summary", description="Report type: summary or detailed"),
    format: str = Query("json", description="Response format: json or csv"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Generate a financial report for the specified period.
    Permissions: Only managers and admins can access financial reports.
    """
    try:
        # Convert dates to datetime for consistency
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        # Validate date range
        if start_date > end_date:
            raise ValidationException("Start date must be before end date")
        
        # Validate report type
        if report_type not in ["summary", "detailed"]:
            raise ValidationException("Report type must be 'summary' or 'detailed'")
        
        # Validate format
        if format not in ["json", "csv"]:
            raise ValidationException("Format must be 'json' or 'csv'")
        
        # Generate the report
        report_data = await ReportService.generate_financial_report(
            db, start_datetime, end_datetime, report_type, format
        )
        
        return report_data
        
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating financial report: {str(e)}"
        )

@router.get("/reports/operations")
async def generate_operations_report(
    start_date: date = Query(..., description="Start date for the report period"),
    end_date: date = Query(..., description="End date for the report period"),
    report_type: str = Query("summary", description="Report type: summary or detailed"),
    format: str = Query("json", description="Response format: json or csv"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Generate an operations report for the specified period.
    Includes work orders and technician performance metrics.
    Permissions: Only managers and admins can access operations reports.
    """
    try:
        # Convert dates to datetime for consistency
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        # Validate date range
        if start_date > end_date:
            raise ValidationException("Start date must be before end date")
        
        # Generate the report
        report_data = await ReportService.generate_operations_report(
            db, start_datetime, end_datetime, report_type, format
        )
        
        return report_data
        
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating operations report: {str(e)}"
        )

@router.get("/reports/clients/{client_id}")
async def generate_client_report(
    client_id: uuid.UUID = Path(..., description="Client ID to generate report for"),
    start_date: date = Query(..., description="Start date for the report period"),
    end_date: date = Query(..., description="End date for the report period"),
    format: str = Query("json", description="Response format: json or csv"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a report for a specific client.
    Permissions: Staff can access any client report, clients can only access their own.
    """
    try:
        # Check client permissions
        if current_user.role == "client":
            from app.models.client import Client
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if not client or client.id != client_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this client report"
                )
        
        # Convert dates to datetime for consistency
        start_datetime = datetime.combine(start_date, datetime.min.time())
        end_datetime = datetime.combine(end_date, datetime.max.time())
        
        # Validate date range
        if start_date > end_date:
            raise ValidationException("Start date must be before end date")
        
        # Generate the report
        report_data = await ReportService.generate_client_report(
            db, client_id, start_datetime, end_datetime, format
        )
        
        return report_data
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating client report: {str(e)}"
        )

@router.get("/reports/technicians/{technician_id}")
async def generate_technician_report(
    technician_id: uuid.UUID = Path(..., description="Technician ID to generate report for"),
    start_date: date = Query(..., description="Start date for the report period"),
    end_date: date = Query(..., description="End date for the report period"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Generate a performance report for a specific technician.
    Permissions: Only managers and admins can access technician reports.
    """
    try:
        # This would typically call a ReportService method
        # For now, we'll return a placeholder
        return {
            "technician_id": str(technician_id),
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "message": "Technician report generation not implemented yet"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating technician report: {str(e)}"
        )

@router.get("/reports/inventory")
async def generate_inventory_report(
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Generate an inventory stock status report.
    Permissions: Only managers and admins can access inventory reports.
    """
    try:
        # This would typically call a ReportService method
        # For now, we'll return a placeholder
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "message": "Inventory report generation not implemented yet"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating inventory report: {str(e)}"
        )

@router.get("/reports/saved")
async def list_saved_reports(
    report_type: Optional[str] = Query(None, description="Filter by report type"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    List saved reports.
    Permissions: Only managers and admins can access saved reports.
    """
    try:
        reports = await ReportService.get_saved_reports(report_type)
        return {"reports": reports}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving saved reports: {str(e)}"
        )

@router.get("/reports/saved/{report_type}/{report_id}/{file_name}")
async def get_saved_report_file(
    report_type: str = Path(..., description="Report type: daily, weekly, monthly, custom"),
    report_id: str = Path(..., description="Report ID (usually a date)"),
    file_name: str = Path(..., description="File name to retrieve"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Get a specific saved report file.
    Permissions: Only managers and admins can access saved reports.
    """
    try:
        report_data = await ReportService.get_report_file(report_type, report_id, file_name)
        return report_data
        
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving report file: {str(e)}"
        )