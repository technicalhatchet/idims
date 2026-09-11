#!/usr/bin/env python3
"""Attach W11174426 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_freestanding_range"

SINGLE_ENTRY: dict[str, tuple[str, str]] = {
    "w11174426-oven-sensor.json": ("safety_power_off", "diag_f3e0"),
    "w11174426-door-latch.json": ("safety_power_off", "clean_latch_test"),
    "w11174426-bake-element.json": ("safety_power_off", "bake_ohms"),
    "w11174426-broil-element.json": ("safety_power_off", "broil_ohms"),
    "w11174426-dsi-board.json": ("safety_power_off", "dsi_bake_coil"),
    "w11174426-acu-power.json": ("safety_power_off", "control_voltage"),
    "w11174426-hmi.json": ("safety_power_off", "keypad_p11"),
}


def single_entry(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11174426-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": continue_to,
        }
    ]


def patch_seed(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    name = path.name
    if name not in SINGLE_ENTRY:
        return f"{name}: skipped"
    attach_after, continue_to = SINGLE_ENTRY[name]
    data["serviceModes"] = single_entry(attach_after, continue_to)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: service diagnostic entry attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11174426-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
