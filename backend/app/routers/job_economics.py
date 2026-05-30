import logging
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_admin_or_manager_user, get_current_user
from app.models.user import User
from app.db.database import get_db
from app.schemas.job_economics import (
    AppointmentMileageResponse,
    AppointmentMileageUpsert,
    ExpenseCategoriesResponse,
    ExpenseCategoryItem,
    ExpenseReceiptListResponse,
    ExpenseReceiptResponse,
    ExpenseVendorListResponse,
    ExpenseVendorResponse,
    JobEconomicsResponse,
    MonthlyEconomicsReportResponse,
    PropertyServiceHistoryResponse,
    WorkOrderExpenseCreate,
    WorkOrderExpenseListResponse,
    WorkOrderExpenseResponse,
    WorkOrderExpenseUpdate,
)
from app.services import job_economics_service as svc

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/categories", response_model=ExpenseCategoriesResponse)
async def get_expense_categories(current_user: User = Depends(get_current_user)):
    items = [ExpenseCategoryItem(**row) for row in svc.expense_categories_payload()]
    return ExpenseCategoriesResponse(items=items)


@router.get("/vendors", response_model=ExpenseVendorListResponse)
async def get_expense_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendors = svc.list_vendors(db)
    return ExpenseVendorListResponse(items=[ExpenseVendorResponse.model_validate(v) for v in vendors])


@router.get("/work-orders/{work_order_id}/expenses", response_model=WorkOrderExpenseListResponse)
async def list_work_order_expenses(
    work_order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = svc.list_expenses(db, work_order_id)
    total = sum((r.amount for r in rows), start=0)
    return WorkOrderExpenseListResponse(
        items=[WorkOrderExpenseResponse.model_validate(r) for r in rows],
        total=total,
    )


@router.post(
    "/work-orders/{work_order_id}/expenses",
    response_model=WorkOrderExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_work_order_expense(
    work_order_id: UUID,
    body: WorkOrderExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        created = svc.create_expense(db, work_order_id, body.model_dump(), current_user.id)
        rows = svc.list_expenses(db, work_order_id)
        item = next((r for r in rows if r.id == created.id), created)
        return WorkOrderExpenseResponse.model_validate(item)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/expenses/{expense_id}", response_model=WorkOrderExpenseResponse)
async def update_work_order_expense(
    expense_id: UUID,
    body: WorkOrderExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        row = svc.update_expense(db, expense_id, body.model_dump(exclude_unset=True))
        return WorkOrderExpenseResponse.model_validate(row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order_expense(
    expense_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        svc.delete_expense(db, expense_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/work-orders/{work_order_id}/receipts", response_model=ExpenseReceiptListResponse)
async def list_work_order_receipts(
    work_order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = svc.list_receipts(db, work_order_id)
    return ExpenseReceiptListResponse(items=[ExpenseReceiptResponse.model_validate(r) for r in rows])


@router.post(
    "/work-orders/{work_order_id}/receipts",
    response_model=ExpenseReceiptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_work_order_receipt(
    work_order_id: UUID,
    file: UploadFile = File(...),
    expense_id: Optional[UUID] = Form(None),
    category: str = Form("misc"),
    vendor_name: str = Form("receipt"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=422, detail="Empty file")
        row = svc.save_receipt(
            db,
            work_order_id=work_order_id,
            user_id=current_user.id,
            file_bytes=content,
            original_filename=file.filename or "receipt.jpg",
            mime_type=file.content_type or "application/octet-stream",
            expense_id=expense_id,
            category=category,
            vendor_name=vendor_name,
        )
        return ExpenseReceiptResponse.model_validate(row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put(
    "/appointments/{appointment_id}/mileage",
    response_model=AppointmentMileageResponse,
)
async def upsert_appointment_mileage(
    appointment_id: UUID,
    body: AppointmentMileageUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        row = svc.upsert_appointment_mileage(db, appointment_id, body.model_dump(), current_user.id)
        return AppointmentMileageResponse.model_validate(row)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/work-orders/{work_order_id}/mileage")
async def list_work_order_mileage(
    work_order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = svc.list_mileage_for_work_order(db, work_order_id)
    return {"items": [AppointmentMileageResponse.model_validate(r) for r in rows]}


@router.get(
    "/work-orders/{work_order_id}/economics",
    response_model=JobEconomicsResponse,
)
async def get_job_economics(
    work_order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    try:
        data = svc.compute_job_economics(db, work_order_id)
        return JobEconomicsResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/reports/monthly", response_model=MonthlyEconomicsReportResponse)
async def get_monthly_economics_report(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_or_manager_user),
):
    data = svc.monthly_economics_report(db, year, month)
    return MonthlyEconomicsReportResponse(**data)


@router.get("/properties/{property_id}/service-history", response_model=PropertyServiceHistoryResponse)
async def get_property_service_history(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        data = svc.property_service_history(db, property_id)
        return PropertyServiceHistoryResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
