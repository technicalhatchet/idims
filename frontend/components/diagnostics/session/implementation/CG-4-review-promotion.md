# CG-4 — Human-Gated Candidate Review + Promotion

**Depends on:** CG-3  
**Rule:** `candidate ≠ knowledge` · `approved ≠ published` · `published = explicit promotion`

## Lifecycle

```
candidate → review → approve | reject | needs_review
                         ↓
                    plan (deterministic diff)
                         ↓
                    validate
                         ↓
                    promote (explicit publish)
                         ↓
              manufacturer_overlays/
```

## Review record fields

| Field | Purpose |
|-------|---------|
| `what` | OEM term / procedure / measurement |
| `mapsTo` | Canonical concept |
| `why` | Matcher layer + confidence |
| `source` | Manual, procedure, pages, extraction doc |
| `conflicts` | Attached conflicts (informational) |
| `proposedChange` | Exact overlay mutation |
| `approvalLevel` | easy / normal / careful / high_risk / blocked |

## Approval levels

| Candidate type | Level |
|----------------|-------|
| OEM alias (confidence ≥ 0.95) | easy |
| procedureTestBinding | normal |
| measurementBinding | normal |
| relationship / canonical override | high_risk |
| UNRESOLVED_TERM / conflict-tied alias | blocked |

## CLI

```bash
# Materialize review packages from CG-3 candidates
python backend/scripts/review_candidates.py materialize --manual W8178558
python backend/scripts/review_candidates.py materialize   # all manuals with candidates

# Review
python backend/scripts/review_candidates.py list --manual W8178558
python backend/scripts/review_candidates.py show --manual W8178558 map-W8178558-mcu-motor_controller
python backend/scripts/review_candidates.py approve --manual W8178558 map-W8178558-mcu-motor_controller
python backend/scripts/review_candidates.py auto-approve-easy --manual W8178558

# Promotion planner (deterministic diff)
python backend/scripts/plan_promotion.py --manual W8178558

# Explicit publish
python backend/scripts/promote_overlay.py --promotion promo-W8178558-...

# Corpus metrics (15 washer manuals)
python backend/scripts/normalization_metrics.py --template washer --materialize
```

## Promotion blocking

- `RELATIONSHIP_CONFLICT` blocks **relationship/override** promotions only
- `ALIAS_CONFLICT` blocks affected **alias** candidates only
- Aliases and procedure bindings can promote while topology conflict remains open for human resolution

## Artifacts

| Path | Purpose |
|------|---------|
| `normalization/review/{manualId}_review.json` | Review packages |
| `normalization/review/ledger.json` | Status + history |
| `normalization/promotions/{promotionId}.json` | Planned diff |
| `normalization/promotions/{promotionId}/overlay_before.json` | Publish backup |

## Ship gate

```bash
pytest backend/scripts/tests/test_normalization_review.py
python backend/scripts/normalization_metrics.py --template washer
```

## Out of scope

- Fancy review UI (CG-4 is CLI-first)
- Auto-publish on approve
- Conflict auto-resolution
