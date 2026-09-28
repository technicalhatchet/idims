#!/usr/bin/env python3
"""Attach diagnosticEffects to W11819775 ACU inverter French door procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_acu_fd_inverter"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

KNOWLEDGE_EVIDENCE = {
    "whirlpoolAcuFdInverterThermistorOhms": ("thermistor", "ref_kw_8e_thermistor", "ref_ms_jazz_thermistor"),
    "whirlpoolAcuFdInverterImTrayThermistorOhms": ("ice_maker_module", "ref_kw_im_e3_heater", "ref_ms_im_mold_heater"),
    "whirlpoolAcuFdInverterDefrostHeaterOhms": ("defrost_heater", "ref_ms_jazz_defrost_heater", "ref_kw_5e_defrost"),
    "whirlpoolAcuFdInverterCompressorOhms": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "whirlpoolAcuFdInverterMullionHeaterOhms": ("heater", "ref_kw_moisture_mullion", "ref_ms_moisture_heater"),
}

CHECKPOINT_EVIDENCE = {
    "evap_fan": ("evap_fan", "ref_kw_22e_evap_fan", "ref_ms_006_frost_chip_heavy_frost_evap_fan_no"),
    "condenser_fan": ("condenser_fan", "ref_ms_condenser_fan", "ref_ms_014_not_cooling_compressor_no"),
    "damper_motor": ("damper_motor", "ref_ms_damper_bad_weak_ff", "ref_kw_rd_damper"),
    "compressor": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "ice_maker": ("ice_maker_module", "ref_kw_im_e4_dry", "ref_ms_011_ice_maker_ff_temp_high"),
    "water_valve": ("water_valve", "ref_ms_im_e4_dry_valve", "ref_kw_im_e4_dry"),
}


def effect_for_branch(procedure_id: str, step: dict, branch: dict) -> list[dict]:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if not kind:
        return []
    knowledge_id = step.get("measurementKnowledgeId")
    confirm_id = eliminate_id = ""
    component_id = ""
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        component_id, confirm_id, eliminate_id = KNOWLEDGE_EVIDENCE[knowledge_id]
    if not confirm_id:
        return []
    if kind in FAIL_MEASUREMENT or (kind == "checkpoint_no" and branch.get("terminal")):
        return [{"type": "confirm", "componentId": component_id, "evidenceId": confirm_id}]
    if kind in PASS_MEASUREMENT and branch.get("terminal"):
        return [{"type": "eliminate", "componentId": component_id, "evidenceId": eliminate_id}]
    return []


def attach_effects(seed: dict) -> int:
    attached = 0
    for step in seed.get("steps", []):
        for branch in step.get("branches", []):
            if branch.get("diagnosticEffects"):
                continue
            effects = effect_for_branch(seed.get("id", ""), step, branch)
            if effects:
                branch["diagnosticEffects"] = effects
                attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11819775-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count}")
        total += count
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
