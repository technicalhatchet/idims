"""CORS allowlist and preflight behavior for production frontends."""

from app.cors_policy import CORS_ALLOWED_ORIGINS, origin_is_allowed


def test_atomic_repair_origin_allowed():
    assert origin_is_allowed("https://atomicrepair419.com")
    assert origin_is_allowed("https://www.atomicrepair419.com")


def test_existing_production_origins_allowed():
    assert origin_is_allowed("https://v0-idims.vercel.app")
    assert origin_is_allowed("https://dma-eight.vercel.app")
    assert origin_is_allowed("https://preview-branch.vercel.app")


def test_unknown_origin_denied():
    assert not origin_is_allowed("https://evil.example.com")
    assert not origin_is_allowed("https://atomicrepair419.com.evil.com")


def test_atomic_repair_on_explicit_allowlist():
    assert "https://atomicrepair419.com" in CORS_ALLOWED_ORIGINS


def test_cors_preflight_atomic_repair():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://atomicrepair419.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://atomicrepair419.com"
    assert "authorization" in (response.headers.get("access-control-allow-headers") or "").lower()


def test_cors_preflight_unknown_origin():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example.com"


def test_cors_get_with_bearer_style_origin():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.get(
        "/api/health",
        headers={
            "Origin": "https://atomicrepair419.com",
            "Authorization": "Bearer test-token-not-validated-on-health",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://atomicrepair419.com"
