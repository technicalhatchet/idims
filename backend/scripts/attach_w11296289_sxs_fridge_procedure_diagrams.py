#!/usr/bin/env python3
"""Attach W11296289 diagram references to procedure measurement steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_sxs_w11296289"
ASSET_BASE = "/images/procedures/whirlpool_sxs_w11296289"

DIAGRAMS: dict[str, dict[str, str]] = {
    "w11296289-theseus-voltage-test-points": {
        "id": "w11296289-theseus-voltage-test-points",
        "caption": "THESEUS ACU voltage test points — P1–P11 (§3-3)",
        "assetPath": f"{ASSET_BASE}/w11296289-theseus-voltage-test-points.png",
    },
    "w11296289-wiring-diagram-a": {
        "id": "w11296289-wiring-diagram-a",
        "caption": "Wiring diagram A — THESEUS/MINOTAUR",
        "assetPath": f"{ASSET_BASE}/w11296289-wiring-diagram-a.png",
    },
    "w11296289-athena-voltage-test-points-b": {
        "id": "w11296289-athena-voltage-test-points-b",
        "caption": "ATHENA voltage test points — diagram B (§3-5)",
        "assetPath": f"{ASSET_BASE}/w11296289-athena-voltage-test-points-b.png",
    },
    "w11296289-athena-voltage-test-points-c": {
        "id": "w11296289-athena-voltage-test-points-c",
        "caption": "ATHENA voltage test points — diagram C (§3-7)",
        "assetPath": f"{ASSET_BASE}/w11296289-athena-voltage-test-points-c.png",
    },
}

THESEUS = "w11296289-theseus-voltage-test-points"
WIRING_A = "w11296289-wiring-diagram-a"
ATHENA_B = "w11296289-athena-voltage-test-points-b"
ATHENA_C = "w11296289-athena-voltage-test-points-c"

CONNECTOR_DIAGRAM_IDS: dict[str, list[str]] = {
    "P1": [THESEUS, WIRING_A],
    "P2": [THESEUS, WIRING_A],
    "P5": [THESEUS, WIRING_A],
    "P8": [THESEUS, WIRING_A],
    "P70": [THESEUS, WIRING_A],
    "P11": [THESEUS, WIRING_A],
    "J2": [ATHENA_B, ATHENA_C],
    "JP1": [ATHENA_B, ATHENA_C],
    "P1 / JP1": [THESEUS, ATHENA_B, ATHENA_C],
    "P2 / JP1": [THESEUS, ATHENA_B, ATHENA_C],
}


def images_for_connector(connector: str) -> list[dict[str, str]]:
    primary = connector.split()[0] if connector else ""
    ids = CONNECTOR_DIAGRAM_IDS.get(connector) or CONNECTOR_DIAGRAM_IDS.get(primary, [THESEUS, ATHENA_B])
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
    for path in sorted(SEED_DIR.glob("w11296289-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} measurement step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} measurement steps total.")


if __name__ == "__main__":
    main()
