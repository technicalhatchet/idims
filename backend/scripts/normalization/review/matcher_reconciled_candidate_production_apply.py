from __future__ import annotations

import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, CANDIDATES_DIR
from .candidate_review_decisions import decisions_path as production_decisions_path
from .candidate_review_index import classify_review_class
from .matcher_reconciled_candidate_review import (
    EXPECTED_SCOPE,
    WAVE_ID,
    build_scope_records,
    closure_path,
    review_path,
)
from .matcher_reconciled_candidate_review_decisions import (
    GATE_ID as REVIEW_GATE_ID,
    load_matcher_reconciled_decisions,
)
from .candidate_review_index_refresh import _candidate_artifact_hashes, _sha256_file
from .matcher_improvement_production_reconciliation import (
    _hash_candidate,
    _index_candidates,
    _load_mapping_candidates,
    build_production_baseline_snapshot,
)
from .wave1_closure_audit import validate_frozen_hashes

GATE_ID = "matcher-reconciled-candidate-production-apply-v1"
STAMP_FIELD = "matcherReconciledProductionApply"
EXPECTED_ACCEPTED = 52

APPLY_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_v1.json"
APPLY_AUDIT_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_AUDIT_v1.json"
LOCK_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_LOCK_v1.json"

NORMALIZATION_DIR = Path(__file__).resolve().parents[1]
MATCHER_FILES = (
    NORMALIZATION_DIR / "matcher_improvement_rules.py",
    NORMALIZATION_DIR / "canonical_matcher.py",
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def apply_path() -> Path:
    return CALIBRATION_DIR / APPLY_FILENAME


def apply_audit_path() -> Path:
    return CALIBRATION_DIR / APPLY_AUDIT_FILENAME


def lock_path() -> Path:
    return CALIBRATION_DIR / LOCK_FILENAME


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _raw_candidate_id(candidate_id: str) -> str:
    parts = candidate_id.split("::", 2)
    return parts[2] if len(parts) >= 3 else candidate_id


def _matcher_file_hashes() -> dict[str, str]:
    return {str(path): _sha256_file(path) for path in MATCHER_FILES if path.is_file()}


def _build_stamp(decision: dict[str, Any]) -> dict[str, Any]:
    return {
        "waveId": WAVE_ID,
        "reviewGateId": REVIEW_GATE_ID,
        "applyGateId": GATE_ID,
        "decision": "accepted",
        "reviewDecisionId": decision.get("decisionId") or decision.get("candidateId"),
        "reviewer": decision.get("reviewer"),
        "reviewedAt": decision.get("timestamp") or decision.get("updatedAt"),
        "canonicalPromotionImplied": False,
    }


def _stamp_matches(existing: dict[str, Any] | None, expected: dict[str, Any]) -> bool:
    if not existing:
        return False
    for key in ("waveId", "reviewGateId", "applyGateId", "decision", "reviewDecisionId", "reviewer", "reviewedAt"):
        if str(existing.get(key) or "") != str(expected.get(key) or ""):
            return False
    return True


def _load_closure() -> dict[str, Any]:
    return _read_json(closure_path())


def _authorized_accepted_decisions() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    closure = _load_closure()
    store = load_matcher_reconciled_decisions()
    decisions_map = store.get("decisions") or {}
    accepted = [d for d in decisions_map.values() if str(d.get("decision") or "") == "accepted"]
    return accepted, closure


def _validate_closure(closure: dict[str, Any], errors: list[str]) -> None:
    if closure.get("status") != "GREEN":
        errors.append(f"closure status {closure.get('status')} != GREEN")
    if int(closure.get("expectedCount") or 0) != EXPECTED_ACCEPTED:
        errors.append("closure expectedCount != 52")
    if int(closure.get("reviewedCount") or 0) != EXPECTED_ACCEPTED:
        errors.append("closure reviewedCount != 52")
    if int(closure.get("acceptedCount") or 0) != EXPECTED_ACCEPTED:
        errors.append("closure acceptedCount != 52")
    if int(closure.get("deferredCount") or 0) != 0:
        errors.append("closure deferredCount != 0")
    if int(closure.get("rejectedCount") or 0) != 0:
        errors.append("closure rejectedCount != 0")
    if closure.get("missingDecisionCandidateIds"):
        errors.append("closure has missing decisions")
    if int(closure.get("duplicateDecisionCount") or 0) != 0:
        errors.append("closure duplicate decisions")
    if closure.get("outOfScopeDecisionCandidateIds"):
        errors.append("closure out-of-scope decisions")
    if closure.get("canonicalPromotionImplied"):
        errors.append("closure canonicalPromotionImplied is true")
    if int(closure.get("historicalDecisionMutations") or 0) != 0:
        errors.append("closure historicalDecisionMutations != 0")
    if int(closure.get("canonicalMutations") or 0) != 0:
        errors.append("closure canonicalMutations != 0")
    if int(closure.get("matcherMutations") or 0) != 0:
        errors.append("closure matcherMutations != 0")
    if int(closure.get("productionCandidateMutations") or 0) != 0:
        errors.append("closure productionCandidateMutations != 0")
    if closure.get("errors"):
        errors.extend([f"closure error: {e}" for e in closure["errors"]])


def _build_preflight_records(
    accepted_decisions: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    errors: list[str] = []
    scope_ids = {r["candidateId"] for r in build_scope_records()}
    records: list[dict[str, Any]] = []

    decision_ids = sorted(str(d.get("decisionId") or d.get("candidateId") or "") for d in accepted_decisions)
    if len(decision_ids) != EXPECTED_ACCEPTED:
        errors.append(f"accepted decision count {len(decision_ids)} != 52")
    if len(decision_ids) != len(set(decision_ids)):
        errors.append("duplicate accepted decision IDs")

    if set(decision_ids) != scope_ids:
        errors.append("accepted decision IDs do not match review scope exactly")

    for decision in sorted(accepted_decisions, key=lambda d: str(d.get("candidateId") or "")):
        candidate_id = str(decision.get("candidateId") or decision.get("decisionId") or "")
        manual_id = str(decision.get("manualId") or "")
        raw_id = _raw_candidate_id(candidate_id)
        candidates = _load_mapping_candidates(manual_id, CANDIDATES_DIR)
        prod_candidate = next((c for c in candidates if str(c.get("id") or "") == raw_id), None)
        if not prod_candidate:
            errors.append(f"production candidate missing: {candidate_id}")
            continue

        identity_index = _index_candidates(manual_id, candidates)
        identity_key = next((k for k, v in identity_index.items() if v is prod_candidate), None)
        review_class = classify_review_class(
            prod_candidate,
            artifact_source="canonical_mapping",
            inheritance_context={"by_procedure": {}},
        )
        proposed = prod_candidate.get("canonicalId")
        expected_target = decision.get("currentProposedCanonicalId")
        if str(proposed or "") != str(expected_target or ""):
            errors.append(f"production target mismatch for {candidate_id}")

        record_hash = _hash_candidate(prod_candidate)
        stamp_expected = _build_stamp(decision)
        existing_stamp = prod_candidate.get(STAMP_FIELD)
        already_applied = _stamp_matches(existing_stamp if isinstance(existing_stamp, dict) else None, stamp_expected)

        records.append(
            {
                "candidateId": candidate_id,
                "manualId": manual_id,
                "procedureId": decision.get("procedureId"),
                "procedureFamily": decision.get("procedureFamily"),
                "currentProductionClassification": review_class,
                "currentProposedCanonicalId": proposed,
                "currentMappingType": prod_candidate.get("mappingType"),
                "productionRecordHash": record_hash,
                "identityKey": (
                    f"{identity_key[0]}::{identity_key[1]}::{identity_key[2]}::{identity_key[3]}"
                    if identity_key
                    else None
                ),
                "provenance": prod_candidate.get("provenance"),
                "acceptedReviewDecision": {
                    "decision": decision.get("decision"),
                    "reviewer": decision.get("reviewer"),
                    "timestamp": decision.get("timestamp"),
                    "matcherImprovement": decision.get("matcherImprovement"),
                    "deltaReconciliationDecision": decision.get("deltaReconciliationDecision"),
                },
                "alreadyApplied": already_applied,
                "plannedAction": "stamp_human_review_acceptance" if not already_applied else "noop_already_applied",
            },
        )

    if len(records) != EXPECTED_ACCEPTED:
        errors.append(f"resolved production records {len(records)} != 52")

    return records, errors


def run_production_apply_gate(
    *,
    apply_mutations: bool = False,
    apply_authorization_granted: bool = False,
) -> dict[str, Any]:
    errors: list[str] = []
    accepted, closure = _authorized_accepted_decisions()
    _validate_closure(closure, errors)

    if not review_path().is_file():
        errors.append("missing matcher-reconciled review scope artifact")

    prod_decisions_bytes_before = production_decisions_path().read_bytes()
    prod_decisions_hash_before = _sha256_file(production_decisions_path())
    candidate_hashes_before = _candidate_artifact_hashes()
    matcher_hashes_before = _matcher_file_hashes()
    baseline_before = build_production_baseline_snapshot()

    preflight_records, record_errors = _build_preflight_records(accepted)
    errors.extend(record_errors)

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    if errors:
        return _package(
            errors,
            apply_mutations=apply_mutations,
            apply_authorization_granted=apply_authorization_granted,
            preflight_records=preflight_records,
            prod_decisions_hash_before=prod_decisions_hash_before,
            matcher_hashes_before=matcher_hashes_before,
            hashes_ok=hashes_ok,
        )

    planned_changes = [r for r in preflight_records if r.get("plannedAction") != "noop_already_applied"]
    already_applied_count = sum(1 for r in preflight_records if r.get("alreadyApplied"))

    if apply_mutations and not apply_authorization_granted:
        errors.append("apply_mutations requested but applyAuthorizationGranted is false")
    if apply_mutations and apply_authorization_granted and planned_changes:
        changes_applied: list[dict[str, Any]] = []
        files_touched: set[str] = set()
        by_manual: dict[str, list[dict[str, Any]]] = {}
        for record in preflight_records:
            by_manual.setdefault(str(record["manualId"]), []).append(record)

        scoped_manuals = {str(r["manualId"]) for r in preflight_records}
        for manual_id, manual_records in by_manual.items():
            path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
            payload = _read_json(path)
            candidates = list(payload.get("candidates") or [])
            manual_mutated = False
            for record in manual_records:
                raw_id = _raw_candidate_id(str(record["candidateId"]))
                idx = next(i for i, c in enumerate(candidates) if str(c.get("id") or "") == raw_id)
                before_hash = record["productionRecordHash"]
                if record.get("alreadyApplied"):
                    after_hash = before_hash
                else:
                    updated = copy.deepcopy(candidates[idx])
                    stamp = _build_stamp(
                        next(
                            d
                            for d in accepted
                            if str(d.get("candidateId")) == str(record["candidateId"])
                        ),
                    )
                    stamp["appliedAt"] = _utc_now()
                    updated[STAMP_FIELD] = stamp
                    candidates[idx] = updated
                    after_hash = _hash_candidate(updated)
                    manual_mutated = True
                changes_applied.append(
                    {
                        **record,
                        "beforeProductionRecordHash": before_hash,
                        "afterProductionRecordHash": after_hash,
                        "mutated": before_hash != after_hash,
                    },
                )
            if manual_mutated:
                path.write_text(json.dumps({**payload, "candidates": candidates}, indent=2), encoding="utf-8")
                files_touched.add(manual_id)

        candidate_hashes_after = _candidate_artifact_hashes()
        unauthorized = []
        for path_str, digest in candidate_hashes_after.items():
            if candidate_hashes_before.get(path_str) == digest:
                continue
            normalized = path_str.replace("\\", "/")
            if not any(f"/{mid}/" in normalized for mid in scoped_manuals):
                unauthorized.append(path_str)

        mutated_count = sum(1 for c in changes_applied if c.get("mutated"))
        if unauthorized:
            errors.append(f"unauthorized candidate file changes: {len(unauthorized)}")
        if mutated_count != len(planned_changes):
            errors.append(f"mutated count {mutated_count} != planned {len(planned_changes)}")

        if production_decisions_path().read_bytes() != prod_decisions_bytes_before:
            errors.append("796 production decisions changed during apply")
        if _matcher_file_hashes() != matcher_hashes_before:
            errors.append("matcher implementation files changed during apply")

        hashes_ok_after, hash_errors_after = validate_frozen_hashes()
        if not hashes_ok_after:
            errors.extend(hash_errors_after)

        post_records, post_errors = _build_preflight_records(accepted)
        if post_errors:
            errors.extend(post_errors)
        if any(r.get("plannedAction") != "noop_already_applied" for r in post_records):
            errors.append("post-apply preflight still has pending mutations")

        return _package(
            errors,
            status="GREEN" if not errors else "STOP",
            apply_mutations=True,
            apply_authorization_granted=True,
            preflight_records=preflight_records,
            changes_applied=changes_applied,
            authorized_changes=mutated_count,
            already_applied_count=already_applied_count,
            files_touched=sorted(files_touched),
            prod_decisions_hash_before=prod_decisions_hash_before,
            prod_decisions_hash_after=_sha256_file(production_decisions_path()),
            matcher_hashes_before=matcher_hashes_before,
            matcher_hashes_after=_matcher_file_hashes(),
            candidate_hashes_before=candidate_hashes_before,
            candidate_hashes_after=candidate_hashes_after,
            hashes_ok=hashes_ok,
            baseline_before=baseline_before,
        )

    # Preflight-only or authorized apply with nothing left to do
    status = "GREEN" if not errors else "STOP"
    if already_applied_count == EXPECTED_ACCEPTED and not planned_changes:
        apply_state = "already_applied"
    elif apply_mutations:
        apply_state = "applied"
    else:
        apply_state = "preflight_only_not_authorized"

    return _package(
        errors,
        status=status,
        apply_mutations=apply_mutations,
        apply_authorization_granted=apply_authorization_granted,
        preflight_records=preflight_records,
        authorized_changes=len(planned_changes),
        already_applied_count=already_applied_count,
        prod_decisions_hash_before=prod_decisions_hash_before,
        matcher_hashes_before=matcher_hashes_before,
        hashes_ok=hashes_ok,
        apply_state=apply_state,
        baseline_before=baseline_before,
    )


def _package(
    errors: list[str],
    *,
    status: str | None = None,
    apply_mutations: bool,
    apply_authorization_granted: bool,
    preflight_records: list[dict[str, Any]] | None = None,
    changes_applied: list[dict[str, Any]] | None = None,
    authorized_changes: int = 0,
    already_applied_count: int = 0,
    files_touched: list[str] | None = None,
    prod_decisions_hash_before: str | None = None,
    prod_decisions_hash_after: str | None = None,
    matcher_hashes_before: dict[str, str] | None = None,
    matcher_hashes_after: dict[str, str] | None = None,
    candidate_hashes_before: dict[str, str] | None = None,
    candidate_hashes_after: dict[str, str] | None = None,
    hashes_ok: bool = False,
    apply_state: str = "preflight_only_not_authorized",
    baseline_before: dict[str, Any] | None = None,
) -> dict[str, Any]:
    status = status or ("STOP" if errors else "GREEN")
    preflight_records = preflight_records or []
    unauthorized = 0 if status == "GREEN" or not apply_mutations else max(0, authorized_changes - len(changes_applied or []))

    lock = {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_production_apply_lock",
        "gateId": GATE_ID,
        "generatedAt": _utc_now(),
        "applyAuthorizationGranted": apply_authorization_granted and apply_mutations and status == "GREEN",
        "applyAuthorizationRequired": True,
        "productionMutationsExecuted": apply_mutations and status == "GREEN",
        "soleAuthority": "CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_v1.json (52 accepted)",
        "closureAuthority": str(closure_path()),
    }

    apply_report = {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_production_apply",
        "gateId": GATE_ID,
        "status": status,
        "generatedAt": _utc_now(),
        "applyState": apply_state,
        "canonicalPromotionImplied": False,
        "matcherExecuted": False,
        "reviewIndexRefreshed": False,
        "candidatesRegenerated": False,
        "mergedInto796Decisions": False,
        "applyMutationsRequested": apply_mutations,
        "applyAuthorizationGranted": apply_authorization_granted,
        "productionMutationsExecuted": apply_mutations and status == "GREEN",
        "summary": {
            "authorizedScope": EXPECTED_ACCEPTED,
            "authorizedChangesPlanned": authorized_changes,
            "authorizedChangesApplied": len([c for c in (changes_applied or []) if c.get("mutated")])
            if changes_applied
            else (0 if not apply_mutations else authorized_changes),
            "alreadyAppliedBeforeGate": already_applied_count,
            "unauthorizedChanges": unauthorized,
            "productionFilesTouched": len(files_touched or []),
        },
        "preflightRecords": preflight_records,
        "changeset": changes_applied or [],
        "integrity": {
            "frozenHashVerification": {"passed": hashes_ok},
            "productionDecisionsHashBefore": prod_decisions_hash_before,
            "productionDecisionsHashAfter": prod_decisions_hash_after or prod_decisions_hash_before,
            "productionDecisionsUnchanged": prod_decisions_hash_before == (prod_decisions_hash_after or prod_decisions_hash_before),
            "matcherFileHashesBefore": matcher_hashes_before,
            "matcherFileHashesAfter": matcher_hashes_after or matcher_hashes_before,
            "matcherUnchanged": matcher_hashes_before == (matcher_hashes_after or matcher_hashes_before),
        },
        "baselineSnapshot": baseline_before,
        "errors": errors,
    }
    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_production_apply_audit",
        "gateId": GATE_ID,
        "status": status,
        "generatedAt": apply_report["generatedAt"],
        "integrityChecks": {"passed": not errors, "errors": errors},
        "candidateArtifactsTouched": files_touched or [],
        "canonicalArtifactsTouched": [],
    }
    return {"apply": apply_report, "audit": audit, "lock": lock}


def write_production_apply_artifacts(payload: dict[str, Any]) -> tuple[Path, Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    paths = (apply_path(), apply_audit_path(), lock_path())
    paths[0].write_text(json.dumps(payload["apply"], indent=2), encoding="utf-8")
    paths[1].write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    paths[2].write_text(json.dumps(payload["lock"], indent=2), encoding="utf-8")
    return paths
