from app.services.cpsc_recall_brand_families import (
    appliance_families,
    families_compatible,
    manufacturer_family,
)


def test_whirlpool_family_match():
    assert manufacturer_family("Maytag") == "whirlpool_family"
    assert "whirlpool_family" in appliance_families("KitchenAid")
    assert families_compatible("Maytag", "Whirlpool")


def test_kenmore_can_match_whirlpool_recalls():
    assert families_compatible("Kenmore", "Whirlpool")


def test_cross_family_blocked():
    assert not families_compatible("Samsung", "Whirlpool")
