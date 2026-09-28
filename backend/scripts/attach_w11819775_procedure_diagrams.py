#!/usr/bin/env python3
"""Attach W11819775 diagram references to ACU inverter French door procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_acu_fd_inverter"
ASSET_BASE = "/images/procedures/whirlpool_acu_fd_inverter"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11819775-acu-connector-pinout": {
        "id": "w11819775-acu-connector-pinout",
        "caption": "ACU connector pinouts (CONTROL BOARD / CONNECTORS & PINOUTS)",
        "assetPath": f"{ASSET_BASE}/w11819775-acu-connector-pinout.png",
    },
    "w11819775-voltage-chart-a": {
        "id": "w11819775-voltage-chart-a",
        "caption": "ACU voltage chart — CN20/CN12/CN7/CN18",
        "assetPath": f"{ASSET_BASE}/w11819775-voltage-chart-a.png",
    },
    "w11819775-voltage-chart-b": {
        "id": "w11819775-voltage-chart-b",
        "caption": "ACU voltage chart — CN6/CN13/CN10 thermistors & loads",
        "assetPath": f"{ASSET_BASE}/w11819775-voltage-chart-b.png",
    },
}

PINOUT = "w11819775-acu-connector-pinout"
CHART_A = "w11819775-voltage-chart-a"
CHART_B = "w11819775-voltage-chart-b"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "CN6": [PINOUT, CHART_B],
    "CN12": [PINOUT, CHART_A],
    "CN13": [PINOUT, CHART_B],
    "compressor": [PINOUT, CHART_A],
    "mullion": [PINOUT, CHART_A],
}


def images_for_connector(connector: str) -> list[dict[str, str]]:
    ids = CONNECTOR_DIAGRAM_IDS.get(connector, [PINOUT, CHART_A])
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
    for path in sorted(SEED_DIR.glob("w11819775-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
