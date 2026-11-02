"""Tenant property scope for client portal routes."""

from __future__ import annotations

import uuid
from typing import Any, List, Optional, Set

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Query as SAQuery, Session

from app.db.database import get_db
from app.models.client_appliance import ClientAppliance
from app.models.notification import Notification
from app.models.property import Property
from app.models.work_order import WorkOrder
from app.services.portal_login_service import (
    PortalLoginError,
    PortalScope,
    get_portal_scope,
)

_scope_bearer = HTTPBearer()


async def _portal_token_data(
    credentials: HTTPAuthorizationCredentials = Depends(_scope_bearer),
):
    from app.core.auth import get_auth_handler

    auth_handler = get_auth_handler()
    return await auth_handler.verify_token(credentials.credentials)


def _parse_admin_client_id(admin_client_id: Optional[str]) -> Optional[uuid.UUID]:
    if not admin_client_id:
        return None
    try:
        return uuid.UUID(admin_client_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid admin_client_id")


def get_portal_scope_from_request(
    db: Session,
    token_data: Any,
    *,
    admin_client_id: Optional[str] = None,
) -> PortalScope:
    parsed = _parse_admin_client_id(admin_client_id)
    try:
        return get_portal_scope(db, token_data, admin_client_id=parsed)
    except PortalLoginError as exc:
        if exc.code == "revoked":
            raise HTTPException(status_code=403, detail=exc.message) from exc
        if exc.code == "admin_no_client":
            raise HTTPException(status_code=400, detail=exc.message) from exc
        if exc.code == "forbidden":
            raise HTTPException(status_code=403, detail=exc.message) from exc
        raise HTTPException(
            status_code=404,
            detail="No client record found for this account. Please contact support.",
        ) from exc


async def portal_scope_dependency(
    token_data=Depends(_portal_token_data),
    db: Session = Depends(get_db),
    admin_client_id: Optional[str] = Query(None),
) -> PortalScope:
    return get_portal_scope_from_request(db, token_data, admin_client_id=admin_client_id)


def _property_id_set(scope: PortalScope) -> Optional[Set[uuid.UUID]]:
    if scope.property_ids is None:
        return None
    return set(scope.property_ids)


def assert_property_in_scope(
    db: Session,
    scope: PortalScope,
    property_id: Optional[uuid.UUID],
) -> None:
    del db
    if property_id is None:
        if scope.is_tenant:
            raise HTTPException(status_code=404, detail="Not found")
        return
    allowed = _property_id_set(scope)
    if allowed is not None and property_id not in allowed:
        raise HTTPException(status_code=404, detail="Not found")


def require_owner(scope: PortalScope) -> None:
    if scope.is_tenant:
        raise HTTPException(status_code=404, detail="Not found")


def tenant_blocks_billing(scope: PortalScope) -> bool:
    return scope.is_tenant


def filter_property_query(query: SAQuery, scope: PortalScope) -> SAQuery:
    query = query.filter(Property.client_id == scope.client.id)
    allowed = _property_id_set(scope)
    if allowed is not None:
        if not allowed:
            query = query.filter(Property.id.is_(None))
        else:
            query = query.filter(Property.id.in_(list(allowed)))
    return query


def filter_work_order_query(query: SAQuery, scope: PortalScope) -> SAQuery:
    query = query.filter(WorkOrder.client_id == scope.client.id)
    allowed = _property_id_set(scope)
    if allowed is not None:
        if not allowed:
            query = query.filter(WorkOrder.id.is_(None))
        else:
            query = query.filter(WorkOrder.property_id.in_(list(allowed)))
    return query


def filter_appliance_query(query: SAQuery, scope: PortalScope) -> SAQuery:
    query = query.filter(ClientAppliance.client_id == scope.client.id)
    allowed = _property_id_set(scope)
    if allowed is not None:
        if not allowed:
            query = query.filter(ClientAppliance.id.is_(None))
        else:
            query = query.filter(ClientAppliance.property_id.in_(list(allowed)))
    return query


def load_property_for_scope(db: Session, scope: PortalScope, property_id: uuid.UUID) -> Property:
    prop = (
        db.query(Property)
        .filter(Property.id == property_id, Property.client_id == scope.client.id)
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Not found")
    assert_property_in_scope(db, scope, prop.id)
    return prop


def load_work_order_for_scope(
    db: Session,
    scope: PortalScope,
    work_order_id: uuid.UUID,
) -> WorkOrder:
    wo = (
        db.query(WorkOrder)
        .filter(WorkOrder.id == work_order_id, WorkOrder.client_id == scope.client.id)
        .first()
    )
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    assert_property_in_scope(db, scope, wo.property_id)
    return wo


def load_appliance_for_scope(
    db: Session,
    scope: PortalScope,
    appliance_id: uuid.UUID,
) -> ClientAppliance:
    app = (
        db.query(ClientAppliance)
        .filter(ClientAppliance.id == appliance_id, ClientAppliance.client_id == scope.client.id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Appliance not found")
    assert_property_in_scope(db, scope, app.property_id)
    return app


def notification_visible_for_scope(
    db: Session,
    scope: PortalScope,
    notification: Notification,
) -> bool:
    if not scope.is_tenant:
        return True
    related_type = (notification.related_type or "").lower()
    if related_type not in ("work_order", "workorder") or not notification.related_id:
        return True
    wo = db.query(WorkOrder).filter(WorkOrder.id == notification.related_id).first()
    if not wo or wo.client_id != scope.client.id:
        return False
    allowed = _property_id_set(scope)
    if allowed is None:
        return True
    return wo.property_id in allowed if wo.property_id else False


_TENANT_WO_STRIP_KEYS = frozenset({
    "invoice_total",
    "invoice_subtotal",
    "invoice_tax",
    "balance_due",
    "estimate_total",
    "estimate_lines",
    "estimate_available",
    "estimate_approval",
    "estimate_expires_at",
    "estimate_expired",
    "diagnostic_completed_at",
    "pricing",
    "payment",
    "can_pay",
    "can_pay_online",
    "subtotal",
    "tax",
    "total",
    "amount_paid",
})


def strip_tenant_work_order_dict(payload: dict) -> dict:
    out = dict(payload)
    for key in _TENANT_WO_STRIP_KEYS:
        out.pop(key, None)
    if isinstance(out.get("services"), list):
        out["services"] = [
            {k: v for k, v in item.items() if k not in ("price", "total", "unit_price", "line_total")}
            if isinstance(item, dict)
            else item
            for item in out["services"]
        ]
    if isinstance(out.get("history"), list):
        out["history"] = [strip_tenant_work_order_dict(item) if isinstance(item, dict) else item for item in out["history"]]
    return out


def maybe_strip_work_order_payload(scope: PortalScope, payload: dict) -> dict:
    if not tenant_blocks_billing(scope):
        return payload
    return strip_tenant_work_order_dict(payload)
