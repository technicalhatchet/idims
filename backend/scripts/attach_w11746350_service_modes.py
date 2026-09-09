#!/usr/bin/env python3
"""Attach W11746350 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_freestanding_range"

SINGLE_ENTRY: dict[str, tuple[str, str]] = {
    "w11746350-oven-sensor.json": ("safety_power_off", "verify_room_temp"),
    "w11746350-door-latch.json": ("safety_power_off", "latch_activation"),
    "w11746350-bake-element.json": ("safety_power_off", "bake_connections"),
    "w11746350-broil-element.json": ("safety_power_off", "broil_ohms"),
    "w11746350-convect-element.json": ("safety_power_off", "convect_element_ohms"),
    "w11746350-dsi-gas-valve.json": ("safety_power_off", "regulator_ohms"),
    "w11746350-acu-power.json": ("safety_power_off", "check_acu_connections"),
    "w11746350-hmi.json": ("safety_power_off", "inspect_hmi_harness"),
}


def single_entry(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11746350-service-diagnostic-entry",
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
    for path in sorted(SEED_DIR.glob("w11746350-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
