#!/usr/bin/env python3
"""Attach W11169659 service mode bundles to delta procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ccu_dryer"

BRIDGE_STEP = {
    "id": "service_mode_after_diag_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Service Diagnostics entered. Use Key Activation, fault scroll, or Service Test as needed, then continue below.",
    "sourceExcerpt": "After diagnostic entry, proceed with OEM component test steps.",
    "requiresInput": False,
}

DIAG_ATTACH: dict[str, str] = {
    "w11169659-heater-electric.json": "service_diag_l1_l2",
    "w11169659-moisture-sensor.json": "service_mode_wet_cloth",
    "w11169659-drum-led.json": "access_drum_led",
}


def insert_bridge(path: Path, continue_to: str, bridge: dict) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data.get("steps", [])
    if any(step.get("id") == bridge["id"] for step in steps):
        return
    continue_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == continue_to),
        None,
    )
    if continue_index is None:
        raise ValueError(f"{path.name}: step {continue_to} not found")
    inserted = {
        **bridge,
        "order": steps[continue_index].get("order", continue_index + 1),
        "defaultNextStepId": continue_to,
    }
    steps.insert(continue_index, inserted)
    for index, step in enumerate(steps, start=1):
        step["order"] = index
    data["steps"] = steps
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def patch_diagnostic_entry(path: Path) -> str:
    name = path.name
    if name not in DIAG_ATTACH:
        return f"{name}: skipped (diagnostic entry)"
    continue_to = DIAG_ATTACH[name]
    insert_bridge(path, continue_to, BRIDGE_STEP)
    data = json.loads(path.read_text(encoding="utf-8"))
    data["serviceModes"] = [
        {
            "bundleId": "w11169659-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: diagnostic entry service mode"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11169659-*.json")):
        print(patch_diagnostic_entry(path))


if __name__ == "__main__":
    main()
