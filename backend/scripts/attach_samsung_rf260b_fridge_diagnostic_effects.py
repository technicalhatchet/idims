#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung RF260B refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_sxs"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "samsungrf260b-fz-sensor": "thermistor",
    "samsungrf260b-ff-sensor": "thermistor",
    "samsungrf260b-fz-def-sensor": "thermistor",
    "samsungrf260b-ff-def-sensor": "thermistor",
    "samsungrf260b-ambient-sensor": "thermistor",
    "samsungrf260b-pantry-sensor": "thermistor",
    "samsungrf260b-humidity-sensor": "thermistor",
    "samsungrf260b-ice-maker-sensor": "thermistor",
    "samsungrf260b-fz-fan": "evap_fan",
    "samsungrf260b-ff-fan": "evap_fan",
    "samsungrf260b-c-fan": "evap_fan",
    "samsungrf260b-fz-defrost-heater": "heater",
    "samsungrf260b-ff-defrost-heater": "heater",
    "samsungrf260b-ice-maker-function": "ice_maker_module",
    "samsungrf260b-panel-communication": "display_panel",
    "samsungrf260b-option-error": "display_panel",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "refrigeratorThermistorVoltage": (
        "thermistor",
        "ref_ms_thermistor_voltage_bad",
        "defrost_thermistor_bad",
    ),
    "refrigeratorEvapFanFeedbackVoltage": (
        "evap_fan",
        "ref_ms_evap_fan_voltage_low",
        "evap_fan_no",
    ),
    "samsungRefrigeratorDefrostHeaterOhms": (
        "heater",
        "ref_ms_samsung_defrost_heater",
        "ref_ms_samsung_defrost_heater",
    ),
    "samsungRf260bFfDefrostHeaterOhms": (
        "heater",
        "ref_ms_samsung_defrost_heater",
        "ref_ms_samsung_defrost_heater",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "display_panel": ("display_panel", "ref_kw_41e_display", "ref_ms_display_panel_bad"),
    "ice_maker_module": ("ice_maker_module", "ref_ms_011_ice_maker_ff_temp_high", "chip_ice_maker"),
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
    if kind == "checkpoint_yes" and not branch.get("terminal") and eliminate_id:
        return []
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
    for path in sorted(SEED_DIR.glob("samsungrf260b-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
