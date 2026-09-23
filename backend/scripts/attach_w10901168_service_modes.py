#!/usr/bin/env python3
"""Attach W10901168 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_bella_french_door"

BRIDGE = {"id": "service_mode_after_diag_entry", "type": "instruction", "title": "Continue in Bella Diagnostics",
          "body": "Diagnostics active. Use Up/Down to navigate; Icemaker2 to select test.", "requiresInput": False}

TESTS = {
    "w10901168-test-01-rc-thermistor.json": "select_test_01",
    "w10901168-test-02-fc-thermistor.json": "select_test_02",
    "w10901168-test-05-pantry-thermistor.json": "select_test_05",
    "w10901168-test-14-ice-box-thermistor.json": "select_test_14",
    "w10901168-test-58-condenser-fan.json": "select_test_58",
    "w10901168-test-40-compressor-sealed-system.json": "select_test_40",
    "w10901168-test-57-rc-fan.json": "select_test_57",
    "w10901168-test-56-fc-fan.json": "select_test_56",
    "w10901168-test-42-pantry-baffle.json": "select_test_42",
    "w10901168-test-89-defrost-heater.json": "select_test_89",
    "w10901168-test-59-ice-box-fan.json": "select_test_59",
    "w10901168-test-97-98-im-water-fill.json": "select_test_97",
    "w10901168-test-120-121-im-harvest.json": "select_test_120",
    "w10901168-test-96-water-valve.json": "select_test_96",
}


def main() -> None:
    for name, cont in TESTS.items():
        p = SEED_DIR / name
        if not p.exists():
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        steps = data["steps"]
        if not any(s.get("id") == BRIDGE["id"] for s in steps):
            idx = next(i for i, s in enumerate(steps) if s.get("id") == cont)
            steps.insert(idx, {**BRIDGE, "order": steps[idx].get("order"), "defaultNextStepId": cont, "sourceExcerpt": BRIDGE["body"]})
        for i, s in enumerate(steps, 1):
            s["order"] = i
        data["serviceModes"] = [{"bundleId": "w10901168-diagnostic-entry", "modeKind": "service_diagnostic_entry",
                                 "attachAfterStepId": "safety_power_off", "continueToStepId": BRIDGE["id"]}]
        p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(name)


if __name__ == "__main__":
    main()
