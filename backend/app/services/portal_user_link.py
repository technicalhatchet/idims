"""Portal link-account: sync clients.user_id to users row for Auth0 sub (phase 2e)."""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.auth import get_auth_handler
from app.models.client import Client
from app.models.notification import Notification
from app.models.user import User as DBUser

from app.services.portal_user_auth import STAFF_ROLES, is_placeholder_client_auth_id

logger = logging.getLogger(__name__)

def _customer_user_id_moves():
    """Tables that exist in prod and are customer-owned by users.id."""
    from app.models.document import Document
    from app.models.push_subscription import PushSubscription

    return (
        (Notification, "user_id"),
        (PushSubscription, "user_id"),
        (Document, "user_id"),
    )

# FKs to users.id we intentionally do NOT move (staff/technician attribution, WO audit, etc.):
# clients.created_by, work_orders.*_by, invoices.created_by, quotes.created_by,
# payments.created_by, audit_log.user_id, logit.user_id, deploy_reminders.user_id,
# technician.user_id, job_economics.*, media.uploaded_by, work_order_payments.recorded_by, ...


def _roles_from_token(token_data: Any) -> list:
    roles = getattr(token_data, "roles", None) or []
    if isinstance(roles, list):
        return [str(r) for r in roles]
    return []


def ensure_db_user_for_portal_link(
    db: Session,
    token_data: Any,
    *,
    client: Optional[Client] = None,
) -> DBUser:
    """
    Resolve users row for token sub using the same path as get_current_user.
    Never elevates to staff from this module — roles come from the token only.
    """
    roles = _roles_from_token(token_data)
    if roles and any(r in STAFF_ROLES for r in roles):
        logger.warning(
            "[LinkAccount] ensure_db_user called with staff roles in token: %s sub=%s",
            roles,
            getattr(token_data, "sub", None),
        )
    trusted_placeholder = None
    if client and client.user_id:
        linked = db.query(DBUser).filter(DBUser.id == client.user_id).first()
        if linked and is_placeholder_client_auth_id(linked.auth_id):
            trusted_placeholder = linked
    auth_handler = get_auth_handler()
    return auth_handler.ensure_db_user_from_token(
        db,
        token_data,
        trusted_placeholder_user=trusted_placeholder,
    )


def repoint_user_customer_data_collect_ids(
    db: Session,
    *,
    from_user_id: UUID,
    to_user_id: UUID,
) -> Dict[str, List[str]]:
    """Move customer-owned rows between users; return table -> moved row ids."""
    moved: Dict[str, List[str]] = {}
    for model, column_name in _customer_user_id_moves():
        column = getattr(model, column_name)
        rows = db.query(model.id).filter(column == from_user_id).all()
        ids = [row[0] for row in rows]
        if not ids:
            continue
        db.query(model).filter(model.id.in_(ids)).update(
            {column_name: to_user_id},
            synchronize_session=False,
        )
        moved[model.__tablename__] = [str(i) for i in ids]
    return moved


def repoint_placeholder_user_customer_data(
    db: Session,
    *,
    placeholder_user_id: UUID,
    real_user_id: UUID,
    client_id: UUID,
) -> Dict[str, int]:
    """Move customer-owned rows from staff placeholder user to Auth0-linked user. Placeholder row kept."""
    moved = repoint_user_customer_data_collect_ids(
        db,
        from_user_id=placeholder_user_id,
        to_user_id=real_user_id,
    )
    counts = {table: len(ids) for table, ids in moved.items()}

    logger.info(
        "[LinkAccount] Repointed placeholder user %s -> %s for client %s (placeholder auth_id kept): %s",
        placeholder_user_id,
        real_user_id,
        client_id,
        counts,
    )
    return counts


def sync_client_user_id_on_link(
    db: Session,
    client: Client,
    token_data: Any,
    *,
    login=None,
) -> None:
    """Set or repoint client.user_id; migrate data off staff placeholder users."""
    auth0_user_id = getattr(token_data, "sub", None)
    if not auth0_user_id:
        logger.warning("[LinkAccount] sync_client_user_id skipped: no token sub")
        return

    user = ensure_db_user_for_portal_link(db, token_data, client=client)

    if login is not None:
        from app.services.portal_login_service import sync_login_user_id

        sync_login_user_id(db, login, user)

    if client.user_id is None:
        client.user_id = user.id
        db.commit()
        db.refresh(client)
        logger.info(
            "[LinkAccount] Set client %s user_id=%s for sub=%s",
            client.id,
            user.id,
            auth0_user_id,
        )
        return

    if client.user_id == user.id:
        return

    linked_user = db.query(DBUser).filter(DBUser.id == client.user_id).first()
    linked_auth_id = getattr(linked_user, "auth_id", None)

    if linked_user and is_placeholder_client_auth_id(linked_auth_id):
        repoint_placeholder_user_customer_data(
            db,
            placeholder_user_id=linked_user.id,
            real_user_id=user.id,
            client_id=client.id,
        )
        logger.info(
            "[LinkAccount] Replaced placeholder user_id for client %s: placeholder_user=%s auth_id=%s -> real_user=%s sub=%s",
            client.id,
            linked_user.id,
            linked_auth_id,
            user.id,
            auth0_user_id,
        )
        client.user_id = user.id
        db.commit()
        db.refresh(client)
        return

    logger.warning(
        "[LinkAccount] client.user_id conflict client_id=%s stored_user_id=%s "
        "stored_auth_id=%s token_sub=%s resolved_user_id=%s",
        client.id,
        client.user_id,
        linked_auth_id,
        auth0_user_id,
        user.id,
    )
