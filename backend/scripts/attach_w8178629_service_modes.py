#!/usr/bin/env python3
"""Attach W8178629 diagnostic test mode entry to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_centennial_dryer"

BRIDGE_STEP = {
    "id": "service_mode_after_diag_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Diagnostic mode entered (Less Dry / input beep test reviewed). Continue with component tests below.",
    "sourceExcerpt": "After diagnostic entry, proceed with OEM component test steps.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "w8178629-timer-motor.json": "less_dry_precheck",
    "w8178629-door-switch.json": "diag_door_beep",
    "w8178629-thermal-fuse-exhaust.json": "access_thermal",
    "w8178629-electric-heater.json": "access_heater",
    "w8178629-electric-tco-inlet.json": "access_tco",
    "w8178629-gas-hilimit-cutoff.json": "access_gas_limits",
    "w8178629-gas-coils.json": "access_coils",
    "w8178629-drive-motor.json": "access_motor",
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
            "bundleId": "w8178629-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: diagnostic entry service mode"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w8178629-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
