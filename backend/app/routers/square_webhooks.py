"""Square webhooks: safety net for Tap to Pay.

Square calls POST /api/webhooks/square for payment.created / payment.updated. When a
COMPLETED payment carries our POS note ("Atomic Repair WO #…") and isn't recorded yet,
it's recorded on that work order — this catches Offline Mode payments and callbacks that
never made it back (closed tab, no signal).

Pay-link, portal and TechDeck card charges are recorded in the request that charges them,
so the webhook leaves those alone (it only logs a completed payment it can't place).

Setup (Railway env):
  SQUARE_WEBHOOK_SIGNATURE_KEY  — from Developer Console → Webhooks → your subscription
  SQUARE_WEBHOOK_URL            — the exact notification URL you registered, e.g.
                                  https://idims-production.up.railway.app/api/webhooks/square
"""

import base64
import hashlib
import hmac
import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ValidationException
from app.db.database import get_db
from app.models.work_order import WorkOrder

logger = logging.getLogger(__name__)

router = APIRouter()

HANDLED_EVENTS = {"payment.created", "payment.updated"}


def _signature_ok(raw_body: bytes, signature: str) -> bool:
    key = (os.getenv("SQUARE_WEBHOOK_SIGNATURE_KEY") or "").strip()
    url = (os.getenv("SQUARE_WEBHOOK_URL") or "").strip()
    if not key or not url or not signature:
        return False
    digest = hmac.new(key.encode(), url.encode() + raw_body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature.strip())


def _first_time_seen(db: Session, event_id: str, event_type: str) -> bool:
    row = db.execute(
        text(
            "INSERT INTO square_webhook_events (event_id, event_type) VALUES (:id, :type) "
            "ON CONFLICT (event_id) DO NOTHING RETURNING event_id"
        ),
        {"id": event_id, "type": event_type[:64]},
    ).first()
    return row is not None


@router.post("/square")
async def square_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    if not _signature_ok(raw, request.headers.get("x-square-hmacsha256-signature", "")):
        logger.warning("[Square webhook] bad or missing signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        event = json.loads(raw or b"{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = str(event.get("type") or "")
    event_id = str(event.get("event_id") or "")
    if event_type not in HANDLED_EVENTS or not event_id:
        return {"ok": True, "ignored": event_type or "unknown"}

    payment = ((event.get("data") or {}).get("object") or {}).get("payment") or {}
    if (payment.get("status") or "").upper() != "COMPLETED":
        return {"ok": True, "ignored": f"status {payment.get('status')}"}

    from app.services.portal_square_payment_service import get_square_config
    from app.services.tap_to_pay_service import order_number_from_note, record_square_payment

    try:
        if not _first_time_seen(db, event_id, event_type):
            db.rollback()
            return {"ok": True, "duplicate": True}

        order_number = order_number_from_note(payment.get("note"))
        if not order_number:
            db.commit()  # remember the event; nothing of ours to record
            return {"ok": True, "ignored": "not a Tap to Pay payment"}

        work_order = db.query(WorkOrder).filter(WorkOrder.order_number == order_number).first()
        if not work_order:
            logger.warning("[Square webhook] payment %s names unknown WO %s", payment.get("id"), order_number)
            db.commit()
            return {"ok": True, "ignored": "unknown work order"}

        result = record_square_payment(
            db,
            work_order,
            payment,
            cfg=get_square_config(db),
            notes="Tap to Pay — Square POS (webhook)",
        )
        db.commit()
        if not result["already_recorded"]:
            logger.info("[Square webhook] recorded %s on WO %s", payment.get("id"), order_number)
        return {"ok": True, "recorded": not result["already_recorded"]}
    except ValidationException as exc:
        db.rollback()
        logger.warning("[Square webhook] %s: %s", event_id, exc)
        return {"ok": True, "ignored": str(exc)}  # 200 so Square doesn't retry something we won't accept
    except Exception as exc:
        db.rollback()
        logger.error("[Square webhook] %s failed: %s", event_id, exc)
        raise HTTPException(status_code=500, detail="Webhook processing failed")  # Square will retry
