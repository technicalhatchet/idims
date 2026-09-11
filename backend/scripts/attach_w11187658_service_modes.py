#!/usr/bin/env python3
"""Attach W11187658 service mode entry to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_dishwasher_ada"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Service mode entered. Continue with component checks below.",
    "sourceExcerpt": "After service mode entry, proceed with OEM component test steps.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "w11187658-fill-valve.json": "access_fill_valve",
    "w11187658-heater.json": "access_heater",
    "w11187658-drain-pump.json": "access_drain_pump",
}


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in ATTACH_MAP:
        return f"{name}: skipped"

    continue_to = ATTACH_MAP[name]
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data.get("steps", [])

    if not any(step.get("id") == BRIDGE_STEP["id"] for step in steps):
        continue_index = next(
            (index for index, step in enumerate(steps) if step.get("id") == continue_to),
            None,
        )
        if continue_index is None:
            raise ValueError(f"{name}: step {continue_to} not found")
        bridge = {
            **BRIDGE_STEP,
            "order": steps[continue_index].get("order", continue_index + 1),
            "defaultNextStepId": continue_to,
        }
        steps.insert(continue_index, bridge)
        for index, step in enumerate(steps, start=1):
            step["order"] = index

    data["serviceModes"] = [
        {
            "bundleId": "w11187658-service-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service mode entry attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11187658-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
