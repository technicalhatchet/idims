"""
Pydantic schemas for Stripe payment operations
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from decimal import Decimal

class StripeLineItem(BaseModel):
    """Schema for Stripe line item"""
    name: str = Field(..., description="Name of the item")
    description: Optional[str] = Field(None, description="Description of the item")
    price: Decimal = Field(..., description="Price of the item")
    quantity: int = Field(1, description="Quantity of the item")
    is_discount: bool = Field(False, description="Whether this is a discount line item")

class CreateCheckoutSessionRequest(BaseModel):
    """Schema for creating a Stripe checkout session"""
    work_order_id: str = Field(..., description="Work order ID")
    client_email: Optional[str] = Field(None, description="Client's email address")
    client_name: Optional[str] = Field(None, description="Client's name")
    success_url: str = Field(..., description="URL to redirect to on successful payment")
    cancel_url: str = Field(..., description="URL to redirect to on cancelled payment")
    metadata: Optional[Dict[str, str]] = Field(None, description="Additional metadata")

class CreateCheckoutSessionResponse(BaseModel):
    """Schema for Stripe checkout session response"""
    session_id: str = Field(..., description="Stripe session ID")
    url: str = Field(..., description="Checkout URL")
    payment_intent_id: Optional[str] = Field(None, description="Payment intent ID")
    amount_total: int = Field(..., description="Total amount in cents")
    currency: str = Field(..., description="Currency code")

class PaymentSessionStatus(BaseModel):
    """Schema for payment session status"""
    session_id: str = Field(..., description="Stripe session ID")
    payment_status: str = Field(..., description="Payment status")
    payment_intent_id: Optional[str] = Field(None, description="Payment intent ID")
    amount_total: int = Field(..., description="Total amount in cents")
    currency: str = Field(..., description="Currency code")
    customer_email: Optional[str] = Field(None, description="Customer email")
    metadata: Dict[str, str] = Field(default_factory=dict, description="Session metadata")
    status: str = Field(..., description="Session status")

class PaymentSuccessResponse(BaseModel):
    """Schema for payment success response"""
    payment_intent_id: str = Field(..., description="Payment intent ID")
    amount: int = Field(..., description="Amount in cents")
    currency: str = Field(..., description="Currency code")
    status: str = Field(..., description="Payment status")
    metadata: Dict[str, str] = Field(default_factory=dict, description="Payment metadata")
    charges: List[Dict[str, Any]] = Field(default_factory=list, description="Charge details")

class WebhookEvent(BaseModel):
    """Schema for Stripe webhook event"""
    id: str = Field(..., description="Event ID")
    type: str = Field(..., description="Event type")
    data: Dict[str, Any] = Field(..., description="Event data")
    created: int = Field(..., description="Event creation timestamp")
    livemode: bool = Field(False, description="Whether this is a live mode event")

class ProcessPaymentRequest(BaseModel):
    """Schema for processing payment (internal use)"""
    work_order_id: str = Field(..., description="Work order ID")
    amount: Decimal = Field(..., description="Payment amount")
    payment_method: str = Field("stripe", description="Payment method")
    metadata: Optional[Dict[str, str]] = Field(None, description="Additional metadata")

class ProcessPaymentResponse(BaseModel):
    """Schema for payment processing response"""
    success: bool = Field(..., description="Whether payment was successful")
    payment_id: str = Field(..., description="Payment ID")
    amount: Decimal = Field(..., description="Payment amount")
    currency: str = Field("usd", description="Currency")
    status: str = Field(..., description="Payment status")
    message: Optional[str] = Field(None, description="Additional message")

