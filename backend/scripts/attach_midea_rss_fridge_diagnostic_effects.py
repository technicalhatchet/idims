#!/usr/bin/env python3
"""Attach diagnosticEffects to Midea RSS refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/midea_rss"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "midearss-rc-temp-sensor": "thermistor",
    "midearss-fz-temp-sensor": "thermistor",
    "midearss-rc-defrost-sensor": "defrost_thermostat",
    "midearss-fz-defrost-sensor": "defrost_thermostat",
    "midearss-ambient-sensor": "thermistor",
    "midearss-fz-defrost-heater": "heater",
    "midearss-communication": "display_panel",
    "midearss-high-temp-alarm": "thermistor",
    "midearss-ice-maker": "ice_maker_module",
    "midearss-ice-maker-sensor": "thermistor",
    "midearss-vfd-inverter": "compressor",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "mideaB3839ThermistorKohm": (
        "thermistor",
        "ref_kw_8e_thermistor",
        "defrost_thermistor_bad",
    ),
    "mideaRssDefrostHeaterOhms": (
        "heater",
        "ref_ms_007_heavy_frost_heater_open",
        "ref_kw_5e_defrost",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "display_panel": ("display_panel", "ref_kw_41e_display", "ref_ms_display_panel_bad"),
    "ice_maker_module": ("ice_maker_module", "ref_ms_011_ice_maker_ff_temp_high", "chip_ice_maker"),
    "compressor": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_014_not_cooling_compressor_no"),
    "defrost_thermostat": ("defrost_thermostat", "defrost_thermistor_bad_component", "defrost_thermistor_bad"),
    "thermistor": ("thermistor", "ref_kw_8e_thermistor", "defrost_thermistor_bad"),
    "heater": ("heater", "ref_ms_007_heavy_frost_heater_open", "ref_kw_5e_defrost"),
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
    for path in sorted(SEED_DIR.glob("midearss-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
