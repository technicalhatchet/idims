"""Auth0 Management API must use canonical tenant domain, not custom login domain."""

from unittest.mock import MagicMock, patch

from app.core.auth import AuthHandler, auth0_mgmt_api_url, get_auth0_mgmt_domain


def test_auth0_mgmt_api_url_prefers_mgmt_domain(monkeypatch):
    monkeypatch.setenv("AUTH0_DOMAIN", "auth.solodiag.com")
    monkeypatch.setenv("AUTH0_MGMT_DOMAIN", "dev-abc123.us.auth0.com")
    from app.config import Settings

    settings = Settings()
    with patch("app.core.auth.settings", settings):
        assert get_auth0_mgmt_domain() == "dev-abc123.us.auth0.com"
        assert auth0_mgmt_api_url("/users/auth0|1") == (
            "https://dev-abc123.us.auth0.com/api/v2/users/auth0|1"
        )


def test_get_client_credentials_token_uses_mgmt_domain(monkeypatch):
    monkeypatch.setenv("AUTH0_DOMAIN", "auth.solodiag.com")
    monkeypatch.setenv("AUTH0_MGMT_DOMAIN", "tenant.us.auth0.com")
    monkeypatch.setenv("AUTH0_MGMT_CLIENT_ID", "mgmt-id")
    monkeypatch.setenv("AUTH0_MGMT_CLIENT_SECRET", "mgmt-secret")
    from app.config import Settings

    settings = Settings()
    handler = AuthHandler(domain="auth.solodiag.com", audience="https://api")
    AuthHandler._mgmt_token_cache = None
    AuthHandler._mgmt_token_expires_at = None

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"access_token": "tok", "expires_in": 3600}

    with patch("app.core.auth.settings", settings):
        with patch("app.core.auth.requests.post", return_value=mock_response) as post:
            token = handler.get_client_credentials_token()

    assert token == "tok"
    post.assert_called_once()
    url = post.call_args[0][0]
    payload = post.call_args[1]["json"]
    assert url == "https://tenant.us.auth0.com/oauth/token"
    assert payload["audience"] == "https://tenant.us.auth0.com/api/v2/"
