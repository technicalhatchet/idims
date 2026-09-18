#!/usr/bin/env python3
"""Attach diagnosticEffects to W11803249 Theseus CDFD procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_theseus_cdfd"

FAIL = {"measurement_open", "measurement_warning", "measurement_critical"}
KNOWLEDGE = {
    "whirlpoolTheseusCdfdThermistorOhms": ("thermistor", "ref_kw_8e_thermistor", "ref_ms_jazz_thermistor"),
    "whirlpoolTheseusCdfdDefrostHeaterOhms": ("defrost_heater", "ref_ms_jazz_defrost_heater", "ref_kw_5e_defrost"),
    "whirlpoolTheseusCdfdCompressorOhms": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "whirlpoolTheseusCdfdFillTubeHeaterOhms": ("ice_maker", "ref_kw_im_e4_dry", "ref_ms_im_mold_heater"),
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
            elif kind == "measurement_normal" and branch.get("terminal"):
                branch["diagnosticEffects"] = [{"type": "eliminate", "componentId": comp, "evidenceId": eliminate}]
                n += 1
    return n


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11803249-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        c = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {c}")
        total += c
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
