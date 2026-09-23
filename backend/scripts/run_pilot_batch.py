#!/usr/bin/env python3
"""CG-PRODUCTION-NORMALIZATION-PILOT — classify cohort outcomes and prove batch STOP behavior."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.pilot_batch import COHORT_PATH, evaluate_pilot_batch, write_pilot_artifacts  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cohort",
        type=Path,
        default=COHORT_PATH,
        help="Path to pilot cohort JSON",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write results and analysis artifacts to calibration/",
    )
    args = parser.parse_args()

    results = evaluate_pilot_batch(args.cohort)
    if args.write:
        write_pilot_artifacts(results)

    import json

    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
