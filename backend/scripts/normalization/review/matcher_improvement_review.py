from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..paths import CALIBRATION_DIR, REVIEW_DIR
from .candidate_review_decisions import load_decisions
from .existing_frozen_mapping_missed_drilldown import (
    DRILLDOWN_FILENAME,
    EXPECTED_MISSED_COUNT,
    drilldown_path,
)
from .matcher_improvement_decisions import load_matcher_improvement_decisions
from .unresolved_frozen_vocabulary_gap_analysis import (
    WAVE1_CLOSURE,
    WAVE2_CLOSURE,
    WAVE3_DEFINITION,
)
from .unresolved_pool_analysis import (
    BATCH_RUN_ID,
    pool_content_hash,
    select_unresolved_candidates,
)
from .wave1_closure_audit import BATCH_LOCK_FILE, validate_frozen_hashes
from .wave1_existing_canonical_mapping import load_review_index
from .wave3_new_canonical_knowledge import select_wave_candidates as select_wave3
from .unresolved_frozen_vocabulary_gap_analysis import select_frozen_vocabulary_gap_records

REVIEW_FILENAME = "CG_MATCHER_IMPROVEMENT_REVIEW_v1.json"
REVIEW_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_REVIEW_AUDIT_v1.json"
GATE_ID = "matcher-improvement-wave1"
EXPECTED_REVIEW_ITEM_COUNT = 17

SAFE_BACKLOG_CATEGORIES = frozenset(
    {
        "ALIAS_IMPROVEMENT_CANDIDATE",
        "DECOMPOSITION_IMPROVEMENT_CANDIDATE",
        "CONTEXTUAL_MATCHING_IMPROVEMENT_CANDIDATE",
    },
)

ALLOWED_HUMAN_DECISIONS = ("approve", "defer", "reject", "no_change")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def review_path() -> Path:
    return CALIBRATION_DIR / REVIEW_FILENAME


def review_audit_path() -> Path:
    return CALIBRATION_DIR / REVIEW_AUDIT_FILENAME


def load_drilldown() -> dict[str, Any]:
    path = drilldown_path()
    if not path.is_file():
        raise FileNotFoundError(f"missing drilldown artifact: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def derive_smallest_safe_backlog(drilldown: dict[str, Any]) -> list[dict[str, Any]]:
    executive = drilldown.get("executiveAnswers") or {}
    safe = list(executive.get("smallestSafeMatcherAliasBacklog") or [])
    if safe:
        return safe

    backlog = drilldown.get("matcherImprovementBacklog") or []
    derived = [
        item
        for item in backlog
        if item.get("category") in SAFE_BACKLOG_CATEGORIES
        and item.get("confidence") in {"high", "medium"}
        and int(item.get("affectedRecordCount") or 0) >= 2
        and item.get("frozenCanonicalId")
        and item.get("implementationAuthorized") is False
    ]
    derived.sort(key=lambda row: (-int(row.get("affectedRecordCount") or 0), str(row.get("backlogId") or "")))
    return derived


def index_record_analyses(drilldown: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(row.get("candidateId") or ""): row
        for row in (drilldown.get("recordAnalyses") or [])
    }


def procedure_families_for_provenance(
    analyses_by_id: dict[str, dict[str, Any]],
    provenance_ids: list[str],
) -> list[str]:
    families = set()
    for candidate_id in provenance_ids:
        row = analyses_by_id.get(str(candidate_id))
        if row and row.get("procedureFamily"):
            families.add(str(row["procedureFamily"]))
    return sorted(families)


def assess_false_positive_risk(item: dict[str, Any]) -> str:
    term = str(item.get("terminologyClusterKey") or "")
    failure = str(item.get("observedFailureMode") or "")
    if failure == "SOURCE_TERM_NOISE":
        return "high — structural or noisy source terminology may over-match if generalized."
    if len(term.split()) <= 1 and item.get("affectedManualCount", 0) < 3:
        return "medium — short terminology cluster; substring rules risk collateral matches."
    if item.get("crossManufacturer"):
        return "medium — cross-manufacturer evidence helps, but rule must stay procedure/context bounded."
    if item.get("affectedPlatformCount", 0) >= 5:
        return "low-medium — broad platform spread; still requires bounded matcher predicate."
    return "medium — review sibling functional equivalence before any matcher change."


def why_considered_safe(item: dict[str, Any]) -> str:
    return (
        f"Drill-down smallestSafeMatcherAliasBacklog: category={item.get('category')}, "
        f"confidence={item.get('confidence')}, affectedRecordCount={item.get('affectedRecordCount')}, "
        f"frozenCanonicalId={item.get('frozenCanonicalId')}, implementationAuthorized=false. "
        "Meets >=2 records, high/medium confidence, alias/decomposition/context category, anchored frozen target."
    )


def proposed_narrow_behavior(item: dict[str, Any]) -> str:
    frozen = item.get("frozenCanonicalId")
    term_examples = item.get("terminologySourceExamples") or []
    examples = ", ".join(term_examples[:4]) if term_examples else item.get("terminologyClusterKey")
    category = item.get("category")
    if category == "ALIAS_IMPROVEMENT_CANDIDATE":
        return (
            f"Governance-only proposal: when accepted sibling evidence and procedure/decomposition context "
            f"align, map specific terminology variants (e.g. {examples}) to existing frozen '{frozen}' — "
            f"not broad substring rules on 'interface' or similar."
        )
    if category == "DECOMPOSITION_IMPROVEMENT_CANDIDATE":
        return (
            f"Governance-only proposal: improve decomposition exposure so component/function context "
            f"resolves to frozen '{frozen}' when siblings already do — scoped to backlogId {item.get('backlogId')}."
        )
    return (
        f"Governance-only proposal: contextual matcher propagation to frozen '{frozen}' within the same "
        f"manual/procedure family patterns evidenced by siblings — backlogId {item.get('backlogId')} only."
    )


def enrich_review_item(item: dict[str, Any], analyses_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    provenance = [str(pid) for pid in (item.get("provenanceRecordIds") or [])]
    procedure_families = procedure_families_for_provenance(analyses_by_id, provenance)
    return {
        **item,
        "reviewItemId": item.get("backlogId"),
        "implementationAuthorized": False,
        "procedureFamilies": procedure_families,
        "reviewerBrief": {
            "frozenCanonicalTarget": item.get("frozenCanonicalId"),
            "affectedTerminology": {
                "clusterKey": item.get("terminologyClusterKey"),
                "sourceExamples": item.get("terminologySourceExamples") or [],
            },
            "acceptedSiblingExamples": item.get("acceptedSiblingEvidenceExamples") or [],
            "coverage": {
                "manualCount": item.get("affectedManualCount"),
                "platformCount": item.get("affectedPlatformCount"),
                "manufacturerCount": item.get("affectedManufacturerCount"),
                "crossManufacturer": item.get("crossManufacturer"),
            },
            "procedureFamilies": procedure_families,
            "matchingFailureMode": item.get("observedFailureMode"),
            "whyConsideredSafe": why_considered_safe(item),
            "falsePositiveRisk": assess_false_positive_risk(item),
            "proposedNarrowMatcherOrAliasBehavior": proposed_narrow_behavior(item),
            "provenanceRecordIds": provenance,
        },
    }


def build_review_items(drilldown: dict[str, Any]) -> list[dict[str, Any]]:
    safe_backlog = derive_smallest_safe_backlog(drilldown)
    analyses_by_id = index_record_analyses(drilldown)
    items = [enrich_review_item(item, analyses_by_id) for item in safe_backlog]
    return sorted(
        items,
        key=lambda row: (-int(row.get("affectedRecordCount") or 0), str(row.get("backlogId") or "")),
    )


def build_review_definition(drilldown: dict[str, Any], review_items: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_review",
        "gateId": GATE_ID,
        "label": "Matcher improvement review — Wave 1 (smallest safe backlog)",
        "status": "READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW",
        "generatedAt": _utc_now(),
        "batchRunId": BATCH_RUN_ID,
        "sourceDrilldown": DRILLDOWN_FILENAME,
        "expectedReviewItemCount": EXPECTED_REVIEW_ITEM_COUNT,
        "reviewItemCount": len(review_items),
        "allowedDecisions": list(ALLOWED_HUMAN_DECISIONS),
        "decisionSemantics": {
            "approve": (
                "Evidence supports implementing this specific matcher/alias/decomposition/context improvement "
                "for this backlogId only."
            ),
            "defer": "Pattern is plausible but requires additional evidence or a narrower rule.",
            "reject": "The pattern should not be generalized into matcher behavior.",
            "no_change": "Sibling evidence is valid, but no matcher change should be made for this item.",
        },
        "decisionsArtifact": "normalization/review/CG_MATCHER_IMPROVEMENT_REVIEW_DECISIONS_v1.json",
        "decisionsArtifactFile": "CG_MATCHER_IMPROVEMENT_REVIEW_DECISIONS_v1.json",
        "promotionExcluded": True,
        "canonicalMutationAllowed": False,
        "matcherImplementationAllowed": False,
        "implementationAuthorized": False,
        "governanceNote": (
            "APPROVE authorizes only the specific backlog item, not category-wide or source-term-only rules. "
            "SOURCE TERM ALONE IS NEVER SUFFICIENT. No matcher or alias changes are applied by this gate."
        ),
        "reviewItems": review_items,
    }


def run_integrity_checks(
    index: dict[str, Any],
    review_items: list[dict[str, Any]],
    decisions_before: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    drilldown = load_drilldown()
    unresolved = select_unresolved_candidates(index)
    unresolved_after = select_unresolved_candidates(load_review_index())
    decisions_after = load_decisions()
    matcher_decisions = load_matcher_improvement_decisions()

    if len(review_items) != EXPECTED_REVIEW_ITEM_COUNT:
        errors.append(f"review item count {len(review_items)} != {EXPECTED_REVIEW_ITEM_COUNT}")

    for item in review_items:
        if item.get("implementationAuthorized") is not False:
            errors.append(f"{item.get('backlogId')} implementationAuthorized is not false")
        if item.get("category") not in SAFE_BACKLOG_CATEGORIES:
            errors.append(f"{item.get('backlogId')} category not in safe backlog categories")
        if not item.get("frozenCanonicalId"):
            errors.append(f"{item.get('backlogId')} missing frozenCanonicalId anchor")

    backlog_ids = {str(item.get("backlogId") or "") for item in review_items}
    if len(backlog_ids) != len(review_items):
        errors.append("duplicate backlogId in review items")

    drilldown = load_drilldown()
    safe_derived = derive_smallest_safe_backlog(drilldown)
    safe_ids = {str(item.get("backlogId") or "") for item in safe_derived}
    if safe_ids != backlog_ids:
        errors.append("review items do not exactly match smallestSafeMatcherAliasBacklog")

    if len(unresolved) != 1100:
        errors.append(f"unresolved count {len(unresolved)} != 1100")
    if pool_content_hash(unresolved) != pool_content_hash(unresolved_after):
        errors.append("unresolved pool content hash changed")

    gap = select_frozen_vocabulary_gap_records(unresolved)
    if len(gap) != 1078:
        errors.append(f"canonicalMapping gap {len(gap)} != 1078")

    before_map = decisions_before.get("decisions") or {}
    after_map = decisions_after.get("decisions") or {}
    if len(before_map) != 796:
        errors.append(f"production decision count {len(before_map)} != 796")
    if before_map != after_map:
        errors.append("production review decisions changed during gate build")

    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    if wave1.get("status") != "WAVE1_CLOSED":
        errors.append("wave1 closure not intact")
    if wave2.get("status") != "WAVE2_CLOSED":
        errors.append("wave2 closure not intact")

    wave3_def = json.loads(WAVE3_DEFINITION.read_text(encoding="utf-8")) if WAVE3_DEFINITION.is_file() else {}
    wave3_expected = wave3_def.get("expectedCandidateCount")
    if wave3_expected is None or int(wave3_expected) != 0:
        errors.append("wave3 not empty in definition")
    if len(select_wave3(index)) != 0:
        errors.append("wave3 pool not empty")

    if not (CALIBRATION_DIR / BATCH_LOCK_FILE).is_file():
        errors.append("batch lock missing")

    if matcher_decisions.get("matcherImplementationApplied"):
        errors.append("matcher decisions artifact indicates implementation already applied")

    return {
        "passed": len(errors) == 0,
        "errors": errors,
        "reviewItemCount": len(review_items),
        "unresolvedCount": len(unresolved),
        "canonicalMappingGapCount": len(gap),
        "productionReviewDecisionCount": len(before_map),
        "matcherReviewDecisionCount": len(matcher_decisions.get("decisions") or {}),
        "frozenCanonicalHashesValid": hashes_ok,
        "wave1ClosureIntact": wave1.get("status") == "WAVE1_CLOSED",
        "wave2ClosureIntact": wave2.get("status") == "WAVE2_CLOSED",
        "wave3Empty": len(select_wave3(index)) == 0,
        "aliasesAdded": False,
        "matcherChanged": False,
        "normalizationMutated": False,
        "batchAuthorizationChanged": False,
        "drilldownAnalyzedMissedCount": int(drilldown.get("analyzedRecordCount") or 0),
    }


def run_matcher_improvement_preflight() -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    drilldown = load_drilldown()
    if int(drilldown.get("analyzedRecordCount") or 0) != EXPECTED_MISSED_COUNT:
        errors.append("drilldown analyzedRecordCount is not 374")

    review_items = build_review_items(drilldown)
    review_definition = build_review_definition(drilldown, review_items)

    if review_definition.get("status") != "READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW":
        errors.append("review definition status mismatch")

    allowed_ids = {str(item["backlogId"]) for item in review_items}
    full_backlog = drilldown.get("matcherImprovementBacklog") or []
    full_backlog_ids = {str(i.get("backlogId") or "") for i in full_backlog}
    extra_outside = [
        bid
        for bid in allowed_ids
        if bid not in full_backlog_ids
    ]
    if extra_outside:
        errors.append("review item not found in matcherImprovementBacklog")

    decisions = load_decisions()
    integrity = run_integrity_checks(load_review_index(), review_items, decisions)
    if not integrity["passed"]:
        errors.extend(integrity["errors"])

    matcher_decisions = load_matcher_improvement_decisions()
    matcher_count = len(matcher_decisions.get("decisions") or {})
    if matcher_count > 0:
        warnings.append(f"matcher improvement decisions artifact already has {matcher_count} decisions")

    return {
        "passed": len(errors) == 0,
        "gateId": GATE_ID,
        "expectedReviewItemCount": EXPECTED_REVIEW_ITEM_COUNT,
        "actualReviewItemCount": len(review_items),
        "reviewItemBacklogIds": sorted(allowed_ids),
        "errors": errors,
        "warnings": warnings,
        "integrityChecks": integrity,
        "reviewDefinition": review_definition,
    }


def build_review_audit(preflight: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_review_audit",
        "gateId": GATE_ID,
        "status": (
            "READY_FOR_HUMAN_MATCHER_IMPROVEMENT_REVIEW"
            if preflight.get("passed")
            else "BLOCKED"
        ),
        "generatedAt": _utc_now(),
        "reviewArtifact": REVIEW_FILENAME,
        "preflightChecks": {
            "passed": preflight.get("passed"),
            "errors": preflight.get("errors"),
            "warnings": preflight.get("warnings"),
            "expectedReviewItemCount": EXPECTED_REVIEW_ITEM_COUNT,
            "actualReviewItemCount": preflight.get("actualReviewItemCount"),
        },
        "integrityChecks": preflight.get("integrityChecks"),
        "allowedDecisions": list(ALLOWED_HUMAN_DECISIONS),
        "mutationChecks": {
            "matcherImplementationAllowed": False,
            "matcherChanged": False,
            "aliasesAdded": False,
            "canonicalMutationAllowed": False,
            "productionDecisionCount": preflight.get("integrityChecks", {}).get(
                "productionReviewDecisionCount",
            ),
            "matcherReviewDecisionCount": preflight.get("integrityChecks", {}).get(
                "matcherReviewDecisionCount",
            ),
        },
    }


def write_matcher_improvement_review_artifacts(preflight: dict[str, Any]) -> tuple[Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    review_file = review_path()
    audit_file = review_audit_path()
    review_file.write_text(json.dumps(preflight["reviewDefinition"], indent=2), encoding="utf-8")
    audit_file.write_text(json.dumps(build_review_audit(preflight), indent=2), encoding="utf-8")
    return review_file, audit_file
