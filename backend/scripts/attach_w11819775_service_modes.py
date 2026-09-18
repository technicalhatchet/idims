#!/usr/bin/env python3
"""Attach W11819775 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_acu_fd_inverter"

BRIDGE = {
    "id": "service_mode_after_sd_entry",
    "type": "instruction",
    "title": "Continue in Service Diagnostics",
    "body": "Service Diagnostics active. Use ▲/▼ to reach the test number for this procedure; Freezer to enter.",
    "sourceExcerpt": "Navigate with temperature up/down arrows.",
    "requiresInput": False,
}

SERVICE_TESTS = {
    "w11819775-test-01-rc-thermistor.json": "select_test_01",
    "w11819775-test-03-fc-thermistor.json": "select_test_03",
    "w11819775-test-05-fc-evap-thermistor.json": "select_test_05",
    "w11819775-test-07-im-tray-thermistor.json": "select_test_07",
    "w11819775-test-10-rh-sensor.json": "select_test_10",
    "w11819775-test-23-compressor.json": "select_test_23",
    "w11819775-test-27-fc-fan.json": "select_test_27",
    "w11819775-test-28-condenser-fan.json": "select_test_28",
    "w11819775-test-25-damper.json": "select_test_25",
    "w11819775-test-38-defrost.json": "select_test_38",
    "w11819775-test-40-mullion-heater.json": "select_test_40",
}

IM_TEST = {
    "w11819775-test-13-fc-ice-maker.json": "enter_im_test",
    "w11819775-test-14-water-valve.json": "run_im_for_fill",
}


def patch_seed(path: Path, bundle_id: str, continue_to: str) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    steps = data["steps"]
    if not any(s.get("id") == BRIDGE["id"] for s in steps):
        idx = next(i for i, s in enumerate(steps) if s.get("id") == continue_to)
        bridge = {**BRIDGE, "order": steps[idx].get("order", idx + 1), "defaultNextStepId": continue_to}
        steps.insert(idx, bridge)
    for i, s in enumerate(steps, 1):
        s["order"] = i
    data["serviceModes"] = [{
        "bundleId": bundle_id,
        "modeKind": "service_diagnostic_entry" if "diagnostic" in bundle_id else "component_activation",
        "attachAfterStepId": "safety_power_off",
        "continueToStepId": BRIDGE["id"],
    }]
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for name, cont in SERVICE_TESTS.items():
        p = SEED_DIR / name
        if p.exists():
            patch_seed(p, "w11819775-service-diagnostic-entry", cont)
            print(f"{name}: sd entry")
    for name, cont in IM_TEST.items():
        p = SEED_DIR / name
        if p.exists():
            patch_seed(p, "w11819775-fc-im-test-mode-entry", cont)
            print(f"{name}: im test mode")


if __name__ == "__main__":
    main()
