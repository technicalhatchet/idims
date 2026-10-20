"""Admin client merge — repoint FK children, survivor field merge, portal login rules (phase 2f)."""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Type
from uuid import UUID

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.client_appliance import ClientAppliance
from app.models.client_merge_audit import ClientMergeAudit
from app.models.client_login import ClientLogin
from app.models.client_portal_claim import ClientPortalClaim
from app.models.document import Document
from app.models.invoice import Invoice
from app.models.payment import PaymentMethod
from app.models.property import Property
from app.models.quote import Quote
from app.models.user import User as DBUser
from app.models.work_order import WorkOrder
from app.services.portal_user_auth import is_placeholder_client_auth_id, user_has_staff_role
from app.services.portal_login_service import count_active_logins, has_real_portal_login
from app.services.portal_user_link import repoint_user_customer_data_collect_ids
from app.utils.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)

FieldChoice = str  # "keep" | "merge"

CLIENT_ID_REPOINT_MODELS: Tuple[Tuple[Type, str], ...] = (
    (Property, "client_id"),
    (ClientAppliance, "client_id"),
    (WorkOrder, "client_id"),
    (Quote, "client_id"),
    (Invoice, "client_id"),
    (PaymentMethod, "client_id"),
    (Document, "client_id"),
    (ClientLogin, "client_id"),
)


class ClientMergeError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def client_is_merged(client: Client) -> bool:
    return client.merged_into_client_id is not None


def active_client_query(db: Session):
    """Clients eligible for list, search, portal link, and merge."""
    return db.query(Client).filter(Client.merged_into_client_id.is_(None))


def _load_user(db: Session, user_id: Optional[UUID]) -> Optional[DBUser]:
    if not user_id:
        return None
    return db.query(DBUser).filter(DBUser.id == user_id).first()


def _is_real_login_user(user: Optional[DBUser]) -> bool:
    if not user or user_has_staff_role(user):
        return False
    auth_id = getattr(user, "auth_id", None)
    if not auth_id or is_placeholder_client_auth_id(auth_id):
        return False
    return True


def _merge_moved_chunks(moved: Dict[str, List[str]], chunk: Dict[str, List[str]]) -> None:
    for table, ids in chunk.items():
        moved.setdefault(table, []).extend(ids)


def _client_core_snapshot(db: Session, client: Client) -> Dict[str, Any]:
    return {
        "id": str(client.id),
        "first_name": client.first_name,
        "last_name": client.last_name,
        "email": client.email,
        "phone": client.phone,
        "mobile": client.mobile,
        "company_name": client.company_name,
        "status": client.status,
        "auth0_user_id": client.auth0_user_id,
        "user_id": str(client.user_id) if client.user_id else None,
        "has_portal_login": has_real_portal_login(db, client),
        "active_login_count": count_active_logins(db, client.id),
        "merged_into_client_id": (
            str(client.merged_into_client_id) if client.merged_into_client_id else None
        ),
    }


def _count_rows(db: Session, model: Type, merge_id: UUID) -> int:
    column = getattr(model, "client_id")
    return db.query(model).filter(column == merge_id).count()


def _table_exists(db: Session, table_name: str) -> bool:
    try:
        bind = db.get_bind()
        return table_name in inspect(bind).get_table_names(schema="public")
    except Exception:
        return False


def _count_media_client_rows(db: Session, merge_id: UUID) -> int:
    if not _table_exists(db, "media"):
        return 0
    from app.models.media import Media, MediaType

    return (
        db.query(Media)
        .filter(Media.media_type == MediaType.CLIENT, Media.reference_id == merge_id)
        .count()
    )


def _normalize_address_key(address: Optional[str]) -> str:
    if not address:
        return ""
    return re.sub(r"\s+", " ", str(address).strip().lower())


def _property_duplicate_warnings(
    db: Session, keep_id: UUID, merge_id: UUID
) -> List[Dict[str, str]]:
    keep_props = db.query(Property).filter(Property.client_id == keep_id).all()
    merge_props = db.query(Property).filter(Property.client_id == merge_id).all()
    keep_keys = {_normalize_address_key(p.address) for p in keep_props if p.address}
    warnings: List[Dict[str, str]] = []
    for prop in merge_props:
        key = _normalize_address_key(prop.address)
        if key and key in keep_keys:
            warnings.append(
                {
                    "code": "duplicate_property_address",
                    "message": f"Duplicate property address after merge: {prop.address}",
                    "severity": "warning",
                }
            )
    return warnings


def _appliance_duplicate_warnings(
    db: Session, keep_id: UUID, merge_id: UUID
) -> List[Dict[str, str]]:
    def norm(s: Optional[str]) -> str:
        return (s or "").strip().lower()

    keep_apps = (
        db.query(ClientAppliance)
        .filter(ClientAppliance.client_id == keep_id, ClientAppliance.is_active.is_(True))
        .all()
    )
    merge_apps = (
        db.query(ClientAppliance)
        .filter(ClientAppliance.client_id == merge_id, ClientAppliance.is_active.is_(True))
        .all()
    )
    warnings: List[Dict[str, str]] = []
    for ma in merge_apps:
        for ka in keep_apps:
            serial_a, serial_b = norm(ma.serial), norm(ka.serial)
            if serial_a and serial_b and serial_a == serial_b:
                warnings.append(
                    {
                        "code": "duplicate_appliance_serial",
                        "message": f"Likely duplicate appliance (serial {ma.serial}).",
                        "severity": "warning",
                    }
                )
                break
            make_a, make_b = norm(ma.make), norm(ka.make)
            model_a, model_b = norm(ma.model), norm(ka.model)
            if make_a and make_b and model_a and model_b and make_a == make_b and model_a == model_b:
                warnings.append(
                    {
                        "code": "duplicate_appliance_model",
                        "message": f"Likely duplicate appliance ({ma.make} {ma.model}).",
                        "severity": "warning",
                    }
                )
                break
    return warnings


def _contact_conflict_warnings(keep: Client, merge: Client) -> List[Dict[str, str]]:
    warnings: List[Dict[str, str]] = []
    if keep.email and merge.email and keep.email.strip().lower() != merge.email.strip().lower():
        warnings.append(
            {
                "code": "conflicting_email",
                "message": "Clients have different email addresses; choose which to keep.",
                "severity": "warning",
            }
        )
    if keep.phone and merge.phone and keep.phone.strip() != merge.phone.strip():
        warnings.append(
            {
                "code": "conflicting_phone",
                "message": "Clients have different phone numbers; choose which to keep.",
                "severity": "warning",
            }
        )
    if keep.mobile and merge.mobile and keep.mobile.strip() != merge.mobile.strip():
        warnings.append(
            {
                "code": "conflicting_mobile",
                "message": "Clients have different mobile numbers; choose which to keep.",
                "severity": "warning",
            }
        )
    return warnings


def _blockers(keep: Client, merge: Client, db: Session) -> List[Dict[str, str]]:
    blockers: List[Dict[str, str]] = []
    if keep.id == merge.id:
        blockers.append(
            {"code": "same_client", "message": "Cannot merge a client with itself.", "severity": "blocker"}
        )
    if client_is_merged(keep):
        blockers.append(
            {
                "code": "keep_already_merged",
                "message": "The keep client was already merged into another record.",
                "severity": "blocker",
            }
        )
    if client_is_merged(merge):
        blockers.append(
            {
                "code": "merge_already_merged",
                "message": "The merge client was already merged into another record.",
                "severity": "blocker",
            }
        )
    blockers.extend(_auth0_user_identity_blockers(db, keep, merge))
    return blockers


def _auth0_user_identity_blockers(db: Session, keep: Client, merge: Client) -> List[Dict[str, str]]:
    """Block when keep.user_id is a real user not tied to any active login on either client."""
    keep_user = _load_user(db, keep.user_id)
    if not keep_user or not _is_real_login_user(keep_user):
        return []
    active_subs = set()
    for client_id in (keep.id, merge.id):
        for login in (
            db.query(ClientLogin)
            .filter(
                ClientLogin.client_id == client_id,
                ClientLogin.revoked_at.is_(None),
            )
            .all()
        ):
            sub = (login.auth0_user_id or "").strip()
            if sub:
                active_subs.add(sub)
    if keep_user.auth_id in active_subs:
        return []
    if not active_subs:
        return []
    return [
        {
            "code": "auth0_user_id_mismatch",
            "message": (
                "keep.user_id does not match any active portal login on these records; "
                "fix manually before merging."
            ),
            "severity": "blocker",
        }
    ]


def _merge_preview_from_clients(db: Session, keep: Client, merge: Client) -> Dict[str, Any]:
    blockers = _blockers(keep, merge, db)
    warnings = (
        _contact_conflict_warnings(keep, merge)
        + _property_duplicate_warnings(db, keep.id, merge.id)
        + _appliance_duplicate_warnings(db, keep.id, merge.id)
    )

    row_counts: Dict[str, int] = {}
    for model, _ in CLIENT_ID_REPOINT_MODELS:
        row_counts[model.__tablename__] = _count_rows(db, model, merge.id)
    media_count = _count_media_client_rows(db, merge.id)
    if media_count:
        row_counts["media"] = media_count

    open_claims = (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.client_id == merge.id,
            ClientPortalClaim.used_at.is_(None),
            ClientPortalClaim.revoked_at.is_(None),
        )
        .count()
    )
    if open_claims:
        row_counts["client_portal_claims_to_revoke"] = open_claims

    return {
        "keep": _client_core_snapshot(db, keep),
        "merge": _client_core_snapshot(db, merge),
        "row_counts": row_counts,
        "warnings": warnings,
        "blockers": blockers,
        "can_merge": len(blockers) == 0,
    }


def build_merge_preview(
    db: Session,
    *,
    keep_client_id: UUID,
    merge_client_id: UUID,
) -> Dict[str, Any]:
    keep = db.query(Client).filter(Client.id == keep_client_id).first()
    merge = db.query(Client).filter(Client.id == merge_client_id).first()
    if not keep:
        raise ClientMergeError("keep_not_found", "Keep client not found", 404)
    if not merge:
        raise ClientMergeError("merge_not_found", "Merge client not found", 404)

    return _merge_preview_from_clients(db, keep, merge)


def _collect_ids_and_repoint(
    db: Session,
    model: Type,
    column_name: str,
    *,
    merge_id: UUID,
    keep_id: UUID,
) -> List[str]:
    column = getattr(model, column_name)
    rows = db.query(model.id).filter(column == merge_id).all()
    ids = [row[0] for row in rows]
    if not ids:
        return []
    db.query(model).filter(model.id.in_(ids)).update(
        {column_name: keep_id},
        synchronize_session=False,
    )
    return [str(i) for i in ids]


def _repoint_media(db: Session, merge_id: UUID, keep_id: UUID) -> List[str]:
    if not _table_exists(db, "media"):
        return []
    from app.models.media import Media, MediaType

    rows = (
        db.query(Media.id)
        .filter(Media.media_type == MediaType.CLIENT, Media.reference_id == merge_id)
        .all()
    )
    ids = [row[0] for row in rows]
    if not ids:
        return []
    db.query(Media).filter(Media.id.in_(ids)).update(
        {Media.reference_id: keep_id},
        synchronize_session=False,
    )
    return [str(i) for i in ids]


def _revoke_open_claims(db: Session, merge_id: UUID) -> List[str]:
    now = utcnow_naive()
    claims = (
        db.query(ClientPortalClaim)
        .filter(
            ClientPortalClaim.client_id == merge_id,
            ClientPortalClaim.used_at.is_(None),
            ClientPortalClaim.revoked_at.is_(None),
        )
        .all()
    )
    for claim in claims:
        claim.revoked_at = now
    return [str(c.id) for c in claims]


def _union_tags(a: Optional[List], b: Optional[List]) -> List:
    out: List[str] = []
    seen = set()
    for source in (a or [], b or []):
        for item in source:
            key = str(item)
            if key not in seen:
                seen.add(key)
                out.append(item)
    return out


def _union_custom_fields(a: Optional[Dict], b: Optional[Dict]) -> Dict:
    merged = dict(b or {})
    merged.update(a or {})
    return merged


def _apply_field_choices(
    keep: Client,
    merge: Client,
    field_choices: Dict[str, FieldChoice],
) -> None:
    source = merge if field_choices.get("name") == "merge" else keep
    keep.first_name = source.first_name
    keep.last_name = source.last_name

    for field in ("email", "phone", "mobile"):
        choice = field_choices.get(field, "keep")
        if choice == "merge":
            setattr(keep, field, getattr(merge, field))

    fill_fields = (
        "company_name",
        "address",
        "billing_address",
        "shipping_address",
        "tax_id",
        "source",
        "notes",
    )
    for field in fill_fields:
        if not getattr(keep, field) and getattr(merge, field):
            setattr(keep, field, getattr(merge, field))

    keep.tags = _union_tags(keep.tags, merge.tags)
    keep.custom_fields = _union_custom_fields(keep.custom_fields, merge.custom_fields)

    mobile_choice = field_choices.get("mobile", "keep")
    if mobile_choice == "merge":
        keep.sms_consent = merge.sms_consent
        keep.sms_consent_at = merge.sms_consent_at
        keep.sms_consent_source = merge.sms_consent_source


def _resolve_real_user_for_auth0(db: Session, auth0_sub: str, keep: Client, merge: Client) -> Optional[DBUser]:
    real_user = db.query(DBUser).filter(DBUser.auth_id == auth0_sub).first()
    if real_user and not user_has_staff_role(real_user):
        return real_user
    for client in (merge, keep):
        user = _load_user(db, client.user_id)
        if user and _is_real_login_user(user) and user.auth_id == auth0_sub:
            return user
    return None


def _apply_portal_identity_merge(db: Session, keep: Client, merge: Client, moved: Dict[str, List[str]]) -> None:
    """Reconcile keep.user_id with active portal logins after client_logins repoint."""
    primary_login = (
        db.query(ClientLogin)
        .filter(
            ClientLogin.client_id == keep.id,
            ClientLogin.revoked_at.is_(None),
        )
        .order_by(ClientLogin.created_at.asc())
        .first()
    )
    if not primary_login:
        merge.user_id = None
        return

    survivor_auth = (primary_login.auth0_user_id or "").strip()
    if not survivor_auth:
        return

    real_user = _resolve_real_user_for_auth0(db, survivor_auth, keep, merge)
    if not real_user:
        return

    real_id = real_user.id
    for source_user_id in (merge.user_id, keep.user_id):
        if not source_user_id or source_user_id == real_id:
            continue
        source_user = _load_user(db, source_user_id)
        if source_user and is_placeholder_client_auth_id(getattr(source_user, "auth_id", None)):
            chunk = repoint_user_customer_data_collect_ids(
                db,
                from_user_id=source_user_id,
                to_user_id=real_id,
            )
            _merge_moved_chunks(moved, chunk)

    keep.user_id = real_id
    merge.user_id = None


def execute_client_merge(
    db: Session,
    *,
    keep_client_id: UUID,
    merge_client_id: UUID,
    field_choices: Dict[str, FieldChoice],
    merged_by_user_id: Optional[UUID],
    admin_display_name: str,
) -> Tuple[Client, ClientMergeAudit, List[Dict[str, str]]]:
    keep = (
        db.query(Client)
        .filter(Client.id == keep_client_id)
        .with_for_update()
        .first()
    )
    merge = (
        db.query(Client)
        .filter(Client.id == merge_client_id)
        .with_for_update()
        .first()
    )
    if not keep or not merge:
        raise ClientMergeError("client_not_found", "Client not found", 404)

    preview = _merge_preview_from_clients(db, keep, merge)
    if not preview["can_merge"]:
        raise ClientMergeError(
            "merge_blocked",
            preview["blockers"][0]["message"] if preview["blockers"] else "Merge blocked",
            409,
        )

    moved: Dict[str, List[str]] = {}
    warnings = list(preview["warnings"])

    for model, column_name in CLIENT_ID_REPOINT_MODELS:
        ids = _collect_ids_and_repoint(
            db, model, column_name, merge_id=merge.id, keep_id=keep.id
        )
        if ids:
            moved[model.__tablename__] = ids

    media_ids = _repoint_media(db, merge.id, keep.id)
    if media_ids:
        moved["media"] = media_ids

    revoked = _revoke_open_claims(db, merge.id)
    if revoked:
        moved["client_portal_claims_revoked"] = revoked

    _apply_field_choices(keep, merge, field_choices)
    _apply_portal_identity_merge(db, keep, merge, moved)

    now = utcnow_naive()
    merge_note = (
        f"Merged into {keep.display_name} on {now.strftime('%Y-%m-%d')} by {admin_display_name}."
    )
    merge.notes = f"{merge.notes or ''}\n\n{merge_note}".strip()
    merge.status = "inactive"
    merge.merged_into_client_id = keep.id
    merge.merged_at = now
    merge.auth0_user_id = None
    merge.user_id = None

    summary_lines = [
        f"Merged duplicate client {merge.id} ({merge.display_name}) into this record on {now.strftime('%Y-%m-%d')} by {admin_display_name}.",
    ]
    for table, ids in sorted(moved.items()):
        summary_lines.append(f"  {table}: {len(ids)} row(s)")
    keep.notes = f"{keep.notes or ''}\n\n" + "\n".join(summary_lines).strip()

    audit = ClientMergeAudit(
        keep_client_id=keep.id,
        merge_client_id=merge.id,
        merged_by=merged_by_user_id,
        merged_at=now,
        field_choices=field_choices,
        moved=moved,
        warnings=warnings,
    )
    db.add(audit)
    db.flush()

    logger.info(
        "Client merge keep=%s merge=%s audit=%s moved_tables=%s",
        keep.id,
        merge.id,
        audit.id,
        list(moved.keys()),
    )
    return keep, audit, warnings
