from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..matcher_improvement_rules import BACKLOG_MATCH_SPECS, approved_backlog_ids
from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .matcher_improvement_delta_reconciliation_decisions import (
    GATE_ID,
    POPULATION_A_DECISIONS,
    POPULATION_B_DECISIONS,
    decisions_path,
    empty_decisions_store,
    load_delta_reconciliation_decisions,
    save_delta_reconciliation_decisions,
)
from .matcher_improvement_delta_review import delta_review_path
from .matcher_improvement_full_corpus_regeneration import production_manual_ids, staging_root
from .matcher_improvement_scoped_validation import (
    _production_integrity_snapshot,
    load_implementation_audit,
)
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes
from .wave1_existing_canonical_mapping import load_review_index, select_wave_candidates as select_wave1
from .wave2_new_platform_knowledge import select_wave_candidates as select_wave2

QUEUE_FILENAME = "CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_QUEUE_v1.json"
RECONCILIATION_FILENAME = "CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_v1.json"
RECONCILIATION_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_AUDIT_v1.json"
DELTA_REVIEW_REQUIRED_STATUS = "GREEN — DELTA REVIEW READY"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def queue_path() -> Path:
    return CALIBRATION_DIR / QUEUE_FILENAME


def reconciliation_path() -> Path:
    return CALIBRATION_DIR / RECONCILIATION_FILENAME


def reconciliation_audit_path() -> Path:
    return CALIBRATION_DIR / RECONCILIATION_AUDIT_FILENAME


def _decision_id(population: str, candidate_key: str) -> str:
    digest = hashlib.sha256(f"{population}::{candidate_key}".encode()).hexdigest()[:16]
    prefix = "delta-a" if population == "A" else "delta-b"
    return f"{prefix}-{digest}"


def _staging_comparison_note(baseline_class: str | None, staged_class: str | None, baseline_target: Any, staged_target: Any) -> str:
    if baseline_class == staged_class and baseline_target == staged_target:
        return "same"
    if staged_class == "unresolved" and baseline_class != "unresolved":
        return "stricter"
    if baseline_class == "unresolved" and staged_class != "unresolved":
        return "broader"
    if baseline_target and staged_target and baseline_target != staged_target:
        return "different_target"
    return "different"


def _historical_wave_context(
    manual_id: str,
    procedure_id: str,
    source_term: str,
    staged_target: Any,
    staged_class: str | None,
) -> dict[str, Any]:
    index = load_review_index()
    decisions = load_decisions().get("decisions") or {}
    matches: list[dict[str, Any]] = []
    for wave_name, selector in (("wave1", select_wave1), ("wave2", select_wave2)):
        for record in selector(index):
            what = record.get("what") or {}
            if str(record.get("manualId") or "") != manual_id:
                continue
            if str(what.get("procedureId") or "") != procedure_id:
                continue
            if str(what.get("sourceTerm") or "") != source_term:
                continue
            candidate_id = str(record.get("candidateId") or "")
            decision = decisions.get(candidate_id) or {}
            accepted = decision.get("reviewStatus") == "accepted"
            expected_target = (record.get("mapsTo") or {}).get("proposedCanonicalId")
            expected_class = record.get("reviewClass")
            conflict = accepted and (
                str(staged_target or "") != str(expected_target or "")
                or str(staged_class or "") != str(expected_class or "")
            )
            matches.append(
                {
                    "wave": wave_name,
                    "candidateId": candidate_id,
                    "reviewStatus": decision.get("reviewStatus") or "unreviewed",
                    "acceptedTarget": expected_target,
                    "acceptedReviewClass": expected_class,
                    "historicalDecisionConflict": conflict,
                },
            )
    any_conflict = any(m.get("historicalDecisionConflict") for m in matches)
    return {
        "waveMatches": matches,
        "historicalDecisionConflict": any_conflict,
    }


def build_population_a(delta_review: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for group in delta_review.get("matcherImprovementGroups") or []:
        backlog_id = str(group.get("backlogId") or "")
        approved_target = group.get("approvedTarget") or BACKLOG_MATCH_SPECS.get(backlog_id, {}).get("canonicalId")
        for record in group.get("records") or []:
            candidate_key = str(record.get("candidateKey") or "")
            manual_id = str(record.get("manualId") or "")
            procedure_id = str(record.get("procedureId") or "")
            source_term = candidate_key.split("::")[2] if "::" in candidate_key else ""
            staged_class = record.get("stagedClassification")
            staged_target = record.get("stagedProposed")
            baseline_class = record.get("baselineClassification")
            baseline_target = record.get("baselineProposed")
            hist = _historical_wave_context(manual_id, procedure_id, source_term, staged_target, staged_class)
            items.append(
                {
                    "decisionId": _decision_id("A", candidate_key),
                    "population": "A",
                    "candidateKey": candidate_key,
                    "backlogId": backlog_id,
                    "approvedTarget": approved_target,
                    "manualId": manual_id,
                    "procedureId": procedure_id,
                    "procedureFamily": candidate_key.split("::")[1] if "::" in candidate_key else "",
                    "baselineClassification": baseline_class,
                    "stagedClassification": staged_class,
                    "baselineProposedCanonicalId": baseline_target,
                    "stagedProposedCanonicalId": staged_target,
                    "sourceTerm": source_term,
                    "mappingType": "matcher_improvement",
                    "matcherImprovementBacklogId": backlog_id,
                    "priorMatcherApproval": {
                        "gateId": "matcher-improvement-wave1",
                        "backlogId": backlog_id,
                        "implementationAudit": "CG_MATCHER_IMPROVEMENT_IMPLEMENTATION_AUDIT_v1.json",
                    },
                    "whyStagedChanged": record.get("reasonRuleFired"),
                    "evidence": record,
                    "provenance": {"stagedCorpus": str(staging_root())},
                    "stagingComparison": _staging_comparison_note(
                        baseline_class,
                        staged_class,
                        baseline_target,
                        staged_target,
                    ),
                    **hist,
                },
            )
    return sorted(items, key=lambda r: (r["backlogId"], r["candidateKey"]))


def _population_b_seed(
    *,
    candidate_key: str,
    manual_id: str,
    procedure_id: str,
    source_term: str,
    baseline_class: Any,
    staged_class: Any,
    baseline_target: Any,
    staged_target: Any,
    why: str,
    category_explanation: str | None,
    drift_sets: list[str],
    delta_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    delta = delta_lookup.get(candidate_key) or {}
    hist = _historical_wave_context(manual_id, procedure_id, source_term, staged_target, staged_class)
    return {
        "decisionId": _decision_id("B", candidate_key),
        "population": "B",
        "candidateKey": candidate_key,
        "manualId": manual_id,
        "procedureId": procedure_id,
        "procedureFamily": "-".join(procedure_id.split("-")[:2]) if procedure_id else "",
        "baselineClassification": baseline_class or delta.get("baselineClassification"),
        "stagedClassification": staged_class or delta.get("stagedClassification"),
        "baselineProposedCanonicalId": baseline_target if baseline_target is not None else delta.get("baselineProposedCanonicalId"),
        "stagedProposedCanonicalId": staged_target if staged_target is not None else delta.get("stagedProposedCanonicalId"),
        "sourceTerm": source_term or delta.get("baselineSourceTerm") or delta.get("stagedSourceTerm"),
        "matcherImprovementBacklogId": None,
        "whyStagedChanged": why or delta.get("whyStagedChanged"),
        "categoryAExplanation": category_explanation or delta.get("categoryExplanation"),
        "driftSourceSets": sorted(set(drift_sets)),
        "stagingComparison": _staging_comparison_note(
            baseline_class or delta.get("baselineClassification"),
            staged_class or delta.get("stagedClassification"),
            baseline_target if baseline_target is not None else delta.get("baselineProposedCanonicalId"),
            staged_target if staged_target is not None else delta.get("stagedProposedCanonicalId"),
        ),
        "evidence": delta,
        "provenance": delta.get("provenance"),
        **hist,
    }


def build_population_b(delta_review: dict[str, Any]) -> list[dict[str, Any]]:
    delta_lookup = {d["candidateKey"]: d for d in (delta_review.get("allDeltas") or [])}
    merged: dict[str, dict[str, Any]] = {}

    def merge_item(item: dict[str, Any], source_set: str) -> None:
        key = str(item.get("candidateKey") or "")
        if not key:
            return
        manual_id = str(item.get("manualId") or "")
        procedure_id = str(item.get("procedureId") or "")
        source_term = str(item.get("sourceTerm") or "")
        baseline_class = item.get("baselineClass") or item.get("baselineClassification")
        staged_class = item.get("stagedClass") or item.get("stagedClassification")
        baseline_target = item.get("baselineProposed") or item.get("baselineProposedCanonicalId")
        staged_target = item.get("stagedProposed") or item.get("stagedProposedCanonicalId")
        why = item.get("reasonBecameUnresolved") or item.get("categoryExplanation") or item.get("whyStagedChanged")
        cat = item.get("categoryExplanation")
        if key in merged:
            merged[key]["driftSourceSets"] = sorted(
                set(merged[key].get("driftSourceSets") or []) | {source_set},
            )
            return
        merged[key] = _population_b_seed(
            candidate_key=key,
            manual_id=manual_id,
            procedure_id=procedure_id,
            source_term=source_term,
            baseline_class=baseline_class,
            staged_class=staged_class,
            baseline_target=baseline_target,
            staged_target=staged_target,
            why=str(why or ""),
            category_explanation=cat,
            drift_sets=[source_set],
            delta_lookup=delta_lookup,
        )

    for item in delta_review.get("nonAuthorizedProposedChanges") or []:
        merge_item(item, "nonAuthorizedProposedChanges")
    for item in delta_review.get("addedToUnresolved") or []:
        merge_item(item, "addedToUnresolved")
    for item in (delta_review.get("removedFromUnresolvedReconciliation") or {}).get("otherRemovals") or []:
        merge_item(item, "otherUnresolvedRemovals")

    return sorted(merged.values(), key=lambda r: r["candidateKey"])


def _hash_production_mapping_corpus() -> str:
    digest = hashlib.sha256()
    for manual_id in production_manual_ids():
        path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
        if path.is_file():
            digest.update(path.read_bytes())
    return digest.hexdigest()


def run_preflight_checks() -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    checks: dict[str, Any] = {}

    delta_path = delta_review_path()
    if not delta_path.is_file():
        errors.append("missing CG_MATCHER_IMPROVEMENT_DELTA_REVIEW_v1.json")
        return errors, checks
    delta_review = json.loads(delta_path.read_text(encoding="utf-8"))
    if delta_review.get("status") != DELTA_REVIEW_REQUIRED_STATUS:
        errors.append(f"delta review status {delta_review.get('status')}")

    impl = load_implementation_audit()
    if impl.get("status") != "GREEN":
        errors.append("implementation audit not GREEN")

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 not closed")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 not closed")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    prod_before = _production_integrity_snapshot()
    if prod_before.get("reviewDecisionCount") != 796:
        errors.append(f"decision count {prod_before.get('reviewDecisionCount')} != 796")

    if not staging_root().is_dir():
        errors.append("staged corpus missing")

    checks.update(
        {
            "deltaReviewStatus": delta_review.get("status"),
            "implementationAudit": impl.get("status"),
            "wave1": wave1.get("status"),
            "wave2": wave2.get("status"),
            "frozenHashes": hashes_ok,
            "productionDecisionCount": prod_before.get("reviewDecisionCount"),
            "productionMappingCorpusHash": _hash_production_mapping_corpus(),
        },
    )
    return errors, checks


def build_reconciliation_tallies(
    population_a: list[dict[str, Any]],
    population_b: list[dict[str, Any]],
    decisions_store: dict[str, Any],
) -> dict[str, Any]:
    from collections import Counter

    decision_map = decisions_store.get("decisions") or {}

    def tally(population: str, allowed: frozenset[str]) -> dict[str, Any]:
        items = population_a if population == "A" else population_b
        counts = Counter()
        missing: list[str] = []
        selected_for_production: list[str] = []
        retained_baseline: list[str] = []
        deferred: list[str] = []
        conflicts: list[str] = []
        for item in items:
            entry = decision_map.get(item["decisionId"]) or {}
            decision = str(entry.get("decision") or "")
            if not decision:
                missing.append(item["decisionId"])
                counts["missing"] += 1
                continue
            if decision not in allowed:
                counts["invalid"] += 1
                continue
            counts[decision] += 1
            if decision == "accept_staged":
                selected_for_production.append(item["decisionId"])
            if decision == "keep_production_baseline":
                retained_baseline.append(item["decisionId"])
            if decision in {"defer_staged", "defer_review"}:
                deferred.append(item["decisionId"])
            if item.get("historicalDecisionConflict"):
                conflicts.append(item["decisionId"])
        return {
            "total": len(items),
            "counts": dict(counts),
            "missing": len(missing),
            "missingDecisionIds": missing,
            "selectedForFutureProductionReconciliation": selected_for_production,
            "retainedAtProductionBaseline": retained_baseline,
            "deferred": deferred,
            "historicalDecisionConflicts": conflicts,
        }

    pop_a = tally("A", POPULATION_A_DECISIONS)
    pop_b = tally("B", POPULATION_B_DECISIONS)
    pop_a_out = {
        "total": pop_a["total"],
        "accepted": pop_a["counts"].get("accept_staged", 0),
        "deferred": pop_a["counts"].get("defer_staged", 0),
        "rejected": pop_a["counts"].get("reject_staged", 0),
        "missing": pop_a["missing"],
        **pop_a,
    }
    pop_b_out = {
        "total": pop_b["total"],
        "acceptedStaged": pop_b["counts"].get("accept_staged", 0),
        "keptProductionBaseline": pop_b["counts"].get("keep_production_baseline", 0),
        "deferred": pop_b["counts"].get("defer_review", 0),
        "historicalDecisionConflicts": len(pop_b["historicalDecisionConflicts"]),
        "missing": pop_b["missing"],
        **pop_b,
    }
    complete = pop_a["missing"] == 0 and pop_b["missing"] == 0
    return {
        "populationA": pop_a_out,
        "populationB": pop_b_out,
        "humanReviewComplete": complete,
        "automaticDecisionsApplied": False,
    }


def run_delta_reconciliation_gate(*, initialize_decisions: bool = True) -> dict[str, Any]:
    errors: list[str] = []
    preflight_errors, preflight_checks = run_preflight_checks()
    errors.extend(preflight_errors)

    delta_review = json.loads(delta_review_path().read_text(encoding="utf-8")) if delta_review_path().is_file() else {}
    population_a = build_population_a(delta_review)
    population_b = build_population_b(delta_review)

    if len(population_a) != 46:
        errors.append(f"population A count {len(population_a)} != 46")
    expected_b = len(
        {
            *(d["candidateKey"] for d in (delta_review.get("nonAuthorizedProposedChanges") or [])),
            *(d["candidateKey"] for d in (delta_review.get("addedToUnresolved") or [])),
            *(
                d["candidateKey"]
                for d in (delta_review.get("removedFromUnresolvedReconciliation") or {}).get("otherRemovals") or []
                if d.get("candidateKey")
            ),
        },
    )
    if len(population_b) != expected_b:
        errors.append(f"population B unique count {len(population_b)} != dedup expectation {expected_b}")

    for item in population_a:
        if not item.get("backlogId") or item["backlogId"] not in set(approved_backlog_ids()):
            errors.append(f"population A invalid backlog {item.get('candidateKey')}")

    for item in population_b:
        if item.get("matcherImprovementBacklogId"):
            errors.append(f"population B has matcher backlog {item.get('candidateKey')}")

    decisions_store = load_delta_reconciliation_decisions()
    if initialize_decisions and not decisions_path().is_file():
        save_delta_reconciliation_decisions(empty_decisions_store())
        decisions_store = load_delta_reconciliation_decisions()

    if decisions_store.get("automaticDecisionsApplied"):
        errors.append("automatic decisions detected in delta reconciliation store")

    prod_snapshot = _production_integrity_snapshot()
    tallies = build_reconciliation_tallies(population_a, population_b, decisions_store)

    status = "GREEN" if not errors else "STOP"
    review_complete_status = "GREEN — DELTA RECONCILIATION READY" if not errors else status

    queue = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_delta_reconciliation_queue",
        "gateId": GATE_ID,
        "generatedAt": _utc_now(),
        "populationA": population_a,
        "populationB": population_b,
        "counts": {
            "populationA": len(population_a),
            "populationB": len(population_b),
        },
    }

    reconciliation = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_delta_reconciliation",
        "status": review_complete_status,
        "gateType": "human_delta_reconciliation_review",
        "promotionGate": False,
        "productionSwapAllowed": False,
        "generatedAt": _utc_now(),
        "preflight": preflight_checks,
        "inputs": {
            "deltaReview": "CG_MATCHER_IMPROVEMENT_DELTA_REVIEW_v1.json",
            "stagedCorpus": str(staging_root()),
            "productionCandidates": str(CANDIDATES_DIR),
            "decisionsStore": decisions_path().name,
        },
        "populationSummary": {
            "populationA": len(population_a),
            "populationBUnique": len(population_b),
        },
        "reconciliation": tallies,
        "nextGate": "controlled_production_candidate_reconciliation_after_human_review_complete",
        "errors": errors,
    }

    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_delta_reconciliation_audit",
        "status": status,
        "generatedAt": reconciliation["generatedAt"],
        "integrityChecks": {
            "passed": not errors,
            "errors": errors,
            "productionCandidatesUntouched": True,
            "historicalDecisionsUntouched": True,
            "automaticDecisions": False,
        },
    }

    return {
        "queue": queue,
        "reconciliation": reconciliation,
        "audit": audit,
    }


def write_delta_reconciliation_artifacts(payload: dict[str, Any]) -> tuple[Path, Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    q = queue_path()
    r = reconciliation_path()
    a = reconciliation_audit_path()
    q.write_text(json.dumps(payload["queue"], indent=2), encoding="utf-8")
    r.write_text(json.dumps(payload["reconciliation"], indent=2), encoding="utf-8")
    a.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    return q, r, a
