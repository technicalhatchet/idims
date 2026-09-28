#!/usr/bin/env python3
"""Attach diagnosticEffects to W11296289 SxS refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_sxs_w11296289"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11296289-test-01-fc-thermistor": "thermistor",
    "w11296289-test-03-rc-thermistor": "thermistor",
    "w11296289-test-05-defrost-thermistor": "thermistor",
    "w11296289-test-07-compressor-cond-fan": "compressor",
    "w11296289-test-09-damper-open": "damper_motor",
    "w11296289-test-11-damper-heater": "damper_motor",
    "w11296289-test-13-defrost-heater": "defrost_heater",
    "w11296289-test-15-evap-fan": "evap_fan",
    "w11296289-test-19-water-valve": "water_valve",
    "w11296289-test-33-im-tray-thermistor": "ice_maker_module",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "whirlpoolSxsW11296289ThermistorOhms": (
        "thermistor",
        "ref_kw_8e_thermistor",
        "ref_ms_jazz_thermistor",
    ),
    "whirlpoolSxsW11296289DefrostHeaterOhms": (
        "defrost_heater",
        "ref_ms_007_heavy_frost_heater_open",
        "ref_ms_jazz_defrost_heater",
    ),
    "whirlpoolSxsW11296289EvapFanOhms": (
        "evap_fan",
        "ref_kw_22e_evap_fan",
        "ref_ms_006_frost_chip_heavy_frost_evap_fan_no",
    ),
    "whirlpoolSxsW11296289CondenserFanOhms": (
        "condenser_fan",
        "ref_ms_014_not_cooling_compressor_no",
        "ref_ms_jazz_compressor_run",
    ),
    "whirlpoolSxsW11296289CompressorRunOhms": (
        "compressor",
        "ref_ms_014_not_cooling_compressor_no",
        "ref_ms_jazz_compressor_run",
    ),
    "whirlpoolSxsW11296289LineVoltage120": (
        "control_board",
        "ref_ms_014_not_cooling_compressor_no",
        "ref_ms_jazz_compressor_run",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "thermistor": ("thermistor", "ref_kw_jazz_thermistor_o", "ref_kw_8e_thermistor"),
    "compressor": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "condenser_fan": ("condenser_fan", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "damper_motor": ("damper_motor", "ref_ms_damper_bad_weak_ff", "ref_kw_rd_damper"),
    "defrost_heater": ("defrost_heater", "ref_ms_007_heavy_frost_heater_open", "ref_ms_jazz_defrost_heater"),
    "evap_fan": ("evap_fan", "ref_ms_006_frost_chip_heavy_frost_evap_fan_no", "ref_kw_22e_evap_fan"),
    "water_valve": ("water_valve", "ref_kw_water_valve", "ref_kw_water_valve"),
    "ice_maker_module": ("ice_maker_module", "ref_kw_no_ice", "ref_kw_no_ice"),
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
    for path in sorted(SEED_DIR.glob("w11296289-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
