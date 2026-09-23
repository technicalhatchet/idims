#!/usr/bin/env python3
"""CG-5 — Golden mapping regression suite for matcher tuning."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.calibration.golden_runner import evaluate_golden_set  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--golden-set",
        type=Path,
        help="Path to golden_mapping_set.json (default: normalization/calibration/)",
    )
    parser.add_argument("--json", action="store_true", help="Emit full JSON report")
    args = parser.parse_args()

    report = evaluate_golden_set(args.golden_set)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("=== Golden Mapping Regression ===")
        print(f"Total:  {report['total']}")
        print(f"Passed: {report['passed']}")
        print(f"Failed: {report['failed']}")
        print(f"Pass rate: {report['passRate']}")
        print("\nBy expected decision:")
        for decision, counts in sorted(report.get("byDecision", {}).items()):
            print(f"  {decision}: {counts['passed']} passed, {counts['failed']} failed")
        if report.get("failures"):
            print("\nFailures:")
            for failure in report["failures"]:
                print(f"  - {failure['id']}: {failure['sourceTerm']}")
                for reason in failure.get("failures") or []:
                    print(f"      {reason}")

    return 1 if report.get("failed") else 0


if __name__ == "__main__":
    raise SystemExit(main())
