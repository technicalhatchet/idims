#!/usr/bin/env python3
"""Generate the post-batch candidate review index (read/classify only — no promotion)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.review.candidate_review_index import (
    DEFAULT_BATCH_RUN_ID,
    DEFAULT_PROCESSING_MANIFEST_HASH,
    build_candidate_review_index,
    write_candidate_review_index,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-run-id", default=DEFAULT_BATCH_RUN_ID)
    parser.add_argument("--processing-manifest-hash", default=DEFAULT_PROCESSING_MANIFEST_HASH)
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--dry-run", action="store_true", help="Build index but do not write file")
    args = parser.parse_args()

    index = build_candidate_review_index(
        batch_run_id=args.batch_run_id,
        processing_manifest_hash=args.processing_manifest_hash,
    )
    if args.dry_run:
        print(json.dumps({"totalCandidateRecords": index["totalCandidateRecords"]}, indent=2))
        return 0

    path = write_candidate_review_index(index, output_path=args.output)
    print(f"wrote {path}")
    print(f"totalCandidateRecords={index['totalCandidateRecords']}")
    print(f"countsByReviewClass={json.dumps(index['countsByReviewClass'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
