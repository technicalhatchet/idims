from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import decisions_path as production_decisions_path, load_decisions
from .matcher_improvement_delta_reconciliation_final import manifest_path
from .matcher_improvement_production_reconciliation import (
    changeset_path as reconciliation_changeset_path,
    reconciliation_path,
)
from .matcher_improvement_review_index_refresh import _resolve_candidate_id_for_key
from .matcher_improvement_review_index_refresh import _records_by_id
from .matcher_reconciled_candidate_review_decisions import (
    GATE_ID,
    decisions_path as wave_decisions_path,
    load_matcher_reconciled_decisions,
)
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes
from .wave1_existing_canonical_mapping import load_review_index
from .wave2_new_platform_knowledge import select_wave_candidates as select_wave2

WAVE_ID = "matcher-reconciled-candidate-review"
EXPECTED_SCOPE = 52

REVIEW_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_v1.json"
REVIEW_AUDIT_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_AUDIT_v1.json"
CLOSURE_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_CLOSURE_v1.json"
CLOSURE_AUDIT_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_CLOSURE_AUDIT_v1.json"

INDEX_REFRESH_FILE = CALIBRATION_DIR / "CG_MATCHER_IMPROVEMENT_REVIEW_INDEX_REFRESH_v1.json"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def review_path() -> Path:
    return CALIBRATION_DIR / REVIEW_FILENAME


def review_audit_path() -> Path:
    return CALIBRATION_DIR / REVIEW_AUDIT_FILENAME


def closure_path() -> Path:
    return CALIBRATION_DIR / CLOSURE_FILENAME


def closure_audit_path() -> Path:
    return CALIBRATION_DIR / CLOSURE_AUDIT_FILENAME


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _manifest_by_key() -> dict[str, dict[str, Any]]:
    manifest = _read_json(manifest_path())
    return {str(r["candidateKey"]): r for r in (manifest.get("records") or [])}


def _changeset_by_key() -> dict[str, dict[str, Any]]:
    changeset = _read_json(reconciliation_changeset_path())
    out: dict[str, dict[str, Any]] = {}
    for mutation in changeset.get("mutations") or []:
        out[str(mutation["candidateKey"])] = mutation
    return out


def _authorized_candidate_ids() -> list[str]:
    refresh = _read_json(INDEX_REFRESH_FILE)
    requires = (refresh.get("newReviewRecords") or {}).get("requiresNewHumanReview") or []
    return sorted(str(x) for x in requires)


def build_scope_records() -> list[dict[str, Any]]:
    candidate_ids = _authorized_candidate_ids()
    index = load_review_index()
    by_id = _records_by_id(index)
    manifest = _manifest_by_key()
    changeset = _changeset_by_key()
    refresh = _read_json(INDEX_REFRESH_FILE)
    intersection = {
        str(item["candidateKey"]): item
        for item in ((refresh.get("summary") or {}).get("reconciledManifestIntersection") or [])
    }

    records: list[dict[str, Any]] = []
    for candidate_id in candidate_ids:
        index_record = by_id.get(candidate_id)
        if not index_record:
            raise RuntimeError(f"missing index record for scoped candidate: {candidate_id}")

        candidate_key = None
        for key, item in intersection.items():
            if str(item.get("candidateId")) == candidate_id:
                candidate_key = key
                break
        if not candidate_key:
            for key, manifest_row in manifest.items():
                resolved = _resolve_candidate_id_for_key(by_id, key)
                if resolved == candidate_id:
                    candidate_key = key
                    break
        manifest_row = manifest.get(candidate_key or "", {})
        mutation = changeset.get(candidate_key or "", {})

        procedure_id = (
            manifest_row.get("procedureId")
            or (index_record.get("what") or {}).get("procedureId")
            or mutation.get("procedureId")
        )
        records.append(
            {
                "decisionId": candidate_id,
                "candidateId": candidate_id,
                "candidateKey": candidate_key or manifest_row.get("candidateKey"),
                "manualId": index_record.get("manualId"),
                "procedureId": procedure_id,
                "procedureFamily": manifest_row.get("procedureFamily") or procedure_id,
                "requiresNewHumanReview": True,
                "hasHistoricalDecision": False,
                "currentReviewClass": index_record.get("reviewClass"),
                "currentProposedCanonicalId": (index_record.get("mapsTo") or {}).get("proposedCanonicalId"),
                "matcherImprovement": {
                    "backlogId": manifest_row.get("backlogId") or mutation.get("backlogId"),
                    "approvedTarget": manifest_row.get("stagedProposedCanonicalId")
                    or mutation.get("newProductionTarget"),
                },
                "deltaReconciliationDecision": manifest_row.get("decision") or "accept_staged",
                "productionReconciliation": {
                    "manifestRecord": manifest_row,
                    "changesetMutation": {
                        k: v
                        for k, v in mutation.items()
                        if k != "stagedPayload"
                    },
                },
                "historicalDecisionStatus": "none",
                "indexSnapshot": {
                    "what": index_record.get("what"),
                    "mapsTo": index_record.get("mapsTo"),
                    "where": index_record.get("where"),
                    "why": index_record.get("why"),
                    "context": index_record.get("context"),
                },
            },
        )
    return records


def run_preflight() -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    recon = _read_json(reconciliation_path())
    if recon.get("status") != "GREEN":
        errors.append("production reconciliation not GREEN")
    refresh = _read_json(INDEX_REFRESH_FILE)
    if refresh.get("status") != "GREEN":
        errors.append("review index refresh not GREEN")

    prod_decisions = load_decisions().get("decisions") or {}
    if len(prod_decisions) != 796:
        errors.append(f"production decisions count {len(prod_decisions)} != 796")

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 not closed")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 not closed")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    manifest = _read_json(manifest_path())
    if len(manifest.get("records") or []) != EXPECTED_SCOPE:
        errors.append("manifest record count != 52")

    try:
        scope_records = build_scope_records()
    except RuntimeError as exc:
        errors.append(str(exc))
        scope_records = []

    candidate_ids = [r["candidateId"] for r in scope_records]
    if len(candidate_ids) != EXPECTED_SCOPE:
        errors.append(f"scope count {len(candidate_ids)} != 52")
    if len(candidate_ids) != len(set(candidate_ids)):
        errors.append("duplicate candidate IDs in scope")

    index = load_review_index()
    wave2_pool_ids = {str(r["candidateId"]) for r in select_wave2(index)}
    wave1_decision_ids = {cid for cid in prod_decisions if cid not in wave2_pool_ids}
    wave2_decision_ids = wave2_pool_ids
    wave3_class = {
        str(r["candidateId"])
        for r in (index.get("candidateRecords") or [])
        if r.get("reviewClass") == "newCanonicalKnowledge"
    }

    overlap_w1 = sorted(set(candidate_ids) & wave1_decision_ids)
    overlap_w2 = sorted(set(candidate_ids) & wave2_decision_ids)
    overlap_796 = sorted(set(candidate_ids) & set(prod_decisions))
    overlap_w3 = sorted(set(candidate_ids) & wave3_class)

    if overlap_w1:
        errors.append(f"wave1 overlap: {len(overlap_w1)}")
    if overlap_w2:
        errors.append(f"wave2 overlap: {len(overlap_w2)}")
    if overlap_796:
        errors.append(f"796-decision overlap: {len(overlap_796)}")
    if overlap_w3:
        errors.append(f"wave3 newCanonical overlap: {len(overlap_w3)}")

    refresh_requires = _authorized_candidate_ids()
    if sorted(refresh_requires) != sorted(candidate_ids):
        errors.append("scope does not match index refresh requiresNewHumanReview list")

    wave_store = load_matcher_reconciled_decisions()
    if wave_store.get("automaticDecisionsApplied"):
        errors.append("automatic decisions already applied in wave store")

    return {
        "passed": not errors,
        "errors": errors,
        "warnings": warnings,
        "expectedScope": EXPECTED_SCOPE,
        "scopeCandidateIds": candidate_ids,
        "overlap": {
            "wave1": overlap_w1,
            "wave2": overlap_w2,
            "historical796": overlap_796,
            "wave3NewCanonical": overlap_w3,
        },
        "scopeRecords": scope_records,
        "frozenHashesPassed": hashes_ok,
        "canonicalPromotionImplied": False,
        "productionDecisionsHash": _sha256_file(production_decisions_path()),
        "productionDecisionsCount": len(prod_decisions),
    }


def run_review_gate(*, write_artifacts: bool = True) -> dict[str, Any]:
    preflight = run_preflight()
    status = "GREEN" if preflight["passed"] else "STOP"
    review = {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_review",
        "waveId": WAVE_ID,
        "gateId": GATE_ID,
        "status": status,
        "generatedAt": _utc_now(),
        "canonicalPromotionImplied": False,
        "matcherExecuted": False,
        "expectedScopeCount": EXPECTED_SCOPE,
        "reviewSemantics": {
            "accepted": "Valid production candidate knowledge (not canonical promotion)",
            "deferred": "Retain for later review",
            "rejected": "Mapping should not remain as accepted candidate knowledge",
        },
        "scopeRecords": preflight.get("scopeRecords") or [],
        "preflight": {k: v for k, v in preflight.items() if k != "scopeRecords"},
        "decisionStore": str(wave_decisions_path()),
        "errors": preflight.get("errors") or [],
    }
    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_review_audit",
        "waveId": WAVE_ID,
        "status": status,
        "generatedAt": review["generatedAt"],
        "integrityChecks": {
            "passed": preflight["passed"],
            "errors": preflight.get("errors") or [],
        },
    }
    payload = {"review": review, "audit": audit}
    if write_artifacts:
        CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
        review_path().write_text(json.dumps(review, indent=2), encoding="utf-8")
        review_audit_path().write_text(json.dumps(audit, indent=2), encoding="utf-8")
        if not wave_decisions_path().is_file():
            from .matcher_reconciled_candidate_review_decisions import empty_decisions_store, save_matcher_reconciled_decisions

            save_matcher_reconciled_decisions(empty_decisions_store())
    return payload


def run_closure_gate(*, write_artifacts: bool = True) -> dict[str, Any]:
    errors: list[str] = []
    preflight = run_preflight()
    if not preflight["passed"]:
        errors.extend(preflight["errors"])

    scope_ids = set(preflight.get("scopeCandidateIds") or [])
    store = load_matcher_reconciled_decisions()
    decisions = store.get("decisions") or {}

    out_of_scope = sorted(set(decisions) - scope_ids)
    missing = sorted(scope_ids - set(decisions))
    duplicate_ids: list[str] = []

    status_counts = Counter(str(d.get("decision") or "") for d in decisions.values())
    reviewed = len([d for d in decisions.values() if d.get("decision") in {"accepted", "deferred", "rejected"}])

    if out_of_scope:
        errors.append(f"out-of-scope decisions: {len(out_of_scope)}")
    if missing:
        errors.append(f"missing decisions: {len(missing)}")

    prod_hash_before = preflight.get("productionDecisionsHash")
    prod_hash_after = _sha256_file(production_decisions_path())
    if prod_hash_before != prod_hash_after:
        errors.append("796 production decisions artifact changed during review")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    closure_status = "GREEN" if not errors and reviewed == EXPECTED_SCOPE else "STOP"
    if reviewed < EXPECTED_SCOPE:
        closure_status = "HOLD"

    closure = {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_review_closure",
        "waveId": WAVE_ID,
        "status": closure_status,
        "generatedAt": _utc_now(),
        "expectedCount": EXPECTED_SCOPE,
        "reviewedCount": reviewed,
        "acceptedCount": status_counts.get("accepted", 0),
        "deferredCount": status_counts.get("deferred", 0),
        "rejectedCount": status_counts.get("rejected", 0),
        "missingDecisionCandidateIds": missing,
        "duplicateDecisionCount": len(duplicate_ids),
        "outOfScopeDecisionCandidateIds": out_of_scope,
        "historicalDecisionMutations": 0,
        "canonicalMutations": 0,
        "matcherMutations": 0,
        "productionCandidateMutations": 0,
        "canonicalPromotionImplied": False,
        "mergedIntoProductionReviewDecisions": False,
        "errors": errors,
    }
    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_review_closure_audit",
        "waveId": WAVE_ID,
        "status": closure_status,
        "generatedAt": closure["generatedAt"],
        "integrityChecks": {"passed": not errors, "errors": errors},
    }
    payload = {"closure": closure, "audit": audit}
    if write_artifacts:
        CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
        closure_path().write_text(json.dumps(closure, indent=2), encoding="utf-8")
        closure_audit_path().write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return payload
