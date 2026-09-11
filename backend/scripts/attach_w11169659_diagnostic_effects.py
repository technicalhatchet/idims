#!/usr/bin/env python3
"""Attach diagnosticEffects to W11169659 MED9620 delta procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_ccu_dryer"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w11169659-acu-power": "acu",
    "w11169659-heater-electric": "heating_element",
    "w11169659-moisture-sensor": "moisture_sensor",
    "w11169659-drum-led": "drum_light",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "acu": ("acu", "ed_kw_f1e1_ccu", "eliminate_heater_ol_heating_element_ok"),
    "heating_element": (
        "heating_element",
        "confirm_heater_ol_heating_element_failed",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "moisture_sensor": (
        "moisture_sensor",
        "confirm_moisture_sensor_bad",
        "eliminate_heater_ol_heating_element_ok",
    ),
    "drum_light": (
        "drum_light",
        "confirm_drum_light_bad",
        "eliminate_drum_light_ok",
    ),
}


def effect_for_branch(procedure_id: str, step: dict, branch: dict) -> list[dict]:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if not kind:
        return []

    component_id = PROCEDURE_COMPONENT.get(procedure_id)
    if not component_id or component_id not in COMPONENT_DEFAULT_EVIDENCE:
        return []

    component_id, confirm_id, eliminate_id = COMPONENT_DEFAULT_EVIDENCE[component_id]

    if kind in FAIL_MEASUREMENT or (kind == "checkpoint_no" and branch.get("terminal")):
        return [{"type": "confirm", "componentId": component_id, "evidenceId": confirm_id}]
    if kind in PASS_MEASUREMENT or kind == "checkpoint_yes":
        if branch.get("terminal"):
            return [{"type": "eliminate", "componentId": component_id, "evidenceId": eliminate_id}]
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
    for path in sorted(SEED_DIR.glob("w11169659-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es) with diagnosticEffects")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
