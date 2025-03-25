from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import ConfigDict

class DashboardStats(BaseModel):
    """Schema for dashboard statistics"""
    total_work_orders: int = Field(..., description="Total number of work orders")
    active_work_orders: int = Field(..., description="Number of active work orders")
    completed_work_orders: int = Field(..., description="Number of completed work orders")
    total_clients: int = Field(..., description="Total number of clients")
    total_technicians: int = Field(..., description="Total number of technicians")
    total_revenue: float = Field(..., description="Total revenue")
    monthly_revenue: float = Field(..., description="Revenue for the current month")
    pending_payments: float = Field(..., description="Total amount of pending payments")
    unread_notifications: int = Field(..., description="Number of unread notifications")
    model_config = ConfigDict(from_attributes=True)

class WorkOrderStats(BaseModel):
    """Schema for work order statistics"""
    status_counts: Dict[str, int] = Field(..., description="Count of work orders by status")
    priority_counts: Dict[str, int] = Field(..., description="Count of work orders by priority")
    recent_work_orders: List[Dict[str, Any]] = Field(..., description="List of recent work orders")
    model_config = ConfigDict(from_attributes=True)

class RevenueStats(BaseModel):
    """Schema for revenue statistics"""
    daily_revenue: List[Dict[str, Any]] = Field(..., description="Daily revenue data")
    monthly_revenue: List[Dict[str, Any]] = Field(..., description="Monthly revenue data")
    payment_methods: Dict[str, float] = Field(..., description="Revenue by payment method")
    model_config = ConfigDict(from_attributes=True)

class TechnicianStats(BaseModel):
    """Schema for technician statistics"""
    total_technicians: int = Field(..., description="Total number of technicians")
    active_technicians: int = Field(..., description="Number of active technicians")
    technician_performance: List[Dict[str, Any]] = Field(..., description="Performance metrics for technicians")
    model_config = ConfigDict(from_attributes=True)

class ClientStats(BaseModel):
    """Schema for client statistics"""
    total_clients: int = Field(..., description="Total number of clients")
    active_clients: int = Field(..., description="Number of active clients")
    top_clients: List[Dict[str, Any]] = Field(..., description="List of top clients by revenue")
    model_config = ConfigDict(from_attributes=True)

class DashboardResponse(BaseModel):
    """Complete dashboard response schema"""
    stats: DashboardStats
    work_orders: WorkOrderStats
    revenue: RevenueStats
    technicians: TechnicianStats
    clients: ClientStats
    model_config = ConfigDict(from_attributes=True) 