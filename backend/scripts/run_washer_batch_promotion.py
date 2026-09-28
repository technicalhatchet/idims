#!/usr/bin/env python3
"""CG-5.4 — Whirlpool FL batch promotion with equivalence + human-decision metrics."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from human_decision_metrics import collect_manual_decision_metrics
from normalization.paths import CALIBRATION_DIR
from normalization.promotion.planner import MANUAL_TO_OVERLAY
from run_compiler_loop import run_compiler_loop

WHIRLPOOL_FL_BATCH = [
    {"manualId": "W8178558", "label": "Duet Sport CCU/MCU (CG-2 reference)"},
    {"manualId": "W11169652", "label": "Whirlpool FL direct drive"},
]

SAMSUNG_FL_BATCH = [
    {"manualId": "SAMSUNG-FL-BB8700-WASHER", "label": "Samsung FL BB8700"},
    {"manualId": "SAMSUNG-FL-WF6000R-WASHER", "label": "Samsung FL WF6000R"},
]


def run_batch(
    batch: list[dict],
    *,
    publish: bool = False,
    run_ds7: bool = False,
) -> dict:
    results = []
    for entry in batch:
        manual_id = entry["manualId"]
        if manual_id not in MANUAL_TO_OVERLAY:
            results.append(
                {
                    "manualId": manual_id,
                    "label": entry.get("label"),
                    "status": "skipped",
                    "reason": "No MANUAL_TO_OVERLAY publish target configured",
                    "metrics": collect_manual_decision_metrics(manual_id),
                },
            )
            continue

        metrics_before = collect_manual_decision_metrics(manual_id)
        try:
            loop_result = run_compiler_loop(manual_id, publish=publish, auto_approve=True)
            status = "published" if publish else "dry-run-ok"
        except Exception as exc:
            results.append(
                {
                    "manualId": manual_id,
                    "label": entry.get("label"),
                    "status": "failed",
                    "error": str(exc),
                    "metricsBefore": metrics_before,
                },
            )
            continue

        metrics_after = collect_manual_decision_metrics(manual_id)
        results.append(
            {
                "manualId": manual_id,
                "label": entry.get("label"),
                "status": status,
                "equivalent": loop_result.get("equivalence", {}).get("equivalent"),
                "promotionId": loop_result.get("promotionId"),
                "metricsBefore": metrics_before,
                "metricsAfter": metrics_after,
            },
        )

    report = {
        "batchResults": results,
        "published": publish,
    }
    CALIBRATION_DIR.mkdir(parents=True, exist_ok=True)
    out = CALIBRATION_DIR / "washer_batch_promotion_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if run_ds7:
        proc = subprocess.run(
            ["npm", "run", "test:diagnostic-session"],
            cwd=ROOT / "frontend",
            check=False,
            shell=sys.platform == "win32",
        )
        report["ds7ExitCode"] = proc.returncode
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        if proc.returncode != 0:
            raise RuntimeError("DS-7 regression failed after batch promotion")

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--batch",
        choices=["whirlpool_fl", "samsung_fl"],
        default="whirlpool_fl",
    )
    parser.add_argument("--manual", help="Run single manual from batch")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--run-ds7", action="store_true")
    args = parser.parse_args()

    batch = WHIRLPOOL_FL_BATCH if args.batch == "whirlpool_fl" else SAMSUNG_FL_BATCH
    if args.manual:
        batch = [e for e in batch if e["manualId"] == args.manual]
        if not batch:
            batch = [{"manualId": args.manual, "label": args.manual}]

    report = run_batch(batch, publish=args.publish, run_ds7=args.run_ds7)
    for row in report.get("batchResults", []):
        print(
            f"{row.get('manualId')}: {row.get('status')} "
            f"equivalent={row.get('equivalent')} "
            f"humanDecisions={((row.get('metricsAfter') or row.get('metricsBefore') or {}).get('humanDecisionCount'))}",
        )
    print(f"\nWrote {CALIBRATION_DIR / 'washer_batch_promotion_report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
