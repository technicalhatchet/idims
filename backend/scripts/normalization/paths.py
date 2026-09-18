from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "procedures"
    / "procedureManualManifest.json"
)
PROCEDURE_SEED_DIR = (
    ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed"
)
CANONICAL_DIR = (
    ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "canonical"
)
NORMALIZATION_DIR = (
    ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "normalization"
)
CALIBRATION_DIR = NORMALIZATION_DIR / "calibration"
CANDIDATES_DIR = NORMALIZATION_DIR / "candidates"
COMPONENT_ALIASES_PATH = CANONICAL_DIR / "component_aliases.json"
PLATFORM_OVERLAY_PATH = (
    CANONICAL_DIR / "platform_overlays" / "front_load_washer.reference.json"
)
TOP_LOAD_PLATFORM_OVERLAY_PATH = (
    CANONICAL_DIR / "platform_overlays" / "top_load_washer.reference.json"
)
WHIRLPOOL_OVERLAY_PATH = (
    CANONICAL_DIR / "manufacturer_overlays" / "whirlpool_front_load_washer.json"
)
WHIRLPOOL_TL_OVERLAY_PATH = (
    CANONICAL_DIR / "manufacturer_overlays" / "whirlpool_top_load_washer.json"
)
CANONICAL_WASHER_PATH = CANONICAL_DIR / "front_load_washer.json"
CANONICAL_TOP_LOAD_WASHER_PATH = CANONICAL_DIR / "top_load_washer.json"
CANONICAL_DRYER_PATH = CANONICAL_DIR / "vented_dryer.json"
CANONICAL_DISHWASHER_PATH = CANONICAL_DIR / "dishwasher.json"
CANONICAL_RANGE_OVEN_PATH = CANONICAL_DIR / "range_oven.json"
REVIEW_DIR = NORMALIZATION_DIR / "review"
PROMOTIONS_DIR = NORMALIZATION_DIR / "promotions"
MANUFACTURER_OVERLAYS_DIR = CANONICAL_DIR / "manufacturer_overlays"
GLOBAL_CONFLICTS_PATH = CANDIDATES_DIR / "_global_conflicts.json"
