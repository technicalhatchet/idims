#!/usr/bin/env python3
"""Attach NS-DWR3SS1 service test mode entry to selected procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/insignia_dishwasher"

BRIDGE_STEP = {
    "id": "service_mode_after_test_entry",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Service test mode entered. Continue with component checks below.",
    "sourceExcerpt": "After service test entry, proceed with OEM component test steps.",
    "requiresInput": False,
}

ATTACH_MAP: dict[str, str] = {
    "nsdwr3ss1-fill-valve.json": "access_fill_valve",
    "nsdwr3ss1-heater.json": "access_heater",
    "nsdwr3ss1-control-panel.json": "inspect_panel",
    "nsdwr3ss1-diverter.json": "access_diverter",
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
            "bundleId": "nsdwr3ss1-service-test-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": BRIDGE_STEP["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service test entry attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("nsdwr3ss1-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
