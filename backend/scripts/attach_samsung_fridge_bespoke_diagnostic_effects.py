#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung Bespoke refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fridge_bespoke"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungbespoke-freezer-sensor": "thermistor",
    "samsungbespoke-fridge-sensor": "thermistor",
    "samsungbespoke-freezer-defrost-sensor": "thermistor",
    "samsungbespoke-fridge-defrost-sensor": "thermistor",
    "samsungbespoke-ambient-sensor": "thermistor",
    "samsungbespoke-flex-sensor": "thermistor",
    "samsungbespoke-humidity-sensor": "thermistor",
    "samsungbespoke-ice-maker-sensor": "ice_maker_module",
    "samsungbespoke-freezer-fan": "evap_fan",
    "samsungbespoke-fridge-fan": "evap_fan",
    "samsungbespoke-convertible-fan": "evap_fan",
    "samsungbespoke-ice-room-fan": "evap_fan",
    "samsungbespoke-freezer-defrost-heater": "heater",
    "samsungbespoke-damper-heater-135": "damper_motor",
    "samsungbespoke-damper-heater-24": "damper_motor",
    "samsungbespoke-ice-pipe-heater-72": "ice_pipe_heater",
    "samsungbespoke-ice-pipe-heater-24": "ice_pipe_heater",
    "samsungbespoke-ice-duct-heater": "ice_pipe_heater",
    "samsungbespoke-ice-room-heater": "heater",
    "samsungbespoke-compressor-inverter": "inverter_board",
    "samsungbespoke-main-panel-comm": "display_panel",
    "samsungbespoke-main-inverter-comm": "inverter_board",
    "samsungbespoke-autofill-overflow": "ice_maker_module",
}

KNOWLEDGE_EVIDENCE = {
    "samsungBespokeFridgeThermistorVoltage": ("thermistor", "defrost_thermistor_bad_component", ""),
    "samsungBespokeFridgeEvapFanFeedbackVoltage": ("evap_fan", "ref_ms_evap_fan_voltage_low", ""),
    "samsungBespokeFridgeInverterIpmVoltage": ("inverter_board", "ref_ms_inverter_ipm_low", ""),
    "samsungBespokeFridgeDefrostHeaterOhms63": ("heater", "ref_ms_samsung_defrost_heater", ""),
    "samsungBespokeFridgeDamperHeaterOhms135": ("damper_motor", "ref_ms_damper_bad_weak_ff", ""),
    "samsungBespokeFridgeDamperHeaterOhms24": ("damper_motor", "ref_ms_damper_bad_weak_ff", ""),
    "samsungBespokeFridgeIcePipeHeaterOhms72": ("ice_pipe_heater", "ref_ms_007_heavy_frost_heater_open", ""),
    "samsungBespokeFridgeIcePipeHeaterOhms24": ("ice_pipe_heater", "ref_ms_007_heavy_frost_heater_open", ""),
    "samsungBespokeFridgeIceDuctHeaterOhms63": ("ice_pipe_heater", "ref_ms_007_heavy_frost_heater_open", ""),
    "samsungBespokeFridgeAutofillOverflowVoltage": ("ice_maker_module", "", ""),
}


def attach_effects(data: dict) -> int:
    pid = data.get("id", "")
    component = PROCEDURE_COMPONENT.get(pid, "")
    count = 0
    for step in data.get("steps", []):
        kid = step.get("measurementKnowledgeId")
        comp, confirm, eliminate = KNOWLEDGE_EVIDENCE.get(kid, (component, "", ""))
        for branch in step.get("branches", []) or []:
            if branch.get("diagnosticEffects"):
                continue
            when = branch.get("when", {})
            kind = when.get("kind", "")
            effects = []
            if kind in PASS_MEAS and eliminate:
                effects.append({"action": "eliminate", "evidenceId": eliminate, "componentId": comp})
            elif kind in FAIL_MEAS and confirm:
                effects.append({"action": "confirm", "evidenceId": confirm, "componentId": comp})
            elif kind == "checkpoint_no" and confirm:
                effects.append({"action": "confirm", "evidenceId": confirm, "componentId": comp})
            elif kind == "checkpoint_yes" and eliminate:
                effects.append({"action": "eliminate", "evidenceId": eliminate, "componentId": comp})
            if effects:
                branch["diagnosticEffects"] = effects
                count += 1
    return count


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("samsungbespoke-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
