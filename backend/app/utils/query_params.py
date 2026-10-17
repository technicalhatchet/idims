"""Parse query-string flags (and coerce FastAPI Query defaults leaked on direct calls)."""

from __future__ import annotations

from typing import Any

from starlette.requests import Request

_TRUTHY = frozenset({"true", "1", "yes", "on"})


def query_bool_from_request(request: Request, name: str, default: bool = False) -> bool:
    raw = request.query_params.get(name)
    if raw is None:
        return default
    return str(raw).lower() in _TRUTHY


def coerce_query_bool(
    value: Any,
    request: Request,
    name: str,
    default: bool = False,
) -> bool:
    """
    FastAPI injects real bools from HTTP. When a route handler is invoked directly
    (e.g. main.py proxy), missing params default to Query(...) objects, which are truthy.
    """
    if isinstance(value, bool):
        return value
    return query_bool_from_request(request, name, default)
