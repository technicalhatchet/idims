from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..matcher_improvement_rules import (
    BACKLOG_MATCH_SPECS,
    MatcherImprovementContext,
    active_approved_rules,
    approved_backlog_ids,
    load_matcher_improvement_review,
    try_matcher_improvement,
)
from ..canonical_matcher import build_mapping_candidates, load_canonical_component_ids
from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR
from ..normalize_procedure import load_procedure_seeds_for_manual
from ..paths import PROCEDURE_SEED_DIR
from ..pipeline import find_manual_entry, load_manifest
from .candidate_review_decisions import load_decisions
from .candidate_review_index import classify_review_class, index_path
from .matcher_improvement_decisions import load_matcher_improvement_decisions
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes
from .wave1_existing_canonical_mapping import load_review_index, select_wave_candidates as select_wave1
from .wave2_new_platform_knowledge import select_wave_candidates as select_wave2

VALIDATION_FILENAME = "CG_MATCHER_IMPROVEMENT_SCOPED_VALIDATION_v1.json"
VALIDATION_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_SCOPED_VALIDATION_AUDIT_v1.json"
IMPLEMENTATION_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_IMPLEMENTATION_AUDIT_v1.json"
REJECTED_BACKLOG_ID = "efmm-64d66fbb30c3"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def validation_path() -> Path:
    return CALIBRATION_DIR / VALIDATION_FILENAME


def validation_audit_path() -> Path:
    return CALIBRATION_DIR / VALIDATION_AUDIT_FILENAME


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_implementation_audit() -> dict[str, Any]:
    path = CALIBRATION_DIR / IMPLEMENTATION_AUDIT_FILENAME
    return json.loads(path.read_text(encoding="utf-8"))


def cohort_from_approved_rules() -> dict[str, Any]:
    review = load_matcher_improvement_review()
    items = {item["backlogId"]: item for item in (review.get("reviewItems") or [])}
    manual_ids: set[str] = set()
    procedure_families: set[str] = set()
    backlog_to_manuals: dict[str, list[str]] = {}
    for rule in active_approved_rules():
        bid = rule["backlogId"]
        manuals = list(rule["allowedManualIds"])
        backlog_to_manuals[bid] = manuals
        manual_ids.update(manuals)
        item = items.get(bid) or {}
        procedure_families.update(item.get("procedureFamilies") or [])
    return {
        "approvedBacklogIds": approved_backlog_ids(),
        "manualIds": sorted(manual_ids),
        "procedureFamilies": sorted(procedure_families),
        "backlogToManualIds": backlog_to_manuals,
    }


def _load_baseline_candidates(manual_id: str) -> list[dict[str, Any]]:
    path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
    if not path.is_file():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return list(payload.get("candidates") or [])


def _regenerate_candidates(manual_id: str) -> list[dict[str, Any]]:
    manifest = load_manifest()
    entry = find_manual_entry(manifest, manual_id)
    template_id = str(entry.get("templateId") or "washer")
    seed_dir = PROCEDURE_SEED_DIR / str(entry.get("seedDir"))
    procedures = load_procedure_seeds_for_manual(entry, seed_dir)
    candidates, _ = build_mapping_candidates(procedures, entry, template_id)
    return candidates


def _inheritance_context(manual_id: str) -> dict[str, Any]:
    procedures_path = CANDIDATES_DIR / manual_id / "normalized_procedures.json"
    if not procedures_path.is_file():
        return {"by_procedure": {}, "seed_source_manual_id": None}
    payload = json.loads(procedures_path.read_text(encoding="utf-8"))
    by_procedure: dict[str, Any] = {}
    for procedure in payload.get("procedures") or []:
        procedure_id = procedure.get("procedureId")
        if procedure_id:
            by_procedure[str(procedure_id)] = {}
    return {"by_procedure": by_procedure, "seed_source_manual_id": None}


def _candidate_metrics(candidates: list[dict[str, Any]], manual_id: str) -> dict[str, Any]:
    inheritance = _inheritance_context(manual_id)
    class_counts = Counter()
    unresolved = 0
    existing_canonical = 0
    matcher_improvements: list[dict[str, Any]] = []
    for candidate in candidates:
        review_class = classify_review_class(
            candidate,
            artifact_source="canonical_mapping",
            inheritance_context=inheritance,
        )
        class_counts[review_class] += 1
        if review_class == "unresolved":
            unresolved += 1
        if review_class == "existingCanonicalMapping":
            existing_canonical += 1
        if candidate.get("mappingType") == "matcher_improvement":
            matcher_improvements.append(candidate)
    return {
        "totalCandidates": len(candidates),
        "unresolvedCount": unresolved,
        "existingCanonicalMappingCount": existing_canonical,
        "countsByReviewClass": dict(class_counts),
        "matcherImprovementCount": len(matcher_improvements),
        "matcherImprovements": matcher_improvements,
    }


def _candidate_key(manual_id: str, candidate: dict[str, Any]) -> tuple[str, str, str, str]:
    provenance = candidate.get("provenance") or {}
    procedure_id = str(provenance.get("procedureId") or candidate.get("procedureId") or "")
    source = str(candidate.get("sourceTerm") or "")
    extracted = str(candidate.get("extractedTerm") or "")
    return (manual_id, procedure_id, source, extracted)


def _wave_regression_for_cohort(manual_ids: set[str]) -> dict[str, Any]:
    index = load_review_index()
    decisions = load_decisions().get("decisions") or {}
    violations: list[dict[str, Any]] = []
    checked = 0
    for wave_name, selector in (("wave1", select_wave1), ("wave2", select_wave2)):
        for record in selector(index):
            manual_id = str(record.get("manualId") or "")
            if manual_id not in manual_ids:
                continue
            candidate_id = str(record.get("candidateId") or "")
            decision = decisions.get(candidate_id) or {}
            if decision.get("reviewStatus") != "accepted":
                continue
            checked += 1
            baseline = _load_baseline_candidates(manual_id)
            regen = _regenerate_candidates(manual_id)
            what = record.get("what") or {}
            maps_to = record.get("mapsTo") or {}
            expected_canonical = maps_to.get("proposedCanonicalId")
            source_term = str(what.get("sourceTerm") or "")
            procedure_id = str(what.get("procedureId") or "")
            baseline_match = [
                c
                for c in baseline
                if str(c.get("sourceTerm") or "") == source_term
                and str((c.get("provenance") or {}).get("procedureId") or c.get("procedureId") or "")
                == procedure_id
            ]
            regen_match = [
                c
                for c in regen
                if str(c.get("sourceTerm") or "") == source_term
                and str((c.get("provenance") or {}).get("procedureId") or c.get("procedureId") or "")
                == procedure_id
            ]
            baseline_canonical = baseline_match[0].get("canonicalId") if baseline_match else None
            regen_canonical = regen_match[0].get("canonicalId") if regen_match else None
            if baseline_canonical != regen_canonical and regen_match:
                mapping_type = regen_match[0].get("mappingType")
                if mapping_type == "matcher_improvement":
                    continue
                violations.append(
                    {
                        "wave": wave_name,
                        "candidateId": candidate_id,
                        "manualId": manual_id,
                        "sourceTerm": source_term,
                        "procedureId": procedure_id,
                        "expectedCanonicalId": expected_canonical,
                        "baselineCanonicalId": baseline_canonical,
                        "regeneratedCanonicalId": regen_canonical,
                    },
                )
    return {"checkedAcceptedRecords": checked, "violations": violations, "passed": len(violations) == 0}


def _validate_matcher_improvements(
    improvements: list[dict[str, Any]],
    *,
    approved_ids: set[str],
    deferred_ids: set[str],
    rejected_ids: set[str],
    cohort: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    backlog_to_manuals = cohort["backlogToManualIds"]
    records: list[dict[str, Any]] = []
    for candidate in improvements:
        manual_id = str((candidate.get("provenance") or {}).get("manualId") or "")
        backlog_id = str((candidate.get("matcherImprovement") or {}).get("backlogId") or "")
        if candidate.get("mappingType") != "matcher_improvement":
            errors.append(f"{manual_id}: mappingType is not matcher_improvement")
        if not backlog_id:
            errors.append(f"{manual_id}: missing matcherImprovement.backlogId")
        if backlog_id in deferred_ids:
            errors.append(f"deferred backlog {backlog_id} produced matcher_improvement")
        if backlog_id in rejected_ids:
            errors.append(f"rejected backlog {backlog_id} produced matcher_improvement")
        if backlog_id not in approved_ids:
            errors.append(f"unapproved backlog {backlog_id} produced matcher_improvement")
        allowed_manuals = set(backlog_to_manuals.get(backlog_id) or [])
        if manual_id and manual_id not in allowed_manuals:
            errors.append(f"{backlog_id} mapping outside authorized manuals: {manual_id}")
        records.append(
            {
                "manualId": manual_id,
                "backlogId": backlog_id,
                "sourceTerm": candidate.get("sourceTerm"),
                "canonicalId": candidate.get("canonicalId"),
                "procedureId": (candidate.get("provenance") or {}).get("procedureId"),
                "matcherLayer": candidate.get("matcherLayer"),
            },
        )
    return {"errors": errors, "records": records, "count": len(records)}


def _procedure_family(procedure_id: str | None) -> str:
    if not procedure_id:
        return ""
    parts = str(procedure_id).split("-")
    if len(parts) >= 2:
        return "-".join(parts[:2])
    return str(procedure_id)


def _validate_review_terminology(
    improvements: list[dict[str, Any]],
    *,
    items_by_id: dict[str, dict[str, Any]],
) -> list[str]:
    errors: list[str] = []
    for candidate in improvements:
        backlog_id = str((candidate.get("matcherImprovement") or {}).get("backlogId") or "")
        spec = BACKLOG_MATCH_SPECS.get(backlog_id)
        item = items_by_id.get(backlog_id) or {}
        canonical_id = str(candidate.get("canonicalId") or "")
        if not spec:
            errors.append(f"missing BACKLOG_MATCH_SPECS for {backlog_id}")
            continue
        if canonical_id != spec["canonicalId"]:
            errors.append(f"{backlog_id} canonicalId {canonical_id} != spec {spec['canonicalId']}")
        frozen_target = str(item.get("frozenCanonicalId") or "")
        if frozen_target and canonical_id != frozen_target:
            errors.append(f"{backlog_id} canonicalId {canonical_id} != review frozen {frozen_target}")
        manual_id = str((candidate.get("provenance") or {}).get("manualId") or "")
        procedure_id = (candidate.get("provenance") or {}).get("procedureId")
        families = list(item.get("procedureFamilies") or [])
        if families:
            family = _procedure_family(str(procedure_id) if procedure_id else None)
            allowed = any(
                family == expected or str(procedure_id or "").startswith(f"{expected}-")
                for expected in families
            )
            if procedure_id and not allowed:
                errors.append(f"{backlog_id} procedure {procedure_id} outside families {families}")
        platform_id = (candidate.get("provenance") or {}).get("platformId")
        template_id = str((candidate.get("provenance") or {}).get("templateId") or "washer")
        ctx = MatcherImprovementContext(
            manual_id,
            str(procedure_id) if procedure_id else None,
            template_id,
            str(platform_id) if platform_id else None,
        )
        ids = load_canonical_component_ids(template_id, str(platform_id) if platform_id else None)
        source = str(candidate.get("sourceTerm") or "")
        raw = str(candidate.get("extractedTerm") or source)
        match = try_matcher_improvement(source, raw, context=ctx, canonical_ids=ids)
        if not match or match.backlog_id != backlog_id:
            errors.append(f"{backlog_id} terminology boundary failed for {manual_id}:{source}")
    return errors


def _production_integrity_snapshot() -> dict[str, Any]:
    index_file = index_path()
    decisions_file = REVIEW_DIR / "CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json"
    index = load_review_index()
    return {
        "reviewIndexPath": str(index_file),
        "reviewIndexHash": _sha256_file(index_file) if index_file.is_file() else None,
        "reviewDecisionCount": len((load_decisions().get("decisions") or {})),
        "decisionsFileHash": _sha256_file(decisions_file) if decisions_file.is_file() else None,
        "unresolvedIndexCount": int((index.get("countsByReviewClass") or {}).get("unresolved") or 0),
        "processingManifestHash": index.get("processingManifestHash"),
    }


def run_wave_regression_tests() -> dict[str, Any]:
    scripts_dir = Path(__file__).resolve().parents[2]
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/test_matcher_improvement_implementation.py",
        "-k",
        "not preflight",
        "tests/test_matcher_improvement_scoped_validation.py::test_cohort_derived_from_nine_approved_rules",
        "tests/test_wave2_closure_audit.py::test_wave2_closure_audit_reports_closed",
        "-q",
    ]
    proc = subprocess.run(cmd, cwd=scripts_dir, capture_output=True, text=True)
    return {
        "passed": proc.returncode == 0,
        "returnCode": proc.returncode,
        "stdout": proc.stdout[-2000:],
        "stderr": proc.stderr[-1000:],
    }


def run_scoped_validation() -> dict[str, Any]:
    errors: list[str] = []
    impl_audit = load_implementation_audit()
    if impl_audit.get("status") != "GREEN":
        errors.append("implementation audit is not GREEN")

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
    approved_ids = set(approved_backlog_ids())
    if len(approved_ids) != 9:
        errors.append(f"approved backlog count {len(approved_ids)} != 9")

    cohort = cohort_from_approved_rules()
    before_snapshot = _production_integrity_snapshot()

    per_manual: list[dict[str, Any]] = []
    baseline_totals = Counter()
    regen_totals = Counter()
    all_improvements: list[dict[str, Any]] = []

    for manual_id in cohort["manualIds"]:
        baseline_candidates = _load_baseline_candidates(manual_id)
        regen_candidates = _regenerate_candidates(manual_id)
        baseline_metrics = _candidate_metrics(baseline_candidates, manual_id)
        regen_metrics = _candidate_metrics(regen_candidates, manual_id)
        for key in ("totalCandidates", "unresolvedCount", "existingCanonicalMappingCount", "matcherImprovementCount"):
            baseline_totals[key] += baseline_metrics[key]
            regen_totals[key] += regen_metrics[key]
        all_improvements.extend(regen_metrics["matcherImprovements"])
        per_manual.append(
            {
                "manualId": manual_id,
                "baseline": {k: baseline_metrics[k] for k in baseline_metrics if k != "matcherImprovements"},
                "regenerated": {k: regen_metrics[k] for k in regen_metrics if k != "matcherImprovements"},
                "deltas": {
                    "totalCandidates": regen_metrics["totalCandidates"] - baseline_metrics["totalCandidates"],
                    "unresolvedCount": regen_metrics["unresolvedCount"] - baseline_metrics["unresolvedCount"],
                    "existingCanonicalMappingCount": (
                        regen_metrics["existingCanonicalMappingCount"]
                        - baseline_metrics["existingCanonicalMappingCount"]
                    ),
                    "matcherImprovementCount": regen_metrics["matcherImprovementCount"],
                },
            },
        )

    review_items = {
        str(item["backlogId"]): item for item in (load_matcher_improvement_review().get("reviewItems") or [])
    }
    improvement_validation = _validate_matcher_improvements(
        all_improvements,
        approved_ids=approved_ids,
        deferred_ids=deferred_ids,
        rejected_ids=rejected_ids,
        cohort=cohort,
    )
    errors.extend(improvement_validation["errors"])
    errors.extend(
        _validate_review_terminology(
            all_improvements,
            items_by_id=review_items,
        ),
    )

    backlog_ids_seen = {record["backlogId"] for record in improvement_validation["records"]}
    if backlog_ids_seen - approved_ids:
        errors.append(f"unrelated matcher backlogIds: {sorted(backlog_ids_seen - approved_ids)}")
    if REJECTED_BACKLOG_ID not in rejected_ids:
        errors.append(f"rejected backlog {REJECTED_BACKLOG_ID} missing from decision store")
    deferred_violations = [bid for bid in backlog_ids_seen if bid in deferred_ids]
    rejected_violations = [bid for bid in backlog_ids_seen if bid in rejected_ids]
    if deferred_violations:
        errors.append(f"deferred backlogIds produced mappings: {deferred_violations}")
    if rejected_violations:
        errors.append(f"rejected backlogIds produced mappings: {rejected_violations}")

    if baseline_totals["matcherImprovementCount"] != 0:
        errors.append("baseline on-disk cohort unexpectedly contains matcher_improvement mappings")

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 closure not intact")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 closure not intact")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave_regression = _wave_regression_for_cohort(set(cohort["manualIds"]))
    if not wave_regression["passed"]:
        errors.extend([f"wave regression violation: {v}" for v in wave_regression["violations"][:5]])

    pytest_regression = run_wave_regression_tests()

    wave1_regression = {
        "closureArtifactStatus": wave1.get("status"),
        "frozenHashVerification": hashes_ok,
        "cohortAcceptedIntegrity": wave_regression,
        "passed": wave1.get("status") == "WAVE1_CLOSED" and wave_regression["passed"] and hashes_ok,
    }
    wave2_regression = {
        "closureArtifactStatus": wave2.get("status"),
        "frozenHashVerification": hashes_ok,
        "cohortAcceptedIntegrity": wave_regression,
        "passed": wave2.get("status") == "WAVE2_CLOSED" and hashes_ok,
    }

    after_snapshot = _production_integrity_snapshot()
    if before_snapshot["reviewIndexHash"] != after_snapshot["reviewIndexHash"]:
        errors.append("production review index hash changed during scoped validation")
    if before_snapshot["decisionsFileHash"] != after_snapshot["decisionsFileHash"]:
        errors.append("production review decisions hash changed during scoped validation")
    if before_snapshot["unresolvedIndexCount"] != after_snapshot["unresolvedIndexCount"]:
        errors.append("production unresolved index count changed during scoped validation")

    status = (
        "GREEN"
        if not errors and pytest_regression["passed"] and wave1_regression["passed"] and wave2_regression["passed"]
        else ("HOLD" if errors else "STOP")
    )

    validation = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_scoped_validation",
        "status": status,
        "generatedAt": _utc_now(),
        "implementationCommit": "b1679708",
        "implementationAudit": IMPLEMENTATION_AUDIT_FILENAME,
        "cohort": cohort,
        "aggregate": {
            "baseline": dict(baseline_totals),
            "regenerated": dict(regen_totals),
            "deltas": {
                "totalCandidates": regen_totals["totalCandidates"] - baseline_totals["totalCandidates"],
                "unresolvedCount": regen_totals["unresolvedCount"] - baseline_totals["unresolvedCount"],
                "existingCanonicalMappingCount": (
                    regen_totals["existingCanonicalMappingCount"] - baseline_totals["existingCanonicalMappingCount"]
                ),
                "matcherImprovementCount": regen_totals["matcherImprovementCount"],
            },
        },
        "perManual": per_manual,
        "matcherImprovementMappings": improvement_validation["records"],
        "deferredBacklogIdsObservedInImplementation": sorted(deferred_ids),
        "rejectedBacklogIdsObservedInImplementation": sorted(rejected_ids),
        "governanceProof": {
            "deferredImplementationViolations": deferred_violations,
            "rejectedImplementationViolations": rejected_violations,
            "rejectedBacklogIdUntouched": REJECTED_BACKLOG_ID,
            "unrelatedMatcherBacklogIds": sorted(backlog_ids_seen - approved_ids),
            "approvedBacklogIdsWithMappings": sorted(backlog_ids_seen),
            "canonicalPromotionOccurred": False,
            "architectureExceptionBypassed": False,
        },
        "waveRegressionInCohort": wave_regression,
        "wave1Regression": wave1_regression,
        "wave2Regression": wave2_regression,
        "productionIntegrity": {
            "before": before_snapshot,
            "after": after_snapshot,
            "unchanged": before_snapshot == after_snapshot,
        },
        "frozenHashVerification": {"passed": hashes_ok, "errors": hash_errors},
        "waveClosure": {"wave1": wave1.get("status"), "wave2": wave2.get("status")},
        "testResults": {"scopedRegressionPytest": pytest_regression},
        "errors": errors,
        "mutationPolicy": {
            "readOnly": True,
            "productionCandidateRewrite": False,
            "productionReviewIndexRewrite": False,
            "matcherCodeChanged": False,
        },
    }

    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_scoped_validation_audit",
        "status": status,
        "generatedAt": validation["generatedAt"],
        "validationArtifact": VALIDATION_FILENAME,
        "integrityChecks": {
            "passed": len(errors) == 0,
            "errors": errors,
            "frozenHashesValid": hashes_ok,
            "productionArtifactsUnchanged": before_snapshot == after_snapshot,
        },
    }

    return {"validation": validation, "audit": audit}


def write_scoped_validation(payload: dict[str, Any]) -> tuple[Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = validation_path()
    audit_out = validation_audit_path()
    out.write_text(json.dumps(payload["validation"], indent=2), encoding="utf-8")
    audit_out.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    return out, audit_out
