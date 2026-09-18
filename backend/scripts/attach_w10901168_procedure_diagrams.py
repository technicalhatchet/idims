#!/usr/bin/env python3
"""Attach W10901168 diagram references to Bella French door procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_bella_french_door"
ASSET_BASE = "/images/procedures/whirlpool_bella_french_door"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w10901168-orion-board-pinout": {
        "id": "w10901168-orion-board-pinout",
        "caption": "Orion board connectors & 115 VAC distribution (FIGURE 5)",
        "assetPath": f"{ASSET_BASE}/w10901168-orion-board-pinout.png",
    },
    "w10901168-gf2-board-connectors": {
        "id": "w10901168-gf2-board-connectors",
        "caption": "GF2 high-voltage board connectors (§2-6)",
        "assetPath": f"{ASSET_BASE}/w10901168-gf2-board-connectors.png",
    },
}

ORION = "w10901168-orion-board-pinout"
GF2 = "w10901168-gf2-board-connectors"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "compressor": [ORION, GF2],
    "3-way valve": [ORION, GF2],
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
    for path in sorted(SEED_DIR.glob("w10901168-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
