from app.services.appliance_lifespan_service import (
    DEFAULT_LIFESPAN_ROWS,
    validate_lifespan_payload,
)


def test_validate_lifespan_min_max():
    validate_lifespan_payload(
        equipment_type="appliance",
        equipment_subtype="dryer",
        typical_min_years=8,
        typical_max_years=12,
    )
    try:
        validate_lifespan_payload(
            equipment_type="appliance",
            equipment_subtype="dryer",
            typical_min_years=15,
            typical_max_years=10,
        )
    except ValueError as exc:
        assert "min" in str(exc).lower()
    else:
        raise AssertionError("expected ValueError")


def test_default_seed_row_count():
    assert len(DEFAULT_LIFESPAN_ROWS) >= 10
