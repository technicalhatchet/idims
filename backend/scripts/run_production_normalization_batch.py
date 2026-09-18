#!/usr/bin/env python3
"""CG-PRODUCTION-NORMALIZATION-BATCH-EXECUTION — production batch orchestrator.

Fail-closed: requires locked execution authorization artifact with
normalizationBatchAuthorized=true AND batchExecutionAuthorized=true.
A CLI flag alone is never sufficient authorization.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.batch_orchestrator import (  # noqa: E402
    COHORT_PATH,
    EXECUTION_LOCK_PATH,
    BatchAuthorizationError,
    BatchManifestFreezeError,
    BatchRunOptions,
    FrozenHashMutationError,
    PilotBaselineOverwriteError,
    run_batch,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cohort",
        type=Path,
        default=COHORT_PATH,
        help="Path to batch cohort JSON",
    )
    parser.add_argument(
        "--execution-lock",
        type=Path,
        default=EXECUTION_LOCK_PATH,
        help="Locked batch execution authorization artifact",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Evaluate orchestrator without writing audit/checkpoint artifacts",
    )
    parser.add_argument(
        "--resume",
        metavar="BATCH_RUN_ID",
        help="Resume a prior checkpointed batch run",
    )
    parser.add_argument(
        "--force-manual",
        action="append",
        default=[],
        metavar="MANUAL_ID",
        help="Reprocess a manual (pilot baselines require locked authorization)",
    )
    parser.add_argument(
        "--max-manuals",
        type=int,
        default=None,
        help="Process only the first N cohort manuals (orchestrator testing)",
    )
    args = parser.parse_args()

    options = BatchRunOptions(
        cohort_path=args.cohort,
        execution_lock_path=args.execution_lock,
        dry_run=args.dry_run,
        resume_batch_run_id=args.resume,
        force_manual_ids=frozenset(args.force_manual),
        max_manuals=args.max_manuals,
        write_artifacts=not args.dry_run,
    )

    try:
        result = run_batch(options)
    except BatchAuthorizationError as exc:
        print(f"run_production_normalization_batch: AUTHORIZATION HARD STOP — {exc}", file=sys.stderr)
        return 2
    except (BatchManifestFreezeError, FrozenHashMutationError, PilotBaselineOverwriteError) as exc:
        print(f"run_production_normalization_batch: HARD STOP — {exc}", file=sys.stderr)
        return 3

    print(json.dumps(result, indent=2))
    return 0 if result.get("batchStatus") in {"completed", "stopped"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
