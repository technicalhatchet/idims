#!/usr/bin/env python3
"""Attach Samsung Bespoke refrigerator service-mode bundles to diagnostic procedures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fridge_bespoke"

BRIDGE = {
    "id": "service_mode_continue",
    "type": "instruction",
    "title": "Continue diagnostic",
    "body": "Service mode active. Continue with pin-level test below.",
    "sourceExcerpt": "Test Mode / Self-diagnosis entered — proceed to CHECK LIST measurement.",
    "requiresInput": False,
}

ATTACH_MAP = {
    "samsungbespoke-freezer-sensor.json": ("run_self_diag", "sensor_voltage"),
    "samsungbespoke-fridge-sensor.json": ("run_self_diag", "sensor_voltage"),
    "samsungbespoke-freezer-fan.json": ("fan_cmd", "fan_fb"),
    "samsungbespoke-fridge-fan.json": ("rfan_cmd", "rfan_fb"),
    "samsungbespoke-convertible-fan.json": ("cfan_pins", "cfan_fb"),
    "samsungbespoke-freezer-defrost-heater.json": ("fdef_disconnect", "fdef_ohms"),
    "samsungbespoke-compressor-inverter.json": ("comp_short", "ipm_read"),
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
            "bundleId": "samsungbespoke-self-diagnosis-entry",
            "modeKind": "fault_codes",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
        {
            "bundleId": "samsungbespoke-test-mode-rf23bb-digital",
            "modeKind": "load_test",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
        {
            "bundleId": "samsungbespoke-test-mode-rf32cg-buttons",
            "modeKind": "load_test",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
        {
            "bundleId": "samsungbespoke-fhub-engineer-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": BRIDGE["id"],
        },
    ]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service modes attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("samsungbespoke-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
