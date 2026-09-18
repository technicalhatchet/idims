from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .provenance import build_provenance


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
) -> dict[str, Any]:
    source = seed.get("source") or {}
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
            "manualId": source.get("manualId") or manual_entry.get("manualId"),
            "manualTitle": source.get("manualTitle"),
            "oemTestNumber": source.get("oemTestNumber"),
            "oemTestTitle": source.get("oemTestTitle"),
            "pages": source.get("pages") or [],
            "extractedTextFile": source.get("extractedTextFile"),
        },
        "provenance": build_provenance(
            manual_id=str(source.get("manualId") or manual_entry.get("manualId")),
            platform_id=seed.get("platformId"),
            procedure_id=seed.get("id"),
            pages=source.get("pages"),
            extraction_doc=manual_entry.get("extractionDoc"),
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

    for path in sorted(seed_dir.glob("*.json")):
        if path.name == "procedureCatalog.json":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("modeKind"):
            continue
        source_manual_id = (data.get("source") or {}).get("manualId")
        entry_manual_id = manual_entry.get("manualId")
        if source_manual_id and entry_manual_id and source_manual_id != entry_manual_id:
            continue
        procedures.append(normalize_procedure_seed(data, manual_entry))
    return procedures
