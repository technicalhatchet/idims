#!/usr/bin/env python3
"""Apply classified term resolutions from a resolution manifest (CG-5.4)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANDIDATES_DIR
from normalization.review.ledger import load_ledger, update_candidate_status
from normalization.review.review_package import materialize_review_package


def load_resolution_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def apply_resolution_to_candidate(
    candidate: dict,
    resolution: dict,
) -> bool:
    canonical_id = resolution.get("canonicalId")
    if not canonical_id:
        return False
    candidate["canonicalId"] = canonical_id
    candidate["status"] = "candidate"
    candidate["confidence"] = max(float(candidate.get("confidence") or 0), 0.9)
    candidate["resolution"] = {
        "classification": resolution.get("classification"),
        "rationale": resolution.get("rationale"),
        "reviewer": "term-resolution",
    }
    return True


def apply_resolutions(manifest_path: Path, *, dry_run: bool = False) -> dict:
    manifest = load_resolution_manifest(manifest_path)
    manual_id = manifest["manualId"]
    mapping_path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
    if not mapping_path.is_file():
        raise FileNotFoundError(f"Mapping candidates not found: {mapping_path}")

    package = json.loads(mapping_path.read_text(encoding="utf-8"))
    candidates = package.get("candidates") or []
    by_id = {row.get("id"): row for row in candidates}

    applied: list[dict] = []
    missing: list[str] = []

    for resolution in manifest.get("resolutions") or []:
        candidate_id = resolution.get("candidateId")
        candidate = by_id.get(candidate_id)
        if not candidate:
            missing.append(str(candidate_id))
            continue

        if not dry_run:
            canonical_id = str(resolution.get("canonicalId") or "")
            apply_resolution_to_candidate(candidate, resolution)
            update_candidate_status(
                candidate_id,
                "approved",
                reviewer="term-resolution",
                reason=(
                    f"{resolution.get('classification')}: "
                    f"{resolution.get('oemTerm')} -> {canonical_id}"
                ),
                manual_id=manual_id,
                resolved_canonical_id=canonical_id,
                resolution_classification=str(resolution.get("classification") or ""),
            )
        applied.append(resolution)

    if not dry_run:
        mapping_path.write_text(json.dumps(package, indent=2), encoding="utf-8")
        materialize_review_package(manual_id, load_ledger())

    classifications: dict[str, int] = {}
    for item in applied:
        key = str(item.get("classification") or "unknown")
        classifications[key] = classifications.get(key, 0) + 1

    return {
        "manualId": manual_id,
        "applied": len(applied),
        "missing": missing,
        "classifications": classifications,
        "dryRun": dry_run,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        default=str(CALIBRATION_DIR / "w11169652_term_resolutions.json"),
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    result = apply_resolutions(Path(args.manifest), dry_run=args.dry_run)
    print(json.dumps(result, indent=2))
    if result.get("missing"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
