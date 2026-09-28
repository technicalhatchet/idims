#!/usr/bin/env python3
"""CG-6.2 — Read-only compounding efficiency report from frozen gate-preview baselines."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR

CALIBRATION_CORPUS_FILE = "compounding_calibration_corpus_v1.json"
OUTPUT_FILE = "compounding_efficiency_v1.json"

# Frozen semantic-inheritance cases — documented at gate, not inferred by this report.
SEMANTIC_INHERITANCE_CATALOG: dict[str, list[dict[str, Any]]] = {
    "SAMSUNG-FL-WF6000R-WASHER": [
        {
            "concept": "inverter_board",
            "priorOemTerm": "§4-3: Power / current sense (9C5)",
            "priorManualId": "SAMSUNG-FL-BB8700-WASHER",
            "gateOemTerm": "§4-1: Power / voltage (9C1, 9C2)",
            "humanClassification": "inherited_platform_family",
            "matcherAutoInheritAtGate": False,
            "artifact": "compounding_samsung_fl2_gate_preview_SAMSUNG-FL-WF6000R-WASHER.json",
            "note": "Knowledge existed on Samsung platform layer; matcher blocked on OEM title variant.",
        },
    ],
}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _coalesce_int(data: dict[str, Any], *keys: str) -> int | None:
    for key in keys:
        if key in data and data[key] is not None:
            return int(data[key])
    return None


def extract_gate_preview_metrics(baseline: dict[str, Any], manual_id: str) -> dict[str, Any]:
    """Pull gate-preview metrics from a frozen baseline without reinterpretation."""
    gate: dict[str, Any] | None = None

    for key in ("promotionGatePreview", "rawGatePreview"):
        preview = baseline.get(key)
        if isinstance(preview, dict):
            preview_manual = preview.get("manualId")
            if preview_manual in (None, manual_id):
                gate = dict(preview)
                break

    promotion_gate = baseline.get("promotionGate")
    if gate is None and isinstance(promotion_gate, dict):
        manuals = promotion_gate.get("manuals")
        if isinstance(manuals, dict) and manual_id in manuals:
            gate = dict(manuals[manual_id])
        elif promotion_gate.get("manualId") == manual_id:
            gate = dict(promotion_gate)

    if gate is None:
        human_resolved = baseline.get("humanResolvedGatePreview")
        if isinstance(human_resolved, dict):
            gate = dict(human_resolved)

    if gate is None:
        raise ValueError(f"No gate-preview block found for {manual_id} in baseline")

    inherited_auto = _coalesce_int(
        gate,
        "inheritedResolvedAutomatically",
    )
    inherited_corpus = _coalesce_int(gate, "inheritedCorpusKnowledge")
    inherited_platform = _coalesce_int(gate, "inheritedPlatformFamilyKnowledge")
    inherited_exact = inherited_auto
    if inherited_exact is None and (inherited_corpus is not None or inherited_platform is not None):
        inherited_exact = int(inherited_corpus or 0) + int(inherited_platform or 0)

    return {
        "metricsSource": "gate_preview",
        "baselineArtifact": None,  # filled by caller
        "reviewRecords": _coalesce_int(gate, "reviewRecords"),
        "newHumanDecisionCount": _coalesce_int(
            gate,
            "newHumanDecisionCount",
            "newGateDecisions",
        ),
        "newHumanDecisionRate": gate.get("newHumanDecisionRate") or gate.get("newDecisionRate"),
        "exactInheritanceAtGate": inherited_exact,
        "inheritedCorpusKnowledge": inherited_corpus,
        "inheritedPlatformFamilyKnowledge": inherited_platform,
        "inheritedResolvedAutomatically": inherited_auto,
        "newPlatformKnowledge": _coalesce_int(gate, "newPlatformKnowledge"),
        "newModelSpecificKnowledge": _coalesce_int(gate, "newModelSpecificKnowledge"),
        "newCanonicalKnowledge": _coalesce_int(gate, "newCanonicalKnowledge"),
        "inheritedWhirlpoolPlatform": _coalesce_int(gate, "inheritedWhirlpoolPlatform"),
        "equivalence": gate.get("equivalence"),
    }


def load_supplemental_gate_preview(
    calibration_dir: Path,
    manual_entry: dict[str, Any],
) -> dict[str, Any] | None:
    """Optional raw gate-preview artifact (e.g. Samsung FL #2 matcher-layer metrics)."""
    raw_name = manual_entry.get("rawGatePreview")
    if not raw_name:
        return None
    path = calibration_dir / raw_name
    if not path.is_file():
        return None
    raw = load_json(path)
    table = raw.get("killerMetricTable") or {}
    rows = table.get("rows") or {}
    return {
        "artifact": raw_name,
        "metricsSource": raw.get("metricsSource", "gate_preview"),
        "inheritedCorpusKnowledge": (rows.get("inheritedCorpusKnowledge") or [None, None])[-1],
        "inheritedPlatformFamilyKnowledge": (rows.get("inheritedPlatformFamilyKnowledge") or [None, None])[-1],
        "newHumanDecisionCount": (rows.get("newGateDecisions") or [None, None])[-1],
        "newHumanDecisionRate": (rows.get("newDecisionRate") or [None, None])[-1],
        "autoInheritedPlatformExactMatch": (raw.get("gateDecisions") or {}).get(
            "autoInheritedPlatformExactMatch",
        ),
        "primaryKiller": raw.get("primaryKiller"),
    }


def build_bar_cell(value: int, max_value: int, width: int = 20) -> str:
    if max_value <= 0:
        return ""
    filled = round((value / max_value) * width)
    if value <= 0:
        return "|"
    return "#" * filled + ("|" if filled < width else "")


def build_efficiency_report(calibration_dir: Path | None = None) -> dict[str, Any]:
    root = calibration_dir or CALIBRATION_DIR
    corpus_path = root / CALIBRATION_CORPUS_FILE
    corpus = load_json(corpus_path)

    promotion_order: list[str] = list(corpus.get("promotionOrder") or [])
    manual_entries: list[dict[str, Any]] = []
    for cohort in (corpus.get("cohorts") or {}).values():
        for row in cohort.get("manuals") or []:
            manual_entries.append(dict(row))

    entry_by_id = {row["manualId"]: row for row in manual_entries}
    rows: list[dict[str, Any]] = []

    for index, manual_id in enumerate(promotion_order, start=1):
        entry = entry_by_id.get(manual_id)
        if not entry:
            raise ValueError(f"Calibration corpus missing manual entry: {manual_id}")

        baseline_name = entry.get("baseline")
        if not baseline_name:
            raise ValueError(f"No baseline artifact for {manual_id}")
        baseline_path = root / baseline_name
        baseline = load_json(baseline_path)

        gate = extract_gate_preview_metrics(baseline, manual_id)
        gate["baselineArtifact"] = baseline_name

        human_resolved = baseline.get("humanResolvedGatePreview")
        if isinstance(human_resolved, dict):
            gate["humanResolvedGatePreview"] = human_resolved

        supplemental = load_supplemental_gate_preview(root, entry)
        semantic_cases = list(SEMANTIC_INHERITANCE_CATALOG.get(manual_id) or [])
        semantic_human_burden = len(semantic_cases)

        human_decisions = int(gate["newHumanDecisionCount"] or 0)
        exact_inherit = gate.get("exactInheritanceAtGate")

        rows.append(
            {
                "sequence": index,
                "manualId": manual_id,
                "label": _manual_label(entry, manual_id),
                "cohort": _manual_cohort(corpus, manual_id),
                "role": entry.get("role"),
                "platformId": entry.get("platformId"),
                "gatePreview": gate,
                "supplementalMatcherLayer": supplemental,
                "semanticInheritance": {
                    "documentedCases": semantic_cases,
                    "humanBurdenCount": semantic_human_burden,
                    "note": (
                        "Counted only from frozen semantic_inheritance catalog — not inferred."
                        if semantic_human_burden == 0
                        else "Matcher gap required human inherited_platform_family."
                    ),
                },
                "humanGateDecisions": human_decisions,
                "exactInheritanceAtGate": exact_inherit,
            },
        )

    decision_counts = [row["humanGateDecisions"] for row in rows]
    max_decisions = max(decision_counts) if decision_counts else 0
    total_decisions = sum(decision_counts)

    bar_chart = [
        {
            "label": row["label"],
            "manualId": row["manualId"],
            "value": row["humanGateDecisions"],
            "bar": build_bar_cell(row["humanGateDecisions"], max_decisions),
        }
        for row in rows
    ]

    leakage = dict(corpus.get("leakageAssertions") or {})
    leakage["perManual"] = [
        {
            "manualId": row["manualId"],
            "newCanonicalKnowledge": row["gatePreview"].get("newCanonicalKnowledge"),
            "inheritedWhirlpoolPlatform": row["gatePreview"].get("inheritedWhirlpoolPlatform"),
        }
        for row in rows
    ]

    return {
        "schemaVersion": "1.0.0",
        "reportType": "compounding_efficiency",
        "version": "v1",
        "phase": "CG-6.2",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "readOnly": True,
        "metricsSource": "gate_preview",
        "calibrationCorpus": CALIBRATION_CORPUS_FILE,
        "outputArtifact": OUTPUT_FILE,
        "headlineQuestion": (
            "As Solomon sees more manuals, how much human work does each additional manual require?"
        ),
        "methodology": {
            "authoritative": "Frozen gate-preview baselines only",
            "doesNot": [
                "mutate baselines",
                "recalculate historical classifications",
                "introduce semantic matching",
                "mix post-publish pipeline metrics",
            ],
            "contract": "knowledge_hierarchy_contract_v1.json",
        },
        "summary": {
            "manualCount": len(rows),
            "totalHumanGateDecisions": total_decisions,
            "averageHumanGateDecisions": round(total_decisions / len(rows), 2) if rows else 0,
            "minHumanGateDecisions": min(decision_counts) if decision_counts else 0,
            "maxHumanGateDecisions": max_decisions,
            "inheritanceCurveHumanDecisions": decision_counts,
            "inheritanceCurveLabels": [row["label"] for row in rows],
            "newCanonicalKnowledgeAcrossCohort": sum(
                int(row["gatePreview"].get("newCanonicalKnowledge") or 0) for row in rows
            ),
            "documentedSemanticInheritanceCases": sum(
                row["semanticInheritance"]["humanBurdenCount"] for row in rows
            ),
        },
        "inheritanceCurve": [
            {
                "sequence": row["sequence"],
                "label": row["label"],
                "manualId": row["manualId"],
                "humanGateDecisions": row["humanGateDecisions"],
                "exactInheritanceAtGate": row["exactInheritanceAtGate"],
                "semanticInheritanceHumanBurden": row["semanticInheritance"]["humanBurdenCount"],
            }
            for row in rows
        ],
        "barChart": {
            "title": "Human gate decisions / manual (gate-preview)",
            "maxValue": max_decisions,
            "rows": bar_chart,
        },
        "manuals": rows,
        "leakage": leakage,
    }


def _manual_cohort(corpus: dict[str, Any], manual_id: str) -> str | None:
    for cohort_id, cohort in (corpus.get("cohorts") or {}).items():
        for row in cohort.get("manuals") or []:
            if row.get("manualId") == manual_id:
                return cohort_id
    return None


def _manual_label(entry: dict[str, Any], manual_id: str) -> str:
    if manual_id == "W8178558":
        return "Whirlpool FL #1"
    if manual_id == "W11169652":
        return "Whirlpool FL #2"
    if manual_id == "W10864849":
        return "Whirlpool TL #1"
    if manual_id == "W11697231":
        return "Whirlpool TL #2"
    if manual_id == "W11416787":
        return "Whirlpool TL #3"
    if manual_id == "SAMSUNG-FL-BB8700-WASHER":
        return "Samsung FL #1"
    if manual_id == "SAMSUNG-FL-WF6000R-WASHER":
        return "Samsung FL #2"
    return manual_id


def format_bar_chart(report: dict[str, Any]) -> str:
    lines = [
        report["barChart"]["title"],
        "",
    ]
    for row in report["barChart"]["rows"]:
        lines.append(f"{row['label']:<18} {row['bar']} {row['value']}")
    lines.append("")
    lines.append(f"Total human gate decisions: {report['summary']['totalHumanGateDecisions']}")
    lines.append(
        f"Curve: {' -> '.join(str(v) for v in report['summary']['inheritanceCurveHumanDecisions'])}",
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default=str(CALIBRATION_DIR / OUTPUT_FILE),
        help="Output JSON path (default: calibration/compounding_efficiency_v1.json)",
    )
    parser.add_argument("--print-chart", action="store_true", help="Print ASCII bar chart")
    args = parser.parse_args()

    report = build_efficiency_report()
    out_path = Path(args.output)
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")

    if args.print_chart:
        print()
        print(format_bar_chart(report))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
