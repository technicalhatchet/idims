#!/usr/bin/env python3
"""Attach W11174814 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_freestanding_range"

MAXWELL_MRC: dict[str, tuple[str, str]] = {
    "w11174814-warming-drawer-sensor.json": ("safety_power_off", "warming_drawer_rtd"),
    "w11174814-warming-drawer-element.json": ("safety_power_off", "warming_drawer_ohms"),
}

INDIGO: dict[str, tuple[str, str]] = {
    "w11174814-gas-igniter.json": ("safety_power_off", "bake_igniter_ohms"),
    "w11174814-ceran-element.json": ("safety_power_off", "ceran_ohms"),
}


def single_entry(bundle_id: str, attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": bundle_id,
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": continue_to,
        }
    ]


def patch_seed(path: Path, mapping: dict[str, tuple[str, str]], bundle_id: str) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    name = path.name
    if name not in mapping:
        return f"{name}: skipped"
    attach_after, continue_to = mapping[name]
    data["serviceModes"] = single_entry(bundle_id, attach_after, continue_to)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return f"{name}: {bundle_id} attached"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11174814-*.json")):
        if path.name in MAXWELL_MRC:
            print(patch_seed(path, MAXWELL_MRC, "w11174814-maxwell-mrc-diagnostic-entry"))
        if path.name in INDIGO:
            print(patch_seed(path, INDIGO, "w11174814-indigo-diagnostic-entry"))


if __name__ == "__main__":
    main()
