"""Resolve canonical ontology id from template + platform (CG-5.5 architecture boundary)."""

from __future__ import annotations

TOP_LOAD_PLATFORM_PREFIXES = (
    "whirlpool_tl",
    "whirlpool_mvw",
    "samsung_tl",
)

FRONT_LOAD_WASHER_PLATFORMS = frozenset(
    {
        "whirlpool_fl_dd",
        "whirlpool_duet_sport",
        "whirlpool_connected_smart_gen3",
        "samsung_fl_washer_bb8700",
        "samsung_fl_washer_wf6000r",
        "samsung_flexwash",
    },
)


DRYER_TEMPLATE_IDS = frozenset({"electric_dryer", "gas_dryer"})

RANGE_IMPLEMENTATION_TEMPLATE_IDS = frozenset(
    {"electric_range", "gas_range", "induction_range", "dual_fuel_range"},
)

HEAT_PUMP_DRYER_PLATFORM_PREFIXES = (
    "samsung_hp_dryer",
    "lg_hp_dryer",
    "whirlpool_hp_dryer",
    "whirlpool_hybridcare",
)


def resolve_ontology_id(template_id: str | None, platform_id: str | None) -> str | None:
    if not template_id:
        return None
    platform = str(platform_id or "")
    if any(platform.startswith(prefix) for prefix in HEAT_PUMP_DRYER_PLATFORM_PREFIXES):
        return "heat_pump_dryer"
    if template_id in DRYER_TEMPLATE_IDS:
        return "vented_dryer"
    if template_id in RANGE_IMPLEMENTATION_TEMPLATE_IDS:
        return "range_oven"
    if template_id == "dishwasher":
        return "dishwasher"
    if "_dishwasher" in platform or platform.startswith("dishwasher_"):
        return "dishwasher"
    if template_id != "washer":
        return None

    if any(platform.startswith(prefix) for prefix in TOP_LOAD_PLATFORM_PREFIXES):
        return "top_load_washer"
    if platform in FRONT_LOAD_WASHER_PLATFORMS:
        return "front_load_washer"

    # Default washer corpus platforms without explicit routing remain FL until classified.
    return "front_load_washer"
