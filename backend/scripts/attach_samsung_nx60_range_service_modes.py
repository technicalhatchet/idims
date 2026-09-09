#!/usr/bin/env python3
"""Attach Samsung NX60 error recall and sub-line test bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_range_nx60"

BRIDGE_STEP = {
    "id": "service_mode_after_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Service mode entered. Continue with component-specific OEM checks below.",
    "sourceExcerpt": "After error recall or sub-line test entry, proceed with component tests.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "samsungnx60-oven-sensor.json": "sensor_ohms",
    "samsungnx60-heater-relays.json": "dlb_relay",
    "samsungnx60-door-lock.json": "lock_motor_ohms",
    "samsungnx60-bake-ignitor.json": "bake_hsi_ohms",
    "samsungnx60-broil-ignitor.json": "broil_hsi_ohms",
    "samsungnx60-safety-valve.json": "valve_amps",
    "samsungnx60-convection-fan.json": "fan_ohms",
    "samsungnx60-touch-comm.json": "touch_tail",
    "samsungnx60-power.json": "board_voltage",
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
            "bundleId": "samsungnx60-error-recall-entry",
            "modeKind": "fault_codes",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
        {
            "bundleId": "samsungnx60-sub-line-test-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": BRIDGE_STEP["id"],
            "continueToStepId": continue_to,
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: error recall + sub-line test attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungnx60-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
