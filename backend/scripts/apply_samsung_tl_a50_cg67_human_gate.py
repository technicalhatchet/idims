#!/usr/bin/env python3
"""Apply SAMSUNG-TL-A50-WASHER CG-6.7 WP3 human gate.

First human semantic gate for Samsung TL washer — not retroactive certification.
Approves rev1 inheritance candidates, records overlay vocabulary decisions, and
writes the authoritative gate decision ledger.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.ledger import load_ledger, update_candidate_status
from normalization.review.review_package import materialize_review_package

CALIBRATION = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "calibration"
)
TABLE_PATH = CALIBRATION / "SAMSUNG_TL_A50_WASHER_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION / "SAMSUNG_TL_A50_WASHER_gate_decision_ledger_v1.json"

MANUAL_ID = "SAMSUNG-TL-A50-WASHER"
GATE_KIND = "samsung_tl_first_manual_compounding"
REVIEWER = "human_gate_cg67"

APPROVE_INHERITANCE = frozenset({"approve_inherited_canonical"})
APPROVE_OVERLAY_VOCAB = frozenset(
    {
        "approve_platform_implementation",
        "approve_manufacturer_vocabulary",
        "approve_platform_vocabulary_role_split",
    }
)
APPROVE_ROLE_EVIDENCE = frozenset({"approve_procedure_role_evidence"})
DEFER_ACTIONS = frozenset(
    {
        "defer_human_review",
        "defer_platform_implementation",
        "defer_procedural_title",
    }
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def collect_candidate_ids_from_row(row: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for key in ("candidateIds", "compoundTitleCandidateIds"):
        for cid in row.get(key) or []:
            if cid and cid not in ids:
                ids.append(cid)
    return ids


def validate_contract(table: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    contract = table.get("canonicalContract") or {}
    allowed = set(contract.get("allowedCanonicalIds") or [])
    forbidden = set(contract.get("forbiddenCanonicalIds") or [])

    for item in table.get("gateBuckets", {}).get("A_canonical_inheritance", {}).get("items") or []:
        for component_id in item.get("canonicalComponents") or []:
            if component_id in forbidden:
                errors.append(f"forbidden canonical id in bucket A: {component_id}")
            elif component_id not in allowed:
                errors.append(f"non-rev1 canonical id in bucket A: {component_id}")

    isolation = table.get("manufacturerIsolation") or {}
    if isolation.get("whirlpoolOverlayDependentCount", 0) != 0:
        errors.append("Whirlpool overlay dependency must be zero before gating")
    for family in ("whirlpoolTl", "whirlpoolFl", "samsungFl"):
        if (isolation.get("crossLeaks") or {}).get(family):
            errors.append(f"cross-family leak present: {family}")

    pending = [
        seed.get("seedComponentId")
        for seed in table.get("gateBuckets", {}).get("B_samsung_knowledge", {}).get("seedReviews") or []
        if seed.get("gateAction") == "pending_human_review"
    ]
    if pending:
        errors.append(f"unresolved pending_human_review seed reviews: {pending}")

    return errors


def build_ledger_entries(table: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    buckets = table.get("gateBuckets") or {}

    for index, item in enumerate(buckets.get("A_canonical_inheritance", {}).get("items") or []):
        entries.append(
            {
                "artifactId": f"inheritance:{index}:{item.get('manualConcept')}",
                "bucket": "A_canonical_inheritance",
                "gateAction": item.get("gateAction"),
                "decisionKind": "inherited_canonical",
                "newSemanticDecision": False,
                "newCanonicalExpansion": False,
                "candidateIds": collect_candidate_ids_from_row(item),
                "canonicalComponents": item.get("canonicalComponents"),
                "canonicalTestTarget": item.get("canonicalTestTarget"),
                "layer": item.get("layer"),
                "rationale": item.get("rationale"),
            }
        )

    for seed in buckets.get("B_samsung_knowledge", {}).get("seedReviews") or []:
        action = seed.get("gateAction")
        is_new = action in APPROVE_OVERLAY_VOCAB
        entries.append(
            {
                "artifactId": f"seed:{seed.get('seedComponentId')}",
                "bucket": "B_samsung_knowledge",
                "gateAction": action,
                "decisionKind": "overlay_vocabulary" if is_new else "deferred_overlay",
                "newSemanticDecision": is_new,
                "newCanonicalExpansion": False,
                "seedComponentId": seed.get("seedComponentId"),
                "implementationComponent": seed.get("implementationComponent"),
                "canonicalFunctionalRole": seed.get("canonicalFunctionalRole"),
                "disposition": seed.get("disposition"),
                "procedureIds": seed.get("procedureIds"),
                "rationale": seed.get("rationale"),
                "humanGateNotes": seed.get("humanGateNotes"),
            }
        )

    for surface in buckets.get("B_samsung_knowledge", {}).get("procedureSurfaces") or []:
        entries.append(
            {
                "artifactId": f"surface:{surface.get('procedureId')}",
                "bucket": "B_samsung_knowledge",
                "gateAction": surface.get("gateAction"),
                "decisionKind": "deferred_overlay",
                "newSemanticDecision": False,
                "newCanonicalExpansion": False,
                "procedureId": surface.get("procedureId"),
                "seedComponentIds": surface.get("seedComponentIds"),
                "rationale": surface.get("rationale"),
            }
        )

    lid = buckets.get("C_evidence_derived_roles", {}).get("lidAuthorization") or {}
    for role in lid.get("roles") or []:
        entries.append(
            {
                "artifactId": f"role:{lid.get('procedureId')}:{role.get('roleId')}",
                "bucket": "C_evidence_derived_roles",
                "gateAction": role.get("gateAction"),
                "decisionKind": "procedure_role_evidence",
                "newSemanticDecision": False,
                "newCanonicalExpansion": False,
                "procedureId": lid.get("procedureId"),
                "roleId": role.get("roleId"),
                "canonicalComponents": role.get("canonicalComponents"),
                "measurementKnowledgeIds": role.get("measurementKnowledgeIds"),
                "forbiddenMatcherAlias": role.get("forbiddenMatcherAlias"),
                "seedFunctionalAlias": role.get("seedFunctionalAlias"),
            }
        )

    clutch = buckets.get("C_evidence_derived_roles", {}).get("clutchEvidence") or {}
    if clutch:
        entries.append(
            {
                "artifactId": f"clutch:{clutch.get('procedureId')}",
                "bucket": "C_evidence_derived_roles",
                "gateAction": "preserve_observation_evidence",
                "decisionKind": "observation_evidence",
                "newSemanticDecision": False,
                "newCanonicalExpansion": False,
                "procedureId": clutch.get("procedureId"),
                "seedComponent": clutch.get("seedComponent"),
                "functionalCanonical": clutch.get("functionalCanonical"),
                "observationVerdict": clutch.get("observationVerdict"),
                "driveSystemHits": clutch.get("driveSystemHits"),
            }
        )

    for index, item in enumerate(table.get("deferredProceduralTitles") or []):
        entries.append(
            {
                "artifactId": f"defer_title:{index}",
                "bucket": "deferred_procedural_noise",
                "gateAction": item.get("gateAction"),
                "decisionKind": "deferred_procedural_title",
                "newSemanticDecision": False,
                "newCanonicalExpansion": False,
                "candidateIds": item.get("candidateIds"),
                "manualConcept": item.get("manualConcept"),
                "rationale": item.get("rationale"),
            }
        )

    return entries


def summarize(entries: list[dict[str, Any]]) -> dict[str, Any]:
    by_kind: dict[str, int] = {}
    for entry in entries:
        kind = entry["decisionKind"]
        by_kind[kind] = by_kind.get(kind, 0) + 1
    new_semantic = sum(1 for entry in entries if entry.get("newSemanticDecision"))
    canonical_expansion = sum(1 for entry in entries if entry.get("newCanonicalExpansion"))
    return {
        "totalArtifacts": len(entries),
        "byDecisionKind": by_kind,
        "newOverlaySemanticDecisions": new_semantic,
        "canonicalExpansion": canonical_expansion,
        "inheritedCanonical": by_kind.get("inherited_canonical", 0),
        "overlayVocabulary": by_kind.get("overlay_vocabulary", 0),
        "deferredOverlay": by_kind.get("deferred_overlay", 0),
        "procedureRoleEvidence": by_kind.get("procedure_role_evidence", 0),
        "deferredProceduralTitles": by_kind.get("deferred_procedural_title", 0),
    }


def apply_candidate_ledger(table: dict[str, Any]) -> dict[str, int]:
    counts = {"approved": 0, "deferred": 0}
    buckets = table.get("gateBuckets") or {}

    for item in buckets.get("A_canonical_inheritance", {}).get("items") or []:
        if item.get("gateAction") not in APPROVE_INHERITANCE:
            continue
        canonical = (item.get("canonicalComponents") or [None])[0]
        test_target = item.get("canonicalTestTarget")
        for cid in collect_candidate_ids_from_row(item):
            update_candidate_status(
                cid,
                "approved",
                reviewer=REVIEWER,
                reason="SAMSUNG-TL-A50 CG-6.7 bucket A — rev1 canonical inheritance",
                manual_id=MANUAL_ID,
                resolved_canonical_id=canonical if isinstance(canonical, str) else None,
                resolved_test_target_id=test_target if isinstance(test_target, str) else None,
                resolution_classification="human_gate_inherited_canonical",
            )
            counts["approved"] += 1

    for item in table.get("deferredProceduralTitles") or []:
        if item.get("gateAction") not in DEFER_ACTIONS:
            continue
        for cid in item.get("candidateIds") or []:
            update_candidate_status(
                cid,
                "deferred",
                reviewer=REVIEWER,
                reason="OEM procedure title — bind by procedureId only",
                manual_id=MANUAL_ID,
                resolution_classification="human_gate_deferred_title",
            )
            counts["deferred"] += 1

    return counts


def main() -> int:
    table = load_json(TABLE_PATH)
    if table.get("gatePolicy", {}).get("publishBlocked") is not True:
        print("WARN: gate table publishBlocked is not true", file=sys.stderr)

    errors = validate_contract(table)
    if errors:
        print(f"FAIL: gate validation ({len(errors)} issues)", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    entries = build_ledger_entries(table)
    summary = summarize(entries)
    infra = table.get("infrastructureCorrection") or {}

    if summary["canonicalExpansion"] != 0:
        print("FAIL: canonical expansion decisions are forbidden", file=sys.stderr)
        return 1

    gated_at = datetime.now(timezone.utc).isoformat()
    candidate_counts = apply_candidate_ledger(table)
    package = materialize_review_package(MANUAL_ID, load_ledger())

    ledger = {
        "schemaVersion": "1.0.0",
        "reportType": "samsung_tl_a50_cg67_gate_decision_ledger",
        "gateKind": GATE_KIND,
        "manualId": MANUAL_ID,
        "platformId": table.get("platformId"),
        "canonicalOntologyId": table.get("canonicalOntologyId"),
        "canonicalContract": table.get("canonicalContract"),
        "proposedOverlayFile": table.get("proposedOverlayFile"),
        "gateTableArtifact": TABLE_PATH.name,
        "observationArtifact": table.get("observationArtifact"),
        "gatedAt": gated_at,
        "reviewer": REVIEWER,
        "purpose": (
            "CG-6.7 WP3 — first human semantic gate for Samsung TL washer against frozen "
            "top_load_washer rev1. Creates overlay vocabulary decisions; does not certify "
            "a pre-existing Samsung TL overlay."
        ),
        "infrastructureCorrection": {
            **infra,
            "semanticLearningFromRouting": 0,
            "note": (
                "WP1 observation: 17 canonical hits. WP1.1 routing correction: +6 hits. "
                "Semantic learning from routing: 0. WP3 overlay vocabulary decisions are "
                "separate from infrastructure correction."
            ),
        },
        "accounting": {
            "infrastructureCorrectionHits": infra.get("deltas", {}).get("canonicalInheritance", 6),
            "observationCanonicalInheritance": infra.get("before", {}).get("canonicalInheritance", 17),
            "postRoutingCanonicalInheritance": infra.get("after", {}).get("canonicalInheritance", 23),
            "newOverlaySemanticDecisions": summary["newOverlaySemanticDecisions"],
            "canonicalExpansion": 0,
            "forbiddenFamilyLeaks": table.get("gateAccounting", {}).get("forbiddenFamilyLeaks"),
            "candidateLedgerApproved": candidate_counts["approved"],
            "candidateLedgerDeferred": candidate_counts["deferred"],
            "note": (
                "newOverlaySemanticDecisions counts approved Samsung overlay vocabulary in "
                "bucket B only. Bucket A inheritance is rev1 reuse, not new learning."
            ),
        },
        "wp3HumanGateGuidance": table.get("wp3HumanGateGuidance"),
        "summary": summary,
        "entries": entries,
        "reviewPackageSummary": package.get("summary"),
        "publishBlocked": True,
        "publishPrerequisites": [
            "WP4 promotion dry-run",
            "canonical top_load_washer.json hash unchanged",
            "samsung_top_load_washer.json scaffold from gated overlay vocabulary",
        ],
    }

    gate_summary = table.get("gateSummary") or {}
    gate_summary.update(
        {
            "status": "gated",
            "gatedAt": gated_at,
            "ledgerArtifact": LEDGER_PATH.name,
            "reviewer": REVIEWER,
            **summary,
            **candidate_counts,
        }
    )
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    table["gatedAt"] = gated_at
    table["ledgerArtifact"] = LEDGER_PATH.name
    table["workPackage"] = "WP3_human_gate_complete"
    table["nextWorkPackage"] = "WP4_promotion_dry_run"

    write_json(TABLE_PATH, table)
    write_json(LEDGER_PATH, ledger)

    print(f"Gated: {TABLE_PATH.name}")
    print(f"Ledger: {LEDGER_PATH.name}")
    print(f"inheritedCanonical={summary['inheritedCanonical']}")
    print(f"newOverlaySemanticDecisions={summary['newOverlaySemanticDecisions']}")
    print(f"candidateApproved={candidate_counts['approved']}")
    print(f"candidateDeferred={candidate_counts['deferred']}")
    print(f"canonicalExpansion={summary['canonicalExpansion']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
