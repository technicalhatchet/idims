#!/usr/bin/env python3
"""Read-only corpus scan for scoped-evidence migration candidates. No seed mutation."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_ROOT = REPO_ROOT / "frontend/components/diagnostics/procedures/seed"
OUT_DIR = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
)

LOAD_SIDE_CONNECTOR_HINTS = re.compile(
    r"(?i)(at component|pump terminals|across the .* terminals|at the component|"
    r"measure across drain pump terminals|at load|winding at component)"
)
CONTROL_CONNECTOR_HINTS = re.compile(
    r"(?i)(at (the )?ccu|dp\d|j\d{1,2}|connector pins|at control|cn\d|ms\d|dl\d|he\d|"
    r"remove connector .+ from the (ccu|acu))"
)
HARNESS_STEP_HINTS = re.compile(r"(?i)harness|continuity")

OPEN_BRANCH_KINDS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_BRANCH_KINDS = {"measurement_normal"}


def is_procedure_seed(path: Path) -> bool:
    if path.name == "procedureCatalog.json":
        return False
    if "bundles" in path.parts:
        return False
    return path.suffix == ".json" and path.is_file()


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def branch_kind(when: dict[str, Any] | None) -> str | None:
    if not when:
        return None
    return when.get("kind")


def effect_summary(effect: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": effect.get("type"),
        "componentId": effect.get("componentId"),
        "evidenceId": effect.get("evidenceId"),
        "assertion": effect.get("assertion"),
        "measurementScope": effect.get("measurementScope"),
        "testPointKey": effect.get("testPointKey"),
    }


def step_text(step: dict[str, Any]) -> str:
    parts = [step.get("title") or "", step.get("body") or "", step.get("sourceExcerpt") or ""]
    return " ".join(parts)


def connector_label(step: dict[str, Any]) -> str | None:
    tp = step.get("testPoint") or {}
    return tp.get("connector")


def is_load_side_step(step: dict[str, Any]) -> bool:
    ctx = step.get("measurementContext") or {}
    if ctx.get("scope") == "at_load":
        return True
    sid = step.get("id") or ""
    if re.search(r"(?i)_at_component$|at_pump_terminals|pump_ohms_at_terminals|at_load", sid):
        return True
    label = connector_label(step) or ""
    text = step_text(step)
    if re.search(
        r"(?i)at (the )?component|at pump terminals|across the two .* terminals|"
        r"measure across .* terminals|at the heater|at the pump",
        text,
    ):
        if not re.search(r"(?i)dp\d|j\d{1,2}|ccu|acu|cn\d|he\d|dl\d|ms\d", label):
            return True
    if re.search(r"(?i)drain pump$|^drain pump|at component|terminals", label + " " + text):
        if not re.search(r"(?i)dp\d|j\d|ccu|acu|cn\d", label):
            return True
    if LOAD_SIDE_CONNECTOR_HINTS.search(text):
        return True
    return False


def is_path_connector_step(step: dict[str, Any]) -> bool:
    ctx = step.get("measurementContext") or {}
    if ctx.get("scope") in ("through_path", "at_control_connector"):
        return True
    label = connector_label(step) or ""
    text = step_text(step)
    if CONTROL_CONNECTOR_HINTS.search(label + " " + text):
        return True
    if step.get("id", "").lower().endswith("_at_ccu") or "_at_ccu" in step.get("id", ""):
        return True
    return False


def load_in_circuit_established(step: dict[str, Any], prior_steps: list[dict[str, Any]]) -> str:
    ctx = step.get("measurementContext") or {}
    if ctx.get("loadInCircuit") is True:
        return "explicit_true"
    if ctx.get("loadInCircuit") is False:
        return "explicit_false"
    # Structured sequence: prior disconnect at control only, not at load
    for ps in reversed(prior_steps):
        if ps.get("type") != "instruction":
            continue
        body = step_text(ps)
        if re.search(
            r"(?i)disconnect .+ (dp\d|he\d|dl\d|j\d+|connector).+ (ccu|acu)",
            body,
        ):
            if not re.search(r"(?i)disconnect .+ from the (drain pump|heater|pump)", body):
                return "sequence_strong"
    return "missing"


def step_by_id(proc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {s["id"]: s for s in proc.get("steps") or [] if "id" in s}


def harness_isolated_both_ends(step: dict[str, Any]) -> bool:
    return bool(
        re.search(
            r"(?i)disconnected at both|open on both ends|both the ccu and the",
            step_text(step),
        )
    )


def extract_measurement_events(proc: dict[str, Any]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    steps = proc.get("steps") or []
    step_by_id = {s["id"]: s for s in steps if "id" in s}
    ordered = sorted(steps, key=lambda s: s.get("order", 0))

    prior: list[dict[str, Any]] = []
    for step in ordered:
        if step.get("type") != "measurement":
            prior.append(step)
            continue
        for branch in step.get("branches") or []:
            kind = branch_kind(branch.get("when"))
            for effect in branch.get("diagnosticEffects") or []:
                events.append(
                    {
                        "stepId": step.get("id"),
                        "stepOrder": step.get("order"),
                        "branchId": branch.get("id"),
                        "branchKind": kind,
                        "nextStepId": branch.get("nextStepId"),
                        "testPoint": step.get("testPoint"),
                        "measurementContext": step.get("measurementContext"),
                        "measurementKnowledgeId": step.get("measurementKnowledgeId"),
                        "effect": effect_summary(effect),
                        "isLoadSide": is_load_side_step(step),
                        "isPathConnector": is_path_connector_step(step),
                        "loadInCircuit": load_in_circuit_established(step, prior),
                    }
                )
        prior.append(step)

    # harness / continuity visual checkpoints with component effects
    for step in ordered:
        if step.get("type") != "visual_check":
            continue
        if not HARNESS_STEP_HINTS.search(step.get("id", "") + " " + step_text(step)):
            continue
        for branch in step.get("branches") or []:
            kind = branch_kind(branch.get("when"))
            for effect in branch.get("diagnosticEffects") or []:
                events.append(
                    {
                        "stepId": step.get("id"),
                        "stepOrder": step.get("order"),
                        "branchId": branch.get("id"),
                        "branchKind": kind,
                        "nextStepId": branch.get("nextStepId"),
                        "testPoint": step.get("testPoint"),
                        "measurementContext": step.get("measurementContext"),
                        "measurementKnowledgeId": None,
                        "effect": effect_summary(effect),
                        "isLoadSide": False,
                        "isPathConnector": True,
                        "loadInCircuit": load_in_circuit_established(step, []),
                        "checkpointHarness": True,
                    }
                )
    return events


def find_pairs(events: list[dict[str, Any]]) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    by_component: dict[str, list[dict[str, Any]]] = {}
    for ev in events:
        cid = ev["effect"].get("componentId")
        if not cid:
            continue
        by_component.setdefault(cid, []).append(ev)

    for cid, comp_events in by_component.items():
        comp_events.sort(key=lambda e: (e.get("stepOrder") or 0, e.get("stepId") or ""))
        for i, early in enumerate(comp_events):
            if early.get("branchKind") not in PASS_BRANCH_KINDS:
                if early["effect"].get("type") != "eliminate":
                    continue
            else:
                if early["effect"].get("type") not in ("eliminate",) and not early["effect"].get(
                    "assertion"
                ) == "component_verified":
                    if early["effect"].get("type") != "eliminate":
                        continue
            early_order = early.get("stepOrder") or 0
            for late in comp_events[i + 1 :]:
                late_order = late.get("stepOrder") or 0
                if late_order <= early_order:
                    continue
                if late.get("branchKind") in OPEN_BRANCH_KINDS or late["effect"].get("type") == "confirm":
                    if late.get("branchKind") in PASS_BRANCH_KINDS:
                        continue
                    pairs.append((early, late))
                elif late.get("checkpointHarness") and late["effect"].get("type") == "confirm":
                    pairs.append((early, late))
    return pairs


def terminal_outcome(proc: dict[str, Any], step_id: str | None) -> dict[str, Any] | None:
    if not step_id:
        return None
    for step in proc.get("steps") or []:
        if step.get("id") == step_id and step.get("type") == "outcome":
            return {
                "stepId": step_id,
                "title": step.get("title"),
                "oemOutcome": step.get("oemOutcome"),
            }
    return None


def classify_pair(
    proc: dict[str, Any], early: dict[str, Any], late: dict[str, Any]
) -> tuple[str, dict[str, Any]]:
    component_id = early["effect"]["componentId"]
    proc_id = proc.get("id", "")
    platform = proc.get("platformId", "")

    measurement_steps = [
        s
        for s in proc.get("steps") or []
        if s.get("type") == "measurement" and s.get("branches")
    ]
    same_knowledge = early.get("measurementKnowledgeId") and (
        early.get("measurementKnowledgeId") == late.get("measurementKnowledgeId")
    )

    base = {
        "procedureId": proc_id,
        "platformId": platform,
        "componentId": component_id,
        "goodOrPassStep": {
            "stepId": early.get("stepId"),
            "branchId": early.get("branchId"),
            "branchKind": early.get("branchKind"),
            "effect": early.get("effect"),
            "testPoint": early.get("testPoint"),
            "measurementContext": early.get("measurementContext"),
        },
        "pathOrFailStep": {
            "stepId": late.get("stepId"),
            "branchId": late.get("branchId"),
            "branchKind": late.get("branchKind"),
            "effect": late.get("effect"),
            "testPoint": late.get("testPoint"),
            "measurementContext": late.get("measurementContext"),
            "checkpointHarness": late.get("checkpointHarness", False),
        },
        "loadInCircuit": late.get("loadInCircuit"),
        "sameMeasurementKnowledgeId": bool(same_knowledge),
        "terminalOutcome": terminal_outcome(proc, late.get("nextStepId")),
        "currentRepairHeadlineRisk": late["effect"].get("type") == "confirm"
        and late["effect"].get("assertion") not in ("path_open", "path_failed")
        and "failed" in (late["effect"].get("evidenceId") or ""),
    }

    steps_map = step_by_id(proc)
    late_step = steps_map.get(late.get("stepId") or "", {})

    if early["effect"].get("assertion") == "component_verified" and late["effect"].get(
        "assertion"
    ) == "path_open":
        base["migrationStatus"] = "migrated_gate2_control"
        return "CLEAR_PATH_SEMANTICS", base

    path_pair_candidate = early.get("isLoadSide") and (
        late.get("isPathConnector") or late.get("checkpointHarness")
    )

    if late.get("checkpointHarness"):
        if harness_isolated_both_ends(late_step):
            return "AMBIGUOUS_CONFIGURATION", {
                **base,
                "missing": [
                    "Pin-for-pin harness continuity with load isolated on both ends",
                    "Gate 2 witness uses through_path + loadInCircuit true at control connector",
                    "Requires scoped assertion vocabulary for isolated harness wire continuity",
                ],
            }
        if early.get("isLoadSide") and late.get("loadInCircuit") == "missing":
            return "AMBIGUOUS_CONFIGURATION", {
                **base,
                "missing": [
                    "loadInCircuit not explicit for harness continuity checkpoint",
                    "no measurementContext on checkpoint step",
                ],
            }
        if early.get("isLoadSide"):
            return "CLEAR_PATH_SEMANTICS", {
                **base,
                "candidateAssertion": "path_open",
                "candidateMeasurementScope": "through_path",
                "proposedEvidenceId": f"path_open_{component_id}_through_harness_check",
            }

    if early.get("isLoadSide") and late.get("isPathConnector"):
        lic = late.get("loadInCircuit")
        if lic in ("explicit_true", "sequence_strong"):
            if late.get("branchKind") in OPEN_BRANCH_KINDS:
                return "CLEAR_PATH_SEMANTICS", {
                    **base,
                    "candidateAssertion": "path_open",
                    "candidateMeasurementScope": "through_path",
                    "proposedEvidenceId": f"path_open_{component_id}_through_{late.get('stepId')}",
                }
            return "TRUE_COMPONENT_FAILURE", {
                **base,
                "reason": "Path connector step uses non-open branch semantics; may still be component-level failure.",
            }
        if lic == "missing":
            return "AMBIGUOUS_CONFIGURATION", {
                **base,
                "missing": [
                    "loadInCircuit not explicit in measurementContext",
                    "procedure sequence does not strongly establish in-circuit load for path measurement",
                ],
            }

    if not early.get("testPoint") or not late.get("testPoint"):
        return "INSUFFICIENT_EVIDENCE", {
            **base,
            "reason": "Missing structured testPoint on one or both steps.",
        }

    if early.get("isPathConnector") and late.get("isPathConnector"):
        return "TRUE_COMPONENT_FAILURE", {
            **base,
            "reason": "Both measurements appear at control/harness connectors without established load-side pass.",
        }

    if not early.get("isLoadSide") and late.get("isPathConnector"):
        return "AMBIGUOUS_CONFIGURATION", {
            **base,
            "missing": [
                "No established load-side good measurement before connector test",
            ],
        }

    if early.get("isLoadSide") and not late.get("isPathConnector"):
        return "TRUE_COMPONENT_FAILURE", {
            **base,
            "reason": "Later step still appears to test the component directly, not an external path.",
        }

    component_measurement_ids = {
        s.get("id")
        for s in measurement_steps
        if any(
            eff.get("componentId") == component_id
            for br in s.get("branches") or []
            for eff in br.get("diagnosticEffects") or []
        )
    }
    if len(component_measurement_ids) >= 3 and same_knowledge and not path_pair_candidate:
        extra = {
            **base,
            "measurementStepCount": len(component_measurement_ids),
            "reason": "Three or more Ω measurement points for same component/knowledge without a single load→path pair.",
        }
        return "MULTI_POINT_COMPOUND", extra

    return "INSUFFICIENT_EVIDENCE", {**base, "reason": "Could not establish path vs component semantics."}


def dedupe_key(record: dict[str, Any]) -> tuple[str, ...]:
    path = record.get("pathOrFailStep") or {}
    good = record.get("goodOrPassStep") or {}
    return (
        record.get("procedureId") or "",
        record.get("componentId") or "",
        good.get("stepId") or "",
        path.get("stepId") or "",
    )


def merge_clear_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[tuple[str, ...], dict[str, Any]] = {}
    for record in records:
        key = dedupe_key(record)
        if key not in merged:
            merged[key] = {**record, "pathBranchesNeedingMigration": []}
        path = record.get("pathOrFailStep") or {}
        branch_id = path.get("branchId")
        if branch_id:
            merged[key]["pathBranchesNeedingMigration"].append(
                {
                    "branchId": branch_id,
                    "branchKind": path.get("branchKind"),
                    "effect": path.get("effect"),
                    "currentRepairHeadlineRisk": record.get("currentRepairHeadlineRisk"),
                }
            )
        if record.get("migrationStatus") == "migrated_gate2_control":
            merged[key]["migrationStatus"] = "migrated_gate2_control"
    return list(merged.values())


def find_corpus_highlights(proc: dict[str, Any]) -> list[dict[str, Any]]:
    """Read-only annotations for patterns that need human review beyond primary class."""
    highlights: list[dict[str, Any]] = []
    pid = proc.get("id") or ""
    steps = sorted(proc.get("steps") or [], key=lambda s: s.get("order", 0))

    for step in steps:
        if step.get("type") != "visual_check":
            continue
        if not HARNESS_STEP_HINTS.search(step.get("id", "") + " " + step_text(step)):
            continue
        for branch in step.get("branches") or []:
            oem = branch.get("oemOutcome") or ""
            if branch.get("when", {}).get("kind") != "checkpoint_no":
                continue
            if not re.search(r"(?i)harness|wiring", oem):
                continue
            for eff in branch.get("diagnosticEffects") or []:
                if eff.get("type") != "confirm":
                    continue
                highlights.append(
                    {
                        "procedureId": pid,
                        "platformId": proc.get("platformId"),
                        "pattern": "harness_repair_outcome_confirms_component",
                        "stepId": step.get("id"),
                        "branchId": branch.get("id"),
                        "componentId": eff.get("componentId"),
                        "evidenceId": eff.get("evidenceId"),
                        "primaryClassification": None,
                        "note": "OEM outcome targets harness/wiring but diagnostic effect confirms component.",
                    }
                )

    load_pass_orders: dict[str, int] = {}
    for step in steps:
        if step.get("type") != "measurement" or not is_load_side_step(step):
            continue
        for branch in step.get("branches") or []:
            if branch_kind(branch.get("when")) != "measurement_normal":
                continue
            for eff in branch.get("diagnosticEffects") or []:
                if eff.get("type") == "eliminate" and eff.get("componentId"):
                    load_pass_orders[eff["componentId"]] = step.get("order") or 0

    for step in steps:
        if step.get("type") != "visual_check":
            continue
        if not harness_isolated_both_ends(step):
            continue
        for branch in step.get("branches") or []:
            if branch.get("when", {}).get("kind") != "checkpoint_no":
                continue
            for eff in branch.get("diagnosticEffects") or []:
                cid = eff.get("componentId")
                if not cid or cid not in load_pass_orders:
                    continue
                if (step.get("order") or 0) < load_pass_orders[cid]:
                    highlights.append(
                        {
                            "procedureId": pid,
                            "platformId": proc.get("platformId"),
                            "pattern": "harness_fault_before_load_pass_in_step_order",
                            "stepId": step.get("id"),
                            "branchId": branch.get("id"),
                            "componentId": cid,
                            "note": "ACU-first branch: harness fault step precedes at-load pass in step order.",
                        }
                    )
    return highlights


def primary_classification_per_procedure(
    proc_classifications: dict[str, list[dict[str, Any]]],
) -> str | None:
    priority = [
        "CLEAR_PATH_SEMANTICS",
        "AMBIGUOUS_CONFIGURATION",
        "MULTI_POINT_COMPOUND",
        "TRUE_COMPONENT_FAILURE",
        "INSUFFICIENT_EVIDENCE",
    ]
    for cls in priority:
        if proc_classifications.get(cls):
            return cls
    return None


def main() -> None:
    seed_files = sorted(SEED_ROOT.rglob("*.json"))
    procedure_files = [p for p in seed_files if is_procedure_seed(p)]

    classifications: dict[str, list[dict[str, Any]]] = {
        "CLEAR_PATH_SEMANTICS": [],
        "AMBIGUOUS_CONFIGURATION": [],
        "TRUE_COMPONENT_FAILURE": [],
        "MULTI_POINT_COMPOUND": [],
        "INSUFFICIENT_EVIDENCE": [],
    }
    false_positive_exclusions: list[dict[str, Any]] = []
    candidate_procedures: set[str] = set()
    procedure_primary: dict[str, str] = {}
    corpus_highlights: list[dict[str, Any]] = []
    scanned = 0

    for path in procedure_files:
        proc = load_json(path)
        if not proc or not proc.get("id") or not proc.get("steps"):
            continue
        scanned += 1
        corpus_highlights.extend(find_corpus_highlights(proc))
        events = extract_measurement_events(proc)
        pairs = find_pairs(events)
        if not pairs:
            continue

        proc_classifications: dict[str, list[dict[str, Any]]] = {}
        for early, late in pairs:
            # Skip if late is soft confirm without failure evidence
            eid = late["effect"].get("evidenceId") or ""
            if late["effect"].get("type") == "confirm" and "failed" not in eid and not late.get(
                "checkpointHarness"
            ):
                if late.get("branchKind") not in OPEN_BRANCH_KINDS:
                    false_positive_exclusions.append(
                        {
                            "procedureId": proc.get("id"),
                            "reason": "Late confirm without explicit failure evidence id",
                            "late": late,
                        }
                    )
                    continue

            cls, record = classify_pair(proc, early, late)
            record["seedPath"] = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
            proc_classifications.setdefault(cls, []).append(record)
            candidate_procedures.add(proc["id"])

        primary = primary_classification_per_procedure(proc_classifications)
        if primary:
            procedure_primary[proc["id"]] = primary
        for cls, records in proc_classifications.items():
            classifications[cls].extend(records)

    classifications["CLEAR_PATH_SEMANTICS"] = merge_clear_records(
        classifications["CLEAR_PATH_SEMANTICS"]
    )

    primary_counts: dict[str, int] = {}
    for cls in classifications:
        primary_counts[cls] = 0
    for cls in procedure_primary.values():
        primary_counts[cls] = primary_counts.get(cls, 0) + 1

    for item in corpus_highlights:
        item["primaryClassification"] = procedure_primary.get(item["procedureId"])

    # Known positive control
    witness = {
        "procedureId": "w8178558-drain-pump",
        "platformId": "whirlpool_duet_sport",
        "classification": "CLEAR_PATH_SEMANTICS",
        "migrationStatus": "migrated_gate2_control",
        "note": "Reference witness; production seed already carries scoped assertions.",
    }

    discovery = {
        "schemaVersion": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "read_only_seed_scan_v1",
        "referenceWitness": witness,
        "totals": {
            "procedureSeedFilesScanned": scanned,
            "candidateProcedures": len(candidate_procedures),
            "classificationCountsPairRecords": {k: len(v) for k, v in classifications.items()},
            "classificationCountsByProcedurePrimary": primary_counts,
            "falsePositiveExclusions": len(false_positive_exclusions),
        },
        "classifications": classifications,
        "falsePositiveExclusions": false_positive_exclusions[:50],
        "corpusHighlights": corpus_highlights,
        "procedurePrimaryClassification": procedure_primary,
        "gate3Summary": {
            "safeForSingleSeedReviewGate": len(
                {
                    r["procedureId"]
                    for r in classifications["CLEAR_PATH_SEMANTICS"]
                    if r.get("migrationStatus") != "migrated_gate2_control"
                    and r.get("loadInCircuit") in ("explicit_true", "sequence_strong")
                }
            ),
            "requiresAdditionalDesignWork": primary_counts.get("MULTI_POINT_COMPOUND", 0)
            + primary_counts.get("AMBIGUOUS_CONFIGURATION", 0),
            "scopedModelLimitations": [
                "Harness pin-for-pin continuity with both ends disconnected is not Gate 2 through_path + loadInCircuit true (e.g. w8178558-door-lock harness_continuity_check).",
                "Harness continuity visual_check steps lack measurementContext; need checkpoint assertion vocabulary or measurementContext on non-measurement steps.",
                "MULTI_POINT_COMPOUND procedures (3+ Ω points or ACU-first then harness then load) exceed simple eliminate→path_open pair rule (e.g. w11169652-test-08-drain-pump).",
                "Connector-first Ω at ACU without prior at-load pass remains component-level semantics (TRUE_COMPONENT_FAILURE).",
                "Legacy eliminate_*_ok on pass branches is not component_verified until migrated; derivation must tolerate mixed runs.",
            ],
        },
        "noProposedProductionMutations": True,
    }

    audit = {
        "schemaVersion": "1.0.0",
        "generatedAt": discovery["generatedAt"],
        "artifact": "CG_SCOPED_EVIDENCE_CORPUS_DISCOVERY_v1.json",
        "executiveSummary": {
            "scanned": scanned,
            "candidates": len(candidate_procedures),
            "clearPathSemantics": discovery["totals"]["classificationCountsPairRecords"][
                "CLEAR_PATH_SEMANTICS"
            ],
            "clearPathSemanticsUniqueProcedures": primary_counts.get("CLEAR_PATH_SEMANTICS", 0),
            "ambiguous": primary_counts.get("AMBIGUOUS_CONFIGURATION", 0),
            "safeSingleSeedReview": discovery["gate3Summary"]["safeForSingleSeedReviewGate"],
        },
        "readOnly": True,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    discovery_path = OUT_DIR / "CG_SCOPED_EVIDENCE_CORPUS_DISCOVERY_v1.json"
    audit_path = OUT_DIR / "CG_SCOPED_EVIDENCE_CORPUS_DISCOVERY_AUDIT_v1.json"
    discovery_path.write_text(json.dumps(discovery, indent=2), encoding="utf-8")
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(f"Wrote {discovery_path}")
    print(f"Wrote {audit_path}")
    print(
        json.dumps(
            {
                "procedureSeedFilesScanned": discovery["totals"]["procedureSeedFilesScanned"],
                "candidateProcedures": discovery["totals"]["candidateProcedures"],
                "classificationCountsByProcedurePrimary": discovery["totals"][
                    "classificationCountsByProcedurePrimary"
                ],
                "falsePositiveExclusions": discovery["totals"]["falsePositiveExclusions"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
