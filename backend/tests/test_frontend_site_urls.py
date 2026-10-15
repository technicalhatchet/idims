"""Deep-link origin selection for Atomic multi-host frontend."""

from app.frontend_site_urls import (
    build_frontend_url,
    resolve_frontend_origin_for_path,
    DEFAULT_IDIMS_ORIGIN,
    DEFAULT_PORTAL_ORIGIN,
    DEFAULT_MARKETING_ORIGIN,
)


def test_portal_paths_use_portal_origin():
    assert resolve_frontend_origin_for_path("/cxdashboard") == DEFAULT_PORTAL_ORIGIN
    assert resolve_frontend_origin_for_path("/cxdashboard/register") == DEFAULT_PORTAL_ORIGIN
    assert (
        build_frontend_url("/cxdashboard/register")
        == "https://portal.atomicrepair419.com/cxdashboard/register"
    )


def test_idims_paths_use_idims_origin():
    assert resolve_frontend_origin_for_path("/work_orders/abc") == DEFAULT_IDIMS_ORIGIN
    assert resolve_frontend_origin_for_path("/techboard") == DEFAULT_IDIMS_ORIGIN
    assert resolve_frontend_origin_for_path("/solomon/diagnostics/x") == DEFAULT_IDIMS_ORIGIN
    assert (
        build_frontend_url("/work_orders/wo-1")
        == "https://idims.atomicrepair419.com/work_orders/wo-1"
    )


def test_marketing_paths_use_marketing_origin():
    assert resolve_frontend_origin_for_path("/book") == DEFAULT_MARKETING_ORIGIN
    assert build_frontend_url("/book/step-1") == "https://atomicrepair419.com/book/step-1"
