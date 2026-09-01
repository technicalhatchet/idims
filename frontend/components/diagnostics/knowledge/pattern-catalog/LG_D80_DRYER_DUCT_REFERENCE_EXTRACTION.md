# LG d80 duct restriction reference extraction

**Source:** `DRY_D80 – LG Error Codes.pdf` (third-party reference sheet)  
**Extracted text:** `backend/docs/manuals/DRY_D80 – LG Error Codes-extracted.txt`  
**Scope:** LG dryer exhaust blockage codes d80–d95; not a full service manual  
**Status:** Phase A — **Phase B/C not merged**

Cross-reference: [DRYER_SERVICE_MANUAL_EXTRACTION.md](./DRYER_SERVICE_MANUAL_EXTRACTION.md), [SAMSUNG_DRYER_MANUAL_COMPARISON.md](./SAMSUNG_DRYER_MANUAL_COMPARISON.md).

---

## Error code ladder (duct restriction)

| Code | Severity | Meaning |
|------|----------|---------|
| d80 | Initial | Duct restriction detected |
| **d85** | Intermediate | Restriction worsening |
| d90 | Severe | Strong restriction |
| d95 | Critical | Exhaust blocked |

**Cause cluster:** Lint filter; flex vent; wall cap; bird nest; crushed duct; excess elbows.

---

## Complaint routing

| Symptom | Action |
|---------|--------|
| Long dry times + d80 | Clean lint screen; inspect vent run |
| Escalating d85→d90 | Full vent clean; measure static ≤0.6 in. W.C. |
| d95 / won't dry | Blocked exhaust; verify outdoor damper |
| Codes return after clean | Damaged blower; sensor fault (full LG manual) |

---

## What's new vs Whirlpool/Samsung dryer docs

- LG-specific **graded** duct codes (d80–d95), not Whirlpool F-codes
- **d85** added to DMA (intermediate step)
- d80/d90/d95 may exist from prior LG seed — deduped on append

---

## Phase B/C (deferred)

- Chip keywords: `duct_restriction`, `d80`, `long_dry_vent`
- Evidence: vent length/elbow count; airflow test
- Elimination: lint filter before sealed-system assumptions

**DMA:** `d85` row in batch append.
