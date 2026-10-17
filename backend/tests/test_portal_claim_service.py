"""Portal claim token helpers."""

from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from app.services.portal_claim_service import (
    PortalClaimError,
    hash_claim_token,
    looks_like_jwt_invite,
    mark_claim_used,
    resolve_client_for_link,
)


def test_hash_claim_token_deterministic():
    raw = "abc123"
    assert hash_claim_token(raw) == hash_claim_token(raw)
    assert len(hash_claim_token(raw)) == 64


def test_looks_like_jwt_invite():
    assert looks_like_jwt_invite("a.b.c")
    assert not looks_like_jwt_invite("urlsafe-token-without-dots")


def test_resolve_client_for_link_rejects_used():
    from unittest.mock import MagicMock

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
    client = SimpleNamespace(id=claim.client_id)

    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [claim, client]

    try:
        resolve_client_for_link(db, raw)
        assert False, "expected PortalClaimError"
    except PortalClaimError as exc:
        assert exc.code == "used"


def test_mark_claim_used_sets_timestamp():
    from unittest.mock import MagicMock

    claim = SimpleNamespace(used_at=None, id=uuid4(), client_id=uuid4())
    db = MagicMock()
    mark_claim_used(db, claim)
    assert claim.used_at is not None
