from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from ..canonical_matcher import load_canonical_component_ids
from ..matcher_improvement_rules import (
    BACKLOG_MATCH_SPECS,
    MatcherImprovementContext,
    approved_backlog_ids,
    load_matcher_improvement_review,
    try_matcher_improvement,
)
from ..paths import CALIBRATION_DIR, CANDIDATES_DIR, REVIEW_DIR
from .matcher_improvement_decisions import load_matcher_improvement_decisions
from .matcher_improvement_full_corpus_regeneration import (
    _architecture_exception_from_dir,
    _candidate_identity,
    _classify_candidate,
    _inheritance_context_for_dir,
    _mapping_candidates_from_dir,
    _overlay_candidates_from_dir,
    _procedure_family,
    _proposed_target,
    _wave_accepted_integrity,
    production_manual_ids,
    staging_root,
)
from .matcher_improvement_scoped_validation import (
    REJECTED_BACKLOG_ID,
    _production_integrity_snapshot,
    _validate_matcher_improvements,
    _validate_review_terminology,
    cohort_from_approved_rules,
    load_implementation_audit,
)
from .unresolved_frozen_vocabulary_gap_analysis import WAVE1_CLOSURE, WAVE2_CLOSURE
from .wave1_closure_audit import validate_frozen_hashes

DELTA_REVIEW_FILENAME = "CG_MATCHER_IMPROVEMENT_DELTA_REVIEW_v1.json"
DELTA_REVIEW_AUDIT_FILENAME = "CG_MATCHER_IMPROVEMENT_DELTA_REVIEW_AUDIT_v1.json"
REGENERATION_FILENAME = "CG_MATCHER_IMPROVEMENT_FULL_CORPUS_REGENERATION_v1.json"

ChangeCategory = Literal["A", "B", "C", "D"]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def delta_review_path() -> Path:
    return CALIBRATION_DIR / DELTA_REVIEW_FILENAME


def delta_review_audit_path() -> Path:
    return CALIBRATION_DIR / DELTA_REVIEW_AUDIT_FILENAME


def _stable_candidate_key(
    manual_id: str,
    procedure_id: str,
    source_term: str,
    extracted_term: str = "",
) -> str:
    return f"{manual_id}::{procedure_id}::{source_term}::{extracted_term}"


def _candidate_by_key(
    manual_id: str,
    root: Path,
) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    out: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for candidate in _mapping_candidates_from_dir(manual_id, root):
        key = _candidate_identity(manual_id, "canonical_mapping", candidate)
        out[key] = candidate
    return out


def _enrich_side(
    manual_id: str,
    root: Path,
    candidate: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not candidate:
        return None
    procedure_id = str((candidate.get("provenance") or {}).get("procedureId") or candidate.get("procedureId") or "")
    return {
        "sourceTerm": candidate.get("sourceTerm"),
        "extractedTerm": candidate.get("extractedTerm"),
        "proposedCanonicalId": _proposed_target(candidate),
        "reviewClass": _classify_candidate(manual_id, root, "canonical_mapping", candidate),
        "mappingType": candidate.get("mappingType"),
        "candidateType": candidate.get("candidateType"),
        "status": candidate.get("status"),
        "matcherImprovementBacklogId": (candidate.get("matcherImprovement") or {}).get("backlogId"),
        "provenance": candidate.get("provenance"),
        "confidence": candidate.get("confidence"),
        "matcherLayer": candidate.get("matcherLayer"),
    }


def _why_staged_changed(
    *,
    baseline: dict[str, Any] | None,
    staged: dict[str, Any] | None,
    backlog_id: str | None,
    approved_target: str | None,
) -> str:
    if backlog_id and approved_target:
        return (
            f"Approved matcher-improvement rule {backlog_id} mapped term to frozen canonical "
            f"'{approved_target}' (mappingType matcher_improvement)."
        )
    if baseline and staged:
        if baseline.get("reviewClass") != staged.get("reviewClass"):
            return (
                f"Review class changed {baseline.get('reviewClass')} -> {staged.get('reviewClass')} "
                f"with proposed {baseline.get('proposedCanonicalId')} -> {staged.get('proposedCanonicalId')} "
                f"(mappingType {baseline.get('mappingType')} -> {staged.get('mappingType')})."
            )
        return (
            f"Proposed target changed {baseline.get('proposedCanonicalId')} -> "
            f"{staged.get('proposedCanonicalId')} under mappingType "
            f"{baseline.get('mappingType')} -> {staged.get('mappingType')}."
        )
    return "Candidate key present in only one corpus side."


def _try_rule_attribution(
    manual_id: str,
    candidate: dict[str, Any],
) -> str | None:
    provenance = candidate.get("provenance") or {}
    procedure_id = provenance.get("procedureId")
    platform_id = provenance.get("platformId")
    template_id = str(provenance.get("templateId") or "washer")
    ctx = MatcherImprovementContext(
        manual_id,
        str(procedure_id) if procedure_id else None,
        template_id,
        str(platform_id) if platform_id else None,
    )
    ids = load_canonical_component_ids(template_id, str(platform_id) if platform_id else None)
    source = str(candidate.get("sourceTerm") or "")
    raw = str(candidate.get("extractedTerm") or source)
    match = try_matcher_improvement(source, raw, context=ctx, canonical_ids=ids)
    return match.backlog_id if match else None


def _categorize_non_authorized_change(
    *,
    record: dict[str, Any],
    baseline: dict[str, Any] | None,
    staged: dict[str, Any] | None,
    manual_id: str,
    staged_candidate: dict[str, Any] | None,
) -> tuple[ChangeCategory, str]:
    """A=pre-existing matcher; B=authorized rule consequence; C=baseline inconsistency; D=unexplained."""
    if staged_candidate:
        indirect = _try_rule_attribution(manual_id, staged_candidate)
        if indirect:
            return (
                "B",
                f"Staged candidate aligns with approved rule {indirect} on term normalization even "
                "without matcher_improvement mappingType on this key (secondary matcher path).",
            )

    if baseline and staged:
        base_status = str(baseline.get("status") or "")
        staged_status = str(staged.get("status") or "")
        base_prop = baseline.get("proposedCanonicalId")
        staged_prop = staged.get("proposedCanonicalId")
        if base_prop == staged_prop and baseline.get("reviewClass") != staged.get("reviewClass"):
            return (
                "C",
                "Baseline classification inconsistent with its own proposed target; staged class aligns with target.",
            )
        if base_status != staged_status and base_prop != staged_prop:
            return (
                "A",
                "Candidate status/matcher path differs between frozen batch snapshot and current matcher regen "
                "(no matcher_improvement backlogId).",
            )
        if baseline.get("mappingType") != staged.get("mappingType") and not staged.get("matcherImprovementBacklogId"):
            return (
                "A",
                "MappingType/path change from batch snapshot to current matcher without matcher_improvement provenance.",
            )
        if base_prop is None and staged_prop is not None:
            return (
                "A",
                "Current matcher resolves a canonical target where batch snapshot left candidate unresolved/null.",
            )
        if base_prop is not None and staged_prop is None:
            return (
                "A",
                "Current matcher no longer emits prior canonical target for this key (regression in target emission).",
            )

    return (
        "D",
        "Could not attribute change to approved matcher rule, batch inconsistency, or known matcher-path drift.",
    )


def _build_all_deltas(
    baseline_root: Path,
    staged_root: Path,
    manual_ids: list[str],
) -> list[dict[str, Any]]:
    deltas: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for manual_id in manual_ids:
        base_map = _candidate_by_key(manual_id, baseline_root)
        staged_map = _candidate_by_key(manual_id, staged_root)
        keys = set(base_map) | set(staged_map)
        for key in keys:
            base_cand = base_map.get(key)
            staged_cand = staged_map.get(key)
            manual, procedure_id, source, extracted = key
            baseline = _enrich_side(manual_id, baseline_root, base_cand)
            staged = _enrich_side(manual_id, staged_root, staged_cand)
            if not baseline or not staged:
                continue
            class_changed = baseline["reviewClass"] != staged["reviewClass"]
            proposed_changed = baseline["proposedCanonicalId"] != staged["proposedCanonicalId"]
            if not class_changed and not proposed_changed:
                continue
            stable = _stable_candidate_key(manual, procedure_id, source, str(extracted or ""))
            if stable in seen_keys:
                continue
            seen_keys.add(stable)
            backlog_id = staged.get("matcherImprovementBacklogId")
            approved_target = (
                BACKLOG_MATCH_SPECS.get(str(backlog_id), {}).get("canonicalId") if backlog_id else None
            )
            attributable = bool(
                backlog_id
                and str(backlog_id) in set(approved_backlog_ids())
                and staged.get("mappingType") == "matcher_improvement",
            )
            deltas.append(
                {
                    "candidateKey": stable,
                    "manualId": manual,
                    "procedureId": procedure_id,
                    "procedureFamily": _procedure_family(procedure_id),
                    "candidateType": staged.get("candidateType") or baseline.get("candidateType"),
                    "baselineClassification": baseline["reviewClass"],
                    "stagedClassification": staged["reviewClass"],
                    "baselineProposedCanonicalId": baseline["proposedCanonicalId"],
                    "stagedProposedCanonicalId": staged["proposedCanonicalId"],
                    "baselineSourceTerm": baseline.get("sourceTerm"),
                    "stagedSourceTerm": staged.get("sourceTerm"),
                    "mappingType": staged.get("mappingType") or baseline.get("mappingType"),
                    "matcherImprovementBacklogId": backlog_id,
                    "provenance": staged.get("provenance") or baseline.get("provenance"),
                    "whyStagedChanged": _why_staged_changed(
                        baseline=baseline,
                        staged=staged,
                        backlog_id=str(backlog_id) if backlog_id else None,
                        approved_target=str(approved_target) if approved_target else None,
                    ),
                    "attributableToApprovedMatcherRule": attributable,
                },
            )
    return sorted(deltas, key=lambda r: (r["manualId"], r["procedureId"], r["candidateKey"]))


def _collect_unresolved_transitions(
    baseline_root: Path,
    staged_root: Path,
    manual_ids: list[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    removed: list[dict[str, Any]] = []
    added: list[dict[str, Any]] = []
    for manual_id in manual_ids:
        base_map = _candidate_by_key(manual_id, baseline_root)
        staged_map = _candidate_by_key(manual_id, staged_root)
        for key in set(base_map) | set(staged_map):
            base_cand = base_map.get(key)
            staged_cand = staged_map.get(key)
            manual, procedure_id, source, extracted = key
            baseline = _enrich_side(manual_id, baseline_root, base_cand)
            staged = _enrich_side(manual_id, staged_root, staged_cand)
            if baseline and staged:
                if baseline["reviewClass"] == "unresolved" and staged["reviewClass"] != "unresolved":
                    removed.append(
                        {
                            "candidateKey": _stable_candidate_key(manual, procedure_id, source, str(extracted or "")),
                            "manualId": manual,
                            "procedureId": procedure_id,
                            "procedureFamily": _procedure_family(procedure_id),
                            "baselineClass": baseline["reviewClass"],
                            "stagedClass": staged["reviewClass"],
                            "baselineProposed": baseline["proposedCanonicalId"],
                            "stagedProposed": staged["proposedCanonicalId"],
                            "sourceTerm": source,
                            "matcherImprovementBacklogId": staged.get("matcherImprovementBacklogId"),
                            "directMatcherImprovement": staged.get("mappingType") == "matcher_improvement",
                        },
                    )
                if baseline["reviewClass"] != "unresolved" and staged["reviewClass"] == "unresolved":
                    added.append(
                        {
                            "candidateKey": _stable_candidate_key(manual, procedure_id, source, str(extracted or "")),
                            "manualId": manual,
                            "procedureId": procedure_id,
                            "procedureFamily": _procedure_family(procedure_id),
                            "baselineClass": baseline["reviewClass"],
                            "stagedClass": staged["reviewClass"],
                            "baselineProposed": baseline["proposedCanonicalId"],
                            "stagedProposed": staged["proposedCanonicalId"],
                            "sourceTerm": source,
                            "baselineMappingType": baseline.get("mappingType"),
                            "stagedMappingType": staged.get("mappingType"),
                            "baselineStatus": baseline.get("status"),
                            "stagedStatus": staged.get("status"),
                            "evidence": {
                                "baseline": baseline,
                                "staged": staged,
                            },
                        },
                    )
            elif base_cand and not staged_cand and baseline and baseline["reviewClass"] == "unresolved":
                removed.append(
                    {
                        "candidateKey": _stable_candidate_key(manual, procedure_id, source, str(extracted or "")),
                        "manualId": manual,
                        "note": "key_removed_in_staged",
                        "sourceTerm": source,
                    },
                )
            elif staged_cand and not base_cand and staged and staged["reviewClass"] == "unresolved":
                added.append(
                    {
                        "candidateKey": _stable_candidate_key(manual, procedure_id, source, str(extracted or "")),
                        "manualId": manual,
                        "note": "key_added_in_staged",
                        "sourceTerm": source,
                    },
                )
    return sorted(removed, key=lambda r: r.get("candidateKey", "")), sorted(added, key=lambda r: r.get("candidateKey", ""))


def _implementation_specific_transitions(
    baseline_root: Path,
    staged_root: Path,
    manual_ids: list[str],
) -> list[dict[str, Any]]:
    transitions: list[dict[str, Any]] = []
    for manual_id in manual_ids:
        base_map = _candidate_by_key(manual_id, baseline_root)
        staged_map = _candidate_by_key(manual_id, staged_root)
        for key in set(base_map) & set(staged_map):
            baseline = _enrich_side(manual_id, baseline_root, base_map[key])
            staged = _enrich_side(manual_id, staged_root, staged_map[key])
            if not baseline or not staged:
                continue
            if baseline["reviewClass"] == "implementationSpecific" and staged["reviewClass"] != "implementationSpecific":
                manual, procedure_id, source, extracted = key
                transitions.append(
                    {
                        "candidateKey": _stable_candidate_key(manual, procedure_id, source, str(extracted or "")),
                        "manualId": manual,
                        "procedureId": procedure_id,
                        "baselineClassification": baseline["reviewClass"],
                        "stagedClassification": staged["reviewClass"],
                        "baselineProposed": baseline["proposedCanonicalId"],
                        "stagedProposed": staged["proposedCanonicalId"],
                        "matcherImprovementBacklogId": staged.get("matcherImprovementBacklogId"),
                        "why": _why_staged_changed(
                            baseline=baseline,
                            staged=staged,
                            backlog_id=staged.get("matcherImprovementBacklogId"),
                            approved_target=None,
                        ),
                    },
                )
            if baseline["reviewClass"] != "implementationSpecific" and staged["reviewClass"] == "implementationSpecific":
                transitions.append(
                    {
                        "candidateKey": "gain",
                        "direction": "to_implementationSpecific",
                        "manualId": manual_id,
                        "procedureId": key[1],
                        "sourceTerm": key[2],
                    },
                )
    return transitions


def _group_matcher_improvements(
    staged_root: Path,
    manual_ids: list[str],
    cohort: dict[str, Any],
) -> list[dict[str, Any]]:
    by_backlog: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for manual_id in manual_ids:
        for candidate in _mapping_candidates_from_dir(manual_id, staged_root):
            if candidate.get("mappingType") != "matcher_improvement":
                continue
            backlog_id = str((candidate.get("matcherImprovement") or {}).get("backlogId") or "")
            if backlog_id:
                by_backlog[backlog_id].append(candidate)

    groups: list[dict[str, Any]] = []
    for backlog_id in sorted(approved_backlog_ids()):
        records = by_backlog.get(backlog_id) or []
        keys: list[str] = []
        families: set[str] = set()
        manuals: set[str] = set()
        items: list[dict[str, Any]] = []
        spec = BACKLOG_MATCH_SPECS.get(backlog_id, {})
        for candidate in records:
            provenance = candidate.get("provenance") or {}
            manual_id = str(provenance.get("manualId") or "")
            procedure_id = str(provenance.get("procedureId") or "")
            source = str(candidate.get("sourceTerm") or "")
            extracted = str(candidate.get("extractedTerm") or "")
            key = _stable_candidate_key(manual_id, procedure_id, source, extracted)
            keys.append(key)
            families.add(_procedure_family(procedure_id))
            manuals.add(manual_id)
            base_cand = _candidate_by_key(manual_id, CANDIDATES_DIR).get(
                _candidate_identity(manual_id, "canonical_mapping", candidate),
            )
            baseline = _enrich_side(manual_id, CANDIDATES_DIR, base_cand)
            staged = _enrich_side(manual_id, staged_root, candidate)
            items.append(
                {
                    "candidateKey": key,
                    "manualId": manual_id,
                    "procedureId": procedure_id,
                    "baselineClassification": (baseline or {}).get("reviewClass"),
                    "stagedClassification": (staged or {}).get("reviewClass"),
                    "baselineProposed": (baseline or {}).get("proposedCanonicalId"),
                    "stagedProposed": (staged or {}).get("proposedCanonicalId"),
                    "reasonRuleFired": _why_staged_changed(
                        baseline=baseline,
                        staged=staged,
                        backlog_id=backlog_id,
                        approved_target=str(spec.get("canonicalId") or ""),
                    ),
                },
            )
        groups.append(
            {
                "backlogId": backlog_id,
                "approvedTarget": spec.get("canonicalId"),
                "authorizedManualIds": cohort.get("backlogToManualIds", {}).get(backlog_id) or [],
                "affectedProcedureFamilies": sorted(families),
                "affectedManualIds": sorted(manuals),
                "candidateKeys": sorted(keys),
                "records": items,
                "mappingCount": len(records),
            },
        )
    return groups


def _categorize_added_unresolved(
    entry: dict[str, Any],
    manual_id: str,
    staged_root: Path,
) -> tuple[ChangeCategory, str]:
    staged_map = _candidate_by_key(manual_id, staged_root)
    key_parts = entry.get("candidateKey", "").split("::", 3)
    if len(key_parts) >= 3:
        lookup_key = None
        for k in staged_map:
            if k[0] == manual_id and k[2] == entry.get("sourceTerm"):
                lookup_key = k
                break
        staged_cand = staged_map.get(lookup_key) if lookup_key else None
    else:
        staged_cand = None
    baseline_evidence = (entry.get("evidence") or {}).get("baseline") or {}
    staged_evidence = (entry.get("evidence") or {}).get("staged") or {}
    if baseline_evidence.get("proposedCanonicalId") and not staged_evidence.get("proposedCanonicalId"):
        return (
            "A",
            "Staged regen dropped canonical target while changing mappingType/status; batch had classified as non-unresolved.",
        )
    if baseline_evidence.get("mappingType") != staged_evidence.get("mappingType"):
        return (
            "A",
            "Matcher path change (mappingType) reclassified record as unresolved under current matcher.",
        )
    if baseline_evidence.get("reviewClass") == "existingCanonicalMapping":
        return (
            "C",
            "Baseline review class disagreed with unresolved candidate status fields; staged applies stricter unresolved rule.",
        )
    return (
        "A",
        "Expected drift: current matcher classifies this key unresolved where batch snapshot did not.",
    )


def _workbench_summary(package: dict[str, Any]) -> dict[str, Any]:
    """Read-only summary shaped like matcher-improvement review queues (no UI wiring)."""
    return {
        "gateId": "matcher-improvement-corpus-delta-v1",
        "reportType": "matcher_improvement_corpus_delta_workbench_summary",
        "readOnly": True,
        "promotionGate": False,
        "title": "Matcher corpus delta review (staging vs production baseline)",
        "counts": package.get("counts") or {},
        "queues": [
            {
                "queueId": "all-mapping-deltas",
                "label": f"All mapping deltas ({package.get('counts', {}).get('allDeltas', 0)})",
                "itemIds": [d["candidateKey"] for d in (package.get("allDeltas") or [])],
            },
            {
                "queueId": "matcher-improvement-mappings",
                "label": f"Authorized matcher improvements ({package.get('counts', {}).get('matcherImprovementMappings', 0)})",
                "itemIds": [
                    key
                    for group in (package.get("matcherImprovementGroups") or [])
                    for key in (group.get("candidateKeys") or [])
                ],
            },
            {
                "queueId": "non-authorized-proposed-changes",
                "label": (
                    f"Proposed-ID changes without backlogId "
                    f"({package.get('counts', {}).get('nonAuthorizedProposedChanges', 0)})"
                ),
                "itemIds": [d["candidateKey"] for d in (package.get("nonAuthorizedProposedChanges") or [])],
            },
            {
                "queueId": "added-to-unresolved",
                "label": f"Newly unresolved ({package.get('counts', {}).get('addedToUnresolved', 0)})",
                "itemIds": [d["candidateKey"] for d in (package.get("addedToUnresolved") or [])],
            },
        ],
        "reviewerBrief": (
            "Read-only delta package for staged full-corpus regen. Does not modify production candidates "
            "or the 796 human decisions. Approve nothing automatically."
        ),
    }


def run_delta_review_gate() -> dict[str, Any]:
    errors: list[str] = []
    hold_reasons: list[str] = []

    impl = load_implementation_audit()
    if impl.get("status") != "GREEN":
        errors.append("implementation audit not GREEN")

    regen_path = CALIBRATION_DIR / REGENERATION_FILENAME
    if not regen_path.is_file():
        errors.append(f"missing {REGENERATION_FILENAME}")
    staged = staging_root()
    if not staged.is_dir():
        errors.append(f"missing staged corpus: {staged}")

    manual_ids = production_manual_ids()
    if len(manual_ids) != 72:
        errors.append(f"expected 72 manuals, found {len(manual_ids)}")

    cohort = cohort_from_approved_rules()
    approved_ids = set(approved_backlog_ids())
    decisions = load_matcher_improvement_decisions()
    deferred_ids = {
        bid
        for bid, entry in (decisions.get("decisions") or {}).items()
        if entry.get("reviewStatus") == "defer"
    }
    rejected_ids = {
        bid
        for bid, entry in (decisions.get("decisions") or {}).items()
        if entry.get("reviewStatus") == "reject"
    }

    production_before = _production_integrity_snapshot()
    prod_mapping_hash = hashlib.sha256()
    for manual_id in manual_ids:
        path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
        if path.is_file():
            prod_mapping_hash.update(path.read_bytes())

    all_deltas = _build_all_deltas(CANDIDATES_DIR, staged, manual_ids)
    removed_unresolved, added_unresolved = _collect_unresolved_transitions(CANDIDATES_DIR, staged, manual_ids)
    impl_specific = _implementation_specific_transitions(CANDIDATES_DIR, staged, manual_ids)
    matcher_groups = _group_matcher_improvements(staged, manual_ids, cohort)

    matcher_count = sum(g["mappingCount"] for g in matcher_groups)
    if matcher_count != 46:
        errors.append(f"matcher improvement mapping count {matcher_count} != 46")

    def _matcher_attributed_removal(row: dict[str, Any]) -> bool:
        return bool(row.get("matcherImprovementBacklogId")) or bool(row.get("directMatcherImprovement"))

    removed_with_mi = [r for r in removed_unresolved if _matcher_attributed_removal(r)]
    removed_without_mi = [r for r in removed_unresolved if not _matcher_attributed_removal(r)]
    if len(removed_with_mi) != 46:
        errors.append(
            f"removed-from-unresolved matcher-attributed count {len(removed_with_mi)} != 46",
        )
    if len(removed_without_mi) != 12:
        errors.append(
            f"removed-from-unresolved non-matcher count {len(removed_without_mi)} != 12 "
            f"(total removed {len(removed_unresolved)})",
        )
    if len(added_unresolved) != 12:
        errors.append(f"added-to-unresolved count {len(added_unresolved)} != 12")

    non_authorized: list[dict[str, Any]] = []
    for delta in all_deltas:
        if delta.get("attributableToApprovedMatcherRule"):
            continue
        if delta.get("baselineProposedCanonicalId") == delta.get("stagedProposedCanonicalId"):
            continue
        base_map = _candidate_by_key(delta["manualId"], CANDIDATES_DIR)
        staged_map = _candidate_by_key(delta["manualId"], staged)
        key = (
            delta["manualId"],
            delta["procedureId"],
            str(delta.get("baselineSourceTerm") or ""),
            "",
        )
        for k in base_map:
            if k[0] == delta["manualId"] and k[1] == delta["procedureId"] and k[2] == delta.get("baselineSourceTerm"):
                key = k
                break
        category, explanation = _categorize_non_authorized_change(
            record=delta,
            baseline=_enrich_side(delta["manualId"], CANDIDATES_DIR, base_map.get(key)),
            staged=_enrich_side(delta["manualId"], staged, staged_map.get(key)),
            manual_id=delta["manualId"],
            staged_candidate=staged_map.get(key),
        )
        entry = {**delta, "changeCategory": category, "categoryExplanation": explanation}
        non_authorized.append(entry)
        if category == "D":
            hold_reasons.append(f"unexplained change: {delta['candidateKey']}")

    added_enriched: list[dict[str, Any]] = []
    for entry in added_unresolved:
        if entry.get("note"):
            cat, expl = ("A", "New mapping key in staged corpus classified unresolved.")
        else:
            cat, expl = _categorize_added_unresolved(entry, entry["manualId"], staged)
        enriched = {**entry, "changeCategory": cat, "categoryExplanation": expl, "reasonBecameUnresolved": expl}
        added_enriched.append(enriched)
        if cat == "D":
            hold_reasons.append(f"unexplained newly unresolved: {entry.get('candidateKey')}")

    staged_improvements = []
    for manual_id in manual_ids:
        for c in _mapping_candidates_from_dir(manual_id, staged):
            if c.get("mappingType") == "matcher_improvement":
                staged_improvements.append(c)
    review_items = {
        str(i["backlogId"]): i for i in (load_matcher_improvement_review().get("reviewItems") or [])
    }
    validation = _validate_matcher_improvements(
        staged_improvements,
        approved_ids=approved_ids,
        deferred_ids=deferred_ids,
        rejected_ids=rejected_ids,
        cohort=cohort,
    )
    errors.extend(validation.get("errors") or [])
    errors.extend(
        _validate_review_terminology(staged_improvements, items_by_id=review_items),
    )

    wave1 = json.loads(WAVE1_CLOSURE.read_text(encoding="utf-8")) if WAVE1_CLOSURE.is_file() else {}
    wave2 = json.loads(WAVE2_CLOSURE.read_text(encoding="utf-8")) if WAVE2_CLOSURE.is_file() else {}
    hashes_ok, hash_errors = validate_frozen_hashes()
    if not hashes_ok:
        errors.extend(hash_errors)

    wave_integrity = _wave_accepted_integrity(staged_root=staged, manual_ids=set(manual_ids))
    if not wave_integrity.get("passed"):
        errors.extend([f"wave integrity: {v}" for v in (wave_integrity.get("violations") or [])[:5]])

    production_after = _production_integrity_snapshot()
    if production_before != production_after:
        errors.append("production review state changed during delta review gate")

    prod_mapping_hash_after = hashlib.sha256()
    for manual_id in manual_ids:
        path = CANDIDATES_DIR / manual_id / "canonical_mapping_candidates.json"
        if path.is_file():
            prod_mapping_hash_after.update(path.read_bytes())
    if prod_mapping_hash.digest() != prod_mapping_hash_after.digest():
        errors.append("production mapping corpus mutated")

    baseline_arch = 0
    staged_arch = 0
    for manual_id in manual_ids:
        if _architecture_exception_from_dir(manual_id, CANDIDATES_DIR):
            baseline_arch += 1
        if _architecture_exception_from_dir(manual_id, staged):
            staged_arch += 1
    if staged_arch > baseline_arch:
        errors.append("architecture exception introduced in staged corpus")

    impl_loss = [t for t in impl_specific if t.get("direction") != "to_implementationSpecific"]
    impl_gain = [t for t in impl_specific if t.get("direction") == "to_implementationSpecific"]
    if len(impl_loss) - len(impl_gain) != 1:
        hold_reasons.append(
            f"implementationSpecific net change {len(impl_gain) - len(impl_loss)} (expected -1)",
        )

    reconciliation = {
        "removedFromUnresolvedTotal": len(removed_unresolved),
        "removedViaMatcherImprovement": len(removed_with_mi),
        "removedViaOtherPaths": len(removed_without_mi),
        "addedToUnresolvedTotal": len(added_unresolved),
        "matcherImprovementMappings": matcher_count,
        "allDeltaRecords": len(all_deltas),
        "arithmetic": (
            f"{len(removed_with_mi)} matcher-improvement + {len(removed_without_mi)} other removals "
            f"= {len(removed_with_mi) + len(removed_without_mi)} removed-from-unresolved; "
            f"{len(added_unresolved)} added-to-unresolved"
        ),
    }
    if len(removed_with_mi) + len(removed_without_mi) != len(removed_unresolved):
        errors.append("removed-from-unresolved reconciliation does not sum")

    status = "GREEN — DELTA REVIEW READY"
    if errors or hold_reasons:
        status = "HOLD" if hold_reasons and not errors else "STOP"
    if errors and hold_reasons:
        status = "STOP"

    package_body = {
        "allDeltas": all_deltas,
        "matcherImprovementGroups": matcher_groups,
        "nonAuthorizedProposedChanges": non_authorized,
        "addedToUnresolved": added_enriched,
        "removedFromUnresolvedReconciliation": {
            "matcherImprovementRemovals": removed_with_mi,
            "otherRemovals": removed_without_mi,
        },
        "implementationSpecificTransition": {
            "netDelta": len(impl_gain) - len(impl_loss),
            "lostImplementationSpecific": impl_loss,
            "gainedImplementationSpecific": impl_gain,
        },
        "counts": {
            "allDeltas": len(all_deltas),
            "matcherImprovementMappings": matcher_count,
            "nonAuthorizedProposedChanges": len(non_authorized),
            "addedToUnresolved": len(added_enriched),
            "removedFromUnresolved": len(removed_unresolved),
            "removedViaMatcherImprovement": len(removed_with_mi),
            "removedViaOtherPaths": len(removed_without_mi),
            "unexplainedNonAuthorized": sum(1 for x in non_authorized if x.get("changeCategory") == "D"),
            "unexplainedAddedUnresolved": sum(1 for x in added_enriched if x.get("changeCategory") == "D"),
        },
        "reconciliation": reconciliation,
    }

    review = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_delta_review",
        "status": status,
        "generatedAt": _utc_now(),
        "gateType": "targeted_delta_review_preflight",
        "promotionGate": False,
        "productionSwapAllowed": False,
        "inputs": {
            "stagedCorpus": str(staged),
            "productionCandidates": str(CANDIDATES_DIR),
            "fullCorpusRegeneration": REGENERATION_FILENAME,
            "implementationAudit": "CG_MATCHER_IMPROVEMENT_IMPLEMENTATION_AUDIT_v1.json",
        },
        **package_body,
        "workbenchSummary": _workbench_summary(package_body),
        "humanReviewSafety": {
            "wave1AcceptedChecked": wave_integrity.get("wave1AcceptedChecked"),
            "wave2AcceptedChecked": wave_integrity.get("wave2AcceptedChecked"),
            "waveIntegrityPassed": wave_integrity.get("passed"),
            "productionReviewUnchanged": production_before == production_after,
            "productionCandidatesUntouched": prod_mapping_hash.digest() == prod_mapping_hash_after.digest(),
            "frozenHashVerification": {"passed": hashes_ok},
            "deferredBacklogIds": sorted(deferred_ids),
            "rejectedBacklogIds": sorted(rejected_ids),
            "architectureExceptionDelta": staged_arch - baseline_arch,
        },
        "errors": errors,
        "holdReasons": hold_reasons,
    }

    audit = {
        "schemaVersion": 1,
        "reportType": "matcher_improvement_delta_review_audit",
        "status": status,
        "generatedAt": review["generatedAt"],
        "deltaReviewArtifact": DELTA_REVIEW_FILENAME,
        "integrityChecks": {
            "passed": not errors and not hold_reasons,
            "errors": errors,
            "holdReasons": hold_reasons,
            "reconciliationBalanced": len(removed_with_mi) + len(removed_without_mi) == len(removed_unresolved),
        },
    }

    return {"review": review, "audit": audit}


def write_delta_review(payload: dict[str, Any]) -> tuple[Path, Path]:
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = delta_review_path()
    audit_out = delta_review_audit_path()
    out.write_text(json.dumps(payload["review"], indent=2), encoding="utf-8")
    audit_out.write_text(json.dumps(payload["audit"], indent=2), encoding="utf-8")
    summary_path = CALIBRATION_DIR / "CG_MATCHER_IMPROVEMENT_DELTA_REVIEW_WORKBENCH_SUMMARY_v1.json"
    summary_path.write_text(json.dumps(payload["review"].get("workbenchSummary") or {}, indent=2), encoding="utf-8")
    return out, audit_out


def run_delta_review_tests() -> dict[str, Any]:
    scripts_dir = Path(__file__).resolve().parents[2]
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/test_matcher_improvement_delta_review.py",
        "-q",
    ]
    proc = subprocess.run(cmd, cwd=scripts_dir, capture_output=True, text=True)
    return {
        "passed": proc.returncode == 0,
        "returnCode": proc.returncode,
        "stdout": proc.stdout[-2000:],
        "stderr": proc.stderr[-800:],
    }
