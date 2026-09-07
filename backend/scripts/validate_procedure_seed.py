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


def load_measurement_knowledge_ids() -> set[str]:
    ids: set[str] = set()
    for path in sorted(KNOWLEDGE_SEED_DIR.glob("measurement-knowledge*.json")):
        entries = json.loads(path.read_text(encoding="utf-8"))
        for entry in entries:
            entry_id = entry.get("id")
            if entry_id:
                ids.add(entry_id)
    return ids


def validate_procedure(data: dict, path: Path, knowledge_ids: set[str]) -> list[str]:
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
    if not isinstance(steps, list) or not steps:
        errors.append(f"{path}: steps must be a non-empty array")
        return errors

    step_ids = {step["id"] for step in steps if "id" in step}
    if len(step_ids) != len(steps):
        errors.append(f"{path}: duplicate or missing step ids")

    entry_step_id = data.get("entryStepId")
    if entry_step_id not in step_ids:
        errors.append(f"{path}: entryStepId '{entry_step_id}' not found in steps")

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
            if next_step_id and next_step_id not in step_ids:
                errors.append(
                    f"{path}: step {step_id} branch {branch.get('id')} references unknown nextStepId '{next_step_id}'"
                )

        default_next = step.get("defaultNextStepId")
        if default_next and default_next not in step_ids:
            errors.append(
                f"{path}: step {step_id} defaultNextStepId '{default_next}' not found in steps"
            )

    return errors


def main() -> int:
    knowledge_ids = load_measurement_knowledge_ids()
    seed_files = sorted(PROCEDURE_SEED_DIR.rglob("*.json"))
    if not seed_files:
        print("No procedure seed files found.", file=sys.stderr)
        return 1

    all_errors: list[str] = []
    procedure_ids: set[str] = set()

    for path in seed_files:
        data = json.loads(path.read_text(encoding="utf-8"))
        proc_id = data.get("id")
        if proc_id in procedure_ids:
            all_errors.append(f"Duplicate procedure id '{proc_id}'")
        elif proc_id:
            procedure_ids.add(proc_id)
        all_errors.extend(validate_procedure(data, path, knowledge_ids))

    if all_errors:
        print("Procedure seed validation failed:", file=sys.stderr)
        for error in all_errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print(f"Validated {len(seed_files)} procedure seed file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
