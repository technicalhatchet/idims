"""In-memory rate limits for the public pay-link endpoints.

The app-wide Redis RateLimitingMiddleware is disabled in main.py (and keys on
path, which doesn't help when every token is a different path), so the pay
links carry their own small limiter.

Counts live in this process. With several uvicorn workers each keeps its own
counts, so real limits are up to WORKERS × these numbers — still far below
anything that could matter for a 48-char random token.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request

_lock = threading.Lock()
_hits: Dict[str, Deque[float]] = {}
_MAX_KEYS = 20_000

# (max hits, window seconds)
PAGE_VIEWS_PER_IP = (60, 60)          # loading /pay pages
CHARGES_PER_IP = (8, 600)             # card attempts from one visitor
CHARGES_PER_TOKEN = (12, 3600)        # card attempts on one invoice
MISSES_PER_IP = (20, 600)             # unknown tokens (someone guessing)


def client_ip(request: Request) -> str:
    """Visitor IP: first X-Forwarded-For hop (set by the Next.js pass-through), else socket peer."""
    forwarded = request.headers.get("x-forwarded-for") or ""
    first = forwarded.split(",")[0].strip()
    if first:
        return first[:64]
    return (request.client.host if request.client else "unknown")[:64]


def _prune(now: float) -> None:
    if len(_hits) <= _MAX_KEYS:
        return
    stale = [k for k, q in _hits.items() if not q or now - q[-1] > 3600]
    for k in stale:
        _hits.pop(k, None)


def _over(key: str, rule: Tuple[int, int], *, record: bool) -> bool:
    limit, window = rule
    now = time.monotonic()
    with _lock:
        q = _hits.get(key)
        if q is None:
            q = deque()
            _hits[key] = q
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return True
        if record:
            q.append(now)
            _prune(now)
        return False


def _too_many() -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Too many attempts. Please wait a few minutes and try again.",
    )


def check_page_view(request: Request) -> None:
    ip = client_ip(request)
    if _over(f"miss:{ip}", MISSES_PER_IP, record=False):
        raise _too_many()
    if _over(f"view:{ip}", PAGE_VIEWS_PER_IP, record=True):
        raise _too_many()


def record_miss(request: Request) -> None:
    _over(f"miss:{client_ip(request)}", MISSES_PER_IP, record=True)


def check_charge(request: Request, token: str) -> None:
    ip = client_ip(request)
    if _over(f"miss:{ip}", MISSES_PER_IP, record=False):
        raise _too_many()
    if _over(f"charge:{ip}", CHARGES_PER_IP, record=True):
        raise _too_many()
    if _over(f"charge-token:{token}", CHARGES_PER_TOKEN, record=True):
        raise _too_many()
