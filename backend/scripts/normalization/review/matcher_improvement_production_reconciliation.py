from __future__ import annotations

import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .candidate_review_index import classify_review_class
from .matcher_improvement_delta_reconciliation_final import (
    FINAL_FILENAME,
    MANIFEST_FILENAME,
    manifest_path,
)
from .matcher_improvement_full_corpus_regeneration import (
    _inheritance_context_for_dir,
    _proposed_target,
    production_manual_ids,
    staging_root,
)
from .matcher_improvement_full_corpus_regeneration import (
    _candidate_identity,
)
from .matcher_improvement_scoped_validation import _production_integrity_snapshot
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes

RECONCILIATION_FILENAME = "CG_MATCHER_IMPROVEMENT_PRODUCTION_RECONCILIATION_v1.json"
RECONCILIATION_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_PRODUCTION_RECONCILIATION_AUDIT_v1.json"
CHANGESET_FILENAME = "CG_MATCHER_IMPROVEMENT_PRODUCTION_RECONCILIATION_CHANGESET_v1.json"
FINAL_REPORT_PATH = CALIBRATION_DIR / FINAL_FILENAME


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def reconciliation_path() -> Path:
    return CALIBRATION_DIR / RECONCILIATION_FILENAME


def reconciliation_audit_path() -> Path:
    return CALIBRATION_DIR / RECONCILIATION_AUDIT_FILENAME


def changeset_path() -> Path:
    return CALIBRATION_DIR / CHANGESET_FILENAME


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _hash_candidate(candidate: dict[str, Any]) -> str:
    return _hash_bytes(json.dumps(candidate, sort_keys=True).encode("utf-8"))


def _candidate_key_from_manifest_key(candidate_key: str) -> tuple[str, str, str, str]:
    parts = candidate_key.split("::", 3)
    while len(parts) < 4:
        parts.append("")
    return (parts[0], parts[1], parts[2], parts[3])


def _index_candidates(manual_id: str, candidates: list[dict[str, Any]]) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    out: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for candidate in candidates:
        key = _candidate_identity(manual_id, "canonical_mapping", candidate)
        out[key] = candidate
    return out


def _classify(manual_id: str, root: Path, candidate: dict[str, Any]) -> str:
    manual_dir = root / manual_id
    inheritance = _inheritance_context_for_dir(manual_dir)
    return classify_review_class(
        candidate,
        artifact_source="canonical_mapping",
        inheritance_context=inheritance,
    )


def _load_mapping_candidates(manual_id: str, root: Path) -> list[dict[str, Any]]:
    path = root / manual_id / "canonical_mapping_candidates.json"
    if not path.is_file():
        return []
    return list(_read_json(path).get("candidates") or [])


def _keep_baseline_records() -> list[dict[str, Any]]:
    final = _read_json(FINAL_REPORT_PATH)
    excluded_ids = final.get("excludedFromManifest", {}).get("keepProductionBaseline") or []
    queue = _read_json(CALIBRATION_DIR / "CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_QUEUE_v1.json")
    index = {str(i["decisionId"]): i for i in (queue.get("populationB") or [])}
    records: list[dict[str, Any]] = []
    for decision_id in excluded_ids:
        item = index.get(str(decision_id))
        if item:
            records.append(item)
    return records


def _stable_candidate_key(key_tuple: tuple[str, str, str, str]) -> str:
    return f"{key_tuple[0]}::{key_tuple[1]}::{key_tuple[2]}::{key_tuple[3]}"


def _resolve_identity_key(
    manual_id: str,
    procedure_id: str,
    source_term: str,
    candidate_index: dict[tuple[str, str, str, str], dict[str, Any]],
    *,
    fallback_key: str | None = None,
) -> tuple[str, str, str, str] | None:
    if procedure_id:
        for key_tuple in candidate_index:
            if key_tuple[0] != manual_id or key_tuple[1] != procedure_id:
                continue
            if str(key_tuple[2]) == str(source_term):
                return key_tuple
    if fallback_key:
        key_tuple = _candidate_key_from_manifest_key(fallback_key)
        if key_tuple in candidate_index:
            return key_tuple
    return None


def build_production_baseline_snapshot() -> dict[str, Any]:
    manual_ids = production_manual_ids()
    files: dict[str, Any] = {}
    candidate_hashes: dict[str, str] = {}
    for manual_id in manual_ids:
        path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
        if path.is_file():
            raw = path.read_bytes()
            files[manual_id] = {
                "path": str(path),
                "fileHash": _hash_bytes(raw),
                "candidateCount": len(_load_mapping_candidates(manual_id, CANDIDATES_DIR)),
            }
            for key_tuple, candidate in _index_candidates(manual_id, _load_mapping_candidates(manual_id, CANDIDATES_DIR)).items():
                stable = f"{key_tuple[0]}::{key_tuple[1]}::{key_tuple[2]}::{key_tuple[3]}"
                candidate_hashes[stable] = _hash_candidate(candidate)
    return {
        "manualCount": len(manual_ids),
        "files": files,
        "candidateRecordHashes": candidate_hashes,
    }


def _overlay_and_arch_hashes(manual_ids: set[str]) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for manual_id in manual_ids:
        for name in ("overlay_candidates.json", "architecture_exception.json"):
            path = CANDIDATES_DIR / manual_id / name
            if path.is_file():
                hashes[str(path)] = _hash_bytes(path.read_bytes())
    return hashes


def run_production_reconciliation_gate(*, apply_mutations: bool = True) -> dict[str, Any]:
    errors: list[str] = []
    staged = staging_root()

    if not manifest_path().is_file():
        errors.append("missing production reconciliation manifest")
        return _package(errors, [], apply_mutations, None, None, None)

    manifest = _read_json(manifest_path())
    if manifest.get("canonicalPromotionImplied"):
        errors.append("manifest canonicalPromotionImplied is true")
    if not manifest.get("soleAuthorityForNextGate"):
        errors.append("manifest soleAuthorityForNextGate is false")

    records = list(manifest.get("records") or [])
    if len(records) != 52:
        errors.append(f"manifest record count {len(records)} != 52")
    keys = [str(r.get("candidateKey") or "") for r in records]
    if len(keys) != len(set(keys)):
        errors.append("manifest duplicate candidate keys")

    for record in records:
        if str(record.get("decision") or "") != "accept_staged":
            errors.append(f"manifest record not accept_staged: {record.get('candidateKey')}")

    keep_baseline_records = _keep_baseline_records()
    if len(keep_baseline_records) != 18:
        errors.append(f"keep-baseline record count {len(keep_baseline_records)} != 18")
    keep_baseline_identity_keys: list[tuple[str, str, str, str]] = []
    keep_baseline_absent_keys: list[str] = []

    prod_decisions_before = _production_integrity_snapshot()
    if prod_decisions_before.get("reviewDecisionCount") != 796:
        errors.append("production decisions != 796 before mutation")

    baseline_snapshot = build_production_baseline_snapshot()
    authorized_key_set = set(keys)
    for key in authorized_key_set:
        if key not in baseline_snapshot["candidateRecordHashes"]:
            errors.append(f"authorized key missing in production baseline: {key}")

    for item in keep_baseline_records:
        candidate_key = str(item.get("candidateKey") or "")
        if candidate_key in authorized_key_set:
            errors.append(f"keep-baseline record also authorized in manifest: {candidate_key}")
            continue
        manual_id = str(item.get("manualId") or "")
        procedure_id = str(item.get("procedureId") or "")
        source_term = str(item.get("sourceTerm") or "")
        prod_index = _index_candidates(manual_id, _load_mapping_candidates(manual_id, CANDIDATES_DIR))
        key_tuple = _candidate_key_from_manifest_key(candidate_key)
        if candidate_key in baseline_snapshot["candidateRecordHashes"] or key_tuple in prod_index:
            resolved = _resolve_identity_key(
                manual_id,
                procedure_id,
                source_term,
                prod_index,
                fallback_key=candidate_key,
            )
            if not resolved or resolved not in prod_index:
                errors.append(f"keep-baseline record missing in production: {candidate_key}")
                continue
            keep_baseline_identity_keys.append(resolved)
        else:
            staged_index = _index_candidates(manual_id, _load_mapping_candidates(manual_id, staged))
            if key_tuple in staged_index and key_tuple not in prod_index:
                keep_baseline_absent_keys.append(candidate_key)
            elif key_tuple in prod_index:
                keep_baseline_identity_keys.append(key_tuple)
            else:
                errors.append(f"keep-baseline record not in production or staged corpus: {candidate_key}")

    mutations_plan: list[dict[str, Any]] = []
    for record in records:
        manual_id = str(record["manualId"])
        candidate_key = str(record["candidateKey"])
        key_tuple = _candidate_key_from_manifest_key(candidate_key)
        staged_index = _index_candidates(manual_id, _load_mapping_candidates(manual_id, staged))
        prod_index = _index_candidates(manual_id, _load_mapping_candidates(manual_id, CANDIDATES_DIR))
        staged_candidate = staged_index.get(key_tuple)
        prod_candidate = prod_index.get(key_tuple)
        if not staged_candidate:
            errors.append(f"staged missing key {candidate_key}")
            continue
        if not prod_candidate:
            errors.append(f"production missing key {candidate_key}")
            continue
        staged_target = _proposed_target(staged_candidate)
        staged_class = _classify(manual_id, staged, staged_candidate)
        if str(staged_target or "") != str(record.get("stagedProposedCanonicalId") or ""):
            errors.append(f"staged target mismatch manifest for {candidate_key}")
        if staged_class != record.get("stagedClassification"):
            errors.append(f"staged class mismatch manifest for {candidate_key}")
        staged_hash = _hash_candidate(staged_candidate)
        old_class = _classify(manual_id, CANDIDATES_DIR, prod_candidate)
        old_target = _proposed_target(prod_candidate)
        mutations_plan.append(
            {
                "candidateKey": candidate_key,
                "manualId": manual_id,
                "procedureId": record.get("procedureId"),
                "population": record.get("population"),
                "decision": record.get("decision"),
                "backlogId": record.get("backlogId"),
                "oldProductionClassification": old_class,
                "newProductionClassification": staged_class,
                "oldProductionTarget": old_target,
                "newProductionTarget": staged_target,
                "stagedSourceHash": staged_hash,
                "oldProductionRecordHash": _hash_candidate(prod_candidate),
                "stagedPayload": staged_candidate,
            },
        )

    if errors:
        return _package(errors, mutations_plan, apply_mutations, baseline_snapshot, prod_decisions_before, None)

    overlay_hashes_before = _overlay_and_arch_hashes(
        set(r["manualId"] for r in mutations_plan)
        | {str(item.get("manualId") or "") for item in keep_baseline_records},
    )

    changes_applied: list[dict[str, Any]] = []
    files_touched: set[str] = set()

    if apply_mutations:
        by_manual: dict[str, list[dict[str, Any]]] = {}
        for mutation in mutations_plan:
            by_manual.setdefault(mutation["manualId"], []).append(mutation)

        for manual_id, manual_mutations in by_manual.items():
            path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
            payload = _read_json(path)
            candidates = list(payload.get("candidates") or [])
            index = _index_candidates(manual_id, candidates)
            for mutation in manual_mutations:
                key_tuple = _candidate_key_from_manifest_key(mutation["candidateKey"])
                if key_tuple not in index:
                    errors.append(f"apply: missing key {mutation['candidateKey']}")
                    continue
                index[key_tuple] = copy.deepcopy(mutation["stagedPayload"])
            # rebuild list preserving order, replacing in place
            new_candidates: list[dict[str, Any]] = []
            for candidate in candidates:
                kt = _candidate_identity(manual_id, "canonical_mapping", candidate)
                new_candidates.append(index.get(kt, candidate))
            payload["candidates"] = new_candidates
            path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            files_touched.add(manual_id)
            for mutation in manual_mutations:
                key_tuple = _candidate_key_from_manifest_key(mutation["candidateKey"])
                new_candidate = index[key_tuple]
                changes_applied.append(
                    {
                        **{k: v for k, v in mutation.items() if k != "stagedPayload"},
                        "newProductionRecordHash": _hash_candidate(new_candidate),
                    },
                )

    if errors:
        return _package(errors, changes_applied, apply_mutations, baseline_snapshot, prod_decisions_before, overlay_hashes_before)

    after_snapshot = build_production_baseline_snapshot()
    changed_keys: list[str] = []
    for key, before_hash in baseline_snapshot["candidateRecordHashes"].items():
        after_hash = after_snapshot["candidateRecordHashes"].get(key)
        if before_hash != after_hash:
            changed_keys.append(key)

    unauthorized = [k for k in changed_keys if k not in authorized_key_set]
    missing_changes = [k for k in authorized_key_set if k not in changed_keys]

    if unauthorized:
        errors.append(f"unauthorized candidate changes: {len(unauthorized)}")
    if missing_changes:
        errors.append(f"authorized keys not changed: {len(missing_changes)}")
    if len(changed_keys) != 52:
        errors.append(f"changed key count {len(changed_keys)} != 52")

    for key_tuple in keep_baseline_identity_keys:
        stable = _stable_candidate_key(key_tuple)
        if baseline_snapshot["candidateRecordHashes"].get(stable) != after_snapshot["candidateRecordHashes"].get(stable):
            errors.append(f"keep-baseline record changed: {stable}")

    for candidate_key in keep_baseline_absent_keys:
        if candidate_key in after_snapshot["candidateRecordHashes"]:
            errors.append(f"keep-baseline staged-only record added to production: {candidate_key}")

    overlay_hashes_after = _overlay_and_arch_hashes(
        set(r["manualId"] for r in mutations_plan)
        | {str(item.get("manualId") or "") for item in keep_baseline_records},
    )
    if overlay_hashes_before != overlay_hashes_after:
        errors.append("overlay or architecture_exception file changed")

    prod_decisions_after = _production_integrity_snapshot()
    if prod_decisions_before != prod_decisions_after:
        errors.append("production review decisions changed during reconciliation")

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 closure not intact")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 closure not intact")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    status = "GREEN" if not errors else "STOP"

    return _package(
        errors,
        changes_applied,
        apply_mutations,
        baseline_snapshot,
        prod_decisions_before,
        overlay_hashes_before,
        after_snapshot=after_snapshot,
        changed_keys=changed_keys,
        unauthorized=unauthorized,
        keep_baseline_verified=len(keep_baseline_identity_keys) + len(keep_baseline_absent_keys),
        files_touched=sorted(files_touched),
        status=status,
        hashes_ok=hashes_ok,
        hash_errors=hash_errors,
        wave1=wave1.get("status"),
        wave2=wave2.get("status"),
        prod_after=prod_decisions_after,
        overlay_after=overlay_hashes_after,
    )


def _package(
    errors: list[str],
    changes: list[dict[str, Any]],
    apply_mutations: bool,
    baseline_snapshot: dict[str, Any] | None,
    prod_before: dict[str, Any] | None,
    overlay_before: dict[str, str] | None,
    **kwargs: Any,
) -> dict[str, Any]:
    status = kwargs.get("status", "STOP" if errors else "GREEN")
    reconciliation = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_production_reconciliation",
        "status": status,
        "generatedAt": _utc_now(),
        "gateType": "controlled_production_candidate_reconciliation",
        "canonicalPromotionImplied": False,
        "matcherExecuted": False,
        "productionReviewIndexRefreshed": False,
        "manifestAuthority": MANIFEST_FILENAME,
        "mutationsApplied": apply_mutations and status == "GREEN",
        "summary": {
            "productionFilesChanged": len(kwargs.get("files_touched") or []),
            "candidateRecordsChanged": len(kwargs.get("changed_keys") or changes),
            "unauthorizedChanges": len(kwargs.get("unauthorized") or []),
            "keepBaselineRecordsVerifiedUnchanged": kwargs.get("keep_baseline_verified", 0),
            "changedManualCount": len(kwargs.get("files_touched") or []),
        },
        "integrity": {
            "frozenHashVerification": {
                "passed": kwargs.get("hashes_ok", False),
                "errors": kwargs.get("hash_errors") or [],
            },
            "productionDecisionsUnchanged": prod_before == kwargs.get("prod_after", prod_before),
            "wave1Closure": kwargs.get("wave1"),
            "wave2Closure": kwargs.get("wave2"),
            "overlayAndArchitectureUnchanged": overlay_before == kwargs.get("overlay_after", overlay_before),
        },
        "baselineSnapshot": baseline_snapshot,
        "afterSnapshot": kwargs.get("after_snapshot"),
        "errors": errors,
    }
    changeset = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_production_reconciliation_changeset",
        "status": status,
        "generatedAt": reconciliation["generatedAt"],
        "mutationCount": len(changes),
        "mutations": [{k: v for k, v in m.items() if k != "stagedPayload"} for m in changes],
        "unauthorizedMutations": kwargs.get("unauthorized") or [],
        "changedCandidateKeys": kwargs.get("changed_keys") or [],
    }
    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_production_reconciliation_audit",
        "status": status,
        "generatedAt": reconciliation["generatedAt"],
        "integrityChecks": {"passed": not errors, "errors": errors},
    }
    return {"reconciliation": reconciliation, "changeset": changeset, "audit": audit}


def write_production_reconciliation_artifacts(payload: dict[str, Any]) -> tuple[Path, Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    p1 = reconciliation_path()
    p2 = reconciliation_audit_path()
    p3 = changeset_path()
    p1.write_text(json.dumps(payload["reconciliation"], indent=2), encoding="utf-8")
    p2.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    p3.write_text(json.dumps(payload["changeset"], indent=2), encoding="utf-8")
    return p1, p2, p3
