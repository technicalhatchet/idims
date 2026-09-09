#!/usr/bin/env python3
"""Attach Midea UZ21 test-mode bundles to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/midea_uz21"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue in test mode",
    "body": "Test mode entered (§9.7). Continue with component-specific checks below.",
    "sourceExcerpt": "After test mode entry, proceed with OEM maintenance steps.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "mideauz21-fz-defrost-heater.json": "disconnect_heater",
    "mideauz21-fz-defrost-sensor.json": "harness_check",
    "mideauz21-fz-temp-sensor.json": "harness_check",
    "mideauz21-evap-fan.json": "access_fan",
    "mideauz21-high-temp-alarm.json": "door_gasket",
}

FORCED_DEFROST_PROCEDURES = {
    "mideauz21-fz-defrost-heater.json",
    "mideauz21-fz-defrost-sensor.json",
    "mideauz21-high-temp-alarm.json",
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

    modes = [
        {
            "bundleId": "mideauz21-test-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    if name in FORCED_DEFROST_PROCEDURES:
        modes.append(
            {
                "bundleId": "mideauz21-forced-defrost-entry",
                "modeKind": "load_test",
                "attachAfterStepId": BRIDGE_STEP["id"],
                "continueToStepId": continue_to,
            }
        )

    data["serviceModes"] = modes
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: test mode attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("mideauz21-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
