from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR
from .candidate_review_decisions import (
    decisions_path,
    load_decisions,
    merge_decisions_into_records,
)
from .candidate_review_preflight import INDEX_FILENAME, run_preflight
from .frozen_canonical_vocabulary import load_frozen_canonical_ids

DEFAULT_BATCH_RUN_ID = "batch-20260918-5d213986"
DEFAULT_PROCESSING_MANIFEST_HASH = (
    "0d537288a76ed9b2bdc3fd7fec8ccb9e5187bf282dc68b917790a1fd184a4013"
)
OBSERVATION_RUN_PATH = (
    CALIBRATION_DIR / "batch_runs" / "CG_PRODUCTION_NORMALIZATION_BATCH_OBSERVATION_RUN_v1.json"
)
RESUME_AUTH_PATH = (
    CALIBRATION_DIR
    / "CG_PRODUCTION_NORMALIZATION_BATCH_RESUME_AUTHORIZATION_batch-20260918-5d213986.json"
)

REVIEW_CLASSES = (
    "inheritedKnowledge",
    "existingCanonicalMapping",
    "newPlatformKnowledge",
    "newCanonicalKnowledge",
    "implementationSpecific",
    "unresolved",
    "architectureException",
)

ARTIFACT_SOURCES = (
    "canonical_mapping",
    "overlay",
    "architecture_exception",
)

COLLISION_MANUALS: set[str] = set()


def index_path() -> Path:
    return REVIEW_DIR / INDEX_FILENAME


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _stable_candidate_id(
    manual_id: str,
    artifact_source: str,
    raw_id: str | None,
    fallback_key: str,
    collision_registry: dict[str, int],
) -> tuple[str, bool]:
    base = raw_id or f"generated-{hashlib.sha256(fallback_key.encode()).hexdigest()[:16]}"
    registry_key = f"{manual_id}::{artifact_source}::{base}"
    seen = collision_registry.get(registry_key, 0)
    collision_registry[registry_key] = seen + 1
    if seen == 0:
        return registry_key, False
    COLLISION_MANUALS.add(manual_id)
    return f"{registry_key}::dup{seen + 1}", True


def _load_inheritance_context(manual_dir: Path) -> dict[str, Any]:
    context: dict[str, Any] = {"by_procedure": {}, "seed_source_manual_id": None}
    procedures_path = manual_dir / "normalized_procedures.json"
    if not procedures_path.is_file():
        return context

    payload = _read_json(procedures_path)
    for procedure in payload.get("procedures") or []:
        procedure_id = procedure.get("procedureId")
        if not procedure_id:
            continue
        provenance = procedure.get("provenance") or {}
        source = procedure.get("source") or {}
        inherited = (
            provenance.get("inheritedFromManualId")
            or procedure.get("inheritedFromManualId")
            or source.get("inheritedFromManualId")
        )
        seed = (
            provenance.get("seedSourceManualId")
            or procedure.get("seedSourceManualId")
            or source.get("seedSourceManualId")
        )
        for provenance_source in provenance.get("sources") or []:
            if provenance_source.get("type") != "inherited_procedure":
                continue
            inherited = inherited or provenance_source.get("inheritedFromManualId")
            seed = seed or provenance_source.get("seedSourceManualId") or inherited
        if inherited or seed:
            context["by_procedure"][procedure_id] = {
                "inheritedFromManualId": inherited,
                "seedSourceManualId": seed,
            }
            if seed and not context["seed_source_manual_id"]:
                context["seed_source_manual_id"] = seed
    return context


def _procedure_inheritance_from_manifest(manual_id: str, manifest: dict[str, Any]) -> dict[str, str | None]:
    for entry in manifest.get("manuals") or []:
        if entry.get("manualId") != manual_id:
            continue
        inheritance = entry.get("procedureInheritance") or {}
        seed = inheritance.get("seedSourceManualId") or inheritance.get("inheritedFromManualId")
        return {
            "inheritedFromManualId": inheritance.get("inheritedFromManualId") or seed,
            "seedSourceManualId": seed,
        }
    return {"inheritedFromManualId": None, "seedSourceManualId": None}


def _has_explicit_new_canonical_abstraction_evidence(candidate: dict[str, Any]) -> bool:
    """Only established candidate fields — no invented architecture inference."""
    if candidate.get("exceptionType") == "architecture_conflict" and candidate.get("requiredRoute"):
        return True
    return False


def classify_review_class(
    candidate: dict[str, Any],
    *,
    artifact_source: str,
    inheritance_context: dict[str, Any],
    frozen_canonical_ids: frozenset[str] | None = None,
) -> str:
    if artifact_source == "architecture_exception":
        return "architectureException"

    provenance = candidate.get("provenance") or {}
    procedure_id = provenance.get("procedureId") or candidate.get("procedureId")
    raw_status = str(candidate.get("status") or "")

    inherited = provenance.get("inheritedFromManualId")
    seed = provenance.get("seedSourceManualId")
    proc_inheritance = (inheritance_context.get("by_procedure") or {}).get(procedure_id) or {}
    if (
        inherited
        or seed
        or proc_inheritance.get("inheritedFromManualId")
        or inheritance_context.get("manual_inherited_from")
    ):
        return "inheritedKnowledge"

    if raw_status == "COMPOUND_TERM_CANDIDATE":
        return "implementationSpecific"

    if raw_status in {"UNRESOLVED_TERM", "CONFLICT_REQUIRES_REVIEW", "FILTERED_NOISE"}:
        return "unresolved"

    if artifact_source == "overlay":
        return "newPlatformKnowledge"

    if artifact_source == "canonical_mapping" and raw_status == "candidate":
        canonical_id = candidate.get("canonicalId")
        if canonical_id:
            frozen_ids = frozen_canonical_ids or load_frozen_canonical_ids()
            if str(canonical_id) in frozen_ids:
                return "existingCanonicalMapping"
        if _has_explicit_new_canonical_abstraction_evidence(candidate):
            return "newCanonicalKnowledge"

    return "unresolved"


def _compute_promotion_blocked(manual_dir: Path, architecture_exception: dict[str, Any] | None) -> bool:
    if architecture_exception:
        return True
    mapping_path = manual_dir / "canonical_mapping_candidates.json"
    if mapping_path.is_file():
        candidates = _read_json(mapping_path).get("candidates") or []
        if any(c.get("status") == "UNRESOLVED_TERM" for c in candidates):
            return True
    conflicts_path = manual_dir / "conflicts.json"
    if conflicts_path.is_file():
        conflicts = _read_json(conflicts_path).get("conflicts") or []
        if conflicts:
            return True
    return False


def _build_candidate_record(
    candidate: dict[str, Any],
    *,
    manual_id: str,
    artifact_source: str,
    batch_run_id: str,
    processing_manifest_hash: str,
    inheritance_context: dict[str, Any],
    promotion_blocked: bool,
    platform_id: str | None,
    collision_registry: dict[str, str],
    architecture_exception: dict[str, Any] | None = None,
) -> dict[str, Any]:
    provenance = candidate.get("provenance") or {}
    procedure_id = provenance.get("procedureId") or candidate.get("procedureId")
    proc_inheritance = (inheritance_context.get("by_procedure") or {}).get(procedure_id) or {}
    fallback_key = json.dumps(
        {
            "manualId": manual_id,
            "artifactSource": artifact_source,
            "candidate": candidate,
        },
        sort_keys=True,
    )
    candidate_id, id_collision = _stable_candidate_id(
        manual_id,
        artifact_source,
        candidate.get("id"),
        fallback_key,
        collision_registry,
    )
    review_class = classify_review_class(
        candidate,
        artifact_source=artifact_source,
        inheritance_context=inheritance_context,
    )
    proposed = (
        candidate.get("canonicalId")
        or candidate.get("canonicalTestTarget")
        or candidate.get("measurementKnowledgeId")
    )
    return {
        "candidateId": candidate_id,
        "rawCandidateId": candidate.get("id"),
        "idCollisionDisambiguated": id_collision,
        "manualId": manual_id,
        "artifactSource": artifact_source,
        "what": {
            "sourceTerm": candidate.get("sourceTerm") or candidate.get("displayTitle") or candidate.get("id"),
            "procedureId": procedure_id,
            "manualId": manual_id,
        },
        "where": {
            "pages": provenance.get("pages") or [],
            "provenanceSources": provenance.get("sources") or [],
            "extractionDoc": next(
                (
                    source.get("path")
                    for source in (provenance.get("sources") or [])
                    if source.get("type") == "extraction_doc"
                ),
                None,
            ),
        },
        "mapsTo": {
            "proposedCanonicalId": proposed,
            "mappingType": candidate.get("mappingType"),
            "candidateType": candidate.get("candidateType") or candidate.get("exceptionType"),
        },
        "why": {
            "confidence": candidate.get("confidence"),
            "reason": candidate.get("reason")
            or (architecture_exception.get("reason") if architecture_exception else None),
            "blockedReason": candidate.get("blockedReason"),
            "matchedPhrase": candidate.get("matchedPhrase"),
            "decomposition": candidate.get("decomposition"),
            "candidateStatus": candidate.get("status"),
        },
        "blockers": {
            "blockedReason": candidate.get("blockedReason"),
            "promotionBlocked": promotion_blocked,
            "conflicts": [],
        },
        "context": {
            "platformId": platform_id or provenance.get("platformId"),
            "inheritedFromManualId": (
                provenance.get("inheritedFromManualId")
                or proc_inheritance.get("inheritedFromManualId")
            ),
            "seedSourceManualId": (
                provenance.get("seedSourceManualId")
                or proc_inheritance.get("seedSourceManualId")
                or inheritance_context.get("seed_source_manual_id")
            ),
            "reviewClass": review_class,
            "implementationContext": {
                "ontologyId": candidate.get("ontologyId"),
                "templateId": candidate.get("templateId"),
            },
            "architectureException": architecture_exception if artifact_source == "architecture_exception" else None,
        },
        "decision": {
            "reviewStatus": "unreviewed",
        },
        "reviewClass": review_class,
        "reviewStatus": "unreviewed",
        "candidateStatus": candidate.get("status"),
        "batchRunId": batch_run_id,
        "processingManifestHash": processing_manifest_hash,
        "sourceArtifacts": [
            f"normalization/candidates/{manual_id}/canonical_mapping_candidates.json"
            if artifact_source == "canonical_mapping"
            else f"normalization/candidates/{manual_id}/overlay_candidates.json"
            if artifact_source == "overlay"
            else f"normalization/candidates/{manual_id}/architecture_exception.json",
        ],
    }


def _latest_audit_per_manual(audits: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for audit in audits:
        manual_id = str(audit.get("manualId") or "")
        if manual_id:
            latest[manual_id] = audit
    return latest


def _observation_audit_map() -> dict[str, dict[str, Any]]:
    if not OBSERVATION_RUN_PATH.is_file():
        return {}
    payload = _read_json(OBSERVATION_RUN_PATH)
    return _latest_audit_per_manual(payload.get("manualAudits") or [])


def _checkpoint_audit_map(batch_run_id: str) -> dict[str, dict[str, Any]]:
    checkpoint_path = CALIBRATION_DIR / f"CG_PRODUCTION_NORMALIZATION_BATCH_CHECKPOINT_{batch_run_id}.json"
    if not checkpoint_path.is_file():
        return {}
    payload = _read_json(checkpoint_path)
    audits = payload.get("manualAudits") or []
    grouped: dict[str, list[dict[str, Any]]] = {}
    for audit in audits:
        manual_id = str(audit.get("manualId") or "")
        grouped.setdefault(manual_id, []).append(audit)
    latest: dict[str, dict[str, Any]] = {}
    for manual_id, entries in grouped.items():
        latest[manual_id] = entries[-1]
    return latest


def _current_candidate_state(manual_dir: Path) -> dict[str, Any]:
    state: dict[str, Any] = {"manualId": manual_dir.name}
    pipeline_path = manual_dir / "pipeline_manifest.json"
    if pipeline_path.is_file():
        state["pipelineManifest"] = _read_json(pipeline_path)
    mapping_path = manual_dir / "canonical_mapping_candidates.json"
    overlay_path = manual_dir / "overlay_candidates.json"
    arch_path = manual_dir / "architecture_exception.json"
    if mapping_path.is_file():
        state["mappingCandidateCount"] = len(_read_json(mapping_path).get("candidates") or [])
    else:
        state["mappingCandidateCount"] = 0
    if overlay_path.is_file():
        state["overlayCandidateCount"] = len(_read_json(overlay_path).get("candidates") or [])
    else:
        state["overlayCandidateCount"] = 0
    state["hasArchitectureException"] = arch_path.is_file()
    procedures_path = manual_dir / "normalized_procedures.json"
    if procedures_path.is_file():
        state["procedureCount"] = len(_read_json(procedures_path).get("procedures") or [])
    else:
        state["procedureCount"] = 0
    return state


def build_manual_reconciliations(
    *,
    batch_run_id: str,
    manual_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    observation = _observation_audit_map()
    current_audits = _checkpoint_audit_map(batch_run_id)
    resume_auth = _read_json(RESUME_AUTH_PATH) if RESUME_AUTH_PATH.is_file() else {}
    flexwash_clearance = next(
        (
            entry
            for entry in (resume_auth.get("architectureExceptionClearances") or [])
            if entry.get("manualId") == "SAMSUNG-FLEXWASH-WASHER"
        ),
        None,
    )

    reconciliations: list[dict[str, Any]] = []
    target_manuals = manual_ids or sorted(
        path.name
        for path in CANDIDATES_DIR.iterdir()
        if path.is_dir() and not path.name.startswith("_")
    )

    for manual_id in sorted(target_manuals):
        manual_dir = CANDIDATES_DIR / manual_id
        if not manual_dir.is_dir():
            continue

        historical = observation.get(manual_id)
        current_audit = current_audits.get(manual_id)
        current_state = _current_candidate_state(manual_dir)
        drift_detected = False
        if historical and current_state:
            historical_counts = (historical.get("counts") or {})
            if (
                int(historical_counts.get("candidateCount") or 0) != int(current_state.get("mappingCandidateCount") or 0)
                or int(historical_counts.get("overlayCandidateCount") or 0) != int(current_state.get("overlayCandidateCount") or 0)
            ):
                drift_detected = True

        reconciliation: dict[str, Any] = {
            "manualId": manual_id,
            "driftDetected": drift_detected,
            "useForReview": "currentCandidateArtifacts",
            "historicalObservation": historical,
            "currentProcessingAudit": current_audit,
            "currentOnDiskCandidateState": current_state,
        }

        if manual_id == "SAMSUNG-RS22T-SXS":
            reconciliation["reconciliationType"] = "audit_artifact_drift"
            reconciliation["note"] = (
                "Historical observation audit reflects empty run; current on-disk candidates are remediated inherited output."
            )

        if manual_id == "SAMSUNG-FLEXWASH-WASHER":
            reconciliation["reconciliationType"] = "architecture_exception_resume"
            reconciliation["historicalObservation"] = {
                **(historical or {}),
                "batchState": "stopped_trigger",
                "primaryDisposition": "architecture_exception",
            }
            reconciliation["currentResume"] = {
                "batchState": "cleared_stop",
                "primaryDisposition": "skipped_authorized",
                "historicalBatchState": "stopped_trigger",
                "reNormalize": bool((flexwash_clearance or {}).get("reNormalize") is True),
                "skippedReason": (current_audit or {}).get("provenance", {}).get("skippedReason"),
            }

        if drift_detected or manual_id in {"SAMSUNG-RS22T-SXS", "SAMSUNG-FLEXWASH-WASHER"}:
            reconciliations.append(reconciliation)

    return reconciliations


def index_manual_candidates(
    manual_id: str,
    *,
    batch_run_id: str,
    processing_manifest_hash: str,
    manifest: dict[str, Any],
    collision_registry: dict[str, str],
) -> list[dict[str, Any]]:
    manual_dir = CANDIDATES_DIR / manual_id
    if not manual_dir.is_dir():
        return []

    inheritance_context = _load_inheritance_context(manual_dir)
    manifest_inheritance = _procedure_inheritance_from_manifest(manual_id, manifest)
    if manifest_inheritance.get("seedSourceManualId") and not inheritance_context.get("seed_source_manual_id"):
        inheritance_context["seed_source_manual_id"] = manifest_inheritance["seedSourceManualId"]
    if manifest_inheritance.get("inheritedFromManualId"):
        inheritance_context["manual_inherited_from"] = manifest_inheritance["inheritedFromManualId"]

    pipeline_manifest = {}
    pipeline_path = manual_dir / "pipeline_manifest.json"
    if pipeline_path.is_file():
        pipeline_manifest = _read_json(pipeline_path)
    platform_id = pipeline_manifest.get("platformId")

    architecture_exception = None
    arch_path = manual_dir / "architecture_exception.json"
    if arch_path.is_file():
        architecture_exception = _read_json(arch_path)

    promotion_blocked = _compute_promotion_blocked(manual_dir, architecture_exception)

    records: list[dict[str, Any]] = []
    mapping_path = manual_dir / "canonical_mapping_candidates.json"
    if mapping_path.is_file():
        for candidate in _read_json(mapping_path).get("candidates") or []:
            records.append(
                _build_candidate_record(
                    candidate,
                    manual_id=manual_id,
                    artifact_source="canonical_mapping",
                    batch_run_id=batch_run_id,
                    processing_manifest_hash=processing_manifest_hash,
                    inheritance_context=inheritance_context,
                    promotion_blocked=promotion_blocked,
                    platform_id=platform_id,
                    collision_registry=collision_registry,
                ),
            )

    overlay_path = manual_dir / "overlay_candidates.json"
    if overlay_path.is_file():
        for candidate in _read_json(overlay_path).get("candidates") or []:
            records.append(
                _build_candidate_record(
                    candidate,
                    manual_id=manual_id,
                    artifact_source="overlay",
                    batch_run_id=batch_run_id,
                    processing_manifest_hash=processing_manifest_hash,
                    inheritance_context=inheritance_context,
                    promotion_blocked=promotion_blocked,
                    platform_id=platform_id,
                    collision_registry=collision_registry,
                ),
            )

    if architecture_exception:
        records.append(
            _build_candidate_record(
                architecture_exception,
                manual_id=manual_id,
                artifact_source="architecture_exception",
                batch_run_id=batch_run_id,
                processing_manifest_hash=processing_manifest_hash,
                inheritance_context=inheritance_context,
                promotion_blocked=True,
                platform_id=platform_id,
                collision_registry=collision_registry,
                architecture_exception=architecture_exception,
            ),
        )

    return records


def build_candidate_review_index(
    *,
    batch_run_id: str = DEFAULT_BATCH_RUN_ID,
    processing_manifest_hash: str = DEFAULT_PROCESSING_MANIFEST_HASH,
    manifest: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from ..pipeline import load_manifest

    preflight = run_preflight(
        batch_run_id=batch_run_id,
        processing_manifest_hash=processing_manifest_hash,
    )
    if not preflight["passed"]:
        raise RuntimeError(f"preflight failed: {preflight['errors']}")

    manifest = manifest or load_manifest()
    manual_ids = sorted(
        path.name
        for path in CANDIDATES_DIR.iterdir()
        if path.is_dir() and not path.name.startswith("_")
    )

    collision_registry: dict[str, str] = {}
    records: list[dict[str, Any]] = []
    for manual_id in manual_ids:
        records.extend(
            index_manual_candidates(
                manual_id,
                batch_run_id=batch_run_id,
                processing_manifest_hash=processing_manifest_hash,
                manifest=manifest,
                collision_registry=collision_registry,
            ),
        )

    records.sort(
        key=lambda record: (
            str(record.get("manualId") or ""),
            str(record.get("reviewClass") or ""),
            str(record.get("candidateId") or ""),
        ),
    )

    records = merge_decisions_into_records(records)

    class_counts = Counter(str(record.get("reviewClass") or "unresolved") for record in records)
    status_counts = Counter(str(record.get("reviewStatus") or "unreviewed") for record in records)

    reconciliations = build_manual_reconciliations(batch_run_id=batch_run_id, manual_ids=manual_ids)

    return {
        "schemaVersion": 1,
        "reportType": "candidate_review_index",
        "batchRunId": batch_run_id,
        "processingManifestHash": processing_manifest_hash,
        "generatedAt": _utc_now(),
        "totalCandidateRecords": len(records),
        "countsByReviewClass": {key: class_counts.get(key, 0) for key in REVIEW_CLASSES},
        "countsByReviewStatus": {
            "unreviewed": status_counts.get("unreviewed", 0),
            "accepted": status_counts.get("accepted", 0),
            "rejected": status_counts.get("rejected", 0),
            "deferred": status_counts.get("deferred", 0),
        },
        "candidateIdCollisionPolicy": {
            "format": "{manualId}::{artifactSource}::{rawCandidateId}",
            "disambiguationSuffix": "::v2",
            "manualsWithCollisions": sorted(COLLISION_MANUALS),
        },
        "preflight": preflight,
        "manualReconciliations": reconciliations,
        "candidateRecords": records,
        "sourceArtifactReferences": [
            "normalization/candidates/*/canonical_mapping_candidates.json",
            "normalization/candidates/*/overlay_candidates.json",
            "normalization/candidates/*/architecture_exception.json",
            "normalization/review/CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_DECISIONS_v1.json",
        ],
        "decisionsArtifact": f"normalization/review/{decisions_path().name}",
        "promotionExplicitlyExcluded": True,
    }


def write_candidate_review_index(
    index: dict[str, Any],
    *,
    output_path: Path | None = None,
) -> Path:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    path = output_path or index_path()
    path.write_text(json.dumps(index, indent=2), encoding="utf-8")
    return path
