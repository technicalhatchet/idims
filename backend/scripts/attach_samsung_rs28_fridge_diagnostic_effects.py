#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung RS28 refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_sxs"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "samsungrs28-f-sensor": "thermistor",
    "samsungrs28-r-sensor": "thermistor",
    "samsungrs28-f-def-sensor": "thermistor",
    "samsungrs28-ambient-sensor": "thermistor",
    "samsungrs28-humidity-sensor": "thermistor",
    "samsungrs28-ice-maker-sensor": "thermistor",
    "samsungrs28-f-fan": "evap_fan",
    "samsungrs28-c-fan": "evap_fan",
    "samsungrs28-f-defrost-heater": "heater",
    "samsungrs28-damper-heater": "damper_motor",
    "samsungrs28-ice-pipe-heater": "ice_pipe_heater",
    "samsungrs28-ice-maker-function": "ice_maker_module",
    "samsungrs28-panel-communication": "display_panel",
    "samsungrs28-inverter-communication": "inverter_board",
    "samsungrs28-io-expander-communication": "main_control",
    "samsungrs28-dispenser-communication": "dispenser_panel",
    "samsungrs28-wifi-communication": "display_panel",
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
    "samsungRs28DamperHeaterOhms": (
        "damper_motor",
        "ref_kw_rd_damper",
        "ref_ms_damper_bad_weak_ff",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "display_panel": ("display_panel", "ref_kw_41e_display", "ref_ms_display_panel_bad"),
    "inverter_board": ("inverter_board", "ref_kw_44e_inverter", "ref_kw_86e_inverter"),
    "main_control": ("main_control", "ref_kw_46e_io", "ref_ms_display_panel_bad"),
    "dispenser_panel": ("dispenser_panel", "ref_kw_47e_dispenser", "ref_ms_display_panel_bad"),
    "ice_maker_module": ("ice_maker_module", "ref_ms_011_ice_maker_ff_temp_high", "chip_ice_maker"),
    "ice_pipe_heater": ("ice_pipe_heater", "ref_kw_33e_ice_pipe", "chip_ice_maker"),
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

    if procedure_id == "samsungrs28-wifi-communication" and kind == "checkpoint_no":
        return [{"type": "confirm", "componentId": "display_panel", "evidenceId": "ref_kw_52e_wifi"}]

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
    for path in sorted(SEED_DIR.glob("samsungrs28-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
