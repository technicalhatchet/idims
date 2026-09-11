#!/usr/bin/env python3
"""Attach W11169659 diagram references to CCU dryer delta procedure steps."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ccu_dryer"
ASSET_BASE = "/images/procedures/whirlpool_ccu_dryer"

DRUM_LED_DIAGRAM = {
    "id": "w11169659-drum-led-strip",
    "caption": "Drum LED connector & strip circuit (TEST #8)",
    "assetPath": f"{ASSET_BASE}/w11169659-drum-led-strip.png",
}

STEP_DIAGRAM_IDS: dict[str, list[dict[str, str]]] = {
    "access_drum_led": [DRUM_LED_DIAGRAM],
    "harness_check": [DRUM_LED_DIAGRAM],
    "j6_current": [DRUM_LED_DIAGRAM],
}


def attach_diagrams(seed: dict) -> int:
    attached = 0
    for step in seed.get("steps", []):
        step_id = step.get("id")
        images = STEP_DIAGRAM_IDS.get(step_id or "")
        if images:
            step["images"] = images
            attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11169659-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_diagrams(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} step(s) with diagrams")
        total += count
    print(f"Attached diagrams on {total} steps total.")


if __name__ == "__main__":
    main()
