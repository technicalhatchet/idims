#!/usr/bin/env python3
"""Attach Samsung RF28 refrigerator service-mode bundles to diagnostic procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fridge_rf28"

BRIDGE = {
    "id": "service_mode_continue",
    "type": "instruction",
    "title": "Continue diagnostic",
    "body": "Service mode active. Continue with pin-level test below.",
    "sourceExcerpt": "Test Mode / Self-diagnosis entered — proceed to CHECK LIST measurement.",
    "requiresInput": False,
}

ATTACH_MAP = {
    "samsungrf28-freezer-sensor.json": ("run_self_diag", "sensor_voltage"),
    "samsungrf28-fridge-sensor.json": ("run_self_diag", "sensor_voltage"),
    "samsungrf28-freezer-defrost-sensor.json": ("run_self_diag", "sensor_voltage"),
    "samsungrf28-fridge-defrost-sensor.json": ("run_self_diag", "sensor_voltage"),
    "samsungrf28-freezer-fan.json": ("fan_cmd", "fan_fb"),
    "samsungrf28-fridge-fan.json": ("fan_cmd", "fan_fb"),
    "samsungrf28-convertible-fan.json": ("fan_cmd", "fan_fb"),
    "samsungrf28-ice-room-fan.json": ("fan_cmd", "fan_fb"),
    "samsungrf28-freezer-defrost-heater.json": ("fz_def_disconnect", "fz_def_ohms"),
    "samsungrf28-fridge-defrost-heater.json": ("ff_def_disconnect", "ff_def_ohms"),
    "samsungrf28-compressor-inverter.json": ("comp_short", "ipm_voltage"),
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
            "bundleId": "samsungrf28-self-diagnostic-entry",
            "modeKind": "fault_codes",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
        {
            "bundleId": "samsungrf28-test-mode-entry",
            "modeKind": "load_test",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
        {
            "bundleId": "samsungrf28-load-condition-entry",
            "modeKind": "load_test",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service modes attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungrf28-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
