#!/usr/bin/env python3
"""Attach Samsung RS28 diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_sxs"
ASSET_BASE = "/images/procedures/samsung_sxs"

DIAGRAMS: dict[str, dict[str, str]] = {
    "samsungrs28-main-pcb-connectors": {
        "id": "samsungrs28-main-pcb-connectors",
        "caption": "MAIN PCB connector layout — CN20/CN40/CN70/CN85/CN90 (§6-2)",
        "assetPath": f"{ASSET_BASE}/samsungrs28-main-pcb-connectors.png",
    },
    "samsungrs28-main-pcb-layout": {
        "id": "samsungrs28-main-pcb-layout",
        "caption": "MAIN PCB layout — inverter, fan, damper, ice maker (§6-1)",
        "assetPath": f"{ASSET_BASE}/samsungrs28-main-pcb-layout.png",
    },
}

PINOUT = "samsungrs28-main-pcb-connectors"
LAYOUT = "samsungrs28-main-pcb-layout"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "CN20": [PINOUT, LAYOUT],
    "CN40": [PINOUT, LAYOUT],
    "CN70": [PINOUT, LAYOUT],
    "CN85": [PINOUT],
    "CN90": [PINOUT, LAYOUT],
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
    for path in sorted(SEED_DIR.glob("samsungrs28-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
