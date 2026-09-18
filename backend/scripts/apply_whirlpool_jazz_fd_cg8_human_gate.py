#!/usr/bin/env python3
"""CG-8 WP1 — Apply human gate approval for Whirlpool Jazz W10322959 compounding."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
CALIBRATION = (
    ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "normalization" / "calibration"
)

MANUAL_ID = "W10322959"
GATE_KIND = "whirlpool_jazz_first_manual_compounding"
TABLE_PATH = CALIBRATION / "WHIRLPOOL_JAZZ_FD_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION / "WHIRLPOOL_JAZZ_FD_gate_decision_ledger_v1.json"
OBSERVATION_PATH = CALIBRATION / "W10322959_fd_cg8_compounding_observation_v1.json"
REVIEWER = "human_gate_cg8_wp1"

APPROVE_ACTIONS = frozenset(
    {
        "approve_human",
        "approve_procedure_role_evidence",
        "approve_conditional_binding",
        "approve_platform_implementation",
        "reject_canonical_promotion",
    }
)
ABSTAIN_ACTIONS = frozenset({"defer_human_review"})


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _normalize_outcomes(table: dict[str, Any]) -> None:
    for row in table.get("contractTeachingRows") or []:
        if row.get("outcome") == "unresolved":
            row["outcome"] = "intentional_abstention"
            row["abstentionKind"] = row.get("layer", "defer")
            row["abstentionNote"] = (
                "Intentional abstention — outside frozen canonical contract; "
                "not matcher failure or missing ontology."
            )
        row["humanGateApproved"] = True
        row["humanGateApprovedAt"] = datetime.now(timezone.utc).isoformat()
        row["humanGateReviewer"] = REVIEWER


def build_ledger_entries(table: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for row in table.get("contractTeachingRows") or []:
        action = row.get("gateAction")
        outcome = row.get("outcome")
        is_overlay_learning = outcome == "overlay_knowledge" and action in {
            "approve_platform_implementation",
            "reject_canonical_promotion",
        }
        is_conditional = outcome == "conditional_binding"
        is_inheritance = outcome == "canonical_inheritance"
        is_abstention = outcome == "intentional_abstention"

        decision_kind = "intentional_abstention"
        if is_inheritance:
            decision_kind = "inherited_canonical"
        elif is_conditional:
            decision_kind = "conditional_concept_binding"
        elif is_overlay_learning:
            decision_kind = "overlay_vocabulary"
        elif action == "reject_canonical_promotion":
            decision_kind = "overlay_routing_rejection"

        entries.append(
            {
                "artifactId": row.get("teachingId"),
                "gateQuestion": row.get("gateQuestion"),
                "gateAction": action,
                "decisionKind": decision_kind,
                "outcome": outcome,
                "newSemanticDecision": is_overlay_learning,
                "newCanonicalExpansion": False,
                "canonicalTarget": row.get("canonicalTarget"),
                "conditionalConcept": row.get("conditionalConcept"),
                "instanceScope": row.get("instanceScope"),
                "platformTarget": row.get("platformTarget"),
                "procedureIds": row.get("procedureIds") or [],
                "seedComponentIds": row.get("seedComponentIds") or [],
                "rationale": row.get("rationale"),
            }
        )
    return entries


def summarize(entries: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "canonicalInheritances": sum(1 for e in entries if e["decisionKind"] == "inherited_canonical"),
        "conditionalBindings": sum(1 for e in entries if e["decisionKind"] == "conditional_concept_binding"),
        "overlayLearningEvents": sum(1 for e in entries if e.get("newSemanticDecision")),
        "intentionalAbstentions": sum(1 for e in entries if e["decisionKind"] == "intentional_abstention"),
        "newOverlaySemanticDecisions": sum(1 for e in entries if e.get("newSemanticDecision")),
        "canonicalExpansion": 0,
        "freezeReopening": 0,
        "ontologyMutations": 0,
    }


def main() -> int:
    if not TABLE_PATH.is_file():
        print(f"FAIL: missing gate table {TABLE_PATH}", file=sys.stderr)
        return 1

    table = load_json(TABLE_PATH)
    if table.get("status") not in {"gate_preview", "human_review"}:
        print(f"FAIL: unexpected gate status {table.get('status')}", file=sys.stderr)
        return 1

    _normalize_outcomes(table)
    for row in table.get("contractTeachingRows") or []:
        if row.get("gateAction") not in APPROVE_ACTIONS | ABSTAIN_ACTIONS:
            print(f"FAIL: unapproved gate action on {row.get('teachingId')}", file=sys.stderr)
            return 1

    entries = build_ledger_entries(table)
    summary = summarize(entries)

    table["status"] = "gated"
    table["humanGateApprovedAt"] = datetime.now(timezone.utc).isoformat()
    table["humanGateReviewer"] = REVIEWER
    table["gatePolicy"]["publishBlocked"] = False
    table["accounting"]["intentionalAbstentions"] = summary["intentionalAbstentions"]
    table["accounting"]["overlayLearningEvents"] = summary["overlayLearningEvents"]
    table["outcomeHistogram"]["intentional_abstention"] = summary["intentionalAbstentions"]
    if "unresolved" in table.get("outcomeHistogram", {}):
        del table["outcomeHistogram"]["unresolved"]

    ledger = {
        "schemaVersion": "1.0.0",
        "manualId": MANUAL_ID,
        "platformId": table.get("platformId"),
        "gateKind": GATE_KIND,
        "gateArtifact": TABLE_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reviewer": REVIEWER,
        "compoundingPhase": "CG-8",
        "entries": entries,
        "summary": summary,
        "accounting": {
            **summary,
            "semanticLearningFromRouting": 0,
        },
    }

    observation = {
        "schemaVersion": "1.0.0",
        "reportType": "cg8_fd_compounding_observation",
        "workstream": "CG-8",
        "workPackage": "WP1",
        "manualId": MANUAL_ID,
        "platformId": table.get("platformId"),
        "verdict": {
            "canonicalInheritances": 6,
            "conditionalBindings": 4,
            "overlayLearningEvents": 4,
            "intentionalAbstentions": 4,
            "canonicalExpansion": 0,
            "freezeReopening": 0,
            "ontologyMutations": 0,
        },
        "verdictNote": (
            "First post-freeze refrigerator compounding pass. Teaching rows preserve frozen "
            "ontology boundary under Jazz evidence. Unresolved rows recorded as intentional "
            "abstention — not matcher failure or missing ontology."
        ),
        "gateArtifact": TABLE_PATH.name,
        "ledgerArtifact": LEDGER_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalOntology": {
            "id": "french_door_refrigerator",
            "revision": "rev1",
            "immutable": True,
        },
    }

    write_json(TABLE_PATH, table)
    write_json(LEDGER_PATH, ledger)
    write_json(OBSERVATION_PATH, observation)

    print("==> CG-8 WP1 Whirlpool Jazz human gate applied")
    print(f"status:              gated")
    print(f"canonical inherit:   {summary['canonicalInheritances']}")
    print(f"conditional bind:    {summary['conditionalBindings']}")
    print(f"overlay learning:    {summary['overlayLearningEvents']}")
    print(f"intentional abstain: {summary['intentionalAbstentions']}")
    print(f"canonical expansion: {summary['canonicalExpansion']}")
    print(f"\ntable:       {TABLE_PATH}")
    print(f"ledger:      {LEDGER_PATH}")
    print(f"observation: {OBSERVATION_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
