#!/usr/bin/env python3
"""Attach W11169652 service-mode bundles to procedure seeds."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_fl_dd"

BRIDGE_STEP = {
    "id": "service_mode_before_qsc",
    "type": "instruction",
    "title": "Continue to Quick Service Cycle",
    "body": "You should now be in Service Diagnostic mode. Continue below for Quick Service Cycle instructions.",
    "sourceExcerpt": "Service Diagnostic mode must be active before Load Test / Quick Service Cycle.",
    "requiresInput": False,
}

SPLIT_QSC_PROCEDURES: dict[str, tuple[str, str]] = {
    "w11169652-test-03-motor.json": ("reconnect_harness_power", "live_test_motor_movement"),
    "w11169652-test-04-door-lock.json": ("reconnect_harness_power", "live_test_door_lock"),
    "w11169652-test-06-inlet-valves.json": ("reconnect_j8", "live_valve_test"),
    "w11169652-test-08-drain-pump.json": ("reconnect_harness_power", "live_test_drain_pump"),
    "w11169652-test-09-wash-heater.json": ("reconnect_harness_power", "live_test_heater"),
}

SINGLE_BUNDLE_PROCEDURES: dict[str, dict[str, str]] = {
    "w11169652-test-11b-dosing-pump.json": {
        "attachAfterStepId": "reconnect_j10_power",
        "continueToStepId": "live_test_dosing_pump",
        "bundleId": "w11169652-load-test-detergent-pump",
        "modeKind": "load_test",
    },
    "w11169652-test-13-vent-fan.json": {
        "attachAfterStepId": "reconnect_j12_power",
        "continueToStepId": "live_test_vent_fan",
        "bundleId": "w11169652-component-activation-vent-fan",
        "modeKind": "component_activation",
    },
    "w11169652-test-17-dry-blower.json": {
        "attachAfterStepId": "reconnect_j12_blower_power",
        "continueToStepId": "live_test_dry_blower",
        "bundleId": "w11169652-component-activation-dry-blower",
        "modeKind": "component_activation",
    },
}


def split_service_modes(attach_after: str, continue_to: str) -> list[dict[str, str]]:
    return [
        {
            "bundleId": "w11169652-service-diagnostic-entry",
            "modeKind": "service_diagnostic_entry",
            "attachAfterStepId": attach_after,
            "continueToStepId": "service_mode_before_qsc",
        },
        {
            "bundleId": "w11169652-quick-service-cycle",
            "modeKind": "quick_service_cycle",
            "attachAfterStepId": "service_mode_before_qsc",
            "continueToStepId": continue_to,
        },
    ]


def single_service_mode(ref: dict[str, str]) -> list[dict[str, str]]:
    return [
        {
            "bundleId": ref["bundleId"],
            "modeKind": ref["modeKind"],
            "attachAfterStepId": ref["attachAfterStepId"],
            "continueToStepId": ref["continueToStepId"],
        }
    ]


def ensure_bridge_step(steps: list[dict], reconnect_id: str, live_test_id: str) -> None:
    if any(step.get("id") == "service_mode_before_qsc" for step in steps):
        return
    reconnect_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == reconnect_id),
        None,
    )
    live_index = next(
        (index for index, step in enumerate(steps) if step.get("id") == live_test_id),
        None,
    )
    if reconnect_index is None or live_index is None:
        raise ValueError(f"Could not place bridge between {reconnect_id} and {live_test_id}")

    bridge = {**BRIDGE_STEP, "order": steps[live_index].get("order", live_index + 1)}
    steps.insert(live_index, bridge)


def patch_test_11b(steps: list[dict]) -> None:
    for step in steps:
        if step.get("id") != "pump_ohms":
            continue
        for branch in step.get("branches", []):
            if branch.get("id") == "pump_pass":
                branch["nextStepId"] = "reconnect_j10_power"

    new_steps = [
        {
            "id": "reconnect_j10_power",
            "type": "instruction",
            "title": "Reconnect J10 and restore power",
            "body": "Reconnect J10 at the ACU. Reassemble panels as needed. Plug in or restore power.",
            "sourceExcerpt": "Reconnect J10 at the ACU. Restore power for live pump activation.",
            "requiresInput": False,
        },
        {
            "id": "live_test_dosing_pump",
            "type": "visual_check",
            "title": "Dosing pump runs in load test",
            "body": "During load test function 010 (console) or Component Activation Detergent Pump (LCD), does the dosing pump run?",
            "sourceExcerpt": "010 — Detergent Pump — If pump does not turn on, see TEST #11B.",
            "requiresInput": True,
            "branches": [
                {
                    "id": "pump_runs_yes",
                    "label": "Pump runs",
                    "when": {"kind": "checkpoint_yes"},
                    "nextStepId": "pump_verified",
                    "diagnosticEffects": [
                        {
                            "type": "eliminate",
                            "componentId": "dosing_pump",
                            "evidenceId": "eliminate_dosing_pump_ol_dosing_pump_ok",
                        }
                    ],
                },
                {
                    "id": "pump_runs_no",
                    "label": "Pump does not run",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "replace_acu_pump",
                    "terminal": True,
                    "oemOutcome": "Pump ohms in range but does not run — replace ACU and verify with Quick Service Cycle.",
                    "diagnosticEffects": [
                        {"type": "suspect", "componentId": "dosing_pump"}
                    ],
                },
            ],
        },
        {
            "id": "pump_verified",
            "type": "outcome",
            "title": "Dosing pump verified",
            "oemOutcome": "Dosing pump operates in service mode — reassemble and verify dispense.",
            "requiresInput": False,
        },
    ]

    replace_index = next(
        index for index, step in enumerate(steps) if step.get("id") == "replace_acu_pump"
    )
    for item in new_steps:
        steps.insert(replace_index, item)
        replace_index += 1

    acu_step = next(step for step in steps if step.get("id") == "replace_acu_pump")
    acu_step["oemOutcome"] = (
        "Pump ohms in range but does not run in service mode — replace ACU."
    )


def patch_test_13(steps: list[dict]) -> None:
    for step in steps:
        if step.get("id") != "fan_ohms":
            continue
        for branch in step.get("branches", []):
            if branch.get("id") == "fan_pass":
                branch["nextStepId"] = "reconnect_j12_power"

    insert_before = next(index for index, step in enumerate(steps) if step.get("id") == "clear_vent")
    new_steps = [
        {
            "id": "reconnect_j12_power",
            "type": "instruction",
            "title": "Reconnect J12 and restore power",
            "body": "Reconnect J12 at the ACU. Reassemble panels as needed. Plug in or restore power.",
            "requiresInput": False,
        },
        {
            "id": "live_test_vent_fan",
            "type": "visual_check",
            "title": "Vent fan runs in component activation",
            "body": "During Component Activation (LCD: Dry Heater & Combo Fan — fan only), does the rear vent fan spin?",
            "requiresInput": True,
            "branches": [
                {
                    "id": "fan_runs_yes",
                    "label": "Fan runs",
                    "when": {"kind": "checkpoint_yes"},
                    "nextStepId": "vent_fan_verified",
                    "diagnosticEffects": [
                        {
                            "type": "eliminate",
                            "componentId": "vent_fan",
                            "evidenceId": "eliminate_vent_fan_ol_vent_fan_ok",
                        }
                    ],
                },
                {
                    "id": "fan_runs_no",
                    "label": "Fan does not run",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "replace_acu_fan",
                    "terminal": True,
                    "oemOutcome": "Fan ohms in range but does not run — replace ACU.",
                    "diagnosticEffects": [
                        {"type": "suspect", "componentId": "vent_fan"}
                    ],
                },
            ],
        },
        {
            "id": "vent_fan_verified",
            "type": "outcome",
            "title": "Vent fan verified",
            "oemOutcome": "Vent fan operates — reassemble and verify with Quick Service Cycle.",
            "requiresInput": False,
        },
    ]
    for offset, item in enumerate(new_steps):
        steps.insert(insert_before + offset, item)

    acu = next(step for step in steps if step.get("id") == "replace_acu_fan")
    acu["oemOutcome"] = "Fan ohms in range but does not run in service mode — replace ACU."


def patch_test_17(steps: list[dict]) -> None:
    for step in steps:
        if step.get("id") != "check_blower_wheel":
            continue
        for branch in step.get("branches", []):
            if branch.get("id") == "bw_ok":
                branch.pop("terminal", None)
                branch["nextStepId"] = "reconnect_j12_blower_power"
                branch.pop("oemOutcome", None)

    insert_before = next(
        index for index, step in enumerate(steps) if step.get("id") == "replace_upper_harness_blower"
    )
    new_steps = [
        {
            "id": "reconnect_j12_blower_power",
            "type": "instruction",
            "title": "Reconnect J12 and restore power",
            "body": "Reconnect J12 and Heater Channel Assembly. Reassemble panels. Plug in or restore power.",
            "requiresInput": False,
        },
        {
            "id": "live_test_dry_blower",
            "type": "visual_check",
            "title": "Dry blower runs in component activation",
            "body": "During Component Activation (Dry Blower) or QSC step 010, does the dry blower run?",
            "requiresInput": True,
            "branches": [
                {
                    "id": "blower_runs_yes",
                    "label": "Blower runs",
                    "when": {"kind": "checkpoint_yes"},
                    "nextStepId": "blower_verified",
                    "diagnosticEffects": [
                        {
                            "type": "eliminate",
                            "componentId": "dry_blower",
                            "evidenceId": "eliminate_dry_blower_ol_dry_blower_ok",
                        }
                    ],
                },
                {
                    "id": "blower_runs_no",
                    "label": "Blower does not run",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "replace_acu_blower",
                    "terminal": True,
                    "oemOutcome": "Blower and wheel OK but motor does not run — replace ACU.",
                    "diagnosticEffects": [
                        {"type": "suspect", "componentId": "dry_blower"}
                    ],
                },
            ],
        },
        {
            "id": "blower_verified",
            "type": "outcome",
            "title": "Dry blower verified",
            "oemOutcome": "Dry blower operates — reassemble and verify with Quick Service Cycle.",
            "requiresInput": False,
        },
    ]
    for offset, item in enumerate(new_steps):
        steps.insert(insert_before + offset, item)

    acu = next(step for step in steps if step.get("id") == "replace_acu_blower")
    acu["oemOutcome"] = "Replace ACU and verify with Quick Service Cycle."


def renumber_steps(steps: list[dict]) -> None:
    for index, step in enumerate(steps, start=1):
        step["order"] = index


def patch_seed(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    name = path.name

    if name in SPLIT_QSC_PROCEDURES:
        attach_after, continue_to = SPLIT_QSC_PROCEDURES[name]
        ensure_bridge_step(data["steps"], attach_after, continue_to)
        data["serviceModes"] = split_service_modes(attach_after, continue_to)
        renumber_steps(data["steps"])
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{name}: split entry + QSC service modes"

    if name in SINGLE_BUNDLE_PROCEDURES:
        ref = SINGLE_BUNDLE_PROCEDURES[name]
        if name.endswith("11b-dosing-pump.json"):
            patch_test_11b(data["steps"])
        elif name.endswith("13-vent-fan.json"):
            patch_test_13(data["steps"])
        elif name.endswith("17-dry-blower.json"):
            patch_test_17(data["steps"])
        data["serviceModes"] = single_service_mode(ref)
        renumber_steps(data["steps"])
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{name}: {ref['bundleId']}"

    return f"{name}: skipped"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w11169652-test-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
