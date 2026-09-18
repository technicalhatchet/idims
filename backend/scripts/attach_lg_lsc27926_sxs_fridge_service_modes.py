#!/usr/bin/env python3
"""Attach LG LSC27926 SxS PCB test mode bundles to component procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_sxs"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "PCB test mode entered. Continue with component-specific checks below.",
    "sourceExcerpt": "After §2-17 test mode entry, proceed with OEM component tests.",
    "requiresInput": False,
}

TEST_MODE_1_MAP: dict[str, str] = {
    "lgsxs-fz-fan.json": "fan_voltage",
    "lgsxs-condenser-fan.json": "fan_voltage",
    "lgsxs-compressor.json": "comp_running",
    "lgsxs-door-switch.json": "door_open_test",
    "lgsxs-damper.json": "damper_open_ok",
}

TEST_MODE_2_MAP: dict[str, str] = {
    "lgsxs-defrost-heater.json": "heater_voltage",
}


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in TEST_MODE_1_MAP and name not in TEST_MODE_2_MAP:
        return f"{name}: skipped"

    continue_to = TEST_MODE_1_MAP.get(name) or TEST_MODE_2_MAP[name]
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
            "bundleId": "lgsxs-test-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: test mode bundle attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("lgsxs-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
