#!/usr/bin/env python3
"""Attach Insignia WMT41 FCt test mode entry to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/insignia_washer_freq"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "FCt test mode entered. Continue with component checks below.",
    "sourceExcerpt": "After FCt test mode entry, proceed with OEM troubleshooting steps.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "insigniawmt41-inlet-valves.json": "supply_check",
    "insigniawmt41-drain-motor.json": "drain_clog",
    "insigniawmt41-lid-switch.json": "lid_closed",
    "insigniawmt41-unbalance.json": "load_balance",
    "insigniawmt41-impact-switch.json": "tub_clearance",
    "insigniawmt41-level-sensor.json": "f8_define",
    "insigniawmt41-drive-motor.json": "cap_discharge",
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
            "bundleId": "insigniawmt41-test-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: test mode entry attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("insigniawmt41-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
