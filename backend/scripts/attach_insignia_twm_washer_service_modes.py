#!/usr/bin/env python3
"""Attach Insignia TWM41/TWM35 test mode entry to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/insignia_washer_cap"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Test mode entered. Continue with component checks below.",
    "sourceExcerpt": "After test mode entry, proceed with OEM troubleshooting steps.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "insigniatwmcap-inlet-valves.json": "supply_check",
    "insigniatwmcap-drain-pump.json": "drain_hose_check",
    "insigniatwmcap-lid-switch.json": "lid_closed",
    "insigniatwmcap-unbalance.json": "load_balance",
    "insigniatwmcap-level-sensor.json": "cap_note",
    "insigniatwmcap-door-lock.json": "lock_harness",
    "insigniatwmcap-load-sensing.json": "auto_sense_test",
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
            "bundleId": "insigniatwmcap-test-mode-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: test mode entry attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("insigniatwmcap-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
