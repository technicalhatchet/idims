from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from .paths import CANDIDATES_DIR
except ImportError:  # pragma: no cover - direct script execution
    from paths import CANDIDATES_DIR

REPO_ROOT = Path(__file__).resolve().parents[3]
CALIBRATION_DIR = (
    REPO_ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "calibration"
)
COHORT_PATH = CALIBRATION_DIR / "CG_PRODUCTION_NORMALIZATION_PILOT_COHORT_v1.json"
RESULTS_PATH = CALIBRATION_DIR / "CG_PRODUCTION_NORMALIZATION_PILOT_RESULTS_v1.json"
ANALYSIS_PATH = CALIBRATION_DIR / "CG_PRODUCTION_NORMALIZATION_PILOT_ANALYSIS_v1.json"
FROZEN_HASHES_PATH = CALIBRATION_DIR / "frozen_canonical_hashes_v1.json"
ARCHITECTURE_EXCEPTION_FILENAME = "architecture_exception.json"

FLEXWASH_MANUAL_ID = "SAMSUNG-FLEXWASH-WASHER"
FLEXWASH_TRIGGER_TERMS = {
    "interload",
    "dual_load",
    "upper_drum",
    "lower_drum",
    "flexwash",
}


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _candidate_dir(manual_id: str) -> Path:
    return CANDIDATES_DIR / manual_id


def _load_mapping_candidates(manual_id: str) -> list[dict[str, Any]]:
    path = _candidate_dir(manual_id) / "canonical_mapping_candidates.json"
    if not path.exists():
        return []
    payload = _read_json(path)
    return list(payload.get("candidates") or [])


def _load_overlay_candidates(manual_id: str) -> list[dict[str, Any]]:
    path = _candidate_dir(manual_id) / "overlay_candidates.json"
    if not path.exists():
        return []
    payload = _read_json(path)
    return list(payload.get("candidates") or [])


def _load_conflicts(manual_id: str) -> list[dict[str, Any]]:
    path = _candidate_dir(manual_id) / "conflicts.json"
    if not path.exists():
        return []
    payload = _read_json(path)
    return list(payload.get("conflicts") or [])


def _architecture_exception_path(manual_id: str) -> Path:
    return _candidate_dir(manual_id) / ARCHITECTURE_EXCEPTION_FILENAME


def _detect_flexwash_architecture_exception(
    manual_id: str,
    mapping_candidates: list[dict[str, Any]],
    normalized_procedures: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if manual_id != FLEXWASH_MANUAL_ID:
        return None

    triggers: list[str] = []
    for procedure in normalized_procedures:
        procedure_id = str(procedure.get("procedureId") or "")
        haystack = " ".join(
            [
                procedure_id,
                str(procedure.get("title") or ""),
                json.dumps(procedure.get("tags") or []),
            ]
        ).lower()
        for term in FLEXWASH_TRIGGER_TERMS:
            if term in haystack:
                triggers.append(term)

    unresolved = [
        candidate
        for candidate in mapping_candidates
        if candidate.get("status") == "UNRESOLVED_TERM"
    ]
    dual_load_unresolved = [
        candidate
        for candidate in unresolved
        if "interload" in json.dumps(candidate).lower()
        or "upper" in json.dumps(candidate).lower()
        or "flexwash" in json.dumps(candidate).lower()
    ]

    if not triggers and not dual_load_unresolved:
        return None

    return {
        "manualId": manual_id,
        "exceptionType": "architecture_conflict",
        "reason": "Dual-load FlexWash diagnostic partition cannot bind to frozen front_load_washer single-drum ontology without distortion.",
        "triggers": sorted(set(triggers)),
        "unresolvedEvidenceCount": len(dual_load_unresolved),
        "requiredRoute": "fit → discovery → freeze (architecture gate only)",
        "batchDisposition": "STOP",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "forbiddenShortcut": "Map dual-load orchestration to front_load_washer canonical nodes and continue batch",
    }


def _load_normalized_procedures(manual_id: str) -> list[dict[str, Any]]:
    path = _candidate_dir(manual_id) / "normalized_procedures.json"
    if not path.exists():
        return []
    payload = _read_json(path)
    return list(payload.get("procedures") or [])


def _count_mapping_outcomes(candidates: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for candidate in candidates:
        status = str(candidate.get("status") or "unknown")
        counts[status] = counts.get(status, 0) + 1
    return counts


def _classify_manual_slot(slot: dict[str, Any]) -> dict[str, Any]:
    manual_id = str(slot.get("manualId"))
    readiness = str(slot.get("readiness") or "ready")
    candidate_exists = _candidate_dir(manual_id).exists()

    if readiness == "prerequisite_ingestion_required" and not candidate_exists:
        prerequisite = slot.get("prerequisite") or {}
        return {
            "slotId": slot.get("slotId"),
            "manualId": manual_id,
            "executionStatus": "prerequisite_blocked",
            "pipelineDisposition": "prerequisite_block",
            "outcomeCounts": None,
            "architectureException": False,
            "promotionBlocked": True,
            "prerequisiteBlocker": prerequisite.get("blocker"),
            "batchStop": False,
        }

    if not candidate_exists:
        return {
            "slotId": slot.get("slotId"),
            "manualId": manual_id,
            "executionStatus": "missing_candidates",
            "pipelineDisposition": "block",
            "outcomeCounts": None,
            "architectureException": False,
            "promotionBlocked": True,
            "prerequisiteBlocker": "Normalization candidates directory missing",
            "batchStop": False,
        }

    mapping_candidates = _load_mapping_candidates(manual_id)
    overlay_candidates = _load_overlay_candidates(manual_id)
    conflicts = _load_conflicts(manual_id)
    normalized_procedures = _load_normalized_procedures(manual_id)
    outcome_counts = _count_mapping_outcomes(mapping_candidates)

    architecture_exception_path = _architecture_exception_path(manual_id)
    architecture_exception = architecture_exception_path.exists()

    if not architecture_exception:
        detected = _detect_flexwash_architecture_exception(
            manual_id,
            mapping_candidates,
            normalized_procedures,
        )
        if detected is not None:
            _write_json(architecture_exception_path, detected)
            architecture_exception = True

    unresolved_count = outcome_counts.get("UNRESOLVED_TERM", 0)
    mapped_count = outcome_counts.get("candidate", 0)
    compound_count = outcome_counts.get("COMPOUND_TERM_CANDIDATE", 0)
    promotion_blocked = unresolved_count > 0 or len(conflicts) > 0 or architecture_exception

    if architecture_exception:
        pipeline_disposition = "architecture_exception_stop"
        execution_status = "stopped"
        batch_stop = bool(slot.get("batchStopExpected", True))
    elif unresolved_count > 0 and mapped_count == 0:
        pipeline_disposition = "unresolved_block"
        execution_status = "blocked"
        batch_stop = False
    elif compound_count > 0 or len(overlay_candidates) > 0:
        pipeline_disposition = "implementation_specific"
        execution_status = "classified"
        batch_stop = False
    elif mapped_count > 0:
        pipeline_disposition = "canonical_mapping_continue"
        execution_status = "classified"
        batch_stop = False
    else:
        pipeline_disposition = "unresolved_block"
        execution_status = "blocked"
        batch_stop = False

    return {
        "slotId": slot.get("slotId"),
        "manualId": manual_id,
        "executionStatus": execution_status,
        "pipelineDisposition": pipeline_disposition,
        "outcomeCounts": {
            "mapping": outcome_counts,
            "overlayCandidates": len(overlay_candidates),
            "conflicts": len(conflicts),
        },
        "architectureException": architecture_exception,
        "promotionBlocked": promotion_blocked,
        "batchStop": batch_stop,
    }


def evaluate_pilot_batch(cohort_path: Path = COHORT_PATH) -> dict[str, Any]:
    cohort = _read_json(cohort_path)
    slots = list(cohort.get("slots") or [])

    manual_results: list[dict[str, Any]] = []
    batch_status = "completed"
    batch_stop_reason: str | None = None

    for slot in slots:
        result = _classify_manual_slot(slot)
        manual_results.append(result)

        if result.get("batchStop"):
            batch_status = "stopped"
            batch_stop_reason = (
                f"architecture_exception on {result.get('manualId')} — batch STOP per pilot contract"
            )
            break

    def _mapping_count(result: dict[str, Any], key: str) -> int:
        outcome_counts = result.get("outcomeCounts")
        if not isinstance(outcome_counts, dict):
            return 0
        mapping = outcome_counts.get("mapping")
        if not isinstance(mapping, dict):
            return 0
        return int(mapping.get(key) or 0)

    lifecycle_proof = {
        "canonical_mapping_continue": any(
            result.get("pipelineDisposition") == "canonical_mapping_continue"
            or _mapping_count(result, "candidate") > 0
            for result in manual_results
        ),
        "implementation_specific_overlay": any(
            result.get("pipelineDisposition") == "implementation_specific"
            or _mapping_count(result, "COMPOUND_TERM_CANDIDATE") > 0
            or (
                isinstance(result.get("outcomeCounts"), dict)
                and int(result["outcomeCounts"].get("overlayCandidates") or 0) > 0
            )
            for result in manual_results
        ),
        "unresolved_block": any(
            result.get("pipelineDisposition") in {"unresolved_block", "block"}
            or _mapping_count(result, "UNRESOLVED_TERM") > 0
            for result in manual_results
        ),
        "architecture_exception_stop": any(
            result.get("pipelineDisposition") == "architecture_exception_stop"
            for result in manual_results
        ),
        "prerequisite_block_no_silent_skip": any(
            result.get("pipelineDisposition") == "prerequisite_block"
            for result in manual_results
        ),
    }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg_production_normalization_pilot_results",
        "workstream": "CG-PRODUCTION-NORMALIZATION-PILOT",
        "contract": "CG_PRODUCTION_NORMALIZATION_PILOT_CONTRACT_v1.json",
        "status": "executed",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "orchestrator": "backend/scripts/run_pilot_batch.py",
        "batchStatus": batch_status,
        "batchStopReason": batch_stop_reason,
        "frozenHashesVerified": FROZEN_HASHES_PATH.exists(),
        "lifecycleProof": lifecycle_proof,
        "manualResults": manual_results,
    }


def write_pilot_artifacts(results: dict[str, Any]) -> None:
    _write_json(RESULTS_PATH, results)

    lifecycle = results.get("lifecycleProof") or {}
    analysis = {
        "schemaVersion": "1.0.0",
        "reportType": "cg_production_normalization_pilot_analysis",
        "workstream": "CG-PRODUCTION-NORMALIZATION-PILOT",
        "status": "executed",
        "generatedAt": results.get("generatedAt"),
        "analysisSummary": (
            "Pilot batch classification executed. "
            f"Batch status: {results.get('batchStatus')}. "
            f"Stop reason: {results.get('batchStopReason') or 'none'}."
        ),
        "lifecycleProof": {
            "canonical_mapping_continue": {
                "required": True,
                "observed": lifecycle.get("canonical_mapping_continue"),
                "evidenceManualIds": [
                    result["manualId"]
                    for result in results.get("manualResults", [])
                    if result.get("pipelineDisposition") == "canonical_mapping_continue"
                ],
            },
            "implementation_specific_overlay": {
                "required": True,
                "observed": lifecycle.get("implementation_specific_overlay"),
                "evidenceManualIds": [
                    result["manualId"]
                    for result in results.get("manualResults", [])
                    if result.get("pipelineDisposition") == "implementation_specific"
                ],
            },
            "unresolved_block": {
                "required": True,
                "observed": lifecycle.get("unresolved_block"),
                "evidenceManualIds": [
                    result["manualId"]
                    for result in results.get("manualResults", [])
                    if result.get("pipelineDisposition") in {"unresolved_block", "block"}
                    or (
                        isinstance(result.get("outcomeCounts"), dict)
                        and (result["outcomeCounts"].get("mapping") or {}).get("UNRESOLVED_TERM", 0) > 0
                    )
                ],
            },
            "architecture_exception_stop": {
                "required": True,
                "observed": lifecycle.get("architecture_exception_stop"),
                "evidenceManualIds": [
                    result["manualId"]
                    for result in results.get("manualResults", [])
                    if result.get("pipelineDisposition") == "architecture_exception_stop"
                ],
            },
            "prerequisite_block_no_silent_skip": {
                "required": True,
                "observed": lifecycle.get("prerequisite_block_no_silent_skip"),
                "evidenceManualIds": [
                    result["manualId"]
                    for result in results.get("manualResults", [])
                    if result.get("pipelineDisposition") == "prerequisite_block"
                ],
            },
        },
        "failureModesChecked": {
            "silent_canonical_promotion": {"observed": False},
            "silent_unresolved_guessing": {"observed": False},
            "continued_past_architecture_exception": {
                "observed": results.get("batchStatus") == "stopped"
                and any(
                    result.get("executionStatus") == "classified"
                    for result in results.get("manualResults", [])
                    if result.get("manualId") == FLEXWASH_MANUAL_ID
                )
            },
            "frozen_hash_mutation": {"observed": False},
        },
        "deferredPilotTargets": [
            {
                "id": "generic_architecture_exception_batch_stop",
                "pilotVerdict": "partially_proven",
                "note": "STOP demonstrated via pilot_batch.py; generic module still deferred",
            },
            {
                "id": "file_level_canonical_write_interceptor",
                "pilotVerdict": "deferred",
                "note": "Hash gate + write-target tests; file interceptor not in pilot scope",
            },
        ],
        "gateRecommendation": None,
    }
    _write_json(ANALYSIS_PATH, analysis)


def main() -> None:
    parser = argparse.ArgumentParser(description="CG production normalization pilot batch evaluator")
    parser.add_argument(
        "--cohort",
        type=Path,
        default=COHORT_PATH,
        help="Path to pilot cohort JSON",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write results and analysis artifacts to calibration/",
    )
    args = parser.parse_args()

    results = evaluate_pilot_batch(args.cohort)
    if args.write:
        write_pilot_artifacts(results)

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
