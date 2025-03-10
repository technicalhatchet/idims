from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, BackgroundTasks, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime, date

from app.db.database import get_db
from app.core.auth import AuthHandler, User
from app.models.invoice import Invoice
from app.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceListResponse,
    InvoiceStatusUpdate, InvoiceSend
)
from app.services.invoice_service import InvoiceService
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

router = APIRouter()
auth_handler = AuthHandler()

@router.get("/invoices", response_model=InvoiceListResponse)
async def list_invoices(
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client ID"),
    work_order_id: Optional[uuid.UUID] = Query(None, description="Filter by work order ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    start_date: Optional[date] = Query(None, description="Filter by issue date (start)"),
    end_date: Optional[date] = Query(None, description="Filter by issue date (end)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List invoices with filtering and pagination.
    Permissions: Staff can see all invoices, clients can only see their own.
    """
    skip = (page - 1) * limit
    
    # Handle client permissions
    if current_user.role == "client":
        from app.models.client import Client
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise NotFoundException("Client profile not found")
        
        # Force client_id filter for client users
        client_id = client.id
    
    try:
        return await InvoiceService.get_invoices(
            db,
            client_id=client_id,
            work_order_id=work_order_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving invoices: {str(e)}"
        )

@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    invoice: InvoiceCreate,
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new invoice.
    Permissions: Only managers and admins can create invoices.
    """
    try:
        return await InvoiceService.create_invoice(db, invoice, current_user.id)
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating invoice: {str(e)}"
        )

@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID = Path(..., description="The ID of the invoice to retrieve"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific invoice by ID.
    Permissions: Staff can access any invoice, clients can only access their own.
    """
    try:
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        
        # Handle client permissions
        if current_user.role == "client":
            from app.models.client import Client
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if not client or client.id != invoice.client_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view this invoice"
                )
        
        return invoice
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving invoice: {str(e)}"
        )

@router.put("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID = Path(..., description="The ID of the invoice to update"),
    invoice_update: InvoiceUpdate = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Update an invoice.
    Permissions: Only managers and admins can update invoices.
    """
    try:
        return await InvoiceService.update_invoice(db, invoice_id, invoice_update)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating invoice: {str(e)}"
        )

@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: uuid.UUID = Path(..., description="The ID of the invoice to delete"),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Delete an invoice.
    Permissions: Only managers and admins can delete invoices.
    """
    try:
        await InvoiceService.delete_invoice(db, invoice_id)
        return None
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting invoice: {str(e)}"
        )

@router.put("/invoices/{invoice_id}/status", response_model=InvoiceResponse)
async def update_invoice_status(
    invoice_id: uuid.UUID = Path(..., description="The ID of the invoice"),
    status_update: InvoiceStatusUpdate = Body(...),
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Update an invoice's status.
    Permissions: Only managers and admins can update invoice status.
    """
    try:
        return await InvoiceService.update_invoice_status(
            db, 
            invoice_id, 
            status_update.status, 
            status_update.notes,
            current_user.id
        )
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating invoice status: {str(e)}"
        )

@router.post("/invoices/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(
    invoice_id: uuid.UUID = Path(..., description="The ID of the invoice to send"),
    send_data: InvoiceSend = Body(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(auth_handler.verify_manager_or_admin),
    db: Session = Depends(get_db)
):
    """
    Send an invoice to the client.
    Permissions: Only managers and admins can send invoices.
    """
    try:
        return await InvoiceService.send_invoice(
            db, 
            invoice_id, 
            send_data, 
            current_user.id,
            background_tasks
        )
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except ConflictException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sending invoice: {str(e)}"
        )

@router.get("/invoices/{invoice_id}/download")
async def download_invoice(
    invoice_id: uuid.UUID = Path(..., description="The ID of the invoice to download"),
    format: str = Query("pdf", description="Format to download (pdf, csv)"),
    current_user: User = Depends(auth_handler.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download an invoice in the specified format.
    Permissions: Staff can download any invoice, clients can only download their own.
    """
    try:
        # Get the invoice
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        
        # Handle client permissions
        if current_user.role == "client":
            from app.models.client import Client
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if not client or client.id != invoice.client_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to download this invoice"
                )
        
        # Generate and return the file
        return await InvoiceService.generate_invoice_document(db, invoice_id, format)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationException as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading invoice: {str(e)}"
        )