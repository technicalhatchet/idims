#!/usr/bin/env python3
"""Attach diagnosticEffects to LG LMHM2237 OTR microwave procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/lg_microwave_otr"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "lgotrmw-pcb-thermistor": "thermal_cutout",
    "lgotrmw-humidity-sensor": "supply",
    "lgotrmw-door-interlock": "door_interlock",
    "lgotrmw-line-power": "line_fuse",
    "lgotrmw-no-heat": "magnetron",
    "lgotrmw-hv-transformer": "magnetron",
    "lgotrmw-hv-capacitor": "hv_capacitor",
    "lgotrmw-hv-diode": "magnetron",
    "lgotrmw-magnetron": "magnetron",
    "lgotrmw-hv-fuse": "line_fuse",
    "lgotrmw-keypad": "supply",
    "lgotrmw-turntable": "magnetron",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "magnetron": (
        "magnetron",
        "confirm_magnetron_open_magnetron_failed",
        "eliminate_magnetron_open_magnetron_ok",
    ),
    "hv_capacitor": (
        "hv_capacitor",
        "confirm_capacitor_bad_hv_capacitor_failed",
        "eliminate_capacitor_bad_hv_capacitor_ok",
    ),
    "line_fuse": (
        "line_fuse",
        "confirm_fuse_open_line_fuse_failed",
        "eliminate_fuse_open_line_fuse_ok",
    ),
    "thermal_cutout": (
        "thermal_cutout",
        "confirm_thermal_cutout_open_thermal_cutout_failed",
        "eliminate_thermal_cutout_open_thermal_cutout_ok",
    ),
    "door_interlock": (
        "door_interlock",
        "confirm_primary_switch_open_door_interlock_failed",
        "eliminate_primary_switch_open_door_interlock_ok",
    ),
    "supply": (
        "supply",
        "confirm_supply_critical_supply_fault",
        "eliminate_supply_critical_supply_ok",
    ),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "microwaveMagnetronFilamentOhms": (
        "magnetron",
        "confirm_magnetron_open_magnetron_failed",
        "eliminate_magnetron_open_magnetron_ok",
    ),
    "microwaveHVDiodeCheck": (
        "magnetron",
        "confirm_magnetron_open_magnetron_failed",
        "eliminate_magnetron_open_magnetron_ok",
    ),
    "microwaveDoorInterlockSwitchOhms": (
        "door_interlock",
        "confirm_primary_switch_open_door_interlock_failed",
        "eliminate_primary_switch_open_door_interlock_ok",
    ),
    "microwaveLineFuseOhms": (
        "line_fuse",
        "confirm_fuse_open_line_fuse_failed",
        "eliminate_fuse_open_line_fuse_ok",
    ),
    "microwaveThermalCutoutOhms": (
        "thermal_cutout",
        "confirm_thermal_cutout_open_thermal_cutout_failed",
        "eliminate_thermal_cutout_open_thermal_cutout_ok",
    ),
    "lgMicrowaveOtrHvTransformerPrimaryOhms": (
        "magnetron",
        "confirm_magnetron_open_magnetron_failed",
        "eliminate_magnetron_open_magnetron_ok",
    ),
    "lgMicrowaveOtrHvTransformerSecondaryOhms": (
        "magnetron",
        "confirm_magnetron_open_magnetron_failed",
        "eliminate_magnetron_open_magnetron_ok",
    ),
    "lgMicrowaveOtrHvFuseOhms": (
        "line_fuse",
        "confirm_fuse_open_line_fuse_failed",
        "eliminate_fuse_open_line_fuse_ok",
    ),
    "lgMicrowaveOtrNoiseFilterCoilOhms": (
        "line_fuse",
        "confirm_no_power_functional_line_fuse_failed",
        "eliminate_no_power_functional_line_fuse_ok",
    ),
    "lgMicrowaveOtrTurntableMotorOhms": (
        "magnetron",
        "confirm_no_heat_functional_magnetron_failed",
        "eliminate_no_heat_functional_magnetron_ok",
    ),
}


def evidence_for_measurement(knowledge_id: str | None, fallback_component: str) -> tuple[str, str, str]:
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        return KNOWLEDGE_EVIDENCE[knowledge_id]
    return COMPONENT_DEFAULT_EVIDENCE.get(fallback_component, (fallback_component, "", ""))


def evidence_for_component(component: str) -> tuple[str, str, str]:
    return COMPONENT_DEFAULT_EVIDENCE.get(component, (component, "", ""))


def confirm_effect(component_id: str, evidence_id: str) -> dict:
    return {"type": "confirm", "componentId": component_id, "evidenceId": evidence_id}


def eliminate_effect(component_id: str, evidence_id: str) -> dict:
    return {"type": "eliminate", "componentId": component_id, "evidenceId": evidence_id}


def suspect_effect(component_id: str) -> dict:
    return {"type": "suspect", "componentId": component_id}


def is_failure_outcome(step: dict | None) -> bool:
    if not step or step.get("type") != "outcome":
        return False
    title = f"{step.get('title', '')} {step.get('oemOutcome', '')}".lower()
    return any(token in title for token in ("replace", "fault", "failed", "suspect", "repair"))


def is_success_outcome(step: dict | None) -> bool:
    if not step or step.get("type") != "outcome":
        return False
    title = f"{step.get('title', '')} {step.get('oemOutcome', '')}".lower()
    return any(token in title for token in ("verified", "operates", "good", "pass", "retest", "within", "ok", "resolved", "addressed"))


def attach_branch_effects(step, branch, fallback_component, steps_by_id) -> bool:
    if branch.get("diagnosticEffects"):
        return False

    kind = (branch.get("when") or {}).get("kind")
    next_step = steps_by_id.get(branch.get("nextStepId", ""))
    terminal = bool(branch.get("terminal")) or (
        next_step and next_step.get("type") == "outcome" and branch.get("nextStepId")
    )

    if step.get("type") == "measurement":
        component, confirm_id, eliminate_id = evidence_for_measurement(
            step.get("measurementKnowledgeId"),
            fallback_component,
        )
        if kind in FAIL_MEASUREMENT and confirm_id:
            branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
            return True
        if kind in PASS_MEASUREMENT and eliminate_id:
            branch["diagnosticEffects"] = [eliminate_effect(component, eliminate_id)]
            return True
        return False

    if step.get("type") == "visual_check":
        component, confirm_id, eliminate_id = evidence_for_component(fallback_component)
        if kind == "checkpoint_no" and (terminal or is_failure_outcome(next_step) or branch.get("oemOutcome")):
            if confirm_id:
                branch["diagnosticEffects"] = [confirm_effect(component, confirm_id)]
                return True
        if kind == "checkpoint_yes" and (
            is_success_outcome(next_step) or (next_step and next_step.get("id", "").endswith("_verified"))
        ):
            if eliminate_id:
                branch["diagnosticEffects"] = [eliminate_effect(component, eliminate_id)]
                return True
        if kind == "checkpoint_no" and not terminal:
            branch["diagnosticEffects"] = [suspect_effect(component)]
            return True
        return False

    return False


def attach_seed(seed: dict) -> int:
    procedure_id = seed.get("id", "")
    fallback_component = PROCEDURE_COMPONENT.get(procedure_id, "")
    if not fallback_component:
        return 0

    if seed.get("componentIds") != [fallback_component]:
        seed["componentIds"] = [fallback_component]

    steps_by_id = {step["id"]: step for step in seed.get("steps", []) if "id" in step}
    attached = 0

    for step in seed.get("steps", []):
        for branch in step.get("branches", []) or []:
            if attach_branch_effects(step, branch, fallback_component, steps_by_id):
                attached += 1

    return attached


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("lgotrmw-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_seed(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) updated")
        total += count
    print(f"Attached diagnosticEffects on {total} branches total.")


if __name__ == "__main__":
    main()
