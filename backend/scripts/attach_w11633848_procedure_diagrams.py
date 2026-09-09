#!/usr/bin/env python3
"""Attach W11633848 diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_dishwasher_acu"
ASSET_BASE = "/images/procedures/whirlpool_dishwasher_acu"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11633848-door-switch-strip": {
        "id": "w11633848-door-switch-strip",
        "caption": "Door switch strip circuit (§3-7)",
        "assetPath": f"{ASSET_BASE}/w11633848-door-switch-strip.png",
    },
    "w11633848-fill-valve-strip": {
        "id": "w11633848-fill-valve-strip",
        "caption": "Fill valve strip circuit (§3-8)",
        "assetPath": f"{ASSET_BASE}/w11633848-fill-valve-strip.png",
    },
    "w11633848-heater-strip": {
        "id": "w11633848-heater-strip",
        "caption": "Heater strip circuit (§3-10)",
        "assetPath": f"{ASSET_BASE}/w11633848-heater-strip.png",
    },
    "w11633848-owi-strip": {
        "id": "w11633848-owi-strip",
        "caption": "OWI / water sensing strip circuit (§3-11)",
        "assetPath": f"{ASSET_BASE}/w11633848-owi-strip.png",
    },
    "w11633848-overfill-strip": {
        "id": "w11633848-overfill-strip",
        "caption": "Overfill float switch strip circuit (§3-12)",
        "assetPath": f"{ASSET_BASE}/w11633848-overfill-strip.png",
    },
    "w11633848-wash-motor-strip": {
        "id": "w11633848-wash-motor-strip",
        "caption": "Wash motor strip circuit (§3-15)",
        "assetPath": f"{ASSET_BASE}/w11633848-wash-motor-strip.png",
    },
    "w11633848-drain-motor-strip": {
        "id": "w11633848-drain-motor-strip",
        "caption": "Drain motor strip circuit (§3-16)",
        "assetPath": f"{ASSET_BASE}/w11633848-drain-motor-strip.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "P9": ["w11633848-door-switch-strip"],
    "P6": ["w11633848-fill-valve-strip"],
    "P4": ["w11633848-heater-strip"],
    "P10": ["w11633848-owi-strip"],
    "P5": ["w11633848-wash-motor-strip"],
}

KNOWLEDGE_DIAGRAM_IDS: dict[str, list[str]] = {
    "dishwasherFloatSwitchOhms": ["w11633848-overfill-strip"],
    "whirlpoolDishwasherAcuDrainMotorOhms": ["w11633848-drain-motor-strip"],
}


def images_for_step(connector: str, measurement_knowledge_id: str | None) -> list[dict[str, str]]:
    if measurement_knowledge_id and measurement_knowledge_id in KNOWLEDGE_DIAGRAM_IDS:
        ids = KNOWLEDGE_DIAGRAM_IDS[measurement_knowledge_id]
    else:
        ids = CONNECTOR_DIAGRAM_IDS.get(connector, [])
    return [DIAGRAMS[diagram_id] for diagram_id in ids if diagram_id in DIAGRAMS]


def attach_diagrams(seed: dict) -> int:
    attached = 0
    for step in seed.get("steps", []):
        if step.get("type") != "measurement":
            continue
        test_point = step.get("testPoint") or {}
        connector = test_point.get("connector")
        if not connector:
            continue
        images = images_for_step(connector, step.get("measurementKnowledgeId"))
        if images:
            step["images"] = images
            attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11633848-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
