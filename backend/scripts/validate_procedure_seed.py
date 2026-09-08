#!/usr/bin/env python3
"""Validate service procedure seed JSON against schema and knowledge references."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROCEDURE_SEED_DIR = (
    ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed"
)
KNOWLEDGE_SEED_DIR = ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "seed"

REQUIRED_PROCEDURE_KEYS = {
    "id",
    "version",
    "title",
    "platformId",
    "componentIds",
    "source",
    "entryStepId",
    "steps",
}

REQUIRED_BUNDLE_KEYS = {
    "id",
    "version",
    "platformId",
    "manualId",
    "title",
    "modeKind",
    "uiVariants",
    "entryStepId",
    "steps",
}

SERVICE_MODE_KINDS = {
    "service_diagnostic_entry",
    "quick_service_cycle",
    "combined_qsc",
    "component_activation",
    "load_test",
    "fault_codes",
    "hmi_test",
    "voltage_check",
}

UI_VARIANTS = {"console", "lcd_in_door", "any"}

REQUIRED_SOURCE_KEYS = {
    "manualId",
    "manualTitle",
    "oemTestNumber",
    "oemTestTitle",
    "pages",
}

REQUIRED_STEP_KEYS = {"id", "order", "type", "title"}

STEP_TYPES = {"safety", "instruction", "visual_check", "measurement", "outcome"}

BRANCH_KINDS = {
    "measurement_normal",
    "measurement_warning",
    "measurement_critical",
    "measurement_open",
    "checkpoint_yes",
    "checkpoint_no",
}

FORBIDDEN_SOURCE_KEYS = {"pdfUrl", "pdfPath", "documentUrl"}

KNOWN_WIRE_COLOR_CODES = {
    "BK", "BLK", "BL", "BU", "BR", "BN", "GN", "GRN", "GY", "GR", "OR", "OG",
    "PK", "R", "RD", "V", "VI", "W", "WH", "WT", "Y", "YL", "W/B", "BK/W",
}

WIRE_COLOR_CONFIDENCE = {"verified", "inferred"}

CONTINUE_TOKEN = "@continue"


def load_measurement_knowledge_ids() -> set[str]:
    ids: set[str] = set()
    for path in sorted(KNOWLEDGE_SEED_DIR.glob("measurement-knowledge*.json")):
        entries = json.loads(path.read_text(encoding="utf-8"))
        for entry in entries:
            entry_id = entry.get("id")
            if entry_id:
                ids.add(entry_id)
    return ids


def is_bundle_path(path: Path) -> bool:
    return "bundles" in path.parts


def validate_steps(
    steps: list[dict],
    path: Path,
    knowledge_ids: set[str],
    *,
    allow_continue: bool = False,
    service_mode_attach_step_ids: set[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    attach_step_ids = service_mode_attach_step_ids or set()

    if not isinstance(steps, list) or not steps:
        errors.append(f"{path}: steps must be a non-empty array")
        return errors

    step_ids = {step["id"] for step in steps if "id" in step}
    if len(step_ids) != len(steps):
        errors.append(f"{path}: duplicate or missing step ids")

    for step in steps:
        step_id = step.get("id", "<unknown>")
        step_missing = REQUIRED_STEP_KEYS - step.keys()
        if step_missing:
            errors.append(f"{path}: step {step_id} missing keys {sorted(step_missing)}")
            continue

        step_type = step.get("type")
        if step_type not in STEP_TYPES:
            errors.append(f"{path}: step {step_id} has invalid type '{step_type}'")

        if step_type == "measurement":
            knowledge_id = step.get("measurementKnowledgeId")
            if not knowledge_id:
                errors.append(f"{path}: step {step_id} missing measurementKnowledgeId")
            elif knowledge_id not in knowledge_ids:
                errors.append(
                    f"{path}: step {step_id} references unknown measurementKnowledgeId '{knowledge_id}'"
                )

        for branch in step.get("branches", []) or []:
            when = branch.get("when", {})
            kind = when.get("kind")
            if kind not in BRANCH_KINDS:
                errors.append(
                    f"{path}: step {step_id} branch {branch.get('id')} has invalid when.kind '{kind}'"
                )
            next_step_id = branch.get("nextStepId")
            if next_step_id and next_step_id not in step_ids and not (
                allow_continue and next_step_id == CONTINUE_TOKEN
            ):
                errors.append(
                    f"{path}: step {step_id} branch {branch.get('id')} references unknown nextStepId '{next_step_id}'"
                )

        default_next = step.get("defaultNextStepId")
        if default_next and default_next not in step_ids and not (
            allow_continue and default_next == CONTINUE_TOKEN
        ):
            errors.append(
                f"{path}: step {step_id} defaultNextStepId '{default_next}' not found in steps"
            )

        step_type = step.get("type")
        branches = step.get("branches") or []
        if (
            step_type in {"safety", "instruction"}
            and step_id not in attach_step_ids
            and not branches
            and not default_next
        ):
            errors.append(
                f"{path}: step {step_id} ({step_type}) must define defaultNextStepId or branches"
            )

        test_point = step.get("testPoint") or {}
        for pin in test_point.get("pinDetails", []) or []:
            wire_color = pin.get("wireColor")
            confidence = pin.get("wireColorConfidence")
            if wire_color and confidence and confidence not in WIRE_COLOR_CONFIDENCE:
                errors.append(
                    f"{path}: step {step_id} pin {pin.get('pin')} has invalid wireColorConfidence '{confidence}'"
                )
            if wire_color and confidence == "verified":
                normalized = str(wire_color).strip().upper()
                if normalized not in KNOWN_WIRE_COLOR_CODES:
                    errors.append(
                        f"{path}: step {step_id} pin {pin.get('pin')} has unknown verified wireColor '{wire_color}'"
                    )

    return errors


def validate_bundle(data: dict, path: Path, knowledge_ids: set[str]) -> list[str]:
    errors: list[str] = []
    missing = REQUIRED_BUNDLE_KEYS - data.keys()
    if missing:
        errors.append(f"{path}: missing keys {sorted(missing)}")
        return errors

    entry_step_id = data.get("entryStepId")
    steps = data.get("steps", [])
    step_ids = {step["id"] for step in steps if "id" in step}
    if entry_step_id not in step_ids:
        errors.append(f"{path}: entryStepId '{entry_step_id}' not found in steps")

    mode_kind = data.get("modeKind")
    if mode_kind not in SERVICE_MODE_KINDS:
        errors.append(f"{path}: invalid modeKind '{mode_kind}'")

    ui_variants = data.get("uiVariants") or []
    if not isinstance(ui_variants, list) or not ui_variants:
        errors.append(f"{path}: uiVariants must be a non-empty array")
    elif any(variant not in UI_VARIANTS for variant in ui_variants):
        errors.append(f"{path}: uiVariants contains invalid value(s)")

    errors.extend(
        validate_steps(steps, path, knowledge_ids, allow_continue=True),
    )
    return errors


def validate_procedure(
    data: dict,
    path: Path,
    knowledge_ids: set[str],
    bundle_ids: set[str],
) -> list[str]:
    errors: list[str] = []

    missing = REQUIRED_PROCEDURE_KEYS - data.keys()
    if missing:
        errors.append(f"{path}: missing keys {sorted(missing)}")
        return errors

    source = data.get("source", {})
    source_missing = REQUIRED_SOURCE_KEYS - source.keys()
    if source_missing:
        errors.append(f"{path}: source missing keys {sorted(source_missing)}")

    for forbidden in FORBIDDEN_SOURCE_KEYS:
        if forbidden in source:
            errors.append(f"{path}: source must not include PDF field '{forbidden}'")

    steps = data.get("steps", [])
    step_ids = {step["id"] for step in steps if isinstance(step, dict) and "id" in step}

    entry_step_id = data.get("entryStepId")
    if entry_step_id not in step_ids:
        errors.append(f"{path}: entryStepId '{entry_step_id}' not found in steps")

    service_mode = data.get("serviceMode")
    service_modes = data.get("serviceModes") or []
    refs: list[dict] = []
    if service_mode:
        refs.append(service_mode)
    if service_modes:
        refs.extend(service_modes)

    if service_mode and service_modes:
        errors.append(f"{path}: use serviceModes only, not both serviceMode and serviceModes")

    for index, ref in enumerate(refs):
        bundle_id = ref.get("bundleId")
        mode_kind = ref.get("modeKind")
        attach_after = ref.get("attachAfterStepId")
        continue_to = ref.get("continueToStepId")
        label = f"serviceModes[{index}]" if len(refs) > 1 else "serviceMode"
        if not bundle_id:
            errors.append(f"{path}: {label}.bundleId is required")
        elif bundle_id not in bundle_ids:
            errors.append(f"{path}: {label} references unknown bundleId '{bundle_id}'")
        if not mode_kind:
            errors.append(f"{path}: {label}.modeKind is required")
        elif mode_kind not in SERVICE_MODE_KINDS:
            errors.append(f"{path}: {label}.modeKind '{mode_kind}' is invalid")
        if not attach_after or attach_after not in step_ids:
            errors.append(
                f"{path}: {label}.attachAfterStepId '{attach_after}' not found in steps"
            )
        if not continue_to or continue_to not in step_ids:
            errors.append(
                f"{path}: {label}.continueToStepId '{continue_to}' not found in steps"
            )

    attach_step_ids = {
        ref.get("attachAfterStepId")
        for ref in refs
        if ref.get("attachAfterStepId")
    }

    errors.extend(
        validate_steps(
            steps,
            path,
            knowledge_ids,
            allow_continue=False,
            service_mode_attach_step_ids=attach_step_ids,
        ),
    )
    return errors


def main() -> int:
    knowledge_ids = load_measurement_knowledge_ids()
    seed_files = sorted(PROCEDURE_SEED_DIR.rglob("*.json"))
    if not seed_files:
        print("No procedure seed files found.", file=sys.stderr)
        return 1

    bundle_files = [path for path in seed_files if is_bundle_path(path)]
    procedure_files = [path for path in seed_files if not is_bundle_path(path)]

    all_errors: list[str] = []
    bundle_ids: set[str] = set()

    for path in bundle_files:
        data = json.loads(path.read_text(encoding="utf-8"))
        bundle_id = data.get("id")
        if bundle_id in bundle_ids:
            all_errors.append(f"Duplicate bundle id '{bundle_id}'")
        elif bundle_id:
            bundle_ids.add(bundle_id)
        all_errors.extend(validate_bundle(data, path, knowledge_ids))

    procedure_ids: set[str] = set()
    for path in procedure_files:
        data = json.loads(path.read_text(encoding="utf-8"))
        proc_id = data.get("id")
        if proc_id in procedure_ids:
            all_errors.append(f"Duplicate procedure id '{proc_id}'")
        elif proc_id:
            procedure_ids.add(proc_id)
        all_errors.extend(validate_procedure(data, path, knowledge_ids, bundle_ids))

    if all_errors:
        print("Procedure seed validation failed:", file=sys.stderr)
        for error in all_errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(
        f"Validated {len(procedure_files)} procedure seed file(s) "
        f"and {len(bundle_files)} service-mode bundle(s)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
