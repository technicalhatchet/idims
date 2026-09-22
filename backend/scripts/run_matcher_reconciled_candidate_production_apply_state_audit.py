from __future__ import annotations

import json

from normalization.review.matcher_reconciled_candidate_production_apply_state_audit import (
    build_state_audit,
    write_state_audit,
)


def main() -> None:
    payload = build_state_audit()
    path = write_state_audit()
    print(json.dumps({"written": str(path), "classification": payload["classification"], "summary": payload["summary"]}, indent=2))


if __name__ == "__main__":
    main()
