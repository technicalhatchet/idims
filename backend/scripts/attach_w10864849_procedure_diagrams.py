#!/usr/bin/env python3
"""Attach W10864849 diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_tl_dd"
ASSET_BASE = "/images/procedures/whirlpool_tl_dd"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w10864849-acu-pinout-figure1": {
        "id": "w10864849-acu-pinout-figure1",
        "caption": "Main control connectors & pinouts (§3-5)",
        "assetPath": f"{ASSET_BASE}/w10864849-acu-pinout-figure1.png",
    },
    "w10864849-inlet-valves-strip": {
        "id": "w10864849-inlet-valves-strip",
        "caption": "Water inlet valves strip circuit (TEST #2)",
        "assetPath": f"{ASSET_BASE}/w10864849-inlet-valves-strip.png",
    },
    "w10864849-drive-system-figure1": {
        "id": "w10864849-drive-system-figure1",
        "caption": "Drive system — motor & shifter area (TEST #3)",
        "assetPath": f"{ASSET_BASE}/w10864849-drive-system-figure1.png",
    },
    "w10864849-thermistor-strip": {
        "id": "w10864849-thermistor-strip",
        "caption": "Temperature thermistor strip circuit (TEST #5)",
        "assetPath": f"{ASSET_BASE}/w10864849-thermistor-strip.png",
    },
    "w10864849-pumps-strip": {
        "id": "w10864849-pumps-strip",
        "caption": "Drain & recirculation pumps strip circuit (TEST #7)",
        "assetPath": f"{ASSET_BASE}/w10864849-pumps-strip.png",
    },
    "w10864849-lid-lock-schematic": {
        "id": "w10864849-lid-lock-schematic",
        "caption": "Lid lock schematic (TEST #8)",
        "assetPath": f"{ASSET_BASE}/w10864849-lid-lock-schematic.png",
    },
    "w10864849-heater-strip": {
        "id": "w10864849-heater-strip",
        "caption": "Heater element strip circuit (TEST #9)",
        "assetPath": f"{ASSET_BASE}/w10864849-heater-strip.png",
    },
    "w10864849-basket-light-strip": {
        "id": "w10864849-basket-light-strip",
        "caption": "Basket light strip circuit (TEST #11)",
        "assetPath": f"{ASSET_BASE}/w10864849-basket-light-strip.png",
    },
    "w10864849-rex-bulk-dispense": {
        "id": "w10864849-rex-bulk-dispense",
        "caption": "Relay expansion board — bulk dispense (TEST #12)",
        "assetPath": f"{ASSET_BASE}/w10864849-rex-bulk-dispense.png",
    },
}

PINOUT = "w10864849-acu-pinout-figure1"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "J12": [PINOUT],
    "J18": [PINOUT],
    "J2": ["w10864849-inlet-valves-strip", PINOUT],
    "J1": ["w10864849-drive-system-figure1", PINOUT],
    "Drive motor": ["w10864849-drive-system-figure1", PINOUT],
    "J4": ["w10864849-pumps-strip", PINOUT],
    "Drain pump": ["w10864849-pumps-strip", PINOUT],
    "J6": ["w10864849-lid-lock-schematic", PINOUT],
    "Heater": ["w10864849-heater-strip", PINOUT],
    "J19": ["w10864849-basket-light-strip", PINOUT],
    "Bulk pump": ["w10864849-rex-bulk-dispense", PINOUT],
}

KNOWLEDGE_DIAGRAM_IDS: dict[str, list[str]] = {
    "whirlpoolTlDdWasherInletThermistorOhms": [
        "w10864849-thermistor-strip",
        PINOUT,
    ],
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
    for path in sorted(SEED_DIR.glob("w10864849-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
