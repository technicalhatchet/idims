from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .provenance import build_provenance, provenance_ref

INHERITANCE_MODE_EXPLICIT_SIBLING = "explicit_sibling_reuse"


def declares_procedure_inheritance(manual_entry: dict[str, Any]) -> bool:
    inheritance = manual_entry.get("procedureInheritance") or {}
    return inheritance.get("mode") == INHERITANCE_MODE_EXPLICIT_SIBLING


def allowed_seed_manual_ids(manual_entry: dict[str, Any]) -> set[str]:
    manual_id = str(manual_entry.get("manualId"))
    allowed = {manual_id}
    inheritance = manual_entry.get("procedureInheritance") or {}
    if inheritance.get("mode") == INHERITANCE_MODE_EXPLICIT_SIBLING:
        for source_id in inheritance.get("sourceManualIds") or []:
            if source_id:
                allowed.add(str(source_id))
    return allowed


def allowed_inherited_procedure_ids(manual_entry: dict[str, Any]) -> set[str] | None:
    inheritance = manual_entry.get("procedureInheritance") or {}
    if inheritance.get("mode") != INHERITANCE_MODE_EXPLICIT_SIBLING:
        return None
    procedure_ids = inheritance.get("procedureIds") or []
    if not procedure_ids:
        return None
    return {str(procedure_id) for procedure_id in procedure_ids}


def _normalize_step(step: dict[str, Any]) -> dict[str, Any]:
    measurements: list[dict[str, Any]] = []
    if step.get("type") == "measurement" and step.get("measurementKnowledgeId"):
        measurements.append(
            {
                "measurementKnowledgeId": step["measurementKnowledgeId"],
                "testPoint": step.get("testPoint"),
                "title": step.get("title"),
            },
        )

    branches: list[dict[str, Any]] = []
    for branch in step.get("branches") or []:
        branches.append(
            {
                "id": branch.get("id"),
                "label": branch.get("label"),
                "when": branch.get("when"),
                "nextStepId": branch.get("nextStepId"),
                "terminal": branch.get("terminal"),
                "oemOutcome": branch.get("oemOutcome"),
            },
        )

    return {
        "id": step.get("id"),
        "order": step.get("order"),
        "type": step.get("type"),
        "title": step.get("title"),
        "body": step.get("body"),
        "requiresInput": step.get("requiresInput"),
        "measurements": measurements,
        "branches": branches,
        "sourceExcerpt": step.get("sourceExcerpt"),
    }


def normalize_procedure_seed(
    seed: dict[str, Any],
    manual_entry: dict[str, Any],
    *,
    inherited_from_manual_id: str | None = None,
) -> dict[str, Any]:
    source = seed.get("source") or {}
    entry_manual_id = str(manual_entry.get("manualId"))
    steps = [_normalize_step(step) for step in seed.get("steps") or []]

    all_measurements: list[dict[str, Any]] = []
    all_branches: list[dict[str, Any]] = []
    for step in steps:
        all_measurements.extend(step.get("measurements") or [])
        for branch in step.get("branches") or []:
            all_branches.append(
                {
                    **branch,
                    "stepId": step.get("id"),
                },
            )

    provenance_extra = None
    if inherited_from_manual_id:
        provenance_extra = [
            provenance_ref(
                "inherited_procedure",
                inheritedFromManualId=inherited_from_manual_id,
                targetManualId=entry_manual_id,
            ),
        ]

    return {
        "procedureId": seed.get("id"),
        "manufacturer": _infer_manufacturer(manual_entry),
        "platformId": seed.get("platformId"),
        "templateId": manual_entry.get("templateId"),
        "title": seed.get("title"),
        "purpose": seed.get("purpose") or source.get("oemTestTitle"),
        "prerequisites": seed.get("prerequisites") or [],
        "componentIds": seed.get("componentIds") or [],
        "tags": seed.get("tags") or [],
        "steps": steps,
        "measurements": all_measurements,
        "branches": all_branches,
        "source": {
            "manualId": entry_manual_id,
            "manualTitle": manual_entry.get("label"),
            "oemTestNumber": source.get("oemTestNumber"),
            "oemTestTitle": source.get("oemTestTitle"),
            "pages": source.get("pages") or [],
            "extractedTextFile": source.get("extractedTextFile"),
            "inheritedFromManualId": inherited_from_manual_id,
            "seedSourceManualId": source.get("manualId"),
        },
        "provenance": build_provenance(
            manual_id=entry_manual_id,
            platform_id=seed.get("platformId"),
            procedure_id=seed.get("id"),
            pages=source.get("pages"),
            extraction_doc=manual_entry.get("extractionDoc"),
            extra=provenance_extra,
        ),
    }


def _infer_manufacturer(manual_entry: dict[str, Any]) -> str:
    label = str(manual_entry.get("label") or "")
    platform = str(manual_entry.get("platformId") or "")
    if label.lower().startswith("samsung") or platform.startswith("samsung"):
        return "Samsung"
    if label.lower().startswith("lg") or platform.startswith("lg"):
        return "LG"
    if label.lower().startswith("insignia") or platform.startswith("insignia"):
        return "Insignia"
    if label.lower().startswith("ge") or platform.startswith("ge"):
        return "GE"
    if "whirlpool" in label.lower() or "maytag" in label.lower() or platform.startswith("whirlpool"):
        return "Whirlpool"
    return "Unknown"


def load_procedure_seeds_for_manual(
    manual_entry: dict[str, Any],
    seed_dir: Path,
) -> list[dict[str, Any]]:
    procedures: list[dict[str, Any]] = []
    if not seed_dir.is_dir():
        return procedures

    entry_manual_id = str(manual_entry.get("manualId"))
    allowed_manual_ids = allowed_seed_manual_ids(manual_entry)
    allowed_procedure_ids = allowed_inherited_procedure_ids(manual_entry)

    for path in sorted(seed_dir.glob("*.json")):
        if path.name == "procedureCatalog.json":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("modeKind"):
            continue
        seed_id = str(data.get("id") or "")
        source_manual_id = (data.get("source") or {}).get("manualId")
        if source_manual_id and str(source_manual_id) not in allowed_manual_ids:
            continue
        if allowed_procedure_ids is not None and seed_id not in allowed_procedure_ids:
            continue
        inherited_from = None
        if source_manual_id and str(source_manual_id) != entry_manual_id:
            inherited_from = str(source_manual_id)
        procedures.append(
            normalize_procedure_seed(
                data,
                manual_entry,
                inherited_from_manual_id=inherited_from,
            ),
        )
    return procedures
