#!/usr/bin/env python3
"""Attach diagnosticEffects to LG LSC27926 SxS refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_sxs"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "lgsxs-freezer-sensor": "thermistor",
    "lgsxs-fresh-food-sensor": "thermistor",
    "lgsxs-defrost-sensor": "thermistor",
    "lgsxs-ambient-sensor": "thermistor",
    "lgsxs-fz-fan": "evap_fan",
    "lgsxs-condenser-fan": "condenser_fan",
    "lgsxs-damper": "damper_motor",
    "lgsxs-defrost-heater": "defrost_heater",
    "lgsxs-compressor": "compressor",
    "lgsxs-door-switch": "door_switch",
    "lgsxs-display-communication": "display_panel",
    "lgsxs-lcd-check": "display_panel",
    "lgsxs-ice-maker": "ice_maker_module",
    "lgsxs-water-dispenser": "water_valve",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "cabinetThermistorOhms": (
        "thermistor",
        "defrost_thermistor_bad_component",
        "defrost_thermistor_bad",
    ),
    "lgRefrigeratorFanVoltage": (
        "evap_fan",
        "ref_ms_lg_fan_voltage_low",
        "ref_ms_evap_fan_voltage_low",
    ),
    "lgDefrostHeaterVoltage": (
        "defrost_heater",
        "ref_ms_lg_defrost_heater_v",
        "ref_ms_lg_defrost_heater_v",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "damper_motor": ("damper_motor", "ref_ms_damper_bad_weak_ff", "ref_kw_rd_damper"),
    "compressor": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "condenser_fan": ("condenser_fan", "ref_ms_014_not_cooling_compressor_no", "ref_ms_jazz_compressor_run"),
    "door_switch": ("door_switch", "ref_kw_door_switch", "ref_kw_door_switch"),
    "display_panel": ("display_panel", "ref_lg_kw_co_display", "ref_lg_kw_display_mode"),
    "ice_maker_module": ("ice_maker_module", "ref_lg_kw_eid_ice", "ref_lg_kw_eiu_ice"),
    "water_valve": ("water_valve", "ref_kw_water_valve", "ref_kw_water_valve"),
    "defrost_heater": ("defrost_heater", "ref_ms_lg_defrost_heater_v", "ref_ms_lg_defrost_heater_v"),
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
        if procedure_id == "lgsxs-condenser-fan":
            component_id = "condenser_fan"
            confirm_id = "ref_ms_014_not_cooling_compressor_no"
            eliminate_id = "ref_ms_jazz_compressor_run"
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
    for path in sorted(SEED_DIR.glob("lgsxs-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
