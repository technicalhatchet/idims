from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..matcher_improvement_rules import (
    BACKLOG_MATCH_SPECS,
    active_approved_rules,
    approved_backlog_ids,
    load_matcher_improvement_review,
    try_matcher_improvement,
    MatcherImprovementContext,
)
from ..paths import CALIBRATION_DIR
from ..canonical_matcher import build_mapping_candidates
from ..normalize_procedure import load_procedure_seeds_for_manual
from ..paths import PROCEDURE_SEED_DIR
from ..pipeline import find_manual_entry, load_manifest
from .matcher_improvement_decisions import load_matcher_improvement_decisions, save_matcher_improvement_decisions
from .matcher_improvement_review import run_matcher_improvement_preflight
from .wave1_closure_audit import validate_frozen_hashes

AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_IMPLEMENTATION_AUDIT_v1.json"
EXPECTED_REVIEW_ITEMS = 17
EXPECTED_REJECT = 1


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def audit_path() -> Path:
    return CALIBRATION_DIR / AUDIT_FILENAME


def decision_tallies() -> dict[str, int]:
    store = load_matcher_improvement_decisions()
    tallies = Counter()
    for entry in (store.get("decisions") or {}).values():
        tallies[str(entry.get("reviewStatus") or "missing")] += 1
    return dict(tallies)


def verify_pre_implementation_gate() -> tuple[list[str], dict[str, Any]]:
    errors: list[str] = []
    preflight = run_matcher_improvement_preflight()
    if not preflight["passed"]:
        errors.extend(preflight["errors"])

    tallies = decision_tallies()
    total = sum(tallies.values())
    if total != EXPECTED_REVIEW_ITEMS:
        errors.append(f"matcher review decisions {total} != {EXPECTED_REVIEW_ITEMS}")
    if tallies.get("reject", 0) != EXPECTED_REJECT:
        errors.append(f"reject count {tallies.get('reject', 0)} != {EXPECTED_REJECT}")

    approved = approved_backlog_ids()
    if not approved:
        errors.append("no approved backlogIds in decision store")

    for backlog_id in approved:
        if backlog_id not in BACKLOG_MATCH_SPECS:
            errors.append(f"approved backlog {backlog_id} has no implementation spec")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    deferred = [bid for bid, status in ((k, v.get("reviewStatus")) for k, v in (load_matcher_improvement_decisions().get("decisions") or {}).items()) if status == "defer"]
    rejected = [bid for bid, status in ((k, v.get("reviewStatus")) for k, v in (load_matcher_improvement_decisions().get("decisions") or {}).items()) if status == "reject"]

    return errors, {
        "preflightPassed": preflight["passed"],
        "decisionTallies": tallies,
        "approvedBacklogIds": approved,
        "deferredBacklogIds": sorted(deferred),
        "rejectedBacklogIds": sorted(rejected),
        "frozenHashesValid": hashes_ok,
    }


def regression_cases() -> list[dict[str, Any]]:
    review = load_matcher_improvement_review()
    items = {item["backlogId"]: item for item in review.get("reviewItems") or []}
    cases: list[dict[str, Any]] = []
    for rule in active_approved_rules():
        item = items[rule["backlogId"]]
        manual_id = rule["allowedManualIds"][0]
        procedure_id = (item.get("procedureFamilies") or [None])[0]
        if procedure_id and not procedure_id.endswith("-test"):
            procedure_id = f"{procedure_id}-probe"
        for example in item.get("terminologySourceExamples") or []:
            cases.append(
                {
                    "backlogId": rule["backlogId"],
                    "manualId": manual_id,
                    "procedureId": procedure_id,
                    "sourceTerm": example,
                    "expectedCanonicalId": rule["canonicalId"],
                },
            )
    return cases


def run_regression_cases() -> dict[str, Any]:
    from normalization.canonical_matcher import load_canonical_component_ids

    manifest = load_manifest()
    manual_template = {
        str(entry.get("manualId")): str(entry.get("templateId") or "washer")
        for entry in manifest.get("manuals") or []
    }
    results = []
    passed = 0
    for case in regression_cases():
        template_id = manual_template.get(case["manualId"], "washer")
        entry = find_manual_entry(manifest, case["manualId"])
        platform_id = str(entry.get("platformId") or "") or None
        canonical_ids = load_canonical_component_ids(template_id, platform_id)
        match = try_matcher_improvement(
            case["sourceTerm"],
            case["sourceTerm"],
            context=MatcherImprovementContext(
                manual_id=case["manualId"],
                procedure_id=case["procedureId"],
                template_id=template_id,
                platform_id=platform_id,
            ),
            canonical_ids=canonical_ids,
        )
        ok = (
            match is not None
            and match.backlog_id == case["backlogId"]
            and match.canonical_id == case["expectedCanonicalId"]
        )
        if ok:
            passed += 1
        results.append({**case, "passed": ok, "actualCanonicalId": match.canonical_id if match else None})
    return {
        "caseCount": len(results),
        "passedCount": passed,
        "failedCount": len(results) - passed,
        "cases": results,
    }


def isolated_manual_regression(manual_ids: list[str]) -> dict[str, Any]:
    manifest = load_manifest()
    summaries = []
    for manual_id in sorted(set(manual_ids)):
        entry = find_manual_entry(manifest, manual_id)
        template_id = str(entry.get("templateId") or "washer")
        seed_dir = PROCEDURE_SEED_DIR / str(entry.get("seedDir"))
        procedures = load_procedure_seeds_for_manual(entry, seed_dir)
        candidates, _ = build_mapping_candidates(procedures, entry, template_id)
        mig = [c for c in candidates if c.get("mappingType") == "matcher_improvement"]
        summaries.append(
            {
                "manualId": manual_id,
                "matcherImprovementCandidateCount": len(mig),
                "matcherImprovementBacklogIds": sorted(
                    {c.get("matcherImprovement", {}).get("backlogId") for c in mig if c.get("matcherImprovement")},
                ),
                "totalMappingCandidates": len(candidates),
            },
        )
    return {
        "manuals": summaries,
        "matcherImprovementCandidatesTotal": sum(row["matcherImprovementCandidateCount"] for row in summaries),
    }


def run_pytest_subset() -> dict[str, Any]:
    scripts_dir = Path(__file__).resolve().parents[2]
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/test_matcher_improvement_implementation.py",
        "tests/test_matcher_improvement_review.py",
        "tests/test_normalization_calibration.py",
        "-q",
    ]
    proc = subprocess.run(cmd, cwd=scripts_dir, capture_output=True, text=True)
    return {
        "passed": proc.returncode == 0,
        "returnCode": proc.returncode,
        "stdout": proc.stdout[-4000:],
        "stderr": proc.stderr[-2000:],
    }


def build_implementation_audit(
    *,
    gate_info: dict[str, Any],
    gate_errors: list[str],
    regression: dict[str, Any],
    manual_regression: dict[str, Any],
    pytest_result: dict[str, Any],
) -> dict[str, Any]:
    hashes_ok, _ = validate_frozen_hashes()
    approved = gate_info["approvedBacklogIds"]
    status = "GREEN"
    if gate_errors:
        status = "HOLD"
    elif regression["failedCount"] > 0 or not pytest_result["passed"] or not hashes_ok:
        status = "STOP"

    return {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_implementation_audit",
        "status": status,
        "generatedAt": _utc_now(),
        "implementationStatus": "MATCHER_IMPROVEMENT_IMPLEMENTATION_COMPLETE" if status == "GREEN" else "BLOCKED",
        "approvedBacklogIdsImplemented": approved,
        "deferredBacklogIdsUntouched": gate_info["deferredBacklogIds"],
        "rejectedBacklogIdsUntouched": gate_info["rejectedBacklogIds"],
        "decisionTallies": gate_info["decisionTallies"],
        "filesChanged": [
            "backend/scripts/normalization/matcher_improvement_rules.py",
            "backend/scripts/normalization/canonical_matcher.py",
            "backend/scripts/normalization/review/matcher_improvement_implementation.py",
        ],
        "beforeAfter": {
            "note": "Isolated in-memory manual normalization for approved provenance manuals only; production candidate artifacts not rewritten by this gate.",
            "manualRegression": manual_regression,
            "ruleRegression": regression,
        },
        "frozenHashVerification": {"passed": hashes_ok},
        "testResults": pytest_result,
        "provenanceByBacklogId": {
            rule["backlogId"]: {
                "canonicalId": rule["canonicalId"],
                "allowedManualIds": rule["allowedManualIds"],
                "procedureFamilies": rule["procedureFamilies"],
                "match": rule["match"],
            }
            for rule in active_approved_rules()
        },
        "errors": gate_errors,
    }


def run_matcher_improvement_implementation_gate() -> dict[str, Any]:
    gate_errors, gate_info = verify_pre_implementation_gate()
    regression = run_regression_cases()
    manual_ids = sorted({manual for rule in active_approved_rules() for manual in rule["allowedManualIds"]})
    manual_regression = isolated_manual_regression(manual_ids)
    pytest_result = run_pytest_subset()
    audit = build_implementation_audit(
        gate_info=gate_info,
        gate_errors=gate_errors,
        regression=regression,
        manual_regression=manual_regression,
        pytest_result=pytest_result,
    )

    if audit["status"] == "GREEN":
        store = load_matcher_improvement_decisions()
        store["matcherImplementationApplied"] = True
        store["matcherImplementationAppliedAt"] = _utc_now()
        store["implementedBacklogIds"] = gate_info["approvedBacklogIds"]
        save_matcher_improvement_decisions(store)

    return audit


def write_implementation_audit(audit: dict[str, Any]) -> Path:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    path = audit_path()
    path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return path
