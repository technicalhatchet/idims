#!/usr/bin/env python3
"""Read-only Wave 1 deferred/rejected pattern synthesis (post-closure gate)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.wave1_pattern_synthesis import (
    run_wave1_pattern_synthesis,
    write_pattern_synthesis,
)


def main() -> int:
    payload = run_wave1_pattern_synthesis()
    path = write_pattern_synthesis(payload)
    print(
        json.dumps(
            {
                "status": payload["status"],
                "artifactPath": str(path),
                "oemTestHeadingWave1": payload["oemTestHeadingAnalysis"]["wave1Count"],
                "oemTestHeadingCorpus": payload["oemTestHeadingAnalysis"]["corpusCount"],
                "supplyWave1": payload["supplyTerminologyAnalysis"]["wave1"]["count"],
            },
            indent=2,
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
