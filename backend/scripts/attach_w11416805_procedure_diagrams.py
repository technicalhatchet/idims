#!/usr/bin/env python3
"""Attach W11416805 diagram references to ACU TL dryer procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_acu_tl_dryer"
ASSET_BASE = "/images/procedures/whirlpool_acu_tl_dryer"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11416805-acu-pinout": {
        "id": "w11416805-acu-pinout",
        "caption": "ACU connectors & pinouts (§3-3)",
        "assetPath": f"{ASSET_BASE}/w11416805-acu-pinout.png",
    },
    "w11416805-motor-figure9": {
        "id": "w11416805-motor-figure9",
        "caption": "Motor main/start winding measure points (TEST #3)",
        "assetPath": f"{ASSET_BASE}/w11416805-motor-figure9.png",
    },
    "w11416805-thermal-electric": {
        "id": "w11416805-thermal-electric",
        "caption": "Thermal components — electric dryer (TEST #4)",
        "assetPath": f"{ASSET_BASE}/w11416805-thermal-electric.png",
    },
    "w11416805-thermal-gas": {
        "id": "w11416805-thermal-gas",
        "caption": "Thermal components — gas dryer (TEST #4)",
        "assetPath": f"{ASSET_BASE}/w11416805-thermal-gas.png",
    },
    "w11416805-gas-valve": {
        "id": "w11416805-gas-valve",
        "caption": "Gas valve coil resistance (TEST #4d)",
        "assetPath": f"{ASSET_BASE}/w11416805-gas-valve.png",
    },
    "w11416805-strip-circuits": {
        "id": "w11416805-strip-circuits",
        "caption": "Strip circuits — motor, heater, moisture (§3-16)",
        "assetPath": f"{ASSET_BASE}/w11416805-strip-circuits.png",
    },
    "w11416805-water-valve-strip": {
        "id": "w11416805-water-valve-strip",
        "caption": "Steam water valve strip circuit",
        "assetPath": f"{ASSET_BASE}/w11416805-water-valve-strip.png",
    },
}

PINOUT = "w11416805-acu-pinout"
MOTOR = "w11416805-motor-figure9"
STRIP = "w11416805-strip-circuits"
THERM_E = "w11416805-thermal-electric"
GAS_VALVE = "w11416805-gas-valve"
WATER = "w11416805-water-valve-strip"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "ACU motor path": [MOTOR, PINOUT, STRIP],
    "Motor main": [MOTOR, PINOUT, STRIP],
    "Motor start": [MOTOR, PINOUT, STRIP],
    "Heater element": [THERM_E, PINOUT, STRIP],
    "J14 outlet": [PINOUT, STRIP],
    "J14 inlet": [PINOUT, STRIP],
    "Gas valve": [GAS_VALVE, PINOUT, STRIP],
    "Ignitor": [GAS_VALVE, STRIP],
    "Steam valve": [WATER, PINOUT],
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
    for path in sorted(SEED_DIR.glob("w11416805-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
