"""Canonical Atomic Repair frontend origins for emails and deep links.

Browser calls that go through the Next.js /api/proxy BFF are same-origin and do not
need CORS entries for these hosts. CORS is only required when the browser talks to
Railway directly (unusual in production Atomic deploy).
"""

from __future__ import annotations

from app.config import _url_from_env, settings

# Defaults match production DNS targets (override via env without Railway changes in code-only previews).
DEFAULT_MARKETING_ORIGIN = "https://atomicrepair419.com"
DEFAULT_PORTAL_ORIGIN = "https://portal.atomicrepair419.com"
DEFAULT_IDIMS_ORIGIN = "https://idims.atomicrepair419.com"

# Align with frontend/lib/routeAccess.js TECH_ROUTE_PREFIXES (host-routing families).
_IDIMS_PATH_PREFIXES = (
    "/techboard",
    "/techdashboard",
    "/work_orders",
    "/logit",
    "/clients",
    "/appointments",
    "/payments",
    "/invoices",
    "/quotes",
    "/reports",
    "/settings",
    "/dashboard",
    "/schedule",
    "/route",
    "/technicians",
    "/debug-user",
    "/solomon",
)

_PORTAL_PATH_PREFIX = "/cxdashboard"


def marketing_frontend_origin() -> str:
    return _url_from_env("MARKETING_FRONTEND_URL", "PUBLIC_SITE_URL") or (
        settings.FRONTEND_URL.rstrip("/")
        if settings.FRONTEND_URL and "localhost" not in settings.FRONTEND_URL
        else DEFAULT_MARKETING_ORIGIN
    )


def portal_frontend_origin() -> str:
    return _url_from_env("PORTAL_FRONTEND_URL") or DEFAULT_PORTAL_ORIGIN


def idims_frontend_origin() -> str:
    return _url_from_env("IDIMS_FRONTEND_URL") or DEFAULT_IDIMS_ORIGIN


def _path_matches_prefix(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(f"{prefix}/")


def resolve_frontend_origin_for_path(path: str) -> str:
    """
    Pick the correct public frontend origin for a deep link path.
    Falls back to marketing apex when the path is not portal- or IDIMS-specific.
    """
    normalized = (path or "").strip()
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"

    if _path_matches_prefix(normalized, _PORTAL_PATH_PREFIX):
        return portal_frontend_origin().rstrip("/")

    for prefix in _IDIMS_PATH_PREFIXES:
        if _path_matches_prefix(normalized, prefix):
            return idims_frontend_origin().rstrip("/")

    return marketing_frontend_origin().rstrip("/")


def build_frontend_url(path: str) -> str:
    """Absolute URL for transactional email / notification links."""
    normalized = (path or "").strip()
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    origin = resolve_frontend_origin_for_path(normalized)
    return f"{origin}{normalized}"
