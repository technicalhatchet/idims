"""Pay links: public invoice + pay page (/pay/{token}) and the tech-side link lookup.

Two routers (see main.py):
  public_router → /api/public/pay        (no auth; the token is the credential)
  staff_router  → /api/work-orders       (staff auth; Pay sheet fetches the link)
"""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_staff_user
from app.core.exceptions import ValidationException
from app.db.database import get_db
from app.models.user import User
from app.services import pay_link_service as svc
from app.utils import pay_link_rate_limit as limits

logger = logging.getLogger(__name__)

public_router = APIRouter()
staff_router = APIRouter()


class PayLinkChargeRequest(BaseModel):
    amount: float
    square_source_id: str
    payment_idempotency_key: Optional[str] = None


def _private_headers(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"


@public_router.get("/{pay_token}")
async def get_pay_page(
    pay_token: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    limits.check_page_view(request)
    _private_headers(response)

    work_order = svc.load_work_order_by_pay_token(db, pay_token)
    if not work_order:
        limits.record_miss(request)
        raise HTTPException(status_code=404, detail="This pay link isn't valid.")
    try:
        return svc.build_public_pay_payload(db, work_order)
    finally:
        # Building the invoice runs calculate_totals(); a public GET never writes.
        db.rollback()


@public_router.post("/{pay_token}/charge")
async def charge_pay_link(
    pay_token: str,
    body: PayLinkChargeRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    limits.check_charge(request, pay_token)
    _private_headers(response)

    try:
        payment, completion, work_order = await svc.charge_by_pay_token(
            db,
            pay_token,
            amount=body.amount,
            square_source_id=body.square_source_id,
            payment_idempotency_key=body.payment_idempotency_key,
        )
        db.commit()
    except ValidationException as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        limits.record_miss(request)
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        logger.error("[Pay link charge] %s", exc)
        raise HTTPException(status_code=500, detail="Payment could not be completed") from exc

    try:
        from app.services.portal_review_hooks import maybe_schedule_review_request

        maybe_schedule_review_request(db, work_order.id)
    except Exception as exc:  # review request must never fail a paid charge
        logger.warning("[Pay link charge] review hook failed: %s", exc)

    square = completion.get("square") or {}
    return {
        "success": True,
        "payment_number": payment.payment_number,
        "amount": float(payment.amount),
        "receipt_url": square.get("receipt_url"),
        "work_order_completed": completion.get("work_order_completed", False),
    }


@staff_router.get("/{work_order_id}/pay-link")
async def get_work_order_pay_link(
    work_order_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_staff_user),
):
    """Pay sheet: the job's permanent pay link + amount due. Creates the token on first use."""
    work_order = svc.load_work_order_for_billing(db, work_order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    token = svc.ensure_pay_token(db, work_order)
    db.commit()

    due = svc.amount_due(work_order)
    return {
        "pay_url": svc.pay_url_for_token(token),
        "amount_due_cents": int(round(due * 100)),
        "square_status": svc.pay_state(work_order, due),
    }
