#!/usr/bin/env python3
"""Attach W10785366A service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_connected_smart_gen3"

SINGLE_ENTRY: dict[str, tuple[str, str, str]] = {
    "w10785366a-hmi-wifi-comm.json": (
        "w10785366a-laundry-service-diagnostic-entry",
        "safety_power_off",
        "enter_service_diag",
    ),
    "w10785366a-dishwasher-wifi.json": (
        "w10785366a-dishwasher-service-diagnostic-cycle",
        "safety_power_off",
        "dw_service_diag",
    ),
    "w10785366a-fridge-wifi-service.json": (
        "w10785366a-fridge-service-mode-entry",
        "safety_power_off",
        "fridge_service_entry",
    ),
}

SOFTWARE_VERSION_ENTRY: dict[str, tuple[str, str, str]] = {
    "w10785366a-hmi-wifi-comm.json": (
        "w10785366a-laundry-software-version-display",
        "software_version_display",
        "wifi_version_check",
    ),
}


def single_mode(bundle_id: str, attach_after: str, continue_to: str) -> list[dict]:
    return [
        {
            "bundleId": bundle_id,
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": continue_to,
        }
    ]


def patch_seed(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    name = path.name
    modes: list[dict] = list(data.get("serviceModes") or [])

    if name in SINGLE_ENTRY:
        bundle_id, attach_after, continue_to = SINGLE_ENTRY[name]
        modes = single_mode(bundle_id, attach_after, continue_to)
        if name in SOFTWARE_VERSION_ENTRY:
            sw_bundle, sw_attach, sw_continue = SOFTWARE_VERSION_ENTRY[name]
            modes.append(
                {
                    "bundleId": sw_bundle,
                    "modeKind": "hmi_test",
                    "attachAfterStepId": sw_attach,
                    "continueToStepId": sw_continue,
                }
            )
        data["serviceModes"] = modes
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{name}: attached {len(modes)} service mode(s)"

    return f"{name}: skipped"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w10785366a-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
