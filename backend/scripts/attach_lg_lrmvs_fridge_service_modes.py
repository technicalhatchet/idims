#!/usr/bin/env python3
"""Attach LG LRMVS PCB test mode bundles to component procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_lrmvs"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "PCB test mode entered. Continue with component-specific voltage or resistance checks below.",
    "sourceExcerpt": "After §9 test mode entry, proceed with OEM component tests.",
    "requiresInput": False,
}

TEST_MODE_1_MAP: dict[str, str] = {
    "lglrmvs-ff-fan.json": "fan_voltage",
    "lglrmvs-fz-fan.json": "fan_voltage",
    "lglrmvs-icing-fan.json": "fan_voltage",
    "lglrmvs-condenser-fan.json": "fan_voltage",
}

TEST_MODE_3_MAP: dict[str, str] = {
    "lglrmvs-fz-defrost-heater.json": "heater_ohms",
    "lglrmvs-ff-defrost-heater.json": "heater_ohms_r",
}


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in TEST_MODE_1_MAP and name not in TEST_MODE_3_MAP:
        return f"{name}: skipped"

    continue_to = TEST_MODE_1_MAP.get(name) or TEST_MODE_3_MAP[name]
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

    service_modes = [
        {
            "bundleId": "lglrmvs-test-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    if name in TEST_MODE_1_MAP:
        service_modes.append(
            {
                "bundleId": "lglrmvs-damper-test",
                "modeKind": "load_test",
                "attachAfterStepId": BRIDGE_STEP["id"],
                "continueToStepId": continue_to,
            },
        )

    data["serviceModes"] = service_modes
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: test mode bundle attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("lglrmvs-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
