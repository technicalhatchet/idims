from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..canonical_matcher import load_canonical_component_ids, load_full_registry, match_source_term
from ..compound_term_parser import load_canonical_component_aliases
from ..paths import CALIBRATION_DIR, CANONICAL_WASHER_PATH


def load_golden_set(path: Path | None = None) -> dict[str, Any]:
    golden_path = path or (CALIBRATION_DIR / "golden_mapping_set.json")
    if not golden_path.is_file():
        raise FileNotFoundError(f"Golden mapping set not found: {golden_path}")
    return json.loads(golden_path.read_text(encoding="utf-8"))


def evaluate_golden_case(case: dict[str, Any]) -> dict[str, Any]:
    template_id = case.get("templateId") or "washer"
    term = case.get("sourceTerm")
    registry = load_full_registry(template_id)
    canonical_ids = load_canonical_component_ids(template_id)
    canonical_aliases = load_canonical_component_aliases(template_id, CANONICAL_WASHER_PATH)

    if case.get("asSeedComponentId"):
        from ..seed_component_registry import resolve_seed_component_id

        seed_match = resolve_seed_component_id(term, template_id)
        if seed_match and seed_match.get("canonicalId"):
            actual = {
                "sourceTerm": term,
                "canonicalId": seed_match["canonicalId"],
                "confidence": seed_match["confidence"],
                "status": "candidate",
                "mappingType": "seed_component_id",
                "reviewLevel": seed_match.get("reviewLevel"),
                "matcherLayer": seed_match.get("registryLayer"),
            }
        else:
            actual = {
                "sourceTerm": term,
                "canonicalId": None,
                "confidence": 0.0,
                "status": "UNRESOLVED_TERM",
                "mappingType": "seed_component_id",
                "matcherLayer": "unresolved",
            }
    else:
        actual = match_source_term(
            term,
            template_id,
            registry=registry,
            canonical_ids=canonical_ids,
            canonical_aliases=canonical_aliases,
        )

    failures: list[str] = []
    expected_canonical = case.get("expectedCanonicalId")
    if expected_canonical is not None and actual.get("canonicalId") != expected_canonical:
        failures.append(
            f"canonicalId: expected {expected_canonical}, got {actual.get('canonicalId')}",
        )

    expected_status = case.get("expectedStatus")
    if expected_status and actual.get("status") != expected_status:
        failures.append(f"status: expected {expected_status}, got {actual.get('status')}")

    expected_blocked_reason = case.get("expectedBlockedReason")
    if expected_blocked_reason and actual.get("blockedReason") != expected_blocked_reason:
        failures.append(
            f"blockedReason: expected {expected_blocked_reason}, got {actual.get('blockedReason')}",
        )

    expected_mapping_type = case.get("expectedMappingType")
    if expected_mapping_type and actual.get("mappingType") != expected_mapping_type:
        failures.append(
            f"mappingType: expected {expected_mapping_type}, got {actual.get('mappingType')}",
        )

    min_confidence = case.get("minConfidence")
    if min_confidence is not None:
        confidence = actual.get("confidence") or 0
        if confidence < min_confidence:
            failures.append(f"confidence {confidence} < min {min_confidence}")

    max_confidence = case.get("maxConfidence")
    if max_confidence is not None:
        confidence = actual.get("confidence") or 0
        if confidence > max_confidence:
            failures.append(f"confidence {confidence} > max {max_confidence}")

    expected_matched_phrase = case.get("expectedMatchedPhrase")
    if expected_matched_phrase is not None:
        if actual.get("matchedPhrase") != expected_matched_phrase:
            failures.append(
                f"matchedPhrase: expected {expected_matched_phrase}, "
                f"got {actual.get('matchedPhrase')}",
            )

    return {
        "id": case.get("id"),
        "sourceTerm": term,
        "expectedDecision": case.get("expectedDecision"),
        "passed": not failures,
        "failures": failures,
        "actual": actual,
    }


def evaluate_golden_set(path: Path | None = None) -> dict[str, Any]:
    golden = load_golden_set(path)
    cases = golden.get("cases") or []
    results = [evaluate_golden_case(case) for case in cases]
    passed = sum(1 for result in results if result["passed"])
    failed = [result for result in results if not result["passed"]]

    by_decision: dict[str, dict[str, int]] = {}
    for case, result in zip(cases, results):
        decision = case.get("expectedDecision") or "unknown"
        bucket = by_decision.setdefault(decision, {"passed": 0, "failed": 0})
        if result["passed"]:
            bucket["passed"] += 1
        else:
            bucket["failed"] += 1

    return {
        "goldenSetVersion": golden.get("schemaVersion"),
        "total": len(results),
        "passed": passed,
        "failed": len(failed),
        "passRate": round(passed / len(results), 4) if results else 1.0,
        "byDecision": by_decision,
        "failures": failed,
        "results": results,
    }
