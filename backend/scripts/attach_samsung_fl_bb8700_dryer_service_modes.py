#!/usr/bin/env python3
"""Attach Samsung BB8700 dryer Smart Install and Error Recall bundles."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fl_dryer_bb8700"

BRIDGE = {
    "id": "service_mode_after_smart_install",
    "type": "instruction",
    "title": "Continue procedure",
    "body": "Smart Install entered. Continue with component checks below.",
    "requiresInput": False,
}

ATTACH_AFTER_SAFETY = {
    "samsungbb8700-dryer-thermistor.json",
    "samsungbb8700-dryer-heater-electric.json",
    "samsungbb8700-dryer-motor-circuit.json",
    "samsungbb8700-dryer-hmi.json",
}


def patch_seed(path: Path) -> str:
    name = path.name
    if name not in ATTACH_AFTER_SAFETY:
        return f"{name}: skipped"
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data["steps"]
    continue_to = steps[1]["id"] if len(steps) > 1 else steps[0]["id"]
    if not any(s.get("id") == BRIDGE["id"] for s in steps):
        idx = next(i for i, s in enumerate(steps) if s.get("id") == continue_to)
        bridge = {**BRIDGE, "order": steps[idx].get("order", idx + 1), "defaultNextStepId": continue_to}
        steps.insert(idx, bridge)
        for i, s in enumerate(steps, 1):
            s["order"] = i
        continue_to = BRIDGE["id"]
    data["serviceModes"] = [
        {
            "bundleId": "samsungbb8700-dryer-smart-install-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": "safety_power_off",
            "continueToStepId": continue_to,
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: smart install attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungbb8700-dryer-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
