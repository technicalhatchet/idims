from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, CANDIDATES_DIR, REVIEW_DIR
from normalization.review.candidate_review_decisions import (
    load_decisions,
    record_review_decision,
    save_decisions,
)
from normalization.review.candidate_review_index import (
    build_candidate_review_index,
    classify_review_class,
    index_manual_candidates,
    write_candidate_review_index,
)
from normalization.review.frozen_canonical_vocabulary import load_frozen_canonical_ids
from normalization.review.candidate_review_preflight import run_preflight


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _load_frozen_hashes() -> dict[str, str]:
    registry_path = CALIBRATION_DIR / "frozen_canonical_hashes_v1.json"
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    return {
        ontology_id: entry["hash"]
        for ontology_id, entry in (payload.get("frozenOntologies") or {}).items()
    }


@pytest.fixture
def isolated_review_dir(tmp_path, monkeypatch):
    review_dir = tmp_path / "review"
    review_dir.mkdir()
    monkeypatch.setattr("normalization.review.candidate_review_decisions.REVIEW_DIR", review_dir)
    monkeypatch.setattr("normalization.review.candidate_review_index.REVIEW_DIR", review_dir)
    monkeypatch.setattr("normalization.review.candidate_review_preflight.REVIEW_DIR", review_dir)
    return review_dir


def test_preflight_passes_for_production_batch():
    result = run_preflight(
        batch_run_id="batch-20260918-5d213986",
        processing_manifest_hash="0d537288a76ed9b2bdc3fd7fec8ccb9e5187bf282dc68b917790a1fd184a4013",
    )
    assert result["passed"] is True
    assert result["candidateManualCount"] == 72
    assert result["rollbackBoundary"]["reviewDecisionsAreNonCanonical"] is True


def test_classify_review_class_is_deterministic():
    frozen_ids = load_frozen_canonical_ids()
    ctx = {"by_procedure": {}}

    assert classify_review_class(
        {"status": "UNRESOLVED_TERM", "candidateType": "canonicalMapping"},
        artifact_source="canonical_mapping",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "unresolved"

    assert classify_review_class(
        {"status": "COMPOUND_TERM_CANDIDATE", "candidateType": "canonicalMapping"},
        artifact_source="canonical_mapping",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "implementationSpecific"

    assert classify_review_class(
        {"status": "candidate", "candidateType": "procedureTestBinding"},
        artifact_source="overlay",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "newPlatformKnowledge"

    assert classify_review_class(
        {
            "status": "candidate",
            "candidateType": "canonicalMapping",
            "canonicalId": "door_lock",
        },
        artifact_source="canonical_mapping",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "existingCanonicalMapping"

    assert classify_review_class(
        {
            "status": "candidate",
            "candidateType": "canonicalMapping",
            "canonicalId": "control_board",
        },
        artifact_source="canonical_mapping",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "existingCanonicalMapping"

    assert classify_review_class(
        {
            "status": "candidate",
            "candidateType": "canonicalMapping",
            "canonicalId": "door_lock",
        },
        artifact_source="canonical_mapping",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) != "newCanonicalKnowledge"

    assert classify_review_class(
        {
            "status": "candidate",
            "candidateType": "canonicalMapping",
            "canonicalId": "definitely_not_a_frozen_id_xyz",
        },
        artifact_source="canonical_mapping",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "unresolved"

    assert classify_review_class(
        {"exceptionType": "architecture_conflict", "requiredRoute": "fit"},
        artifact_source="architecture_exception",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "architectureException"

    assert classify_review_class(
        {
            "status": "UNRESOLVED_TERM",
            "candidateType": "canonicalMapping",
            "provenance": {"inheritedFromManualId": "SAMSUNG-RS28-SXS"},
        },
        artifact_source="canonical_mapping",
        inheritance_context=ctx,
        frozen_canonical_ids=frozen_ids,
    ) == "inheritedKnowledge"


def test_index_includes_all_artifact_types():
    index = build_candidate_review_index()
    records = index["candidateRecords"]
    artifact_sources = {record["artifactSource"] for record in records}
    review_classes = {record["reviewClass"] for record in records}

    assert "canonical_mapping" in artifact_sources
    assert "overlay" in artifact_sources
    assert "architecture_exception" in artifact_sources
    assert "unresolved" in review_classes
    assert "implementationSpecific" in review_classes
    assert "newPlatformKnowledge" in review_classes
    assert "existingCanonicalMapping" in review_classes
    assert index["countsByReviewClass"]["newCanonicalKnowledge"] == 0
    assert index["totalCandidateRecords"] > 1600
    successful_mappings = 0
    for manual_dir in CANDIDATES_DIR.iterdir():
        if not manual_dir.is_dir() or manual_dir.name.startswith("_"):
            continue
        mapping_path = manual_dir / "canonical_mapping_candidates.json"
        if not mapping_path.is_file():
            continue
        for candidate in json.loads(mapping_path.read_text(encoding="utf-8")).get("candidates", []):
            if candidate.get("status") == "candidate" and candidate.get("canonicalId"):
                successful_mappings += 1
    assert index["countsByReviewClass"]["newCanonicalKnowledge"] != successful_mappings
    assert index["countsByReviewClass"]["existingCanonicalMapping"] == successful_mappings


def test_no_unresolved_candidate_disappears_from_index():
    index = build_candidate_review_index()
    unresolved_on_disk = 0
    for manual_dir in sorted(CANDIDATES_DIR.iterdir()):
        if not manual_dir.is_dir() or manual_dir.name.startswith("_"):
            continue
        mapping_path = manual_dir / "canonical_mapping_candidates.json"
        if not mapping_path.is_file():
            continue
        candidates = json.loads(mapping_path.read_text(encoding="utf-8")).get("candidates") or []
        unresolved_on_disk += sum(1 for candidate in candidates if candidate.get("status") == "UNRESOLVED_TERM")

    indexed_unresolved = sum(
        1
        for record in index["candidateRecords"]
        if record.get("reviewClass") == "unresolved"
        or record.get("candidateStatus") == "UNRESOLVED_TERM"
    )
    assert indexed_unresolved >= unresolved_on_disk


def test_review_status_defaults_to_unreviewed(isolated_review_dir):
    index = build_candidate_review_index()
    assert all(record.get("reviewStatus") == "unreviewed" for record in index["candidateRecords"])


def test_review_decision_does_not_modify_canonical_graphs(isolated_review_dir):
    before = {path.name: _sha256_file(path) for path in CANONICAL_DIR.glob("*.json")}
    record_review_decision(
        "test-candidate-review-only",
        "accepted",
        manual_id="W8178558",
        reviewer="tester",
        batch_run_id="batch-20260918-5d213986",
    )
    after = {path.name: _sha256_file(path) for path in CANONICAL_DIR.glob("*.json")}
    assert before == after


def test_rebuild_preserves_existing_review_decisions(isolated_review_dir):
    record_review_decision(
        "manual::canonical_mapping::keep-me",
        "deferred",
        manual_id="W8178558",
        reviewer="tester",
    )
    first = build_candidate_review_index()
    second = build_candidate_review_index()
    decisions = load_decisions()["decisions"]
    assert decisions["manual::canonical_mapping::keep-me"]["reviewStatus"] == "deferred"
    assert first["countsByReviewStatus"] == second["countsByReviewStatus"]


def test_rs22t_reconciliation_uses_current_artifacts():
    index = build_candidate_review_index()
    rs22t = next(
        record for record in index["manualReconciliations"] if record["manualId"] == "SAMSUNG-RS22T-SXS"
    )
    historical = rs22t["historicalObservation"]["counts"]
    current = rs22t["currentOnDiskCandidateState"]
    assert historical["candidateCount"] == 0
    assert current["mappingCandidateCount"] == 33
    assert current["procedureCount"] == 17
    rs22t_records = [
        record for record in index["candidateRecords"] if record["manualId"] == "SAMSUNG-RS22T-SXS"
    ]
    assert len(rs22t_records) == 33


def test_flexwash_exposes_historical_stop_and_current_cleared_stop():
    index = build_candidate_review_index()
    flexwash = next(
        record for record in index["manualReconciliations"] if record["manualId"] == "SAMSUNG-FLEXWASH-WASHER"
    )
    assert flexwash["historicalObservation"]["batchState"] == "stopped_trigger"
    assert flexwash["currentResume"]["batchState"] == "cleared_stop"
    assert flexwash["currentResume"]["reNormalize"] is False
    arch_records = [
        record
        for record in index["candidateRecords"]
        if record["manualId"] == "SAMSUNG-FLEXWASH-WASHER"
        and record["artifactSource"] == "architecture_exception"
    ]
    assert len(arch_records) == 1
    assert arch_records[0]["reviewClass"] == "architectureException"


def test_index_ordering_is_deterministic():
    first = build_candidate_review_index()
    second = build_candidate_review_index()
    first_ids = [record["candidateId"] for record in first["candidateRecords"]]
    second_ids = [record["candidateId"] for record in second["candidateRecords"]]
    assert first_ids == second_ids


def test_frozen_canonical_hashes_unchanged():
    frozen = _load_frozen_hashes()
    for ontology_id, expected in frozen.items():
        graph_path = CANONICAL_DIR / f"{ontology_id}.json"
        assert graph_path.is_file(), ontology_id
        assert _sha256_file(graph_path) == expected, ontology_id


def test_w8178558_manual_index_covers_mapping_and_overlay():
    from normalization.pipeline import load_manifest

    collision_registry: dict[str, int] = {}
    records = index_manual_candidates(
        "W8178558",
        batch_run_id="batch-20260918-5d213986",
        processing_manifest_hash="0d537288a76ed9b2bdc3fd7fec8ccb9e5187bf282dc68b917790a1fd184a4013",
        manifest=load_manifest(),
        collision_registry=collision_registry,
    )
    sources = {record["artifactSource"] for record in records}
    assert "canonical_mapping" in sources
    assert "overlay" in sources
    assert len(records) > 30


def test_review_decision_does_not_change_review_class(isolated_review_dir):
    index = build_candidate_review_index()
    sample = next(
        record for record in index["candidateRecords"] if record.get("reviewClass") == "existingCanonicalMapping"
    )
    record_review_decision(sample["candidateId"], "accepted", manual_id=sample["manualId"])
    rebuilt = build_candidate_review_index()
    updated = next(
        record for record in rebuilt["candidateRecords"] if record["candidateId"] == sample["candidateId"]
    )
    assert updated["reviewClass"] == "existingCanonicalMapping"
    assert updated["reviewStatus"] == "accepted"

    record_review_decision(sample["candidateId"], "rejected", manual_id=sample["manualId"])
    rejected = build_candidate_review_index()
    rejected_record = next(
        record for record in rejected["candidateRecords"] if record["candidateId"] == sample["candidateId"]
    )
    assert rejected_record["reviewClass"] == "existingCanonicalMapping"
    assert rejected_record["reviewStatus"] == "rejected"

    record_review_decision(sample["candidateId"], "deferred", manual_id=sample["manualId"])
    deferred = build_candidate_review_index()
    deferred_record = next(
        record for record in deferred["candidateRecords"] if record["candidateId"] == sample["candidateId"]
    )
    assert deferred_record["reviewClass"] == "existingCanonicalMapping"
    assert deferred_record["reviewStatus"] == "deferred"


def test_frozen_canonical_id_never_classified_as_new_canonical_knowledge():
    index = build_candidate_review_index()
    frozen_ids = load_frozen_canonical_ids()
    for record in index["candidateRecords"]:
        proposed = record.get("mapsTo", {}).get("proposedCanonicalId")
        if proposed in frozen_ids:
            assert record["reviewClass"] != "newCanonicalKnowledge"


def test_write_index_creates_versioned_artifact(isolated_review_dir):
    index = build_candidate_review_index()
    path = write_candidate_review_index(index)
    assert path.name == "CG_PRODUCTION_NORMALIZATION_CANDIDATE_REVIEW_INDEX_v1.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["promotionExplicitlyExcluded"] is True
