#!/usr/bin/env python3
"""Attach diagnosticEffects to W10674984 WRT311 ADC refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_wrt311_adc"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w10674984-defrost-heater": "heater",
    "w10674984-defrost-bimetal": "defrost_thermostat",
    "w10674984-adc-heater-voltage": "control_board",
    "w10674984-adc-cooling-voltage": "control_board",
    "w10674984-ptc-start": "start_device",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "whirlpoolWrt311DefrostHeaterOhms": (
        "heater",
        "ref_ms_wp_wrt311_defrost_heater",
        "ref_kw_wp_rd",
    ),
    "whirlpoolWrt311DefrostBimetalOhms": (
        "defrost_thermostat",
        "ref_ms_wp_wrt_bimetal_open",
        "ref_kw_wp_df",
    ),
    "whirlpoolWrt311AdcDefrostHeaterVoltage": (
        "control_board",
        "ref_ms_wp_wrt311_adc_heater_v",
        "ref_kw_wp_df",
    ),
    "whirlpoolWrt311AdcCoolingOutputVoltage": (
        "control_board",
        "ref_ms_wp_wrt311_adc_cooling_v",
        "ref_ms_014_not_cooling_compressor_no",
    ),
    "whirlpoolWrtPtcStartOhms": (
        "start_device",
        "ref_ms_wp_wrt_ptc_open",
        "ref_kw_wp_ptc",
    ),
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
    for path in sorted(SEED_DIR.glob("w10674984-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
