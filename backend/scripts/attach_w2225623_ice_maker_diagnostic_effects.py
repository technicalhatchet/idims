#!/usr/bin/env python3
"""Attach diagnosticEffects to Whirlpool modular ice maker 2225623 procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_modular_ice_maker"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w2225623-module-power": "ice_maker_module",
    "w2225623-mold-heater": "ice_maker_module",
    "w2225623-motor-circuit": "ice_maker_module",
    "w2225623-bimetal": "ice_maker_module",
    "w2225623-water-valve": "water_valve",
    "w2225623-harness-fuse": "ice_maker_module",
    "w2225623-water-fill-adjust": "ice_maker_module",
    "w2225623-ime-errors": "ice_maker_module",
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "whirlpoolModularIceMakerMoldHeaterOhms": (
        "ice_maker_module",
        "ref_ms_im_mold_heater",
        "ref_kw_im_e3_heater",
    ),
    "whirlpoolModularIceMakerMotorOhms": (
        "ice_maker_module",
        "ref_ms_im_motor_open",
        "ref_kw_im_e2_motor",
    ),
    "whirlpoolModularIceMakerBimetalOhms": (
        "ice_maker_module",
        "ref_kw_im_e3_heater",
        "ref_ms_011_ice_maker_ff_temp_high",
    ),
    "whirlpoolModularIceMakerHarnessFuseOhms": (
        "ice_maker_module",
        "ref_ms_im_fuse_open",
        "ref_ms_011_ice_maker_ff_temp_high",
    ),
}

CHECKPOINT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "ice_maker_module": ("ice_maker_module", "ref_ms_011_ice_maker_ff_temp_high", "ref_kw_im_e2_motor"),
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
    for path in sorted(SEED_DIR.glob("w2225623-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
