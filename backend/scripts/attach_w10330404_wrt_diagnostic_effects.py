#!/usr/bin/env python3
"""Attach diagnosticEffects to W10330404 WRT top-mount refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_wrt_top_mount"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w10330404-defrost-heater": "heater",
    "w10330404-defrost-bimetal": "defrost_thermostat",
    "w10330404-defrost-timer": "defrost_timer",
    "w10330404-ptc-start": "start_device",
    "w10330404-condenser-fan": "condenser_fan",
    "w10330404-ice-maker-fuse": "ice_maker_module",
    "w10330404-compressor-windings": "compressor",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "whirlpoolWrtDefrostHeaterOhms": (
        "heater",
        "ref_ms_wp_wrt_defrost_heater",
        "ref_ms_wp_wrt_frost_heater_combo",
    ),
    "whirlpoolWrtDefrostBimetalOhms": (
        "defrost_thermostat",
        "ref_ms_wp_wrt_bimetal_open",
        "ref_kw_wp_df",
    ),
    "whirlpoolWrtPtcStartOhms": (
        "start_device",
        "ref_ms_wp_wrt_ptc_open",
        "ref_kw_wp_ptc",
    ),
    "whirlpoolWrtCondenserFanOhms": (
        "condenser_fan",
        "ref_ms_006_frost_chip_heavy_frost_evap_fan_no",
        "ref_kw_22e_evap_fan",
    ),
    "whirlpoolWrtIceMakerThermalFuseOhms": (
        "ice_maker_module",
        "ref_ms_wp_wrt_im_fuse",
        "ref_kw_wp_im_fuse",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "defrost_timer": ("defrost_timer", "ref_kw_wp_df", "ref_kw_wp_df"),
    "compressor": ("compressor", "ref_ms_014_not_cooling_compressor_no", "ref_ms_014_not_cooling_compressor_no"),
    "heater": ("heater", "ref_ms_wp_wrt_defrost_heater", "ref_kw_wp_rd"),
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
    for path in sorted(SEED_DIR.glob("w10330404-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
