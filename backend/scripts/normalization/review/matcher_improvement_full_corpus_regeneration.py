from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..matcher_improvement_rules import (
    BACKLOG_MATCH_SPECS,
    approved_backlog_ids,
    load_matcher_improvement_review,
)
from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, NORMALIZATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .candidate_review_index import classify_review_class, index_path
from .matcher_improvement_decisions import load_matcher_improvement_decisions
from .matcher_improvement_scoped_validation import (
    REJECTED_BACKLOG_ID,
    _load_baseline_candidates,
    _production_integrity_snapshot,
    _regenerate_candidates,
    _validate_matcher_improvements,
    _validate_review_terminology,
    cohort_from_approved_rules,
    load_implementation_audit,
)
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes
from .wave1_existing_canonical_mapping import load_review_index, select_wave_candidates as select_wave1
from .wave2_new_platform_knowledge import select_wave_candidates as select_wave2

REGENERATION_FILENAME = "CG_MATCHER_IMPROVEMENT_FULL_CORPUS_REGENERATION_v1.json"
REGENERATION_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_FULL_CORPUS_REGENERATION_AUDIT_v1.json"
STAGED_CORPUS_DIRNAME = "matcher_improvement_full_corpus_v1"
COPY_ALONGSIDE = (
    "normalized_procedures.json",
    "overlay_candidates.json",
    "pipeline_manifest.json",
    "conflicts.json",
    "architecture_exception.json",
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def staging_root() -> Path:
    return NORMALIZATION_DIR / "candidates_staging" / STAGED_CORPUS_DIRNAME


def regeneration_path() -> Path:
    return CALIBRATION_DIR / REGENERATION_FILENAME


def regeneration_audit_path() -> Path:
    return CALIBRATION_DIR / REGENERATION_AUDIT_FILENAME


def production_manual_ids() -> list[str]:
    return sorted(
        path.name
        for path in CANDIDATES_DIR.iterdir()
        if path.is_dir() and not path.name.startswith("_")
    )


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _inheritance_context_for_dir(manual_dir: Path) -> dict[str, Any]:
    procedures_path = manual_dir / "normalized_procedures.json"
    if not procedures_path.is_file():
        return {"by_procedure": {}, "seed_source_manual_id": None}
    payload = _read_json(procedures_path)
    by_procedure: dict[str, Any] = {}
    for procedure in payload.get("procedures") or []:
        procedure_id = procedure.get("procedureId")
        if procedure_id:
            by_procedure[str(procedure_id)] = {}
    return {"by_procedure": by_procedure, "seed_source_manual_id": None}


def _mapping_candidates_from_dir(manual_id: str, root: Path) -> list[dict[str, Any]]:
    path = root / manual_id / "canonical_mapping_candidates.json"
    if not path.is_file():
        return []
    return list(_read_json(path).get("candidates") or [])


def _overlay_candidates_from_dir(manual_id: str, root: Path) -> list[dict[str, Any]]:
    path = root / manual_id / "overlay_candidates.json"
    if not path.is_file():
        return []
    return list(_read_json(path).get("candidates") or [])


def _architecture_exception_from_dir(manual_id: str, root: Path) -> dict[str, Any] | None:
    path = root / manual_id / "architecture_exception.json"
    if not path.is_file():
        return None
    return _read_json(path)


def _candidate_identity(
    manual_id: str,
    artifact_source: str,
    candidate: dict[str, Any],
) -> tuple[str, str, str, str]:
    provenance = candidate.get("provenance") or {}
    procedure_id = str(provenance.get("procedureId") or candidate.get("procedureId") or "")
    if artifact_source == "architecture_exception":
        return (manual_id, artifact_source, str(candidate.get("id") or "architecture_exception"), "")
    source = str(candidate.get("sourceTerm") or candidate.get("displayTitle") or candidate.get("id") or "")
    extracted = str(candidate.get("extractedTerm") or "")
    return (manual_id, procedure_id, source, extracted)


def _proposed_target(candidate: dict[str, Any]) -> str | None:
    return (
        candidate.get("canonicalId")
        or candidate.get("canonicalTestTarget")
        or candidate.get("measurementKnowledgeId")
    )


def _classify_candidate(
    manual_id: str,
    root: Path,
    artifact_source: str,
    candidate: dict[str, Any],
) -> str:
    manual_dir = root / manual_id
    inheritance = _inheritance_context_for_dir(manual_dir)
    return classify_review_class(
        candidate,
        artifact_source=artifact_source,
        inheritance_context=inheritance,
    )


def aggregate_corpus_metrics(root: Path, manual_ids: list[str]) -> dict[str, Any]:
    class_counts: Counter[str] = Counter()
    matcher_improvements: list[dict[str, Any]] = []
    matcher_by_backlog: Counter[str] = Counter()
    per_manual: dict[str, dict[str, Any]] = {}
    mapping_total = 0

    for manual_id in manual_ids:
        manual_counts: Counter[str] = Counter()
        manual_dir = root / manual_id
        if not manual_dir.is_dir():
            continue
        for candidate in _mapping_candidates_from_dir(manual_id, root):
            mapping_total += 1
            review_class = _classify_candidate(manual_id, root, "canonical_mapping", candidate)
            manual_counts[review_class] += 1
            class_counts[review_class] += 1
            if candidate.get("mappingType") == "matcher_improvement":
                matcher_improvements.append(candidate)
                backlog_id = str((candidate.get("matcherImprovement") or {}).get("backlogId") or "")
                if backlog_id:
                    matcher_by_backlog[backlog_id] += 1
        for candidate in _overlay_candidates_from_dir(manual_id, root):
            review_class = _classify_candidate(manual_id, root, "overlay", candidate)
            manual_counts[review_class] += 1
            class_counts[review_class] += 1
        arch = _architecture_exception_from_dir(manual_id, root)
        if arch:
            manual_counts["architectureException"] += 1
            class_counts["architectureException"] += 1

        per_manual[manual_id] = {
            "totalClassifiedRecords": sum(manual_counts.values()),
            "countsByReviewClass": dict(manual_counts),
            "mappingCandidateCount": len(_mapping_candidates_from_dir(manual_id, root)),
            "matcherImprovementCount": sum(
                1
                for c in _mapping_candidates_from_dir(manual_id, root)
                if c.get("mappingType") == "matcher_improvement"
            ),
        }

    return {
        "manualCount": len([mid for mid in manual_ids if (root / mid).is_dir()]),
        "mappingCandidateCount": mapping_total,
        "countsByReviewClass": dict(class_counts),
        "matcherImprovementCount": len(matcher_improvements),
        "matcherImprovementByBacklogId": dict(matcher_by_backlog),
        "perManual": per_manual,
        "matcherImprovements": matcher_improvements,
    }


def _index_candidate_snapshots(root: Path, manual_ids: list[str]) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    snapshots: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for manual_id in manual_ids:
        for candidate in _mapping_candidates_from_dir(manual_id, root):
            key = _candidate_identity(manual_id, "canonical_mapping", candidate)
            snapshots[key] = {
                "reviewClass": _classify_candidate(manual_id, root, "canonical_mapping", candidate),
                "proposedCanonicalId": _proposed_target(candidate),
                "mappingType": candidate.get("mappingType"),
                "backlogId": (candidate.get("matcherImprovement") or {}).get("backlogId"),
            }
    return snapshots


def compare_corpora(
    baseline_root: Path,
    staged_root: Path,
    manual_ids: list[str],
) -> dict[str, Any]:
    baseline_snap = _index_candidate_snapshots(baseline_root, manual_ids)
    staged_snap = _index_candidate_snapshots(staged_root, manual_ids)

    classification_changed: list[dict[str, Any]] = []
    proposed_changed: list[dict[str, Any]] = []
    removed_from_unresolved: list[dict[str, Any]] = []
    added_to_unresolved: list[dict[str, Any]] = []
    keys = set(baseline_snap) | set(staged_snap)

    for key in sorted(keys):
        base = baseline_snap.get(key)
        staged = staged_snap.get(key)
        manual_id, procedure_id, source, _extracted = key
        if base and staged:
            if base["reviewClass"] != staged["reviewClass"]:
                classification_changed.append(
                    {
                        "manualId": manual_id,
                        "procedureId": procedure_id,
                        "sourceTerm": source,
                        "baselineReviewClass": base["reviewClass"],
                        "stagedReviewClass": staged["reviewClass"],
                    },
                )
            if base["proposedCanonicalId"] != staged["proposedCanonicalId"]:
                proposed_changed.append(
                    {
                        "manualId": manual_id,
                        "procedureId": procedure_id,
                        "sourceTerm": source,
                        "baselineProposed": base["proposedCanonicalId"],
                        "stagedProposed": staged["proposedCanonicalId"],
                        "baselineMappingType": base.get("mappingType"),
                        "stagedMappingType": staged.get("mappingType"),
                        "stagedBacklogId": staged.get("backlogId"),
                    },
                )
            if base["reviewClass"] == "unresolved" and staged["reviewClass"] != "unresolved":
                removed_from_unresolved.append(
                    {
                        "manualId": manual_id,
                        "procedureId": procedure_id,
                        "sourceTerm": source,
                        "stagedReviewClass": staged["reviewClass"],
                        "stagedProposed": staged["proposedCanonicalId"],
                        "stagedBacklogId": staged.get("backlogId"),
                    },
                )
            if base["reviewClass"] != "unresolved" and staged["reviewClass"] == "unresolved":
                added_to_unresolved.append(
                    {
                        "manualId": manual_id,
                        "procedureId": procedure_id,
                        "sourceTerm": source,
                        "baselineReviewClass": base["reviewClass"],
                        "baselineProposed": base["proposedCanonicalId"],
                    },
                )
        elif base and not staged:
            if base["reviewClass"] == "unresolved":
                removed_from_unresolved.append(
                    {
                        "manualId": manual_id,
                        "procedureId": procedure_id,
                        "sourceTerm": source,
                        "note": "mapping_key_removed_in_staged",
                    },
                )
        elif staged and not base:
            if staged["reviewClass"] == "unresolved":
                added_to_unresolved.append(
                    {
                        "manualId": manual_id,
                        "procedureId": procedure_id,
                        "sourceTerm": source,
                        "note": "mapping_key_added_in_staged",
                    },
                )

    return {
        "classificationChangedCount": len(classification_changed),
        "proposedCanonicalIdChangedCount": len(proposed_changed),
        "removedFromUnresolvedCount": len(removed_from_unresolved),
        "addedToUnresolvedCount": len(added_to_unresolved),
        "classificationChangedSample": classification_changed[:50],
        "proposedCanonicalIdChangedSample": proposed_changed[:50],
        "removedFromUnresolvedSample": removed_from_unresolved[:50],
        "addedToUnresolvedSample": added_to_unresolved[:50],
    }


def _procedure_family(procedure_id: str | None) -> str:
    if not procedure_id:
        return ""
    parts = str(procedure_id).split("-")
    if len(parts) >= 2:
        return "-".join(parts[:2])
    return str(procedure_id)


def _backlog_impact(
    staged_metrics: dict[str, Any],
    cohort: dict[str, Any],
    review_items: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    improvements = staged_metrics.get("matcherImprovements") or []
    by_backlog: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for candidate in improvements:
        backlog_id = str((candidate.get("matcherImprovement") or {}).get("backlogId") or "")
        if backlog_id:
            by_backlog[backlog_id].append(candidate)

    impacts: list[dict[str, Any]] = []
    for backlog_id in sorted(approved_backlog_ids()):
        item = review_items.get(backlog_id) or {}
        records = by_backlog.get(backlog_id) or []
        families = sorted(
            {
                _procedure_family(str((c.get("provenance") or {}).get("procedureId")))
                for c in records
                if (c.get("provenance") or {}).get("procedureId")
            },
        )
        impacts.append(
            {
                "backlogId": backlog_id,
                "canonicalTarget": BACKLOG_MATCH_SPECS.get(backlog_id, {}).get("canonicalId"),
                "authorizedManualIds": cohort.get("backlogToManualIds", {}).get(backlog_id) or [],
                "procedureFamiliesAffected": families,
                "manualsWithMappings": sorted(
                    {str((c.get("provenance") or {}).get("manualId") or "") for c in records if c},
                ),
                "newMatcherImprovementMappings": len(records),
            },
        )
    return impacts


def _out_of_scope_matcher_mappings(
    improvements: list[dict[str, Any]],
    cohort: dict[str, Any],
    review_items: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    violations: list[dict[str, Any]] = []
    backlog_to_manuals = cohort.get("backlogToManualIds") or {}
    for candidate in improvements:
        backlog_id = str((candidate.get("matcherImprovement") or {}).get("backlogId") or "")
        manual_id = str((candidate.get("provenance") or {}).get("manualId") or "")
        procedure_id = str((candidate.get("provenance") or {}).get("procedureId") or "")
        allowed_manuals = set(backlog_to_manuals.get(backlog_id) or [])
        if manual_id not in allowed_manuals:
            violations.append(
                {
                    "reason": "manual_out_of_scope",
                    "backlogId": backlog_id,
                    "manualId": manual_id,
                    "procedureId": procedure_id,
                    "sourceTerm": candidate.get("sourceTerm"),
                },
            )
            continue
        item = review_items.get(backlog_id) or {}
        families = list(item.get("procedureFamilies") or [])
        if families and procedure_id:
            family = _procedure_family(procedure_id)
            allowed = any(
                family == expected or procedure_id.startswith(f"{expected}-")
                for expected in families
            )
            if not allowed:
                violations.append(
                    {
                        "reason": "procedure_family_out_of_scope",
                        "backlogId": backlog_id,
                        "manualId": manual_id,
                        "procedureId": procedure_id,
                        "sourceTerm": candidate.get("sourceTerm"),
                    },
                )
    return violations


def _wave_accepted_integrity(
    *,
    staged_root: Path,
    manual_ids: set[str],
) -> dict[str, Any]:
    index = load_review_index()
    decisions = load_decisions().get("decisions") or {}
    violations: list[dict[str, Any]] = []
    checked = {"wave1": 0, "wave2": 0}

    for wave_name, selector in (("wave1", select_wave1), ("wave2", select_wave2)):
        for record in selector(index):
            candidate_id = str(record.get("candidateId") or "")
            decision = decisions.get(candidate_id) or {}
            if decision.get("reviewStatus") != "accepted":
                continue
            manual_id = str(record.get("manualId") or "")
            if manual_id not in manual_ids:
                continue
            checked[wave_name] += 1
            what = record.get("what") or {}
            maps_to = record.get("mapsTo") or {}
            expected_target = maps_to.get("proposedCanonicalId")
            expected_class = record.get("reviewClass")
            source_term = str(what.get("sourceTerm") or "")
            procedure_id = str(what.get("procedureId") or "")
            staged_candidates = _mapping_candidates_from_dir(manual_id, staged_root)
            if record.get("artifactSource") == "overlay":
                staged_candidates = _overlay_candidates_from_dir(manual_id, staged_root)
            elif record.get("artifactSource") == "architecture_exception":
                arch = _architecture_exception_from_dir(manual_id, staged_root)
                staged_candidates = [arch] if arch else []

            match = [
                c
                for c in staged_candidates
                if str(c.get("sourceTerm") or c.get("displayTitle") or c.get("id") or "") == source_term
                and str((c.get("provenance") or {}).get("procedureId") or c.get("procedureId") or "")
                == procedure_id
            ]
            if not match:
                violations.append(
                    {
                        "wave": wave_name,
                        "candidateId": candidate_id,
                        "manualId": manual_id,
                        "reason": "accepted_record_missing_in_staged_corpus",
                        "sourceTerm": source_term,
                        "procedureId": procedure_id,
                    },
                )
                continue
            staged_candidate = match[0]
            staged_class = _classify_candidate(
                manual_id,
                staged_root,
                str(record.get("artifactSource") or "canonical_mapping"),
                staged_candidate,
            )
            staged_target = _proposed_target(staged_candidate)
            if staged_target != expected_target:
                violations.append(
                    {
                        "wave": wave_name,
                        "candidateId": candidate_id,
                        "manualId": manual_id,
                        "reason": "accepted_target_drift",
                        "sourceTerm": source_term,
                        "procedureId": procedure_id,
                        "expectedTarget": expected_target,
                        "stagedTarget": staged_target,
                        "stagedMappingType": staged_candidate.get("mappingType"),
                    },
                )
            if staged_class != expected_class:
                violations.append(
                    {
                        "wave": wave_name,
                        "candidateId": candidate_id,
                        "manualId": manual_id,
                        "reason": "accepted_classification_drift",
                        "expectedReviewClass": expected_class,
                        "stagedReviewClass": staged_class,
                        "sourceTerm": source_term,
                        "procedureId": procedure_id,
                    },
                )

    return {
        "wave1AcceptedChecked": checked["wave1"],
        "wave2AcceptedChecked": checked["wave2"],
        "violations": violations,
        "passed": len(violations) == 0,
    }


def _hash_production_mapping_corpus() -> str:
    digest = hashlib.sha256()
    for manual_id in production_manual_ids():
        path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
        if path.is_file():
            digest.update(manual_id.encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()


def write_staged_corpus(manual_ids: list[str], dest: Path) -> dict[str, Any]:
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    written: list[str] = []
    errors: list[str] = []
    for manual_id in manual_ids:
        prod_dir = CANDIDATES_DIR / manual_id
        staged_dir = dest / manual_id
        if not prod_dir.is_dir():
            errors.append(f"missing production manual dir: {manual_id}")
            continue
        staged_dir.mkdir(parents=True, exist_ok=True)
        try:
            mapping_candidates = _regenerate_candidates(manual_id)
        except Exception as exc:  # noqa: BLE001 — gate must capture per-manual failure
            errors.append(f"{manual_id}: regeneration failed: {exc}")
            continue
        staged_dir.joinpath("canonical_mapping_candidates.json").write_text(
            json.dumps({"manualId": manual_id, "candidates": mapping_candidates}, indent=2),
            encoding="utf-8",
        )
        for filename in COPY_ALONGSIDE:
            src = prod_dir / filename
            if src.is_file():
                shutil.copy2(src, staged_dir / filename)
        written.append(manual_id)

    return {"writtenManualCount": len(written), "writtenManualIds": written, "errors": errors}


def run_regression_tests() -> dict[str, Any]:
    scripts_dir = Path(__file__).resolve().parents[2]
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/test_matcher_improvement_full_corpus_regeneration.py",
        "-k",
        "not slow_full_gate",
        "-q",
    ]
    proc = subprocess.run(cmd, cwd=scripts_dir, capture_output=True, text=True)
    return {
        "passed": proc.returncode == 0,
        "returnCode": proc.returncode,
        "stdout": proc.stdout[-2500:],
        "stderr": proc.stderr[-1000:],
    }


def run_full_corpus_regeneration_gate(*, write_staging: bool = True) -> dict[str, Any]:
    errors: list[str] = []
    impl = load_implementation_audit()
    if impl.get("status") != "GREEN":
        errors.append("implementation audit is not GREEN")

    manual_ids = production_manual_ids()
    if len(manual_ids) != 72:
        errors.append(f"expected 72 manuals, found {len(manual_ids)}")

    cohort = cohort_from_approved_rules()
    approved_ids = set(approved_backlog_ids())
    if len(approved_ids) != 9:
        errors.append(f"approved backlog count {len(approved_ids)} != 9")

    decisions = load_matcher_improvement_decisions()
    deferred_ids = {
        bid
        for bid, entry in (decisions.get("decisions") or {}).items()
        if entry.get("reviewStatus") == "defer"
    }
    rejected_ids = {
        bid
        for bid, entry in (decisions.get("decisions") or {}).items()
        if entry.get("reviewStatus") == "reject"
    }
    if REJECTED_BACKLOG_ID not in rejected_ids:
        errors.append(f"rejected backlog {REJECTED_BACKLOG_ID} missing from decision store")

    prod_hash_before = _hash_production_mapping_corpus()
    production_snapshot_before = _production_integrity_snapshot()

    staged = staging_root()
    staging_result: dict[str, Any] = {"skipped": True}
    if write_staging:
        staging_result = write_staged_corpus(manual_ids, staged)
        errors.extend(staging_result.get("errors") or [])
        if staging_result.get("writtenManualCount") != 72:
            errors.append(
                f"staged manual count {staging_result.get('writtenManualCount')} != 72",
            )

    baseline_metrics = aggregate_corpus_metrics(CANDIDATES_DIR, manual_ids)
    staged_metrics = aggregate_corpus_metrics(staged, manual_ids) if write_staging else {}

    if baseline_metrics.get("matcherImprovementCount", 0) != 0:
        errors.append("baseline production corpus unexpectedly contains matcher_improvement mappings")

    comparison = compare_corpora(CANDIDATES_DIR, staged, manual_ids) if write_staging else {}

    review_items = {
        str(item["backlogId"]): item for item in (load_matcher_improvement_review().get("reviewItems") or [])
    }
    backlog_impact = _backlog_impact(staged_metrics, cohort, review_items) if write_staging else []
    scope_violations = (
        _out_of_scope_matcher_mappings(
            staged_metrics.get("matcherImprovements") or [],
            cohort,
            review_items,
        )
        if write_staging
        else []
    )
    if scope_violations:
        errors.append(f"matcher mappings outside authorized scope: {len(scope_violations)}")

    improvement_validation = (
        _validate_matcher_improvements(
            staged_metrics.get("matcherImprovements") or [],
            approved_ids=approved_ids,
            deferred_ids=deferred_ids,
            rejected_ids=rejected_ids,
            cohort=cohort,
        )
        if write_staging
        else {"errors": [], "records": [], "count": 0}
    )
    errors.extend(improvement_validation.get("errors") or [])
    errors.extend(
        _validate_review_terminology(
            staged_metrics.get("matcherImprovements") or [],
            items_by_id=review_items,
        )
        if write_staging
        else [],
    )

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 closure artifact not WAVE1_CLOSED")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 closure artifact not WAVE2_CLOSED")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave_integrity = _wave_accepted_integrity(staged_root=staged, manual_ids=set(manual_ids)) if write_staging else {}
    if write_staging and not wave_integrity.get("passed"):
        errors.extend(
            [f"wave integrity: {v.get('reason')}" for v in (wave_integrity.get("violations") or [])[:10]],
        )

    baseline_arch = int((baseline_metrics.get("countsByReviewClass") or {}).get("architectureException") or 0)
    staged_arch = int((staged_metrics.get("countsByReviewClass") or {}).get("architectureException") or 0)
    if staged_arch > baseline_arch:
        errors.append(f"architectureException increased {baseline_arch} -> {staged_arch}")

    prod_hash_after = _hash_production_mapping_corpus()
    production_snapshot_after = _production_integrity_snapshot()
    if prod_hash_before != prod_hash_after:
        errors.append("production canonical_mapping_candidates corpus was mutated")
    if production_snapshot_before != production_snapshot_after:
        errors.append("production review index or decisions changed during gate")

    pytest_result = run_regression_tests()

    def _delta(key: str) -> int:
        base = int((baseline_metrics.get("countsByReviewClass") or {}).get(key) or 0)
        staged_val = int((staged_metrics.get("countsByReviewClass") or {}).get(key) or 0)
        return staged_val - base

    status = (
        "GREEN"
        if not errors and pytest_result["passed"] and write_staging
        else ("HOLD" if errors else "STOP")
    )

    regeneration = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_full_corpus_regeneration",
        "status": status,
        "generatedAt": _utc_now(),
        "gateType": "controlled_corpus_regeneration_impact_analysis",
        "promotionGate": False,
        "implementationCommit": "b1679708",
        "scopedValidationArtifact": "CG_MATCHER_IMPROVEMENT_SCOPED_VALIDATION_v1.json",
        "stagedCorpusPath": str(staged),
        "productionCandidatesUntouched": prod_hash_before == prod_hash_after,
        "productionMappingCorpusHash": prod_hash_before,
        "cohort": {
            "totalManuals": len(manual_ids),
            "manualIds": manual_ids,
            "approvedBacklogIds": sorted(approved_ids),
        },
        "baseline": {
            "root": str(CANDIDATES_DIR),
            "aggregate": {
                "totalManuals": baseline_metrics.get("manualCount"),
                "totalMappingCandidates": baseline_metrics.get("mappingCandidateCount"),
                "countsByReviewClass": baseline_metrics.get("countsByReviewClass"),
                "matcherImprovementCount": baseline_metrics.get("matcherImprovementCount"),
            },
            "perManual": baseline_metrics.get("perManual"),
        },
        "regenerated": {
            "root": str(staged),
            "aggregate": {
                "totalManuals": staged_metrics.get("manualCount"),
                "totalMappingCandidates": staged_metrics.get("mappingCandidateCount"),
                "countsByReviewClass": staged_metrics.get("countsByReviewClass"),
                "matcherImprovementCount": staged_metrics.get("matcherImprovementCount"),
                "matcherImprovementByBacklogId": staged_metrics.get("matcherImprovementByBacklogId"),
            },
            "perManual": staged_metrics.get("perManual"),
        },
        "deltas": {
            "unresolved": _delta("unresolved"),
            "existingCanonicalMapping": _delta("existingCanonicalMapping"),
            "implementationSpecific": _delta("implementationSpecific"),
            "newPlatformKnowledge": _delta("newPlatformKnowledge"),
            "newCanonicalKnowledge": _delta("newCanonicalKnowledge"),
            "architectureException": _delta("architectureException"),
            "inheritedKnowledge": _delta("inheritedKnowledge"),
            "matcherImprovementCount": (
                int(staged_metrics.get("matcherImprovementCount") or 0)
                - int(baseline_metrics.get("matcherImprovementCount") or 0)
            ),
            "totalMappingCandidates": int(staged_metrics.get("mappingCandidateCount") or 0)
            - int(baseline_metrics.get("mappingCandidateCount") or 0),
        },
        "comparison": comparison,
        "backlogImpact": backlog_impact,
        "matcherGovernance": {
            "improvementValidationErrors": improvement_validation.get("errors"),
            "scopeViolations": scope_violations,
            "deferredBacklogIds": sorted(deferred_ids),
            "rejectedBacklogIds": sorted(rejected_ids),
        },
        "humanReviewIntegrity": wave_integrity,
        "productionIntegrity": {
            "before": production_snapshot_before,
            "after": production_snapshot_after,
            "unchanged": production_snapshot_before == production_snapshot_after,
            "reviewIndexFile": str(index_path()),
            "decisionsFile": str(REVIEW_DIR / "CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json"),
        },
        "waveClosureArtifacts": {"wave1": wave1.get("status"), "wave2": wave2.get("status")},
        "frozenHashVerification": {"passed": hashes_ok, "errors": hash_errors},
        "stagingWrite": staging_result,
        "testResults": {"regressionPytest": pytest_result},
        "errors": errors,
        "nextStep": (
            "human_review_of_changed_records_then_promotion_decision_gate"
            if status == "GREEN"
            else "resolve_gate_errors_before_review_or_promotion"
        ),
    }

    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_full_corpus_regeneration_audit",
        "status": status,
        "generatedAt": regeneration["generatedAt"],
        "regenerationArtifact": REGENERATION_FILENAME,
        "integrityChecks": {
            "passed": len(errors) == 0,
            "errors": errors,
            "frozenHashesValid": hashes_ok,
            "productionCandidatesUntouched": prod_hash_before == prod_hash_after,
            "productionReviewUnchanged": production_snapshot_before == production_snapshot_after,
            "waveAcceptedIntegrity": wave_integrity.get("passed"),
        },
    }

    return {"regeneration": regeneration, "audit": audit}


def write_full_corpus_regeneration(payload: dict[str, Any]) -> tuple[Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = regeneration_path()
    audit_out = regeneration_audit_path()
    out.write_text(json.dumps(payload["regeneration"], indent=2), encoding="utf-8")
    audit_out.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    return out, audit_out
