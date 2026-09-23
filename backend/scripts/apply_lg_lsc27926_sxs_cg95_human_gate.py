#!/usr/bin/env python3
"""CG-9.5 WP3 — Apply human gate approval for LG LSC27926 SxS compounding."""

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

MANUAL_ID = "LG-LSC27926-SXS"
GATE_KIND = "sxs_production_compounding_lg"
TABLE_PATH = CALIBRATION / "LG_LSC27926_SXS_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION / "LG_LSC27926_SXS_gate_decision_ledger_v1.json"
OBSERVATION_PATH = CALIBRATION / "LG_LSC27926_SXS_cg95_compounding_observation_v1.json"
REVIEWER = "human_gate_cg95_wp3"

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
                "independentEvidence": row.get("independentEvidence"),
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
        "discoveryCorpusInheritance": 0,
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

    ledger = {
        "schemaVersion": "1.0.0",
        "manualId": MANUAL_ID,
        "platformId": table.get("platformId"),
        "gateKind": GATE_KIND,
        "gateArtifact": TABLE_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reviewer": REVIEWER,
        "compoundingPhase": "CG-9.5",
        "workPackage": "WP3",
        "entries": entries,
        "summary": summary,
        "accounting": {**summary, "semanticLearningFromRouting": 0},
    }

    observation = {
        "schemaVersion": "1.0.0",
        "reportType": "cg9_5_sxs_compounding_observation",
        "workstream": "CG-9.5",
        "workPackage": "WP3",
        "manualId": MANUAL_ID,
        "platformId": table.get("platformId"),
        "compoundingSequence": 3,
        "verdict": {
            "canonicalInheritances": 6,
            "conditionalBindings": 7,
            "overlayLearningEvents": 10,
            "intentionalAbstentions": 3,
            "canonicalExpansion": 0,
            "discoveryCorpusInheritance": 0,
            "freezeReopening": 0,
            "ontologyMutations": 0,
        },
        "verdictNote": (
            "Third SxS production compounding — full KEEP inheritance including dedicated "
            "door_switch with Test 1 fan-stop, ambient NTC scope, and explicit condenser_fan "
            "conditional. Conventional relay-drive compressor, BLDC fans, OptiChill damper as "
            "platform. LRMVS linear, Samsung SxS, and Whirlpool SxS overlays not imported. "
            "Six refrigerator overlays now on frozen contract."
        ),
        "gateArtifact": TABLE_PATH.name,
        "ledgerArtifact": LEDGER_PATH.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "canonicalOntology": {
            "id": "french_door_refrigerator",
            "revision": "rev1",
            "immutable": True,
            "hash": "adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9",
        },
    }

    write_json(TABLE_PATH, table)
    write_json(LEDGER_PATH, ledger)
    write_json(OBSERVATION_PATH, observation)

    print("==> CG-9.5 WP3 LG LSC27926 SxS human gate applied")
    print(f"canonical inherit:   {summary['canonicalInheritances']}")
    print(f"conditional bind:    {summary['conditionalBindings']}")
    print(f"overlay learning:    {summary['overlayLearningEvents']}")
    print(f"intentional abstain: {summary['intentionalAbstentions']}")
    print(f"canonical expansion: {summary['canonicalExpansion']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
