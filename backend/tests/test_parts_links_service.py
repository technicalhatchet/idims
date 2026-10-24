from app.services import parts_links_service as pls


def test_validate_parts_links_requires_model_placeholder():
    pls.validate_parts_links_value(dict(pls.DEFAULT_PARTS_LINKS))
    try:
        pls.validate_parts_links_value(
            {"model_search_url_template": "https://example.com/no-placeholder"}
        )
    except ValueError as exc:
        assert "model" in str(exc).lower()
    else:
        raise AssertionError("expected ValueError")


def test_build_parts_links_substitutes_model(monkeypatch):
    class _Db:
        pass

    monkeypatch.setattr(pls, "get_parts_links_settings", lambda _db: dict(pls.DEFAULT_PARTS_LINKS))
    payload = pls.build_parts_links_payload(
        _Db(),
        model="WFW8300SW0",
        equipment_subtype="refrigerator",
    )
    assert payload is not None
    assert "WFW8300SW0" in payload["parts_search_url"]
    assert payload["water_filter_search_url"] is not None
    assert "water%20filter" in payload["water_filter_search_url"]
