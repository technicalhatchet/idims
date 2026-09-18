#!/usr/bin/env python3
"""Attach W11803249 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_theseus_cdfd"

BRIDGE = {"id": "service_mode_after_sd_entry", "type": "instruction", "title": "Continue in Service Test Mode",
          "body": "Manual control mode active. Advance to the test step for this procedure.", "requiresInput": False}

TESTS = {f"w11803249-test-{k}.json": f"select_test_{v}" for k, v in [
    ("13-rc-thermistor", "13"), ("12-fc-thermistor", "12"), ("10-fc-evap-thermistor", "10"),
    ("17-pantry-thermistor", "17"), ("29-rh-sensor", "29"), ("72-compressor", "72"),
    ("113-condenser-fan", "113"), ("111-fc-evap-fan", "111"), ("80-rc-damper", "80"),
    ("131-defrost", "131"), ("181-fc-ice-maker", "181"), ("15-heaters", "134"),
]}


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
        data["serviceModes"] = [{"bundleId": "w11803249-service-diagnostic-entry", "modeKind": "service_diagnostic_entry",
                                 "attachAfterStepId": "safety_power_off", "continueToStepId": BRIDGE["id"]}]
        p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(name)


if __name__ == "__main__":
    main()
