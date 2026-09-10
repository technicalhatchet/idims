#!/usr/bin/env python3
"""Attach W11697231 diagram references to WTW4950 PSC washer procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_tl_dd"
ASSET_BASE = "/images/procedures/whirlpool_tl_dd"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11697231-acu-pinout": {
        "id": "w11697231-acu-pinout",
        "caption": "Main control connectors & pinouts (TEST #1)",
        "assetPath": f"{ASSET_BASE}/w11697231-acu-pinout.png",
    },
    "w11697231-shifter-strip": {
        "id": "w11697231-shifter-strip",
        "caption": "Shifter assembly strip circuit (TEST #3a)",
        "assetPath": f"{ASSET_BASE}/w11697231-shifter-strip.png",
    },
    "w11697231-motor-strip": {
        "id": "w11697231-motor-strip",
        "caption": "PSC motor strip circuit (TEST #3b)",
        "assetPath": f"{ASSET_BASE}/w11697231-motor-strip.png",
    },
    "w11697231-drain-pump-strip": {
        "id": "w11697231-drain-pump-strip",
        "caption": "Drain pump strip circuit (TEST #7)",
        "assetPath": f"{ASSET_BASE}/w11697231-drain-pump-strip.png",
    },
}

PINOUT = "w11697231-acu-pinout"
SHIFTER = "w11697231-shifter-strip"
MOTOR = "w11697231-motor-strip"
PUMP = "w11697231-drain-pump-strip"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "J5": [PINOUT],
    "J12": [PINOUT],
    "J9": [PINOUT, SHIFTER],
    "J2": [PINOUT, SHIFTER, MOTOR, PUMP],
    "J6": [PINOUT],
    "PSC motor": [MOTOR, PINOUT],
    "Drain pump": [PUMP, PINOUT],
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
    for path in sorted(SEED_DIR.glob("w11697231-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
