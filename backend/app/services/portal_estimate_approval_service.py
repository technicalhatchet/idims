"""Portal estimate approve/decline (Wave 1A)."""

from __future__ import annotations

import base64
import logging
import re
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_login import ClientLogin
from app.models.estimate_approval import EstimateApproval
from app.models.work_order import WorkOrder
from app.services.google_drive_service import upload_photo_to_drive
from app.services.portal_estimate_content import (
    build_portal_estimate_snapshot,
    estimate_approval_content_changed,
)
from app.services.work_order_invoice_pdf_data import generate_work_order_estimate_pdf_v2
from app.utils.portal_estimate import portal_estimate_meta

logger = logging.getLogger(__name__)


class EstimateApprovalError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _latest_for_hash(db: Session, work_order_id: UUID, content_hash: str) -> Optional[EstimateApproval]:
    return (
        db.query(EstimateApproval)
        .filter(
            EstimateApproval.work_order_id == work_order_id,
            EstimateApproval.estimate_content_hash == content_hash,
        )
        .order_by(EstimateApproval.created_at.desc())
        .first()
    )


def _latest_approved_for_hash(db: Session, work_order_id: UUID, content_hash: str) -> Optional[EstimateApproval]:
    return (
        db.query(EstimateApproval)
        .filter(
            EstimateApproval.work_order_id == work_order_id,
            EstimateApproval.estimate_content_hash == content_hash,
            EstimateApproval.decision == "approved",
        )
        .order_by(EstimateApproval.created_at.desc())
        .first()
    )


def _decode_signature_png(data: str) -> bytes:
    raw = (data or "").strip()
    if raw.startswith("data:"):
        raw = raw.split(",", 1)[-1]
    try:
        content = base64.b64decode(raw, validate=True)
    except Exception:
        raise EstimateApprovalError("invalid_signature", "Signature image is invalid.")
    if len(content) < 100 or len(content) > 2_000_000:
        raise EstimateApprovalError("invalid_signature", "Signature image is invalid.")
    if not content.startswith(b"\x89PNG"):
        raise EstimateApprovalError("invalid_signature", "Signature must be a PNG image.")
    return content


def _upload_bytes_to_drive(
    *,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    order_number: str,
) -> Optional[str]:
    result = upload_photo_to_drive(
        file_bytes=file_bytes,
        filename=filename,
        mime_type=mime_type,
        order_number=order_number,
        year=date.today().year,
    )
    if not result:
        return None
    return result[0]


def assert_can_decide_estimate(
    db: Session,
    work_order: WorkOrder,
    *,
    decision: str,
    content_hash: str,
) -> None:
    meta = portal_estimate_meta(work_order, db)
    if not meta.get("estimate_available"):
        raise EstimateApprovalError(
            "expired",
            "This estimate has expired. Estimates are valid for 30 days after your diagnostic visit.",
            status_code=400,
        )
    status = work_order.status
    status_val = status.value if hasattr(status, "value") else str(status)
    if status_val != "pending_estimate_approval":
        raise EstimateApprovalError(
            "not_pending",
            "This work order is not waiting for estimate approval.",
            status_code=400,
        )

    latest = _latest_for_hash(db, work_order.id, content_hash)
    if latest and latest.decision == "approved":
        if decision == "declined":
            raise EstimateApprovalError(
                "already_approved",
                "This estimate was already approved. Please call Atomic Repair if you need to change your decision.",
                status_code=400,
            )
        if decision == "approved":
            raise EstimateApprovalError(
                "already_approved",
                "This estimate was already approved.",
                status_code=400,
            )


def get_estimate_approval_state(
    db: Session,
    work_order: WorkOrder,
) -> Dict[str, Any]:
    snapshot = build_portal_estimate_snapshot(db, work_order)
    content_hash = snapshot["estimate_content_hash"]
    latest = _latest_for_hash(db, work_order.id, content_hash)
    latest_approved_any = (
        db.query(EstimateApproval)
        .filter(
            EstimateApproval.work_order_id == work_order.id,
            EstimateApproval.decision == "approved",
        )
        .order_by(EstimateApproval.created_at.desc())
        .first()
    )
    estimate_changed_since_approval = False
    if latest_approved_any and estimate_approval_content_changed(
        latest_approved_any.estimate_content_hash, snapshot
    ):
        estimate_changed_since_approval = True

    needs_new_approval = estimate_changed_since_approval

    state = {
        **snapshot,
        **portal_estimate_meta(work_order, db),
        "can_approve": False,
        "can_decline": False,
        "current_decision": None,
        "signer_name": None,
        "decided_at": None,
        "decline_reason": None,
        "estimate_changed_since_approval": estimate_changed_since_approval,
        "needs_new_approval": needs_new_approval,
    }
    if not state.get("estimate_available"):
        return state
    if state.get("estimate_available") and _status_is_pending(work_order):
        if not latest or latest.decision == "declined":
            state["can_approve"] = True
            state["can_decline"] = True
        elif latest.decision == "approved":
            state["current_decision"] = "approved"
            state["signer_name"] = latest.signer_name
            state["decided_at"] = latest.created_at.isoformat() if latest.created_at else None
        if latest and latest.decision == "declined":
            state["current_decision"] = "declined"
            state["decline_reason"] = latest.decline_reason
            state["decided_at"] = latest.created_at.isoformat() if latest.created_at else None
    elif latest:
        state["current_decision"] = latest.decision
        state["signer_name"] = latest.signer_name
        state["decline_reason"] = latest.decline_reason
        state["decided_at"] = latest.created_at.isoformat() if latest.created_at else None
    return state


def _status_is_pending(work_order: WorkOrder) -> bool:
    status = work_order.status
    return (status.value if hasattr(status, "value") else str(status)) == "pending_estimate_approval"


def portal_estimate_approval_summary(db: Session, work_order: WorkOrder) -> Dict[str, Any]:
    state = get_estimate_approval_state(db, work_order)
    return {
        "can_approve": state.get("can_approve"),
        "can_decline": state.get("can_decline"),
        "current_decision": state.get("current_decision"),
        "signer_name": state.get("signer_name"),
        "decided_at": state.get("decided_at"),
        "decline_reason": state.get("decline_reason"),
        "needs_new_approval": state.get("needs_new_approval"),
        "total": state.get("total"),
        "lines": state.get("lines"),
    }


def staff_estimate_approval_summary(db: Session, work_order: WorkOrder) -> Dict[str, Any]:
    snapshot = build_portal_estimate_snapshot(db, work_order)
    content_hash = snapshot["estimate_content_hash"]
    latest = _latest_for_hash(db, work_order.id, content_hash)
    latest_approved = (
        db.query(EstimateApproval)
        .filter(
            EstimateApproval.work_order_id == work_order.id,
            EstimateApproval.decision == "approved",
        )
        .order_by(EstimateApproval.created_at.desc())
        .first()
    )
    changed = bool(
        latest_approved
        and estimate_approval_content_changed(latest_approved.estimate_content_hash, snapshot)
    )
    if not latest:
        return {
            "badge": None,
            "estimate_changed_since_approval": changed,
            "latest": None,
        }
    return {
        "badge": latest.decision,
        "estimate_changed_since_approval": changed,
        "latest": {
            "decision": latest.decision,
            "signer_name": latest.signer_name,
            "created_at": latest.created_at.isoformat() if latest.created_at else None,
            "decline_reason": latest.decline_reason,
            "estimate_total": float(latest.estimate_total),
            "estimate_content_hash": latest.estimate_content_hash,
            "signature_drive_file_id": latest.signature_drive_file_id,
            "estimate_pdf_drive_file_id": latest.estimate_pdf_drive_file_id,
            "decision_source": getattr(latest, "decision_source", None) or "customer",
            "staff_user_name": getattr(latest, "staff_user_name", None),
            "staff_note": getattr(latest, "staff_note", None),
        },
    }


async def notify_staff_estimate_decision(
    db: Session,
    *,
    work_order: WorkOrder,
    decision: str,
    signer_name: Optional[str] = None,
    decline_reason: Optional[str] = None,
) -> None:
    from app.services.feature_flags_service import feature_enabled

    if not feature_enabled(db, "estimate_approval", None):
        return
    from app.services.portal_staff_notify_service import notify_staff_estimate_decision as _notify

    await _notify(
        db,
        work_order=work_order,
        decision=decision,
        signer_name=signer_name,
        decline_reason=decline_reason,
    )


def record_estimate_approval(
    db: Session,
    *,
    work_order: WorkOrder,
    client: Client,
    login: Optional[ClientLogin],
    decision: str,
    signer_name: Optional[str],
    signature_png_b64: Optional[str],
    decline_reason: Optional[str],
    ip: Optional[str],
    user_agent: Optional[str],
    decision_source: str = "customer",
    staff_user_id: Optional[UUID] = None,
    staff_user_name: Optional[str] = None,
    staff_note: Optional[str] = None,
) -> EstimateApproval:
    snapshot = build_portal_estimate_snapshot(db, work_order)
    content_hash = snapshot["estimate_content_hash"]
    assert_can_decide_estimate(db, work_order, decision=decision, content_hash=content_hash)

    sig_drive_id = None
    pdf_drive_id = None
    order_number = work_order.order_number or str(work_order.id)[:8]

    staff_on_behalf = decision_source == "staff_on_behalf"

    if decision == "approved":
        if staff_on_behalf:
            if not (staff_user_name or "").strip():
                raise EstimateApprovalError(
                    "staff_required",
                    "Staff name is required for on-behalf approval.",
                )
        elif not (signer_name or "").strip():
            raise EstimateApprovalError("name_required", "Please enter your name.")
        sig_bytes = None
        if not staff_on_behalf:
            sig_bytes = _decode_signature_png(signature_png_b64 or "")
        sig_drive_id = None
        if sig_bytes:
            safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "-", (signer_name or "").strip())[:40]
            sig_drive_id = _upload_bytes_to_drive(
                file_bytes=sig_bytes,
                filename=f"{order_number}_estimate-signature_{safe_name}.png",
                mime_type="image/png",
                order_number=order_number,
            )
        pdf_bytes = generate_work_order_estimate_pdf_v2(db, work_order, variant="light")
        pdf_drive_id = _upload_bytes_to_drive(
            file_bytes=pdf_bytes,
            filename=f"{order_number}_estimate-approved-snapshot.pdf",
            mime_type="application/pdf",
            order_number=order_number,
        )

    display_signer = (signer_name or "").strip() or None
    if staff_on_behalf and decision == "approved":
        display_signer = (staff_user_name or "").strip() or None

    row = EstimateApproval(
        work_order_id=work_order.id,
        client_id=client.id,
        client_login_id=login.id if login else None,
        decision=decision,
        signer_name=display_signer,
        signature_drive_file_id=sig_drive_id,
        estimate_total=Decimal(str(snapshot["total"])),
        estimate_content_hash=content_hash,
        estimate_pdf_drive_file_id=pdf_drive_id,
        decline_reason=(decline_reason or "").strip() or None,
        decision_source=decision_source,
        staff_user_id=staff_user_id,
        staff_user_name=(staff_user_name or "").strip() or None,
        staff_note=(staff_note or "").strip() or None,
        ip=ip,
        user_agent=(user_agent or "")[:500] or None,
    )
    db.add(row)
    db.flush()
    return row
