#!/usr/bin/env python3
"""Attach Samsung FlexWash Smart Install bundles to component procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_flexwash"

BRIDGE = {
    "id": "service_mode_before_manual_check",
    "type": "instruction",
    "title": "Continue to manual check",
    "body": "Smart Install active. Continue below for component-specific checks.",
    "sourceExcerpt": "Manual check mode — Delay End advances steps per §4-2.",
    "requiresInput": False,
}

ATTACH_MAP = {
    "samsungflexwash-motor-circuit.json": ("reconnect_motor", "live_motor_check"),
    "samsungflexwash-inlet-valves.json": ("smart_install_valves", "valve_visual"),
    "samsungflexwash-drain-pump.json": ("pump_run_check", "drain_verified"),
    "samsungflexwash-door-lock.json": ("reed_ohms", "door_verified"),
}


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in ATTACH_MAP:
        return f"{name}: skipped"
    attach_after, continue_to = ATTACH_MAP[name]
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data["steps"]
    if not any(s.get("id") == BRIDGE["id"] for s in steps):
        idx = next(i for i, s in enumerate(steps) if s.get("id") == continue_to)
        bridge = {**BRIDGE, "order": steps[idx].get("order", idx + 1), "defaultNextStepId": continue_to}
        steps.insert(idx, bridge)
        for i, s in enumerate(steps, 1):
            s["order"] = i
    data["serviceModes"] = [
        {
            "bundleId": "samsungflexwash-smart-install-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
        {
            "bundleId": "samsungflexwash-manual-check-mode",
            "modeKind": "load_test",
            "attachAfterStepId": BRIDGE["id"],
            "continueToStepId": continue_to,
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: smart install + manual check attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungflexwash-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
