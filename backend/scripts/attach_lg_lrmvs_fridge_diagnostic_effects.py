#!/usr/bin/env python3
"""Attach diagnosticEffects to LG LRMVS refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_lrmvs"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "lglrmvs-fz-sensor": "thermistor",
    "lglrmvs-ff-sensor": "thermistor",
    "lglrmvs-icing-sensor": "thermistor",
    "lglrmvs-fz-defrost-sensor": "thermistor",
    "lglrmvs-ff-defrost-sensor": "thermistor",
    "lglrmvs-convert-sensor": "thermistor",
    "lglrmvs-fz-defrost-heater": "heater",
    "lglrmvs-ff-defrost-heater": "heater",
    "lglrmvs-ff-fan": "evap_fan",
    "lglrmvs-fz-fan": "evap_fan",
    "lglrmvs-icing-fan": "evap_fan",
    "lglrmvs-condenser-fan": "condenser_fan",
    "lglrmvs-display-communication": "display_panel",
    "lglrmvs-sealed-system": "sealed_system",
    "lglrmvs-wifi-modem": "control_board",
    "lglrmvs-display-mode": "display_panel",
    "lglrmvs-ice-maker-electrical": "ice_maker_module",
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
        "heater",
        "ref_ms_lg_defrost_heater_v",
        "ref_ms_lg_defrost_heater_v",
    ),
    "lgDefrostHeaterOhmsFreezer": (
        "heater",
        "ref_ms_lg_f_defrost_ohms",
        "ref_ms_lg_f_defrost_ohms",
    ),
    "lgDefrostHeaterOhmsFridge": (
        "heater",
        "ref_ms_lg_f_defrost_ohms",
        "ref_ms_lg_f_defrost_ohms",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "display_panel": ("display_panel", "ref_lg_kw_co_display", "ref_lg_kw_display_mode"),
    "sealed_system": ("sealed_system", "ref_lg_kw_ch_sealed", "ref_lg_kw_cl_sealed"),
    "control_board": ("control_board", "ref_lg_kw_od_wifi", "ref_lg_kw_od_wifi"),
    "ice_maker_module": ("ice_maker_module", "ref_lg_kw_eid_ice", "ref_lg_kw_eiu_ice"),
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
    for path in sorted(SEED_DIR.glob("lglrmvs-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
