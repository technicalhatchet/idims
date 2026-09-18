#!/usr/bin/env python3
"""CG-5.4 — Human decision effort per manual (compiler compounding metric)."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, MANUFACTURER_OVERLAYS_DIR, REVIEW_DIR
from normalization.promotion.planner import MANUAL_TO_OVERLAY
from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization
from normalization.review.alias_families import load_alias_families_from_gap_report
from normalization.review.ledger import load_ledger
from normalization.review.review_package import materialize_review_package
from normalization.semantic_inheritance import record_has_semantic_platform_inheritance

AUTO_REVIEWERS = frozenset({"auto-easy", "compiler_loop", "alias-family"})

WHIRLPOOL_FL_PRIOR_ORDER = ["W8178558", "W11169652"]
WHIRLPOOL_FL_PROMOTION_ORDER = ["W8178558", "W11169652"]  # frozen v1 baseline scope
WHIRLPOOL_TL_PRIOR_ORDER = ["W10864849", "W11697231", "W11416787"]
WHIRLPOOL_WASHER_PROMOTION_ORDER = [
    *WHIRLPOOL_FL_PRIOR_ORDER,
    *WHIRLPOOL_TL_PRIOR_ORDER,
]
SAMSUNG_FL_CORPUS_PRIOR = WHIRLPOOL_FL_PRIOR_ORDER  # canonical corpus only — no Whirlpool platform vocabulary
SAMSUNG_FL_PROMOTION_ORDER = ["SAMSUNG-FL-BB8700-WASHER", "SAMSUNG-FL-WF6000R-WASHER"]
TL_REPLICATION_BASELINE_PLATFORM_ID = "whirlpool_tl_dd"

# Gate-preview metrics are authoritative compounding measurements.
# Post-publish pipeline metrics are operational/debug only — see compounding_methodology_v1.json.


def resolve_promotion_prior_manual_ids(manual_id: str) -> list[str]:
    if manual_id in SAMSUNG_FL_PROMOTION_ORDER:
        idx = SAMSUNG_FL_PROMOTION_ORDER.index(manual_id)
        return [*SAMSUNG_FL_CORPUS_PRIOR, *SAMSUNG_FL_PROMOTION_ORDER[:idx]]
    if manual_id not in WHIRLPOOL_WASHER_PROMOTION_ORDER:
        return []
    idx = WHIRLPOOL_WASHER_PROMOTION_ORDER.index(manual_id)
    return WHIRLPOOL_WASHER_PROMOTION_ORDER[:idx]


def resolve_platform_family_prior_manual_ids(manual_id: str) -> list[str]:
    if manual_id not in WHIRLPOOL_TL_PRIOR_ORDER:
        return []
    idx = WHIRLPOOL_TL_PRIOR_ORDER.index(manual_id)
    return WHIRLPOOL_TL_PRIOR_ORDER[:idx]


def resolve_samsung_platform_family_prior_manual_ids(manual_id: str) -> list[str]:
    if manual_id not in SAMSUNG_FL_PROMOTION_ORDER:
        return []
    idx = SAMSUNG_FL_PROMOTION_ORDER.index(manual_id)
    return SAMSUNG_FL_PROMOTION_ORDER[:idx]


def _is_human_decision(reviewer: str | None) -> bool:
    return bool(reviewer) and reviewer not in AUTO_REVIEWERS


def _normalize_term(term: str | None) -> str:
    return str(term or "").strip().lower()


def load_published_overlay_aliases(
    prior_manual_ids: list[str] | None = None,
) -> dict[str, str]:
    """OEM term -> canonical id from published manufacturer overlays for prior manuals."""
    aliases: dict[str, str] = {}
    if not prior_manual_ids:
        return aliases

    overlay_files = {
        entry["overlayFile"]
        for manual_id in prior_manual_ids
        for entry in [MANUAL_TO_OVERLAY.get(manual_id)]
        if entry and entry.get("overlayFile")
    }
    for filename in sorted(overlay_files):
        path = MANUFACTURER_OVERLAYS_DIR / filename
        if not path.is_file():
            continue
        overlay = json.loads(path.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies") or []:
            if family.get("manualId") not in prior_manual_ids:
                continue
            for term, canonical in (family.get("oemTermAliases") or {}).items():
                if canonical:
                    aliases[str(term)] = str(canonical)
    return aliases


def build_corpus_knowledge(
    prior_manual_ids: list[str] | None = None,
) -> dict[str, set[tuple[str, ...]]]:
    """Knowledge established before promoting the target manual."""
    ledger = load_ledger().get("candidates", {})
    canonical_mappings: set[tuple[str, str]] = set()
    procedure_bindings: set[tuple[str, str]] = set()
    measurement_bindings: set[tuple[str, str]] = set()
    overlay_aliases = load_published_overlay_aliases(prior_manual_ids)

    for candidate_id, entry in ledger.items():
        manual_id = entry.get("manualId")
        if prior_manual_ids is not None and manual_id not in prior_manual_ids:
            continue
        if entry.get("status") not in {"approved", "promoted"}:
            continue

        review_path = REVIEW_DIR / f"{manual_id}_review.json"
        if not review_path.is_file():
            continue
        package = json.loads(review_path.read_text(encoding="utf-8"))
        record = next(
            (row for row in package.get("records", []) if row.get("candidateId") == candidate_id),
            None,
        )
        if not record:
            continue

        ctype = record.get("candidateType")
        if ctype == "canonicalMapping":
            canonical = record.get("mapsTo") or entry.get("resolvedCanonicalId")
            term = record.get("what")
            if canonical and term:
                canonical_mappings.add((_normalize_term(canonical), _normalize_term(term)))
        elif ctype == "procedureTestBinding":
            proposed = record.get("proposedChange", {}).get("value", {})
            proc_id = proposed.get("procedureId")
            target = proposed.get("testTargetId")
            if proc_id and target:
                procedure_bindings.add((str(proc_id), str(target)))
        elif ctype == "measurementBinding":
            proposed = record.get("proposedChange", {}).get("value", {})
            proc_id = proposed.get("procedureId")
            knowledge_id = proposed.get("measurementKnowledgeId")
            if proc_id and knowledge_id:
                measurement_bindings.add((str(proc_id), str(knowledge_id)))

    for family in load_alias_families_from_gap_report():
        canonical_id = family.get("canonicalId")
        if not canonical_id:
            continue
        for term in family.get("sampleTerms") or []:
            canonical_mappings.add((_normalize_term(canonical_id), _normalize_term(term)))

    for term, canonical in overlay_aliases.items():
        canonical_mappings.add((_normalize_term(canonical), _normalize_term(term)))

    return {
        "canonicalMappings": canonical_mappings,
        "procedureBindings": procedure_bindings,
        "measurementBindings": measurement_bindings,
        "overlayAliases": overlay_aliases,
        "priorManualIds": prior_manual_ids or [],
    }


def _record_mapping_key(
    record: dict,
    *,
    ledger_entry: dict | None = None,
    overlay_aliases: dict[str, str] | None = None,
) -> tuple[str, str] | None:
    canonical = record.get("mapsTo") or (ledger_entry or {}).get("resolvedCanonicalId")
    term = record.get("what")
    if not term:
        return None
    if not canonical and overlay_aliases:
        canonical = overlay_aliases.get(term) or overlay_aliases.get(str(term).strip())
    if canonical and term:
        return (_normalize_term(canonical), _normalize_term(term))
    return None


def _record_is_inherited(
    record: dict,
    corpus: dict[str, set[tuple[str, ...]]],
    *,
    ledger_entry: dict | None = None,
) -> bool:
    ctype = record.get("candidateType")
    if ctype == "canonicalMapping":
        key = _record_mapping_key(
            record,
            ledger_entry=ledger_entry,
            overlay_aliases=corpus.get("overlayAliases"),
        )
        return bool(key and key in corpus["canonicalMappings"])

    proposed = record.get("proposedChange", {}).get("value", {})
    if ctype == "procedureTestBinding":
        proc_id = proposed.get("procedureId")
        target = proposed.get("testTargetId")
        if proc_id and target:
            return (str(proc_id), str(target)) in corpus["procedureBindings"]
    if ctype == "measurementBinding":
        proc_id = proposed.get("procedureId")
        knowledge_id = proposed.get("measurementKnowledgeId")
        if proc_id and knowledge_id:
            return (str(proc_id), str(knowledge_id)) in corpus["measurementBindings"]
    return False


def _manual_procedure_prefix(manual_id: str) -> str:
    return f"w{manual_id[1:].lower()}-" if manual_id.startswith("W") else f"{manual_id.lower()}-"


def _record_is_model_specific(record: dict, manual_id: str) -> bool:
    """Reporting-only: candidate tied to this manual's native procedure seeds."""
    proc_id = str((record.get("source") or {}).get("procedureId") or "").lower()
    return proc_id.startswith(_manual_procedure_prefix(manual_id))


def _record_needs_decision(record: dict, ledger_status: str) -> bool:
    if ledger_status in {"approved", "promoted", "rejected"}:
        return False
    level = record.get("approvalLevel")
    status = record.get("status") or "candidate"
    return (
        level == "blocked"
        or status == "needs_review"
        or level == "careful"
        or status == "COMPOUND_TERM_CANDIDATE"
        or status == "candidate"
    )


def load_human_classification_manifest(manual_id: str) -> dict | None:
    for name in (f"{manual_id.lower()}_human_classification.json", f"{manual_id}_human_classification.json"):
        path = CALIBRATION_DIR / name
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    return None


def summarize_human_classification(manifest: dict | None) -> dict:
    if not manifest:
        return {}

    summary = dict(manifest.get("summary") or {})
    by_subtype: dict[str, int] = {}
    for row in manifest.get("classifications") or []:
        subtype = str(row.get("platformSubtype") or "unknown")
        by_subtype[subtype] = by_subtype.get(subtype, 0) + 1

    return {
        "promotionGateDecisions": summary.get("promotionGateDecisions"),
        "newCanonicalKnowledge": summary.get("newCanonicalKnowledge", 0),
        "newPlatformKnowledge": summary.get("newPlatformKnowledge"),
        "reusableTlPlatformConcept": summary.get("reusableTlPlatformConcept"),
        "oneOffOemTerminology": summary.get("oneOffOemTerminology"),
        "knownConceptNewTlImplementation": summary.get("knownConceptNewTlImplementation"),
        "newTlAlias": summary.get("newTlAlias"),
        "newTlProcedureBinding": summary.get("newTlProcedureBinding"),
        "inheritedFlCorpusConcepts": summary.get("inheritedFlCorpusConcepts"),
        "inheritedTlPlatformFamily": summary.get("inheritedTlPlatformFamily"),
        "byPlatformSubtype": by_subtype,
        "architectureBoundary": manifest.get("architectureBoundary"),
    }


def collect_knowledge_classification(
    manual_id: str,
    metrics: dict,
) -> dict:
    """Classify knowledge: inherited vs new platform (with subtypes) vs new canonical."""
    if metrics.get("inheritedCorpusKnowledge") is not None:
        new_human = int(metrics.get("newHumanDecisionCount") or 0)
        new_model = int(metrics.get("newModelSpecificKnowledge") or 0)
        new_canonical = int(metrics.get("newCanonicalKnowledgeCount") or 0)
        return {
            "inheritedKnowledge": int(metrics.get("inheritedResolvedAutomatically") or 0),
            "inheritedCorpusKnowledge": int(metrics.get("inheritedCorpusKnowledge") or 0),
            "inheritedPlatformFamilyKnowledge": int(
                metrics.get("inheritedPlatformFamilyKnowledge") or 0,
            ),
            "newPlatformKnowledge": max(new_human - new_model - new_canonical, 0),
            "newModelSpecificKnowledge": new_model,
            "newCanonicalKnowledge": new_canonical,
        }

    manifest = load_human_classification_manifest(manual_id)
    if manifest and manifest.get("summary") and manual_id == "W10864849":
        human = summarize_human_classification(manifest)
        gate = manifest.get("promotionGateMetrics") or {}
        return {
            "inheritedKnowledge": int(
                gate.get("inheritedResolvedAutomatically")
                or metrics.get("inheritedResolvedAutomatically")
                or 0,
            ),
            "inheritedCorpusKnowledge": human.get("inheritedFlCorpusConcepts"),
            "inheritedPlatformFamilyKnowledge": human.get("inheritedTlPlatformFamily"),
            "newPlatformKnowledge": int(
                human.get("newPlatformKnowledge")
                or gate.get("newHumanDecisionCount")
                or 0,
            ),
            "newPlatformKnowledgeDetail": {
                "reusableTlPlatformConcept": human.get("reusableTlPlatformConcept"),
                "oneOffOemTerminology": human.get("oneOffOemTerminology"),
                "knownConceptNewTlImplementation": human.get("knownConceptNewTlImplementation"),
                "newTlAlias": human.get("newTlAlias"),
                "newTlProcedureBinding": human.get("newTlProcedureBinding"),
                "byPlatformSubtype": human.get("byPlatformSubtype"),
            },
            "newCanonicalKnowledge": int(human.get("newCanonicalKnowledge") or 0),
            "humanClassificationSource": f"{manual_id.lower()}_human_classification.json",
            "architectureBoundary": human.get("architectureBoundary"),
        }

    gap_path = CALIBRATION_DIR / "canonical_gap_report_v1_washer.json"
    new_canonical = 0
    if gap_path.is_file():
        report = json.loads(gap_path.read_text(encoding="utf-8"))
        for row in report.get("buckets", {}).get("canonical_ontology_candidate") or []:
            manual_ids = row.get("manualIds") or []
            if manual_id in manual_ids:
                new_canonical += 1

    inherited = int(metrics.get("inheritedResolvedAutomatically") or 0)
    new_human = int(metrics.get("newHumanDecisionCount") or 0)
    new_platform = max(new_human - new_canonical, 0)

    return {
        "inheritedKnowledge": inherited,
        "newPlatformKnowledge": new_platform,
        "newCanonicalKnowledge": new_canonical,
    }


def collect_manual_decision_metrics(
    manual_id: str,
    *,
    prior_manual_ids: list[str] | None = None,
) -> dict:
    review_path = REVIEW_DIR / f"{manual_id}_review.json"
    if not review_path.is_file():
        return {"manualId": manual_id, "error": "no review package"}

    package = json.loads(review_path.read_text(encoding="utf-8"))
    records = package.get("records") or []
    ledger = load_ledger().get("candidates", {})

    if prior_manual_ids is None:
        prior_manual_ids = resolve_promotion_prior_manual_ids(manual_id) or None

    fl_prior = [mid for mid in (prior_manual_ids or []) if mid in WHIRLPOOL_FL_PRIOR_ORDER]
    platform_prior = resolve_platform_family_prior_manual_ids(manual_id)
    samsung_platform_prior = resolve_samsung_platform_family_prior_manual_ids(manual_id)
    if manual_id in SAMSUNG_FL_PROMOTION_ORDER:
        # Samsung FL #1: corpus prior only. Samsung FL #2+: inherit Samsung platform vocabulary from #1.
        platform_prior = samsung_platform_prior
    elif not platform_prior and prior_manual_ids:
        platform_prior = [mid for mid in prior_manual_ids if mid in WHIRLPOOL_TL_PRIOR_ORDER]

    corpus = build_corpus_knowledge(prior_manual_ids)
    fl_corpus = build_corpus_knowledge(fl_prior or None)
    platform_corpus = build_corpus_knowledge(platform_prior or None)

    by_approval: dict[str, int] = {}
    by_status: dict[str, int] = {}
    by_type: dict[str, int] = {}
    human_approvals = 0
    human_rejections = 0
    auto_approvals = 0
    manual_resolutions = 0
    new_manual_resolutions = 0
    inherited_manual_resolutions = 0
    inherited_resolved_automatically = 0
    inherited_corpus_knowledge = 0
    inherited_platform_family_knowledge = 0
    new_human_decisions = 0
    new_model_specific_knowledge = 0
    new_canonical_knowledge_count = 0
    manual_platform_id = package.get("platformId")

    def _bump_new_decision_buckets(record: dict) -> None:
        nonlocal new_model_specific_knowledge
        if _record_is_model_specific(record, manual_id):
            new_model_specific_knowledge += 1
        elif (
            manual_platform_id
            and manual_platform_id != TL_REPLICATION_BASELINE_PLATFORM_ID
            and record.get("candidateType") == "canonicalMapping"
            and record.get("approvalLevel") in {"blocked", "careful"}
        ):
            # Different seed platform (e.g. whirlpool_tl_dd_5100) — OEM TEST variant.
            new_model_specific_knowledge += 1

    def _bump_inherited_buckets(record: dict) -> None:
        nonlocal inherited_corpus_knowledge, inherited_platform_family_knowledge
        in_platform = bool(platform_prior) and _record_is_inherited(record, platform_corpus)
        in_fl = bool(fl_prior) and _record_is_inherited(record, fl_corpus)
        if in_platform:
            inherited_platform_family_knowledge += 1
        elif in_fl:
            inherited_corpus_knowledge += 1

    for record in records:
        level = record.get("approvalLevel") or "unknown"
        status = record.get("status") or "candidate"
        ctype = record.get("candidateType") or "unknown"
        by_approval[level] = by_approval.get(level, 0) + 1
        by_status[status] = by_status.get(status, 0) + 1
        by_type[ctype] = by_type.get(ctype, 0) + 1

        candidate_id = record.get("candidateId")
        ledger_entry = ledger.get(candidate_id, {})
        reviewer = ledger_entry.get("reviewer") or record.get("reviewer")
        ledger_status = ledger_entry.get("status") or status
        inherited = _record_is_inherited(record, corpus, ledger_entry=ledger_entry)

        if level == "blocked" and ledger_status in {"needs_review", "candidate"}:
            manual_resolutions += 1
            if inherited:
                inherited_manual_resolutions += 1
            else:
                new_manual_resolutions += 1

        if ledger_status in {"approved", "promoted"}:
            if _is_human_decision(reviewer):
                human_approvals += 1
                new_human_decisions += 1
            else:
                auto_approvals += 1
                if inherited or reviewer == "alias-family":
                    inherited_resolved_automatically += 1
                    _bump_inherited_buckets(record)
        elif ledger_status == "rejected" and _is_human_decision(reviewer):
            human_rejections += 1
            new_human_decisions += 1
        elif _record_needs_decision(record, ledger_status):
            if inherited or record_has_semantic_platform_inheritance(record, platform_prior):
                inherited_resolved_automatically += 1
                _bump_inherited_buckets(record)
            elif level in {"easy", "normal"} and ctype in {
                "canonicalMapping",
                "procedureTestBinding",
                "measurementBinding",
            }:
                # Corpus-backed — would auto-approve without new human judgment.
                inherited_resolved_automatically += 1
                _bump_inherited_buckets(record)
            else:
                new_human_decisions += 1
                _bump_new_decision_buckets(record)

    human_decision_count = human_approvals + human_rejections + manual_resolutions
    total_records = len(records)
    decision_relevant = inherited_resolved_automatically + new_human_decisions
    new_human_decision_rate = (
        new_human_decisions / total_records if total_records else 0.0
    )
    inherited_resolution_rate = (
        inherited_resolved_automatically / decision_relevant
        if decision_relevant
        else 0.0
    )

    result = {
        "manualId": manual_id,
        "platformId": package.get("platformId"),
        "priorManualIds": prior_manual_ids or [],
        "totalReviewRecords": len(records),
        "byApprovalLevel": by_approval,
        "byStatus": by_status,
        "byType": by_type,
        "approved": sum(
            1 for r in records
            if (ledger.get(r.get("candidateId"), {}).get("status") or r.get("status"))
            in {"approved", "promoted"}
        ),
        "rejected": by_status.get("rejected", 0),
        "needsReview": by_status.get("needs_review", 0),
        "promoted": by_status.get("promoted", 0),
        "autoApprovals": auto_approvals,
        "humanApprovals": human_approvals,
        "humanRejections": human_rejections,
        "manualResolutionsRequired": manual_resolutions,
        "humanDecisionCount": human_decision_count,
        "newHumanDecisionCount": new_human_decisions,
        "inheritedResolvedAutomatically": inherited_resolved_automatically,
        "newManualResolutions": new_manual_resolutions,
        "inheritedManualResolutions": inherited_manual_resolutions,
        "newHumanDecisionRate": round(new_human_decision_rate, 4),
        "inheritedResolutionRate": round(inherited_resolution_rate, 4),
        "corpusKnowledgeSize": {
            "canonicalMappings": len(corpus["canonicalMappings"]),
            "procedureBindings": len(corpus["procedureBindings"]),
            "measurementBindings": len(corpus["measurementBindings"]),
        },
        "platformFamilyPriorManualIds": platform_prior,
        "flPriorManualIds": fl_prior,
        "inheritedCorpusKnowledge": inherited_corpus_knowledge,
        "inheritedPlatformFamilyKnowledge": inherited_platform_family_knowledge,
        "newPlatformKnowledgeCount": max(
            new_human_decisions - new_model_specific_knowledge - new_canonical_knowledge_count,
            0,
        ),
        "newModelSpecificKnowledge": new_model_specific_knowledge,
        "newCanonicalKnowledgeCount": new_canonical_knowledge_count,
        "knowledgeClassification": {},
    }

    result["knowledgeClassification"] = collect_knowledge_classification(manual_id, result)
    return result


def compare_compounding(
    baseline_manual_id: str,
    target_manual_id: str,
    *,
    prior_manual_ids: list[str] | None = None,
) -> dict:
    if prior_manual_ids is None:
        prior_manual_ids = [baseline_manual_id]

    baseline = collect_manual_decision_metrics(
        baseline_manual_id,
        prior_manual_ids=[],
    )
    target = collect_manual_decision_metrics(
        target_manual_id,
        prior_manual_ids=prior_manual_ids,
    )

    return {
        "schemaVersion": "1.0.0",
        "reportType": "compounding_comparison",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "baselineManualId": baseline_manual_id,
        "targetManualId": target_manual_id,
        "priorManualIds": prior_manual_ids,
        "baseline": baseline,
        "target": target,
        "delta": {
            "reviewRecords": target.get("totalReviewRecords", 0)
            - baseline.get("totalReviewRecords", 0),
            "humanDecisionCount": target.get("humanDecisionCount", 0)
            - baseline.get("humanDecisionCount", 0),
            "newHumanDecisionCount": target.get("newHumanDecisionCount", 0)
            - baseline.get("newHumanDecisionCount", 0),
            "manualResolutionsRequired": target.get("manualResolutionsRequired", 0)
            - baseline.get("manualResolutionsRequired", 0),
            "inheritedResolvedAutomatically": target.get("inheritedResolvedAutomatically", 0)
            - baseline.get("inheritedResolvedAutomatically", 0),
        },
    }


def collect_corpus_decision_metrics(
    template_id: str | None = "washer",
    manual_ids: list[str] | None = None,
    *,
    promotion_order: list[str] | None = None,
) -> dict:
    if manual_ids is None:
        manual_ids = [
            entry["manualId"]
            for entry in load_manifest().get("manuals", [])
            if not template_id or entry.get("templateId") == template_id
        ]

    promotion_order = promotion_order or []
    per_manual = []
    for manual_id in sorted(manual_ids):
        prior = [
            mid for mid in promotion_order
            if mid in manual_ids and mid != manual_id
            and promotion_order.index(mid) < promotion_order.index(manual_id)
        ] if manual_id in promotion_order else []
        per_manual.append(
            collect_manual_decision_metrics(manual_id, prior_manual_ids=prior or None),
        )

    valid = [row for row in per_manual if "error" not in row]

    return {
        "schemaVersion": "1.0.0",
        "reportType": "human_decision_metrics",
        "templateFilter": template_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manualCount": len(valid),
        "promotionOrder": promotion_order,
        "totals": {
            "reviewRecords": sum(r.get("totalReviewRecords", 0) for r in valid),
            "autoApprovals": sum(r.get("autoApprovals", 0) for r in valid),
            "humanApprovals": sum(r.get("humanApprovals", 0) for r in valid),
            "humanRejections": sum(r.get("humanRejections", 0) for r in valid),
            "manualResolutionsRequired": sum(r.get("manualResolutionsRequired", 0) for r in valid),
            "humanDecisionCount": sum(r.get("humanDecisionCount", 0) for r in valid),
            "newHumanDecisionCount": sum(r.get("newHumanDecisionCount", 0) for r in valid),
            "inheritedResolvedAutomatically": sum(
                r.get("inheritedResolvedAutomatically", 0) for r in valid
            ),
        },
        "perManual": per_manual,
    }


def format_decision_report(metrics: dict) -> str:
    lines = [
        "HUMAN DECISION METRICS",
        f"Template: {metrics.get('templateFilter')}",
        f"Manuals:  {metrics.get('manualCount')}",
        "",
        f"{'Manual':<28} {'Records':>8} {'Appr':>6} {'Human':>6} {'New':>6} {'Inh':>6}",
    ]
    for row in metrics.get("perManual", []):
        if row.get("error"):
            continue
        lines.append(
            f"{row['manualId']:<28} {row.get('totalReviewRecords', 0):>8} "
            f"{row.get('approved', 0):>6} "
            f"{row.get('humanDecisionCount', 0):>6} "
            f"{row.get('newHumanDecisionCount', 0):>6} "
            f"{row.get('inheritedResolvedAutomatically', 0):>6}",
        )
    totals = metrics.get("totals") or {}
    lines.extend(
        [
            "",
            f"Auto approvals:              {totals.get('autoApprovals', 0)}",
            f"Human decisions (total):     {totals.get('humanDecisionCount', 0)}",
            f"New human decisions:         {totals.get('newHumanDecisionCount', 0)}",
            f"Inherited/auto-resolved:     {totals.get('inheritedResolvedAutomatically', 0)}",
            f"Manual resolutions:          {totals.get('manualResolutionsRequired', 0)}",
        ],
    )
    return "\n".join(lines)


def format_compounding_report(comparison: dict) -> str:
    baseline = comparison.get("baseline") or {}
    target = comparison.get("target") or {}
    delta = comparison.get("delta") or {}
    return "\n".join(
        [
            "COMPOUNDING COMPARISON",
            f"Baseline: {comparison.get('baselineManualId')} (first manual — all decisions are new)",
            f"Target:   {comparison.get('targetManualId')} "
            f"(prior corpus: {', '.join(comparison.get('priorManualIds') or [])})",
            "",
            f"{'Metric':<32} {'Baseline':>10} {'Target':>10} {'Delta':>10}",
            f"{'reviewRecords':<32} {baseline.get('totalReviewRecords', 0):>10} "
            f"{target.get('totalReviewRecords', 0):>10} {delta.get('reviewRecords', 0):>10}",
            f"{'approved':<32} {baseline.get('approved', 0):>10} "
            f"{target.get('approved', 0):>10} "
            f"{target.get('approved', 0) - baseline.get('approved', 0):>10}",
            f"{'humanDecisionCount':<32} {baseline.get('humanDecisionCount', 0):>10} "
            f"{target.get('humanDecisionCount', 0):>10} {delta.get('humanDecisionCount', 0):>10}",
            f"{'newHumanDecisionCount':<32} {baseline.get('newHumanDecisionCount', 0):>10} "
            f"{target.get('newHumanDecisionCount', 0):>10} {delta.get('newHumanDecisionCount', 0):>10}",
            f"{'manualResolutionsRequired':<32} {baseline.get('manualResolutionsRequired', 0):>10} "
            f"{target.get('manualResolutionsRequired', 0):>10} "
            f"{delta.get('manualResolutionsRequired', 0):>10}",
        f"{'inheritedResolvedAutomatically':<32} "
        f"{baseline.get('inheritedResolvedAutomatically', 0):>10} "
        f"{target.get('inheritedResolvedAutomatically', 0):>10} "
        f"{delta.get('inheritedResolvedAutomatically', 0):>10}",
        f"{'newHumanDecisionRate':<32} "
        f"{baseline.get('newHumanDecisionRate', 0):>10.1%} "
        f"{target.get('newHumanDecisionRate', 0):>10.1%} "
        f"{target.get('newHumanDecisionRate', 0) - baseline.get('newHumanDecisionRate', 0):>10.1%}",
        f"{'inheritedResolutionRate':<32} "
        f"{baseline.get('inheritedResolutionRate', 0):>10.1%} "
        f"{target.get('inheritedResolutionRate', 0):>10.1%} "
        f"{target.get('inheritedResolutionRate', 0) - baseline.get('inheritedResolutionRate', 0):>10.1%}",
    ],
    )


MANUAL_ARCHITECTURE: dict[str, str] = {
    "W8178558": "FL",
    "W11169652": "FL",
    "W10864849": "TL",
    "W11697231": "TL",
    "W11416787": "TL",
}


def _compounding_row(manual: dict, *, architecture: str, equivalence: str | None = None) -> dict:
    knowledge = manual.get("knowledgeClassification") or {}
    return {
        "manualId": manual.get("manualId"),
        "architecture": architecture,
        "reviewRecords": manual.get("totalReviewRecords"),
        "newHumanDecisionCount": manual.get("newHumanDecisionCount"),
        "newHumanDecisionRate": manual.get("newHumanDecisionRate"),
        "inheritedResolvedAutomatically": manual.get("inheritedResolvedAutomatically"),
        "inheritedResolutionRate": manual.get("inheritedResolutionRate"),
        "inheritedCorpusKnowledge": knowledge.get("inheritedCorpusKnowledge")
        or manual.get("inheritedCorpusKnowledge"),
        "inheritedPlatformFamilyKnowledge": knowledge.get("inheritedPlatformFamilyKnowledge")
        or manual.get("inheritedPlatformFamilyKnowledge"),
        "newPlatformKnowledge": knowledge.get("newPlatformKnowledge"),
        "newCanonicalKnowledge": knowledge.get("newCanonicalKnowledge"),
        "equivalence": equivalence,
    }


def _load_frozen_fl_baseline() -> dict[str, dict]:
    path = CALIBRATION_DIR / "compounding_baseline_v1_whirlpool_fl.json"
    if not path.is_file():
        return {}
    report = json.loads(path.read_text(encoding="utf-8"))
    gate = report.get("promotionGate", {}).get("manuals") or {}
    return {manual_id: dict(row) for manual_id, row in gate.items()}


def _load_frozen_tl_baseline() -> dict[str, dict]:
    rows: dict[str, dict] = {}

    tl1_path = CALIBRATION_DIR / "compounding_baseline_v1_whirlpool_tl.json"
    if tl1_path.is_file():
        report = json.loads(tl1_path.read_text(encoding="utf-8"))
        gate = report.get("promotionGate") or {}
        manual_id = gate.get("manualId")
        if manual_id:
            rows[manual_id] = {
                "reviewRecords": gate.get("reviewRecords"),
                "newHumanDecisionCount": gate.get("newHumanDecisionCount"),
                "inheritedResolvedAutomatically": gate.get("inheritedResolvedAutomatically"),
                "newHumanDecisionRate": gate.get("newHumanDecisionRate"),
                "inheritedResolutionRate": gate.get("inheritedResolutionRate"),
                "equivalence": gate.get("equivalence"),
                "newCanonicalKnowledge": gate.get("newCanonicalKnowledge"),
                "newPlatformKnowledge": gate.get("newHumanDecisionCount"),
                "newModelSpecificKnowledge": 0,
                "inheritedPlatformFamilyKnowledge": 0,
                "platformKnowledgeSummary": report.get("platformKnowledgeSummary"),
            }

    tl2_path = CALIBRATION_DIR / "compounding_baseline_v1_whirlpool_tl2.json"
    if tl2_path.is_file():
        report = json.loads(tl2_path.read_text(encoding="utf-8"))
        preview = report.get("promotionGatePreview") or {}
        post = report.get("postPublish") or {}
        manual_id = preview.get("manualId") or post.get("manualId")
        if manual_id:
            rows[manual_id] = {
                "reviewRecords": preview.get("reviewRecords"),
                "newHumanDecisionCount": preview.get("newHumanDecisionCount"),
                "inheritedResolvedAutomatically": preview.get("reviewRecords", 0)
                - preview.get("newHumanDecisionCount", 0),
                "newHumanDecisionRate": preview.get("newHumanDecisionRate"),
                "inheritedPlatformFamilyKnowledge": preview.get(
                    "inheritedPlatformFamilyKnowledge",
                ),
                "newPlatformKnowledge": preview.get("newPlatformKnowledge"),
                "newModelSpecificKnowledge": 0,
                "newCanonicalKnowledge": preview.get("newCanonicalKnowledge"),
                "equivalence": post.get("equivalence"),
            }

    tl3_path = CALIBRATION_DIR / "compounding_baseline_v1_whirlpool_tl3.json"
    if tl3_path.is_file():
        report = json.loads(tl3_path.read_text(encoding="utf-8"))
        preview = report.get("promotionGatePreview") or {}
        post = report.get("postPublish") or {}
        manual_id = preview.get("manualId") or post.get("manualId")
        if manual_id:
            rows[manual_id] = {
                "platformId": preview.get("platformId") or post.get("platformId"),
                "reviewRecords": preview.get("reviewRecords"),
                "newHumanDecisionCount": preview.get("newHumanDecisionCount"),
                "inheritedResolvedAutomatically": preview.get("reviewRecords", 0)
                - preview.get("newHumanDecisionCount", 0),
                "newHumanDecisionRate": preview.get("newHumanDecisionRate"),
                "inheritedPlatformFamilyKnowledge": preview.get(
                    "inheritedPlatformFamilyKnowledge",
                ),
                "newPlatformKnowledge": preview.get("newPlatformKnowledge"),
                "newModelSpecificKnowledge": preview.get("newModelSpecificKnowledge", 0),
                "newCanonicalKnowledge": preview.get("newCanonicalKnowledge"),
                "equivalence": post.get("equivalence"),
            }

    return rows


def write_forward_compounding_report(
    manual_ids: list[str] | None = None,
    *,
    version: str = "v1",
) -> Path:
    manual_ids = manual_ids or WHIRLPOOL_WASHER_PROMOTION_ORDER
    frozen_rows = {**_load_frozen_fl_baseline(), **_load_frozen_tl_baseline()}
    rows: dict[str, dict] = {}

    for manual_id in manual_ids:
        if manual_id in frozen_rows:
            frozen = frozen_rows[manual_id]
            platform_summary = frozen.get("platformKnowledgeSummary") or {}
            rows[manual_id] = {
                "manualId": manual_id,
                "architecture": MANUAL_ARCHITECTURE.get(manual_id, "?"),
                "reviewRecords": frozen.get("reviewRecords"),
                "newHumanDecisionCount": frozen.get("newHumanDecisionCount"),
                "newHumanDecisionRate": frozen.get("newHumanDecisionRate"),
                "inheritedResolvedAutomatically": frozen.get("inheritedResolvedAutomatically"),
                "inheritedResolutionRate": frozen.get("inheritedResolutionRate"),
                "newPlatformKnowledge": frozen.get("newHumanDecisionCount"),
                "newCanonicalKnowledge": frozen.get("newCanonicalKnowledge", 0),
                "platformKnowledgeDetail": platform_summary,
                "equivalence": frozen.get("equivalence"),
                "metricsSource": (
                    "frozen_baseline_v1_whirlpool_tl"
                    if manual_id == "W10864849"
                    else "frozen_baseline_v1_whirlpool_fl"
                ),
            }
            if manual_id == "W10864849":
                rows[manual_id]["inheritedPlatformFamilyKnowledge"] = 0
                rows[manual_id]["inheritedCorpusKnowledge"] = frozen.get("inheritedResolvedAutomatically")
                rows[manual_id]["humanClassification"] = summarize_human_classification(
                    load_human_classification_manifest(manual_id),
                )
            continue

        prior = resolve_promotion_prior_manual_ids(manual_id) or [
            mid for mid in manual_ids
            if mid != manual_id and manual_ids.index(mid) < manual_ids.index(manual_id)
        ]
        metrics = collect_manual_decision_metrics(manual_id, prior_manual_ids=prior or None)
        knowledge = metrics.get("knowledgeClassification") or {}
        rows[manual_id] = _compounding_row(
            metrics,
            architecture=MANUAL_ARCHITECTURE.get(manual_id, "?"),
            equivalence=None,
        )
        rows[manual_id]["metricsSource"] = "live_compounding_pipeline"
        rows[manual_id]["knowledgeClassification"] = knowledge
        rows[manual_id]["newPlatformKnowledge"] = knowledge.get("newPlatformKnowledge")
        rows[manual_id]["newCanonicalKnowledge"] = knowledge.get("newCanonicalKnowledge")

    report = {
        "schemaVersion": "1.0.0",
        "reportType": "forward_compounding",
        "version": version,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "promotionOrder": manual_ids,
        "manuals": rows,
        "notes": [
            "newCanonicalKnowledge should stay 0 unless repeated cross-manual evidence forces ontology expansion.",
            "newPlatformKnowledge = newHumanDecisionCount - newCanonicalKnowledge.",
            "W10864849 is the first architecture-boundary test (FL corpus prior, TL ontology).",
        ],
    }

    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = CALIBRATION_DIR / f"compounding_forward_{version}_whirlpool_washer.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return out


def format_forward_compounding_report(report: dict) -> str:
    manuals = report.get("manuals") or {}
    order = report.get("promotionOrder") or list(manuals.keys())
    headers = order
    lines = [
        "FORWARD COMPOUNDING REPORT",
        "",
        f"{'Metric':<28} " + " ".join(f"{h:>12}" for h in headers),
    ]

    def values(key: str, fmt: str = "d") -> list[str]:
        out: list[str] = []
        for manual_id in order:
            row = manuals.get(manual_id) or {}
            value = row.get(key)
            if value is None:
                out.append(f"{'?':>12}")
            elif fmt == "pct":
                out.append(f"{value:>11.1%}")
            else:
                out.append(f"{value:>12}")
        return out

    lines.append(f"{'Architecture':<28} " + " ".join(
        f"{(manuals.get(mid) or {}).get('architecture', '?'):>12}" for mid in order
    ))
    lines.append(f"{'New decisions':<28} " + " ".join(values("newHumanDecisionCount")))
    lines.append(f"{'New decision rate':<28} " + " ".join(values("newHumanDecisionRate", "pct")))
    lines.append(f"{'Inherited auto':<28} " + " ".join(values("inheritedResolvedAutomatically")))
    lines.append(f"{'Inherited rate':<28} " + " ".join(values("inheritedResolutionRate", "pct")))
    lines.append(f"{'TL platform inherited':<28} " + " ".join(values("inheritedPlatformFamilyKnowledge")))
    lines.append(f"{'FL corpus inherited':<28} " + " ".join(values("inheritedCorpusKnowledge")))
    lines.append(f"{'New platform':<28} " + " ".join(values("newPlatformKnowledge")))
    lines.append(f"{'New canonical':<28} " + " ".join(values("newCanonicalKnowledge")))
    lines.append(f"{'Equivalence':<28} " + " ".join(
        f"{(manuals.get(mid) or {}).get('equivalence') or '?':>12}" for mid in order
    ))
    return "\n".join(lines)


def write_tl_platform_compounding_report(
    tl_manual_ids: list[str] | None = None,
    *,
    version: str = "v1",
) -> Path:
    """Killer metric: TL #1 vs TL #2 platform-family compounding."""
    tl_manual_ids = tl_manual_ids or WHIRLPOOL_TL_PRIOR_ORDER
    frozen_tl = _load_frozen_tl_baseline()
    rows: dict[str, dict] = {}

    for index, manual_id in enumerate(tl_manual_ids):
        label = f"TL #{index + 1}"
        if manual_id in frozen_tl:
            frozen = frozen_tl[manual_id]
            rows[manual_id] = {
                "manualId": manual_id,
                "label": label,
                "platformId": frozen.get("platformId"),
                "inheritedPlatformFamilyKnowledge": frozen.get(
                    "inheritedPlatformFamilyKnowledge",
                    0 if manual_id == "W10864849" else None,
                ),
                "inheritedCorpusKnowledge": frozen.get("inheritedCorpusKnowledge")
                if frozen.get("inheritedCorpusKnowledge") is not None
                else (frozen.get("inheritedResolvedAutomatically") if manual_id == "W10864849" else 0),
                "newPlatformKnowledge": frozen.get("newPlatformKnowledge")
                if frozen.get("newPlatformKnowledge") is not None
                else frozen.get("newHumanDecisionCount"),
                "newModelSpecificKnowledge": frozen.get("newModelSpecificKnowledge", 0),
                "newCanonicalKnowledge": frozen.get("newCanonicalKnowledge", 0),
                "newHumanDecisionCount": frozen.get("newHumanDecisionCount"),
                "newHumanDecisionRate": frozen.get("newHumanDecisionRate"),
                "equivalence": frozen.get("equivalence"),
                "metricsSource": {
                    "W10864849": "frozen_baseline_v1_whirlpool_tl",
                    "W11697231": "frozen_baseline_v1_whirlpool_tl2",
                    "W11416787": "frozen_baseline_v1_whirlpool_tl3",
                }.get(manual_id, "frozen_baseline_v1_whirlpool_tl"),
            }
            continue

        prior = resolve_promotion_prior_manual_ids(manual_id)
        metrics = collect_manual_decision_metrics(manual_id, prior_manual_ids=prior)
        knowledge = metrics.get("knowledgeClassification") or {}
        equiv_path = CALIBRATION_DIR / f"promotion_equivalence_{manual_id}.json"
        equivalence = None
        if equiv_path.is_file():
            equivalence = json.loads(equiv_path.read_text(encoding="utf-8")).get("equivalent")
            if equivalence is not None:
                equivalence = "PASS" if equivalence else "FAIL"
        rows[manual_id] = {
            "manualId": manual_id,
            "label": label,
            "platformId": metrics.get("platformId"),
            "inheritedPlatformFamilyKnowledge": knowledge.get("inheritedPlatformFamilyKnowledge")
            or metrics.get("inheritedPlatformFamilyKnowledge"),
            "inheritedCorpusKnowledge": knowledge.get("inheritedCorpusKnowledge")
            or metrics.get("inheritedCorpusKnowledge"),
            "newPlatformKnowledge": knowledge.get("newPlatformKnowledge"),
            "newModelSpecificKnowledge": knowledge.get("newModelSpecificKnowledge")
            or metrics.get("newModelSpecificKnowledge"),
            "newCanonicalKnowledge": knowledge.get("newCanonicalKnowledge"),
            "newHumanDecisionCount": metrics.get("newHumanDecisionCount"),
            "newHumanDecisionRate": metrics.get("newHumanDecisionRate"),
            "platformFamilyPriorManualIds": metrics.get("platformFamilyPriorManualIds"),
            "equivalence": equivalence,
            "metricsSource": "live_compounding_pipeline",
        }

    report = {
        "schemaVersion": "1.0.0",
        "reportType": "tl_platform_compounding",
        "version": version,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "hypothesis": (
            "TL replication: #1 establish → #2 reproduce → #3 replicate. "
            "Expect high inheritedPlatformFamilyKnowledge and low newPlatformKnowledge."
        ),
        "manuals": rows,
        "reusableTlConceptsFromTl1": [
            "mode_shifter",
            "pressure_sensor",
            "lid_lock",
            "drive_motor",
            "drive pre-test orchestration",
            "TL procedure/measurement bindings",
        ],
        "notes": [
            "pressure_sensor remains TL-platform scoped — not universal canonical.",
            "FL and TL frozen baselines are immutable.",
        ],
    }

    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = CALIBRATION_DIR / f"compounding_tl_platform_{version}.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return out


def format_tl_platform_compounding_report(report: dict) -> str:
    manuals = report.get("manuals") or {}
    order = list(manuals.keys())
    lines = [
        "TL PLATFORM COMPOUNDING (killer metric)",
        "",
        f"{'Metric':<32} " + " ".join(f"{(manuals[mid].get('label') or mid):>14}" for mid in order),
    ]

    def row_values(key: str, fmt: str = "d") -> str:
        cells: list[str] = []
        for manual_id in order:
            value = (manuals.get(manual_id) or {}).get(key)
            if value is None:
                cells.append(f"{'?':>14}")
            elif fmt == "pct":
                cells.append(f"{value:>13.1%}")
            elif fmt == "s":
                cells.append(f"{str(value):>14}")
            else:
                cells.append(f"{value:>14}")
        return " ".join(cells)

    lines.append(f"{'Manual':<32} " + " ".join(f"{mid:>14}" for mid in order))
    lines.append(f"{'TL platform inherited':<32} {row_values('inheritedPlatformFamilyKnowledge')}")
    lines.append(f"{'FL corpus inherited':<32} {row_values('inheritedCorpusKnowledge')}")
    lines.append(f"{'New platform':<32} {row_values('newPlatformKnowledge')}")
    lines.append(f"{'New model-specific':<32} {row_values('newModelSpecificKnowledge')}")
    lines.append(f"{'New canonical':<32} {row_values('newCanonicalKnowledge')}")
    lines.append(f"{'New decisions':<32} {row_values('newHumanDecisionCount')}")
    lines.append(f"{'New decision rate':<32} {row_values('newHumanDecisionRate', 'pct')}")
    lines.append(f"{'Equivalence':<32} {row_values('equivalence', 's')}")
    return "\n".join(lines)


def write_compounding_baseline(
    *,
    baseline_manual_id: str = "W8178558",
    target_manual_id: str = "W11169652",
    version: str = "v1",
) -> Path:
    comparison = compare_compounding(
        baseline_manual_id,
        target_manual_id,
        prior_manual_ids=[baseline_manual_id],
    )
    baseline = comparison["baseline"]
    target = comparison["target"]

    def row(manual: dict, equivalence: str | None = None) -> dict:
        return {
            "manualId": manual.get("manualId"),
            "reviewRecords": manual.get("totalReviewRecords"),
            "approved": manual.get("approved"),
            "newHumanDecisionCount": manual.get("newHumanDecisionCount"),
            "inheritedResolvedAutomatically": manual.get("inheritedResolvedAutomatically"),
            "manualResolutionsRequired": manual.get("manualResolutionsRequired"),
            "humanDecisionCount": manual.get("humanDecisionCount"),
            "newHumanDecisionRate": manual.get("newHumanDecisionRate"),
            "inheritedResolutionRate": manual.get("inheritedResolutionRate"),
            "equivalence": equivalence,
        }

    report = {
        "schemaVersion": "1.0.0",
        "reportType": "compounding_baseline",
        "version": version,
        "generatedAt": comparison.get("generatedAt"),
        "baselineManualId": baseline_manual_id,
        "targetManualId": target_manual_id,
        "manuals": {
            baseline_manual_id: row(baseline, "PASS"),
            target_manual_id: row(target, None),
        },
        "comparison": comparison,
    }

    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = CALIBRATION_DIR / f"compounding_baseline_{version}_whirlpool_fl.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", default="washer")
    parser.add_argument("--manual", help="Single manual metrics")
    parser.add_argument("--compare", nargs=2, metavar=("BASELINE", "TARGET"))
    parser.add_argument("--prior-manuals", nargs="*", help="Prior manuals for corpus knowledge")
    parser.add_argument("--version", default="v1")
    parser.add_argument(
        "--materialize",
        action="store_true",
        help="Normalize + materialize review before metrics",
    )
    parser.add_argument(
        "--write-baseline",
        action="store_true",
        help="Write permanent compounding baseline (W8178558 vs W11169652)",
    )
    args = parser.parse_args()

    if args.write_baseline:
        out = write_compounding_baseline(version=args.version)
        print(f"Wrote {out}")
        comparison = json.loads(out.read_text(encoding="utf-8"))["comparison"]
        print(format_compounding_report(comparison))
        return 0

    if args.materialize and args.manual:
        manifest = load_manifest()
        entry = find_manual_entry(manifest, args.manual)
        run_manual_normalization(entry)
        materialize_review_package(args.manual, load_ledger())

    if args.compare:
        prior = args.prior_manuals or [args.compare[0]]
        comparison = compare_compounding(args.compare[0], args.compare[1], prior_manual_ids=prior)
        print(format_compounding_report(comparison))
        CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
        out = CALIBRATION_DIR / f"compounding_{args.compare[0]}_{args.compare[1]}.json"
        out.write_text(json.dumps(comparison, indent=2), encoding="utf-8")
        print(f"\nWrote {out}")
        return 0

    if args.manual:
        prior = args.prior_manuals or None
        metrics = collect_manual_decision_metrics(args.manual, prior_manual_ids=prior)
        print(json.dumps(metrics, indent=2))
        return 0

    metrics = collect_corpus_decision_metrics(
        template_id=args.template,
        promotion_order=WHIRLPOOL_FL_PROMOTION_ORDER,
    )
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    suffix = f"_{args.template}" if args.template else ""
    out = CALIBRATION_DIR / f"human_decision_metrics_{args.version}{suffix}.json"
    out.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(format_decision_report(metrics))
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
