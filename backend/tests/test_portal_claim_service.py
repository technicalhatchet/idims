"""Portal claim token helpers."""

from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.portal_claim_service import (
    MAX_TTL_DAYS,
    MIN_TTL_DAYS,
    PortalClaimError,
    PURPOSE_PORTAL_INVITE,
    clamp_ttl_days,
    create_portal_claim,
    hash_claim_token,
    looks_like_jwt_invite,
    mark_claim_used,
    resolve_client_for_link,
    revoke_unused_portal_invite_claims,
)


def test_hash_claim_token_deterministic():
    raw = "abc123"
    assert hash_claim_token(raw) == hash_claim_token(raw)
    assert len(hash_claim_token(raw)) == 64


def test_looks_like_jwt_invite():
    assert looks_like_jwt_invite("a.b.c")
    assert not looks_like_jwt_invite("urlsafe-token-without-dots")


def test_clamp_ttl_days():
    assert clamp_ttl_days(0) == MIN_TTL_DAYS
    assert clamp_ttl_days(100) == MAX_TTL_DAYS
    assert clamp_ttl_days(7) == 7


def test_revoke_unused_portal_invite_claims_sets_revoked_at():
    cid = uuid4()
    old = SimpleNamespace(revoked_at=None, id=uuid4())
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [old]

    count = revoke_unused_portal_invite_claims(db, cid)
    assert count == 1
    assert old.revoked_at is not None


def test_create_portal_claim_revokes_prior_invites():
    cid = uuid4()
    db = MagicMock()
    db.add = MagicMock()
    db.flush = MagicMock()
    instance = SimpleNamespace(id=uuid4(), client_id=cid)
    fixed_now = datetime(2026, 6, 1, 12, 0, 0)

    with patch(
        "app.services.portal_claim_service.revoke_unused_portal_invite_claims"
    ) as mock_revoke:
        with patch("app.services.portal_claim_service.utcnow_naive", return_value=fixed_now):
            with patch("app.services.portal_claim_service._staff_user_id", return_value=None):
                with patch("app.services.portal_claim_service.ClientPortalClaim") as mock_cls:
                    mock_cls.return_value = instance
                    claim, raw = create_portal_claim(
                        db, cid, purpose=PURPOSE_PORTAL_INVITE, ttl_days=90
                    )
        mock_revoke.assert_called_once_with(db, cid)

    expires_at = mock_cls.call_args.kwargs["expires_at"]
    assert expires_at == fixed_now + timedelta(days=MAX_TTL_DAYS)
    assert claim is instance
    assert len(raw) > 20


def test_resolve_client_for_link_uses_row_lock():
    raw = "claim-token-value"
    claim = SimpleNamespace(
        id=uuid4(),
        client_id=uuid4(),
        token_hash=hash_claim_token(raw),
        purpose="portal_invite",
        expires_at=datetime.utcnow() + timedelta(days=1),
        used_at=None,
        revoked_at=None,
        claim_metadata=None,
    )
    client = SimpleNamespace(id=claim.client_id)

    lock_query = MagicMock()
    lock_query.first.return_value = claim
    filter_query = MagicMock()
    filter_query.with_for_update.return_value = lock_query
    db = MagicMock()
    db.query.return_value.filter.return_value = filter_query
    db.query.return_value.filter.return_value.first.side_effect = [client]

    result_client, result_claim = resolve_client_for_link(db, raw)
    assert result_client is client
    assert result_claim is claim
    filter_query.with_for_update.assert_called_once()


def test_resolve_client_for_link_rejects_used():
    raw = "claim-token-value"
    claim = SimpleNamespace(
        id=uuid4(),
        client_id=uuid4(),
        token_hash=hash_claim_token(raw),
        purpose="portal_invite",
        expires_at=datetime.utcnow() + timedelta(days=1),
        used_at=datetime.utcnow(),
        revoked_at=None,
        claim_metadata=None,
    )

    lock_query = MagicMock()
    lock_query.first.return_value = claim
    filter_query = MagicMock()
    filter_query.with_for_update.return_value = lock_query
    db = MagicMock()
    db.query.return_value.filter.return_value = filter_query

    try:
        resolve_client_for_link(db, raw)
        assert False, "expected PortalClaimError"
    except PortalClaimError as exc:
        assert exc.code == "used"


def test_mark_claim_used_sets_timestamp():
    claim = SimpleNamespace(used_at=None, id=uuid4(), client_id=uuid4())
    db = MagicMock()
    mark_claim_used(db, claim)
    assert claim.used_at is not None
