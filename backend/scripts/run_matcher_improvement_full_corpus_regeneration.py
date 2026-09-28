#!/usr/bin/env python3
"""Controlled full-corpus candidate regeneration + impact analysis (not promotion)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.matcher_improvement_full_corpus_regeneration import (
    run_full_corpus_regeneration_gate,
    write_full_corpus_regeneration,
)


def main() -> int:
    payload = run_full_corpus_regeneration_gate(write_staging=True)
    regen_path, audit_path = write_full_corpus_regeneration(payload)
    regen = payload["regeneration"]
    deltas = regen.get("deltas") or {}
    print(
        json.dumps(
            {
                "status": regen["status"],
                "regenerationPath": str(regen_path),
                "auditPath": str(audit_path),
                "stagedCorpusPath": regen.get("stagedCorpusPath"),
                "productionCandidatesUntouched": regen.get("productionCandidatesUntouched"),
                "matcherImprovementCount": regen.get("regenerated", {})
                .get("aggregate", {})
                .get("matcherImprovementCount"),
                "unresolvedDelta": deltas.get("unresolved"),
                "existingCanonicalMappingDelta": deltas.get("existingCanonicalMapping"),
                "architectureExceptionDelta": deltas.get("architectureException"),
                "waveAcceptedIntegrity": regen.get("humanReviewIntegrity", {}).get("passed"),
                "errorCount": len(regen.get("errors") or []),
                "nextStep": regen.get("nextStep"),
            },
            indent=2,
        ),
    )
    if regen["status"] != "GREEN":
        print(f"full corpus regeneration gate: {regen['status']}", file=sys.stderr)
        for error in regen.get("errors") or []:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("full corpus regeneration gate: GREEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
