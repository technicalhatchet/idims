#!/usr/bin/env python3
"""Validate CG-3 normalization candidate JSON (structure + canonical references)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANDIDATES_DIR = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "candidates"
)
CANONICAL_DIR = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "canonical"
)
CANONICAL_ONTOLOGY_FILES = {
    "front_load_washer": CANONICAL_DIR / "front_load_washer.json",
    "top_load_washer": CANONICAL_DIR / "top_load_washer.json",
    "vented_dryer": CANONICAL_DIR / "vented_dryer.json",
    "dishwasher": CANONICAL_DIR / "dishwasher.json",
}

REQUIRED_MANIFEST_KEYS = {
    "manualId",
    "status",
    "generatedAt",
    "counts",
}

CANDIDATE_STATUSES = {
    "candidate",
    "validated",
    "approved",
    "rejected",
    "UNRESOLVED_TERM",
    "COMPOUND_TERM_CANDIDATE",
    "FILTERED_NOISE",
    "CONFLICT_REQUIRES_REVIEW",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_manual_candidates(manual_dir: Path, canonical_ids: set[str], test_target_ids: set[str]) -> list[str]:
    errors: list[str] = []
    manual_id = manual_dir.name

    manifest_path = manual_dir / "pipeline_manifest.json"
    if not manifest_path.is_file():
        errors.append(f"{manual_id}: missing pipeline_manifest.json")
        return errors

    manifest = load_json(manifest_path)
    for key in REQUIRED_MANIFEST_KEYS:
        if key not in manifest:
            errors.append(f"{manual_id}: pipeline_manifest missing '{key}'")
    if manifest.get("status") not in CANDIDATE_STATUSES:
        errors.append(f"{manual_id}: invalid pipeline status '{manifest.get('status')}'")

    procedures_path = manual_dir / "normalized_procedures.json"
    if procedures_path.is_file():
        procedures_file = load_json(procedures_path)
        for procedure in procedures_file.get("procedures", []):
            if not procedure.get("procedureId"):
                errors.append(f"{manual_id}: normalized procedure missing procedureId")
            if not procedure.get("provenance", {}).get("manualId"):
                errors.append(f"{manual_id}: procedure missing provenance.manualId")

    mapping_path = manual_dir / "canonical_mapping_candidates.json"
    if mapping_path.is_file():
        for candidate in load_json(mapping_path).get("candidates", []):
            if not candidate.get("provenance"):
                errors.append(f"{manual_id}: mapping candidate missing provenance")
            canonical_id = candidate.get("canonicalId")
            if canonical_id and canonical_ids and canonical_id not in canonical_ids:
                errors.append(
                    f"{manual_id}: mapping '{candidate.get('id')}' "
                    f"unknown canonicalId '{canonical_id}'",
                )

    overlay_path = manual_dir / "overlay_candidates.json"
    if overlay_path.is_file():
        for candidate in load_json(overlay_path).get("candidates", []):
            if not candidate.get("provenance"):
                errors.append(f"{manual_id}: overlay candidate missing provenance")
            target = candidate.get("canonicalTestTarget")
            if target and test_target_ids and target not in test_target_ids:
                if candidate.get("status") != "UNRESOLVED_TERM":
                    errors.append(
                        f"{manual_id}: overlay '{candidate.get('id')}' "
                        f"unknown test target '{target}'",
                    )

    conflicts_path = manual_dir / "conflicts.json"
    if conflicts_path.is_file():
        for conflict in load_json(conflicts_path).get("conflicts", []):
            if conflict.get("status") != "CONFLICT_REQUIRES_REVIEW":
                errors.append(
                    f"{manual_id}: conflict '{conflict.get('id')}' "
                    f"must stay CONFLICT_REQUIRES_REVIEW",
                )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual", help="Validate one manual candidate folder")
    args = parser.parse_args()

    if not CANDIDATES_DIR.is_dir():
        print(f"validate_normalization_candidates: no candidates dir at {CANDIDATES_DIR}")
        return 1

    manual_dirs = []
    if args.manual:
        manual_dirs = [CANDIDATES_DIR / args.manual]
    else:
        manual_dirs = [
            path for path in CANDIDATES_DIR.iterdir()
            if path.is_dir() and not path.name.startswith("_")
        ]

    errors: list[str] = []
    validated = 0
    for manual_dir in sorted(manual_dirs):
        if not manual_dir.is_dir():
            errors.append(f"Missing candidate folder: {manual_dir.name}")
            continue
        canonical_ids: set[str] = set()
        test_target_ids: set[str] = set()
        manifest_path = manual_dir / "pipeline_manifest.json"
        if manifest_path.is_file():
            manifest = load_json(manifest_path)
            ontology_id = manifest.get("ontologyId")
            ontology_path = CANONICAL_ONTOLOGY_FILES.get(str(ontology_id or ""))
            if ontology_path and ontology_path.is_file():
                ontology = load_json(ontology_path)
                canonical_ids = {c["id"] for c in ontology.get("components", []) if "id" in c}
                test_target_ids = {t["id"] for t in ontology.get("testTargets", []) if "id" in t}
        errors.extend(validate_manual_candidates(manual_dir, canonical_ids, test_target_ids))
        validated += 1

    if errors:
        print(f"validate_normalization_candidates: FAILED ({len(errors)} issues)")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"validate_normalization_candidates: OK — {validated} manual candidate folder(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
