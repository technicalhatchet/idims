from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .canonical_matcher import build_mapping_candidates
from .conflict_detector import (
    detect_alias_conflicts,
    detect_test_target_conflicts,
    detect_topology_conflicts,
    merge_conflicts,
)
from .normalize_procedure import load_procedure_seeds_for_manual
from .overlay_candidate_builder import build_overlay_candidates
from .ontology_resolver import resolve_ontology_id
from .paths import CANDIDATES_DIR, MANIFEST_PATH, PROCEDURE_SEED_DIR


def load_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def find_manual_entry(manifest: dict[str, Any], manual_id: str) -> dict[str, Any]:
    for entry in manifest.get("manuals", []):
        if entry.get("manualId") == manual_id:
            return entry
    raise ValueError(f"Manual '{manual_id}' not found in procedureManualManifest.json")


def run_manual_normalization(
    manual_entry: dict[str, Any],
    global_mapping_candidates: list[dict[str, Any]] | None = None,
    global_overlay_candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    manual_id = str(manual_entry.get("manualId"))
    seed_dir = PROCEDURE_SEED_DIR / str(manual_entry.get("seedDir"))
    template_id = str(manual_entry.get("templateId") or "")
    platform_id = manual_entry.get("platformId")

    procedures = load_procedure_seeds_for_manual(manual_entry, seed_dir)
    mapping_candidates, extraction_filters = build_mapping_candidates(
        procedures,
        manual_entry,
        template_id,
    )
    overlay_candidates = build_overlay_candidates(procedures, manual_entry, template_id)

    if global_mapping_candidates is not None:
        global_mapping_candidates.extend(mapping_candidates)
    if global_overlay_candidates is not None:
        global_overlay_candidates.extend(overlay_candidates)

    from .conflict_detector import topology_signature as infer_topology_signature

    topo_sig = infer_topology_signature(manual_entry, procedures)

    per_manual_conflicts = merge_conflicts(
        detect_test_target_conflicts(overlay_candidates),
    )

    output_dir = CANDIDATES_DIR / manual_id
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "manualId": manual_id,
        "platformId": manual_entry.get("platformId"),
        "templateId": template_id,
        "label": manual_entry.get("label"),
        "status": "candidate",
        "ontologyId": resolve_ontology_id(template_id, platform_id),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "topologySignature": topo_sig,
        "counts": {
            "procedures": len(procedures),
            "mappingCandidates": len(mapping_candidates),
            "overlayCandidates": len(overlay_candidates),
            "conflicts": len(per_manual_conflicts),
            "extractionFiltered": extraction_filters.get("totalFiltered", 0),
        },
        "extractionFilters": extraction_filters,
    }

    _write_json(output_dir / "normalized_procedures.json", {
        "manualId": manual_id,
        "procedures": procedures,
    })
    _write_json(output_dir / "canonical_mapping_candidates.json", {
        "manualId": manual_id,
        "candidates": mapping_candidates,
    })
    _write_json(output_dir / "overlay_candidates.json", {
        "manualId": manual_id,
        "candidates": overlay_candidates,
    })
    _write_json(output_dir / "conflicts.json", {
        "manualId": manual_id,
        "conflicts": per_manual_conflicts,
    })
    _write_json(output_dir / "pipeline_manifest.json", manifest)

    return {
        "manualId": manual_id,
        "templateId": template_id,
        "topologySignature": topo_sig,
        "manifest": manifest,
        "mappingCandidates": mapping_candidates,
        "overlayCandidates": overlay_candidates,
        "conflicts": per_manual_conflicts,
    }


def run_global_conflict_pass(manual_runs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapping_candidates: list[dict[str, Any]] = []
    overlay_candidates: list[dict[str, Any]] = []
    for run in manual_runs:
        mapping_candidates.extend(run.get("mappingCandidates") or [])
        overlay_candidates.extend(run.get("overlayCandidates") or [])

    return merge_conflicts(
        detect_alias_conflicts(mapping_candidates),
        detect_topology_conflicts(manual_runs),
        detect_test_target_conflicts(overlay_candidates),
    )


def write_global_conflicts(conflicts: list[dict[str, Any]]) -> None:
    CANDIDATES_DIR.mkdir(parents=True, exist_ok=True)
    _write_json(
        CANDIDATES_DIR / "_global_conflicts.json",
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "conflicts": conflicts,
        },
    )


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
