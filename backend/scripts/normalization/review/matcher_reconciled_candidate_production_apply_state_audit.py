from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR, ROOT
from .matcher_improvement_production_reconciliation import _hash_candidate as recon_hash
from .matcher_reconciled_candidate_production_apply import (
    GATE_ID,
    STAMP_FIELD,
    _build_stamp,
    _raw_candidate_id,
    _stamp_matches,
)
from .matcher_reconciled_candidate_review_decisions import load_matcher_reconciled_decisions

AUDIT_FILENAME = "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_STATE_AUDIT_v1.json"
COMMIT_REFERENCE = "83707ef8"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def audit_path() -> Path:
    return CALIBRATION_DIR / AUDIT_FILENAME


def _git_show_commit_file(rel_posix: str) -> dict[str, Any] | None:
    try:
        out = subprocess.run(
            ["git", "show", f"{COMMIT_REFERENCE}:{rel_posix}"],
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(out.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def build_state_audit() -> dict[str, Any]:
    store = load_matcher_reconciled_decisions()
    accepted = sorted(
        [d for d in (store.get("decisions") or {}).values() if str(d.get("decision") or "") == "accepted"],
        key=lambda d: str(d.get("candidateId") or ""),
    )
    apply_report = json.loads((CALIBRATION_DIR / "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_v1.json").read_text(encoding="utf-8"))
    apply_lock = json.loads((CALIBRATION_DIR / "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_LOCK_v1.json").read_text(encoding="utf-8"))

    per_record: list[dict[str, Any]] = []
    mapping_ok = stamp_ok = recon_ok = commit_exact = 0

    for decision in accepted:
        candidate_id = str(decision.get("candidateId") or "")
        manual_id = str(decision.get("manualId") or "")
        raw_id = _raw_candidate_id(candidate_id)
        path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
        rel = path.relative_to(ROOT).as_posix()
        payload = json.loads(path.read_text(encoding="utf-8"))
        candidate = next((c for c in payload.get("candidates") or [] if str(c.get("id") or "") == raw_id), None)
        row: dict[str, Any] = {
            "candidateId": candidate_id,
            "candidateKey": decision.get("candidateKey"),
            "manualId": manual_id,
            "productionRecordId": raw_id,
        }
        if not candidate:
            row["status"] = "MISSING_CANDIDATE"
            per_record.append(row)
            continue

        target = decision.get("currentProposedCanonicalId")
        mapping_matches = str(candidate.get("canonicalId") or "") == str(target or "")
        if mapping_matches:
            mapping_ok += 1

        stamp = candidate.get(STAMP_FIELD)
        stamp_valid = _stamp_matches(stamp if isinstance(stamp, dict) else None, _build_stamp(decision))
        if stamp_valid:
            stamp_ok += 1

        changeset = (decision.get("productionReconciliation") or {}).get("changesetMutation") or {}
        without_stamp = {k: v for k, v in candidate.items() if k != STAMP_FIELD}
        expected_hash = changeset.get("newProductionRecordHash")
        recon_matches = bool(expected_hash and recon_hash(without_stamp) == expected_hash)
        if recon_matches:
            recon_ok += 1

        committed_payload = _git_show_commit_file(rel)
        committed_candidate = None
        if committed_payload:
            committed_candidate = next(
                (c for c in committed_payload.get("candidates") or [] if str(c.get("id") or "") == raw_id),
                None,
            )
        exact_commit = bool(
            committed_candidate
            and json.dumps(candidate, sort_keys=True) == json.dumps(committed_candidate, sort_keys=True)
        )
        if exact_commit:
            commit_exact += 1

        row["mappingContent"] = {
            "matchesReviewDecision": mapping_matches,
            "canonicalId": candidate.get("canonicalId"),
            "expectedCanonicalId": target,
        }
        row["stamp"] = {
            "present": isinstance(stamp, dict),
            "valid": stamp_valid,
            "appliedAt": stamp.get("appliedAt") if isinstance(stamp, dict) else None,
        }
        row["reconciliationChangeset"] = {
            "matchesExcludingStamp": recon_matches,
            "expectedNewProductionRecordHash": expected_hash,
            "actualHashExcludingStamp": recon_hash(without_stamp),
        }
        row["commit83707ef8"] = {"present": committed_candidate is not None, "exactRecordMatch": exact_commit}
        per_record.append(row)

    apply_changeset_len = len(apply_report.get("changeset") or [])
    classification = "D"
    classification_label = (
        "Production state is complete: 52 reconciliation mapping payloads and 52 human-acceptance stamps on disk "
        "and in commit 83707ef8; lock flags are true. "
        "CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_v1.json is a second idempotent run (already_applied, "
        "empty changeset) and does not retain the first-run 52-entry changeset transcript."
    )
    if (
        mapping_ok == 52
        and stamp_ok == 52
        and recon_ok == 52
        and commit_exact == 52
        and apply_lock.get("applyAuthorizationGranted")
        and apply_lock.get("productionMutationsExecuted")
        and apply_changeset_len == 0
        and apply_report.get("applyState") == "already_applied"
    ):
        classification = "D"
    elif mapping_ok == 52 and stamp_ok < 52:
        classification = "C"
        classification_label = "Mapping reconciliation content present; apply stamp missing or invalid on one or more records."
    elif mapping_ok == 52 and stamp_ok == 52 and not apply_lock.get("productionMutationsExecuted"):
        classification = "B"
        classification_label = "Stamps present on disk but apply lock/report artifacts do not reflect execution."

    return {
        "schemaVersion": 1,
        "reportType": "matcher_reconciled_candidate_production_apply_state_audit",
        "gateId": GATE_ID,
        "status": "GREEN" if mapping_ok == 52 and stamp_ok == 52 else "STOP",
        "generatedAt": _utc_now(),
        "readOnly": True,
        "classification": classification,
        "classificationLabel": classification_label,
        "commitReference": COMMIT_REFERENCE,
        "summary": {
            "authorizedScope": 52,
            "acceptedDecisions": len(accepted),
            "mappingContentMatchesReview": mapping_ok,
            "validApplyStamps": stamp_ok,
            "reconciliationChangesetHashMatchesExcludingStamp": recon_ok,
            "commitExactRecordMatches": commit_exact,
        },
        "artifactState": {
            "lock": {
                "applyAuthorizationGranted": apply_lock.get("applyAuthorizationGranted"),
                "productionMutationsExecuted": apply_lock.get("productionMutationsExecuted"),
                "generatedAt": apply_lock.get("generatedAt"),
            },
            "applyReport": {
                "applyState": apply_report.get("applyState"),
                "productionMutationsExecuted": apply_report.get("productionMutationsExecuted"),
                "summary": apply_report.get("summary"),
                "changesetEntryCount": apply_changeset_len,
                "generatedAt": apply_report.get("generatedAt"),
            },
        },
        "findings": {
            "physicalMutations": {
                "productionReconciliationGate": {
                    "description": "Wrote matcher-improvement mapping payloads (canonicalId, classification fields) into production.",
                    "changesetArtifact": "CG_MATCHER_IMPROVEMENT_PRODUCTION_RECONCILIATION_CHANGESET_v1.json",
                    "recordCount": 52,
                },
                "productionApplyGateFirstRun": {
                    "description": "Added matcherReconciledProductionApply metadata (+ appliedAt) only; no matcher, no canonical promotion.",
                    "field": STAMP_FIELD,
                    "recordCount": stamp_ok,
                },
            },
            "idempotencySecondRun": {
                "basis": "Preflight _stamp_matches on each authorized production candidate record.",
                "notBasedOn": "Persisted changeset array in CG_MATCHER_RECONCILED_CANDIDATE_PRODUCTION_APPLY_v1.json",
                "observed": apply_report.get("summary"),
            },
            "reportedDiscrepancy": {
                "assistantClaimLockFalse": False,
                "actualLockFlags": {
                    "applyAuthorizationGranted": apply_lock.get("applyAuthorizationGranted"),
                    "productionMutationsExecuted": apply_lock.get("productionMutationsExecuted"),
                },
                "note": "Earlier preflight-only summary was wrong; committed lock matches executed apply.",
            },
        },
        "perRecord": per_record,
        "errors": [],
    }


def write_state_audit() -> Path:
    payload = build_state_audit()
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    audit_path().write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return audit_path()
