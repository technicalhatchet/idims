#!/usr/bin/env python3
"""Attach diagnosticEffects to W10901168 Bella French door procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_bella_french_door"

FAIL = {"measurement_open", "measurement_warning", "measurement_critical"}
KNOWLEDGE = {
    "whirlpoolBellaFdCompressorSensorOhms": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "whirlpoolBellaFdThreeWayValveOhms": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
}


def attach_effects(seed: dict) -> int:
    n = 0
    for step in seed.get("steps", []):
        kid = step.get("measurementKnowledgeId")
        if not kid or kid not in KNOWLEDGE:
            continue
        comp, confirm, eliminate = KNOWLEDGE[kid]
        for branch in step.get("branches", []):
            if branch.get("diagnosticEffects"):
                continue
            kind = (branch.get("when") or {}).get("kind")
            if kind in FAIL:
                branch["diagnosticEffects"] = [{"type": "confirm", "componentId": comp, "evidenceId": confirm}]
                n += 1
    return n


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w10901168-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        c = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        total += c
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
