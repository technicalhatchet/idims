"""Ensure appliance export paths are registered before {appliance_id} catch-all."""


def test_export_routes_registered_on_client_portal_router():
    from app.routers import client_portal

    paths = [getattr(r, "path", "") for r in client_portal.router.routes]
    assert "/portal/appliances/export.csv" in paths
    assert "/portal/appliances/repairs-export.csv" in paths
    assert "/portal/appliances/export.pdf" in paths

    export_idx = paths.index("/portal/appliances/export.csv")
    appliance_detail_idx = paths.index("/portal/appliances/{appliance_id}")
    assert export_idx < appliance_detail_idx
