#!/usr/bin/env python3
"""Attach diagnosticEffects to W11509412 Whirlpool/KA ACU French door procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ka_french_door"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11509412-test-01-fc-thermistor": "thermistor",
    "w11509412-test-02-rc-thermistor": "thermistor",
    "w11509412-test-03-evap-fan-damper": "evap_fan",
    "w11509412-test-04-compressor": "compressor",
    "w11509412-test-06-defrost": "defrost_heater",
    "w11509412-test-36-ice-box-fan": "evap_fan",
    "w11509412-test-37-ice-box-thermistor": "thermistor",
    "w11509412-test-19-fill-tube-heater": "ice_maker",
    "w11509412-test-45-ice-water-fill": "water_valve",
    "w11509412-test-58-ice-heater-thermistor": "ice_maker",
    "w11509412-test-59-ice-motor": "ice_maker",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "whirlpoolKaFdThermistorOhms": (
        "thermistor",
        "ref_kw_8e_thermistor",
        "ref_ms_jazz_thermistor",
    ),
    "whirlpoolKaFdDefrostHeaterOhms": (
        "defrost_heater",
        "ref_ms_jazz_defrost_heater",
        "ref_ms_007_heavy_frost_heater_open",
    ),
    "whirlpoolKaFdDefrostBimetalOhms": (
        "defrost_thermostat",
        "ref_ms_wp_wrt_bimetal_open",
        "ref_kw_5e_defrost",
    ),
    "whirlpoolKaFdCompressorRunOhms": (
        "compressor",
        "ref_ms_014_not_cooling_compressor_no",
        "ref_ms_jazz_compressor_run",
    ),
    "whirlpoolKaFdCompressorStartOhms": (
        "compressor",
        "ref_ms_014_not_cooling_compressor_no",
        "ref_ms_jazz_compressor_run",
    ),
    "whirlpoolKaFdIceMakerThermistorOhms": (
        "ice_maker_module",
        "ref_kw_im_e3_heater",
        "ref_ms_im_mold_heater",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "evap_fan": ("evap_fan", "ref_kw_22e_evap_fan", "ref_ms_006_frost_chip_heavy_frost_evap_fan_no"),
    "damper_motor": ("damper_motor", "ref_ms_damper_bad_weak_ff", "ref_kw_rd_damper"),
    "defrost_heater": ("defrost_heater", "ref_ms_jazz_defrost_heater", "ref_kw_5e_defrost"),
    "thermistor": ("thermistor", "ref_kw_8e_thermistor", "ref_ms_jazz_thermistor"),
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
    component_id = PROCEDURE_COMPONENT.get(procedure_id, "")
    confirm_id = ""
    eliminate_id = ""

    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        component_id, confirm_id, eliminate_id = KNOWLEDGE_EVIDENCE[knowledge_id]
    elif component_id and component_id in CHECKPOINT_EVIDENCE:
        component_id, confirm_id, eliminate_id = CHECKPOINT_EVIDENCE[component_id]

    if not confirm_id:
        return []

    if kind in FAIL_MEASUREMENT or (kind == "checkpoint_no" and branch.get("terminal")):
        return [{"type": "confirm", "componentId": component_id, "evidenceId": confirm_id}]
    if kind in PASS_MEASUREMENT and branch.get("terminal"):
        return [{"type": "eliminate", "componentId": component_id, "evidenceId": eliminate_id}]
    return []


def attach_effects(seed: dict) -> int:
    attached = 0
    procedure_id = seed.get("id", "")
    for step in seed.get("steps", []):
        for branch in step.get("branches", []):
            if branch.get("diagnosticEffects"):
                continue
            effects = effect_for_branch(procedure_id, step, branch)
            if effects:
                branch["diagnosticEffects"] = effects
                attached += 1
    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("w11509412-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
