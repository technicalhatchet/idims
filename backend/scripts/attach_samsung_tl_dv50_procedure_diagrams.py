#!/usr/bin/env python3
"""Attach Samsung TL DV50 dryer diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_tl_dryer_dv50"
ASSET_BASE = "/images/procedures/samsung_tl_dryer_dv50"

DIAGRAMS: dict[str, dict[str, str]] = {
    "samsungtldv50-control-pcb": {
        "id": "samsungtldv50-control-pcb",
        "caption": "Control panel and Cover PCB access (§3-2 p.11)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-control-pcb.png",
    },
    "samsungtldv50-door-switch": {
        "id": "samsungtldv50-door-switch",
        "caption": "Frame front and door switch housing (§3-2 p.13)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-door-switch.png",
    },
    "samsungtldv50-motor": {
        "id": "samsungtldv50-motor",
        "caption": "Motor and blower assembly (§3-2 p.16)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-motor.png",
    },
    "samsungtldv50-burner": {
        "id": "samsungtldv50-burner",
        "caption": "Gas burner assembly (§3-2 p.17)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-burner.png",
    },
    "samsungtldv50-heater-thermistor": {
        "id": "samsungtldv50-heater-thermistor",
        "caption": "Thermistor, sensors, and heater (§3-2 p.18)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-heater-thermistor.png",
    },
    "samsungtldv50-component-test-heat": {
        "id": "samsungtldv50-component-test-heat",
        "caption": "Thermistor, heater, door switch tests (§4-4 p.25)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-component-test-heat.png",
    },
    "samsungtldv50-component-test-motor": {
        "id": "samsungtldv50-component-test-motor",
        "caption": "Motor, belt switch, flame sensor tests (§4-4 p.26)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-component-test-motor.png",
    },
    "samsungtldv50-component-test-gas": {
        "id": "samsungtldv50-component-test-gas",
        "caption": "Gas valve and igniter tests (§4-4 p.27)",
        "assetPath": f"{ASSET_BASE}/samsungtldv50-component-test-gas.png",
    },
}

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "Motor": [
        "samsungtldv50-motor",
        "samsungtldv50-component-test-motor",
        "samsungtldv50-control-pcb",
    ],
    "Heater": [
        "samsungtldv50-heater-thermistor",
        "samsungtldv50-component-test-heat",
    ],
    "Thermistor": [
        "samsungtldv50-heater-thermistor",
        "samsungtldv50-component-test-heat",
    ],
    "Valve": [
        "samsungtldv50-burner",
        "samsungtldv50-component-test-gas",
        "samsungtldv50-control-pcb",
    ],
    "Igniter 101D": [
        "samsungtldv50-burner",
        "samsungtldv50-component-test-gas",
    ],
    "10RS": [
        "samsungtldv50-heater-thermistor",
        "samsungtldv50-component-test-motor",
    ],
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
    for path in sorted(SEED_DIR.glob("samsungtldv50-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
