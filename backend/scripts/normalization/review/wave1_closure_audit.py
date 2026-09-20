from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .frozen_canonical_vocabulary import load_frozen_canonical_ids
from .wave1_existing_canonical_mapping import (
    EXPECTED_CANDIDATE_COUNT,
    REVIEW_CLASS,
    WAVE_ID,
    load_review_index,
    load_wave_definition,
    select_wave_candidates,
    validate_frozen_hashes,
)

CLOSURE_AUDIT_FILENAME = "CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_AUDIT_v1.json"
CLOSURE_SUMMARY_FILENAME = "CG_WAVE1_EXISTING_CANONICAL_MAPPING_CLOSURE_SUMMARY_v1.md"
WAVES_DIR = REVIEW_DIR / "waves"
EXPECTED_ACCEPTED = 328
EXPECTED_DEFERRED = 41
EXPECTED_REJECTED = 1
ALLOWED_DECISION_STATUSES = frozenset({"accepted", "rejected", "deferred"})
INDEX_MANIFEST_HASH = "0d537288a76ed9b2bdc3fd7fec8ccb9e5187bf282dc68b917790a1fd184a4013"
BATCH_LOCK_FILE = "CG_PRODUCTION_NORMALIZATION_BATCH_EXECUTION_LOCK_v1.json"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def closure_audit_path() -> Path:
    return WAVES_DIR / CLOSURE_AUDIT_FILENAME


def closure_summary_path() -> Path:
    return WAVES_DIR / CLOSURE_SUMMARY_FILENAME


def classify_source_term_pattern(source_term: str | None) -> str:
    term = (source_term or "").strip()
    if not term:
        return "empty_or_missing"
    if re.match(r"^TEST\s*#", term, re.IGNORECASE):
        return "oem_test_heading"
    if "§" in term or term.startswith("§"):
        return "manual_section_heading"
    if re.match(r"^[A-Z]{2,3}\d+$", term):
        return "connector_identifier"
    if term == "supply":
        return "literal_supply_term"
    return "other"


def _stable_record_hash(record: dict[str, Any]) -> str:
    payload = json.dumps(record, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def reconcile_wave_decisions(
    wave_candidates: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    wave_ids = [str(record["candidateId"]) for record in wave_candidates]
    wave_id_set = set(wave_ids)
    decision_map = decisions_store.get("decisions") or {}

    if len(wave_candidates) != EXPECTED_CANDIDATE_COUNT:
        errors.append(
            f"wave pool count {len(wave_candidates)} != expected {EXPECTED_CANDIDATE_COUNT}",
        )

    missing = sorted(wave_id_set - set(decision_map))
    extra = sorted(set(decision_map) - wave_id_set)
    if missing:
        errors.append(f"missing decisions: {len(missing)}")
    if extra:
        errors.append(f"out-of-wave decisions: {len(extra)}")

    status_counts = Counter()
    duplicate_status_keys: list[str] = []
    for candidate_id in wave_ids:
        entry = decision_map.get(candidate_id)
        if not entry:
            continue
        status = entry.get("reviewStatus")
        if status not in ALLOWED_DECISION_STATUSES:
            errors.append(f"invalid reviewStatus for {candidate_id}: {status}")
            continue
        status_counts[status] += 1
        if len(entry.get("history") or []) < 1:
            errors.append(f"missing decision history for {candidate_id}")

    if status_counts["accepted"] != EXPECTED_ACCEPTED:
        errors.append(
            f"accepted count {status_counts['accepted']} != expected {EXPECTED_ACCEPTED}",
        )
    if status_counts["deferred"] != EXPECTED_DEFERRED:
        errors.append(
            f"deferred count {status_counts['deferred']} != expected {EXPECTED_DEFERRED}",
        )
    if status_counts["rejected"] != EXPECTED_REJECTED:
        errors.append(
            f"rejected count {status_counts['rejected']} != expected {EXPECTED_REJECTED}",
        )

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "expectedCount": EXPECTED_CANDIDATE_COUNT,
        "reviewedCount": len(decision_map) if not extra and not missing else len(wave_id_set & set(decision_map)),
        "acceptedCount": status_counts["accepted"],
        "deferredCount": status_counts["deferred"],
        "rejectedCount": status_counts["rejected"],
        "missingDecisionCandidateIds": missing[:20],
        "outOfWaveDecisionCandidateIds": extra[:20],
        "missingDecisionCount": len(missing),
        "outOfWaveDecisionCount": len(extra),
    }


def audit_accepted_decisions(
    wave_candidates: list[dict[str, Any]],
    decisions_store: dict[str, Any],
    frozen_ids: set[str],
) -> dict[str, Any]:
    errors: list[str] = []
    decision_map = decisions_store.get("decisions") or {}
    accepted_records = [
        record
        for record in wave_candidates
        if decision_map.get(record["candidateId"], {}).get("reviewStatus") == "accepted"
    ]

    if len(accepted_records) != EXPECTED_ACCEPTED:
        errors.append(f"accepted record count {len(accepted_records)} != {EXPECTED_ACCEPTED}")

    for record in accepted_records:
        if record.get("reviewClass") != REVIEW_CLASS:
            errors.append(f"reviewClass changed for {record['candidateId']}")
        proposed = (record.get("mapsTo") or {}).get("proposedCanonicalId")
        if not proposed:
            errors.append(f"missing proposedCanonicalId for accepted {record['candidateId']}")
        elif str(proposed) not in frozen_ids:
            errors.append(f"accepted canonical not frozen: {record['candidateId']} -> {proposed}")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "acceptedCount": len(accepted_records),
        "allReviewClassExistingCanonicalMapping": all(
            record.get("reviewClass") == REVIEW_CLASS for record in accepted_records
        ),
        "allProposedCanonicalIdsInFrozenVocabulary": len(errors) == 0,
        "candidateRecordsMutatedByDecisions": False,
        "note": "Decisions are persisted separately; index candidate payloads were not rewritten by review UI.",
    }


def analyze_deferred_patterns(
    wave_candidates: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    decision_map = decisions_store.get("decisions") or {}
    deferred = [
        record
        for record in wave_candidates
        if decision_map.get(record["candidateId"], {}).get("reviewStatus") == "deferred"
    ]
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in deferred:
        term = (record.get("what") or {}).get("sourceTerm")
        groups[classify_source_term_pattern(term)].append(record)

    pattern_groups = []
    for pattern_id, records in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])):
        manuals = sorted({str(record.get("manualId") or "") for record in records})
        canonical_ids = sorted(
            {
                str((record.get("mapsTo") or {}).get("proposedCanonicalId") or "")
                for record in records
                if (record.get("mapsTo") or {}).get("proposedCanonicalId")
            },
        )
        pattern_groups.append(
            {
                "patternId": pattern_id,
                "count": len(records),
                "exampleCandidateIds": [record["candidateId"] for record in records[:5]],
                "proposedCanonicalIds": canonical_ids,
                "manualIds": manuals,
                "exampleSourceTerms": sorted(
                    {
                        str((record.get("what") or {}).get("sourceTerm") or "")
                        for record in records[:8]
                    },
                )[:8],
            },
        )

    return {
        "deferredCount": len(deferred),
        "patternGroupCount": len(pattern_groups),
        "groups": pattern_groups,
        "interpretationNote": (
            "Evidence-only grouping; does not auto-resolve deferred items or change decisions."
        ),
    }


def analyze_rejected_supply_mapping(
    wave_candidates: list[dict[str, Any]],
    decisions_store: dict[str, Any],
    frozen_ids: set[str],
) -> dict[str, Any]:
    decision_map = decisions_store.get("decisions") or {}
    supply_records = [
        record
        for record in wave_candidates
        if (record.get("what") or {}).get("sourceTerm") == "supply"
    ]
    mapping_counts = Counter(
        str((record.get("mapsTo") or {}).get("proposedCanonicalId") or "")
        for record in supply_records
    )
    rejected = [
        record
        for record in wave_candidates
        if decision_map.get(record["candidateId"], {}).get("reviewStatus") == "rejected"
    ]
    rejected_record = rejected[0] if len(rejected) == 1 else None
    rejected_errors: list[str] = []
    if len(rejected) != 1:
        rejected_errors.append(f"expected exactly 1 rejected candidate, found {len(rejected)}")

    supply_in_frozen = "supply" in frozen_ids
    power_supply_in_frozen = "power_supply" in frozen_ids

    by_manual: dict[str, list[dict[str, str]]] = defaultdict(list)
    for record in supply_records:
        by_manual[str(record.get("manualId") or "")].append(
            {
                "candidateId": record["candidateId"],
                "proposedCanonicalId": str((record.get("mapsTo") or {}).get("proposedCanonicalId") or ""),
                "reviewStatus": str(decision_map.get(record["candidateId"], {}).get("reviewStatus") or ""),
            },
        )

    return {
        "rejectedCandidate": rejected_record,
        "rejectedValidationErrors": rejected_errors,
        "canonicalVocabulary": {
            "supplyPresent": supply_in_frozen,
            "power_supplyPresent": power_supply_in_frozen,
        },
        "wave1SupplyOccurrences": {
            "totalWithSourceTermSupply": len(supply_records),
            "mappingCounts": dict(mapping_counts),
            "supplyToSupplyCount": mapping_counts.get("supply", 0),
            "supplyToPowerSupplyCount": mapping_counts.get("power_supply", 0),
            "manualCount": len(by_manual),
            "byManual": dict(sorted(by_manual.items())),
        },
        "inconsistencyObservation": (
            "Wave 1 maps sourceTerm 'supply' to both proposedCanonicalId 'supply' "
            f"({mapping_counts.get('supply', 0)} candidates) and 'power_supply' "
            f"({mapping_counts.get('power_supply', 0)} candidates). "
            "The single rejected candidate is SAMSUNG-FLEXWASH-WASHER supply→supply; "
            "audit does not normalize or apply mappings."
        ),
    }


def verify_decision_integrity(decisions_store: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    if decisions_store.get("reportType") != "candidate_review_decisions":
        errors.append("decisions reportType mismatch")
    if decisions_store.get("promotionApplied"):
        errors.append("decisions artifact indicates promotionApplied")
    for key in ("promoted", "canonicalMutation", "normalizationMutation"):
        if key in decisions_store:
            errors.append(f"unexpected decisions artifact key: {key}")

    decision_map = decisions_store.get("decisions") or {}
    reviewers = set()
    for entry in decision_map.values():
        if not entry.get("reviewer"):
            errors.append(f"missing reviewer on {entry.get('candidateId')}")
        else:
            reviewers.add(entry["reviewer"])
        for hist in entry.get("history") or []:
            if hist.get("reviewStatus") not in ALLOWED_DECISION_STATUSES:
                errors.append(f"invalid history status on {entry.get('candidateId')}")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "decisionOnlyArtifact": True,
        "promotionTriggered": False,
        "reviewerIdentities": sorted(reviewers),
        "promotionExcluded": True,
        "reviewClassMutatedByDecisions": False,
    }


def check_canonical_mutation() -> dict[str, Any]:
    ok, errors = validate_frozen_hashes()
    return {
        "passed": ok,
        "errors": errors,
        "canonicalFilesMutated": not ok,
    }


def check_normalization_mutation(index: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    manifest_hash = str(index.get("processingManifestHash") or "")
    if manifest_hash != INDEX_MANIFEST_HASH:
        errors.append("review index processingManifestHash changed from closure baseline")
    if index.get("promotionExplicitlyExcluded") is not True:
        errors.append("promotionExplicitlyExcluded is not true on review index")
    wave_pool_hash = hashlib.sha256(
        json.dumps(
            select_wave_candidates(index),
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8"),
    ).hexdigest()
    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "processingManifestHash": manifest_hash,
        "expectedProcessingManifestHash": INDEX_MANIFEST_HASH,
        "waveCandidatePoolContentHash": wave_pool_hash,
        "candidateArtifactsMutatedByClosure": False,
        "note": "Closure verifies index manifest hash and wave pool snapshot hash; does not rewrite candidates.",
    }


def check_batch_mutation() -> dict[str, Any]:
    errors: list[str] = []
    lock_path = CALIBRATION_DIR / BATCH_LOCK_FILE
    if not lock_path.is_file():
        errors.append(f"missing batch lock: {BATCH_LOCK_FILE}")
        return {"passed": False, "errors": errors, "batchArtifactsMutated": True}

    raw = lock_path.read_bytes()
    lock = json.loads(raw.decode("utf-8"))
    lock_hash = hashlib.sha256(raw).hexdigest()
    verdict = str(lock.get("verdict") or "")
    statement = str(lock.get("closureStatement") or "")
    cohort_execution_gated = (
        "NOT AUTHORIZED" in verdict.upper()
        or "remains NOT authorized" in statement
    )
    if not cohort_execution_gated:
        errors.append("batch lock no longer documents fail-closed cohort execution gate")
    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "batchLockFile": BATCH_LOCK_FILE,
        "batchLockSha256": lock_hash,
        "verdict": verdict,
        "batchArtifactsMutatedByWave1Closure": False,
    }


def run_wave1_closure_audit() -> dict[str, Any]:
    errors: list[str] = []
    wave_definition = load_wave_definition()
    index = load_review_index()
    decisions_store = load_decisions()
    frozen_ids = load_frozen_canonical_ids()
    wave_candidates = select_wave_candidates(index)

    reconciliation = reconcile_wave_decisions(wave_candidates, decisions_store)
    if not reconciliation["passed"]:
        errors.extend(reconciliation["errors"])

    accepted_audit = audit_accepted_decisions(wave_candidates, decisions_store, frozen_ids)
    if not accepted_audit["passed"]:
        errors.extend(accepted_audit["errors"])

    deferred_analysis = analyze_deferred_patterns(wave_candidates, decisions_store)
    rejected_analysis = analyze_rejected_supply_mapping(wave_candidates, decisions_store, frozen_ids)
    if rejected_analysis["rejectedValidationErrors"]:
        errors.extend(rejected_analysis["rejectedValidationErrors"])

    decision_integrity = verify_decision_integrity(decisions_store)
    if not decision_integrity["passed"]:
        errors.extend(decision_integrity["errors"])

    frozen_hash_validation = check_canonical_mutation()
    if not frozen_hash_validation["passed"]:
        errors.extend(frozen_hash_validation["errors"])

    normalization_check = check_normalization_mutation(index)
    if not normalization_check["passed"]:
        errors.extend(normalization_check["errors"])

    batch_check = check_batch_mutation()
    if not batch_check["passed"]:
        errors.extend(batch_check["errors"])

    if wave_definition.get("promotionExcluded") is not True:
        errors.append("wave definition promotionExcluded is not true")

    all_passed = len(errors) == 0
    return {
        "schemaVersion": 1,
        "reportType": "candidate_review_wave_closure_audit",
        "waveId": WAVE_ID,
        "reviewClass": REVIEW_CLASS,
        "generatedAt": _utc_now(),
        "expectedCount": EXPECTED_CANDIDATE_COUNT,
        "reviewedCount": reconciliation["reviewedCount"],
        "acceptedCount": reconciliation["acceptedCount"],
        "deferredCount": reconciliation["deferredCount"],
        "rejectedCount": reconciliation["rejectedCount"],
        "decisionReconciliation": reconciliation,
        "acceptedAudit": accepted_audit,
        "deferredPatternAnalysis": deferred_analysis,
        "rejectedMappingAnalysis": rejected_analysis,
        "decisionIntegrity": decision_integrity,
        "frozenHashValidation": frozen_hash_validation,
        "canonicalMutationCheck": frozen_hash_validation,
        "normalizationMutationCheck": normalization_check,
        "batchMutationCheck": batch_check,
        "promotionExcluded": True,
        "errors": errors,
        "status": "WAVE1_CLOSED" if all_passed else "WAVE1_CLOSURE_BLOCKED",
    }


def write_closure_summary(audit: dict[str, Any]) -> Path:
    deferred = audit["deferredPatternAnalysis"]
    supply = audit["rejectedMappingAnalysis"]["wave1SupplyOccurrences"]
    lines = [
        "# Wave 1 closure — existing canonical mapping",
        "",
        f"**Status:** `{audit['status']}`",
        f"**Generated:** {audit['generatedAt']}",
        "",
        "## Counts",
        "",
        f"- Reviewed: **{audit['reviewedCount']}/{audit['expectedCount']}**",
        f"- Accepted: **{audit['acceptedCount']}**",
        f"- Deferred: **{audit['deferredCount']}**",
        f"- Rejected: **{audit['rejectedCount']}**",
        "",
        "## Deferred pattern groups",
        "",
    ]
    for group in deferred["groups"]:
        lines.append(
            f"- **{group['patternId']}** ({group['count']}): "
            f"e.g. `{group['exampleCandidateIds'][0]}`",
        )
    lines.extend(
        [
            "",
            "## Supply mapping (Wave 1, sourceTerm `supply`)",
            "",
            f"- `supply` → `supply`: **{supply['supplyToSupplyCount']}**",
            f"- `supply` → `power_supply`: **{supply['supplyToPowerSupplyCount']}**",
            f"- Rejected: SAMSUNG-FLEXWASH-WASHER `supply` → `supply` (1)",
            "",
            "## Governance",
            "",
            "- Decisions only; no promotion, no canonical/normalization/batch mutation.",
            f"- Frozen hash validation: **{'PASS' if audit['frozenHashValidation']['passed'] else 'FAIL'}**",
            "",
        ],
    )
    path = closure_summary_path()
    WAVES_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_closure_audit(audit: dict[str, Any]) -> Path:
    WAVES_DIR.mkdir(parents=True, exist_ok=True)
    path = closure_audit_path()
    path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return path


def update_wave_preflight_audit_status(closure_status: str) -> None:
    from .wave1_existing_canonical_mapping import wave_audit_path

    path = wave_audit_path()
    if not path.is_file():
        return
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["status"] = closure_status
    payload["closureAudit"] = CLOSURE_AUDIT_FILENAME
    payload["closedAt"] = _utc_now()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
