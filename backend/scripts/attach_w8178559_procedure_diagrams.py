#!/usr/bin/env python3
"""Attach W8178559 diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_duet_sport_dryer"
ASSET_BASE = "/images/procedures/whirlpool_duet_sport_dryer"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w8178559-mce-pinout-figure17": {
        "id": "w8178559-mce-pinout-figure17",
        "caption": "MCE connectors & pinouts (Figure 17)",
        "assetPath": f"{ASSET_BASE}/w8178559-mce-pinout-figure17.png",
    },
    "w8178559-motor-figure7-9": {
        "id": "w8178559-motor-figure7-9",
        "caption": "Motor & belt switch — Figures 7–9 (TEST #2)",
        "assetPath": f"{ASSET_BASE}/w8178559-motor-figure7-9.png",
    },
    "w8178559-heater-figure11": {
        "id": "w8178559-heater-figure11",
        "caption": "Thermal components — Figure 11 (TEST #3)",
        "assetPath": f"{ASSET_BASE}/w8178559-heater-figure11.png",
    },
    "w8178559-exhaust-thermistor-3a": {
        "id": "w8178559-exhaust-thermistor-3a",
        "caption": "Exhaust thermistor — TEST #3a",
        "assetPath": f"{ASSET_BASE}/w8178559-exhaust-thermistor-3a.png",
    },
    "w8178559-gas-valve-3d": {
        "id": "w8178559-gas-valve-3d",
        "caption": "Gas valve coils — TEST #3b–3d",
        "assetPath": f"{ASSET_BASE}/w8178559-gas-valve-3d.png",
    },
    "w8178559-moisture-figure12": {
        "id": "w8178559-moisture-figure12",
        "caption": "Moisture sensor — Figure 12 (TEST #4)",
        "assetPath": f"{ASSET_BASE}/w8178559-moisture-figure12.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "Motor main": ["w8178559-motor-figure7-9", "w8178559-mce-pinout-figure17"],
    "Motor start": ["w8178559-motor-figure7-9", "w8178559-mce-pinout-figure17"],
    "Heater": ["w8178559-heater-figure11", "w8178559-mce-pinout-figure17"],
    "P14 thermistor": ["w8178559-exhaust-thermistor-3a", "w8178559-mce-pinout-figure17"],
    "Ignitor": ["w8178559-heater-figure11", "w8178559-gas-valve-3d"],
    "Gas valve": ["w8178559-gas-valve-3d", "w8178559-mce-pinout-figure17"],
}


def images_for_connector(connector: str) -> list[dict[str, str]]:
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
        images = images_for_connector(connector)
        if images:
            step["images"] = images
            attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w8178559-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
