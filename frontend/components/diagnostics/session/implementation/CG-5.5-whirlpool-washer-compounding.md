# CG-5.5 — Whirlpool Washer Compounding Batch (CLOSED)

**Status:** CLOSED — evidence frozen · provisionally validated through TL #3  
**Successor:** CG-5.6 Samsung FL cross-manufacturer experiment  
**Depends on:** CG-5.4 (complete)

Methodology discipline (gate-preview vs post-publish): `calibration/compounding_methodology_v1.json`  
Consolidated evidence: `calibration/compounding_baseline_whirlpool_washer_evidence.json`

## Frozen baseline (do not retroactively change methodology)

Permanent reference: `knowledge/normalization/calibration/compounding_baseline_v1_whirlpool_fl.json`

| Metric | W8178558 | W11169652 |
|--------|--------:|----------:|
| Review records | 41 | 49 |
| New human decisions | 10 | 9 |
| New decision rate | 24.4% | 18.4% |
| Inherited automatically | 20 | 40 |
| Inherited resolution rate | 66.7% | 81.6% |
| Equivalence | PASS | PASS |

**Canonical additions across both manuals:** 0  
**Ontology candidates promoted:** 0

## Two-family canonical test (proven)

```
              Canonical FL Washer (front_load_washer)
                            │
              ┌─────────────┴─────────────┐
              │                           │
         W8178558                   W11169652
        Duet Sport                  Direct Drive
              │                           │
        CCU → MCU → M               ACU → M
              │                           │
              └─────────────┬─────────────┘
                            ↓
                    control_board
                            ↓
                      drive_motor
```

Canonical layer: functional dependencies. Overlay layer: Whirlpool implementation topology.

## Whirlpool FL corpus — complete

The 15-manual washer normalization corpus contains **two** Whirlpool FL procedure platforms:

| Manual | Platform | Status |
|--------|----------|--------|
| W8178558 | `whirlpool_duet_sport` | Published |
| W11169652 | `whirlpool_fl_dd` | Published |

No third Whirlpool FL manual exists in the current corpus. Next Whirlpool **washer** compounding target: **W10864849** (`whirlpool_tl_dd`, TL direct-drive, WTW9500).

Samsung FL moved to **CG-5.6** — Whirlpool evidence is frozen; do not add more Whirlpool manuals.

## Promotion order

```
W8178558 → W11169652 → W10864849 → (TL DD variants) → Samsung FL stress test
```

Prior corpus for compounding metrics: all manuals promoted before the target.

## Pipeline (unchanged rules)

```
normalize → pre-match filter → seed mapping → gap analysis → materialize review
  → compounding metrics (no approve-all)
  → resolve genuinely new terms (classified)
  → approve bindings
  → equivalence → publish → canonical validation → DS-7
```

**Do not** `approve-all`. Inherited alias families resolve automatically; genuinely new knowledge stays visible.

## Knowledge classification (track separately)

| Bucket | Meaning |
|--------|---------|
| `inheritedCorpusKnowledge` | FL (or prior) corpus — concept known, auto-resolved |
| `inheritedPlatformFamilyKnowledge` | Prior TL manual on same overlay family |
| `newPlatformKnowledge` | New to this platform family |
| `newCanonicalKnowledge` | Cross-platform evidence only (≥3 manuals + ≥2 mfrs) |

### newPlatformKnowledge subtypes (CG-5.5+)

| Subtype | Meaning |
|---------|---------|
| `reusable_tl_platform_concept` | Expect TL #2 to inherit (e.g. `mode_shifter`, `pressure_sensor`) |
| `known_concept_new_tl_implementation` | Functional concept known; TL topology differs (`lid_lock`, BPM motor) |
| `new_tl_alias` | OEM TEST title / alias new to TL overlay |
| `one_off_oem_terminology` | Manual-specific variant title; low reuse expectation |
| `new_tl_procedure_binding` | Mechanical procedure/measurement overlay wiring |

**Do not** promote `reusable_tl_platform_concept` to universal washer ontology from a single TL manual.

Human classification artifact: `calibration/w10864849_human_classification.json`

## CG-5.5 scaffold (W10864849 — architecture boundary)

**Platform family:** `whirlpool_tl_dd_direct_drive` in `whirlpool_top_load_washer.json`  
**Canonical ontology:** `top_load_washer` (not `front_load_washer`)  
**Routing:** `ontology_resolver.py` + `canonicalRegistry.ts` platform-aware selection

```
W10864849
  ↓
whirlpool_tl_dd
  ↓
top_load_washer   ← canonical appliance ontology (lid_lock, mode_shifter, …)
```

FL overlay architecture does **not** leak into TL. BPM/direct-drive topology lives in manufacturer overlay.

### Knowledge classifier rule (CG-5.5)

| Bucket | Test |
|--------|------|
| `newPlatformKnowledge` | Whirlpool-specific implementation of an existing functional concept |
| `newCanonicalKnowledge` | Reusable functional concept across implementations (≥3 manuals + ≥2 mfrs) |

Unfamiliar OEM nouns alone are **not** ontology candidates.

### Forward compounding table

Permanent report: `calibration/compounding_forward_v1_whirlpool_washer.json`

| Metric | W8178558 | W11169652 | W10864849 |
|--------|--------:|----------:|----------:|
| Architecture | FL | FL | TL |
| New decisions | 10 | 9 | 14 (preview) |
| New decision rate | 24.4% | 18.4% | 26.4% (preview) |
| Inherited auto | 20 | 40 | 39 (preview) |
| Inherited rate | 66.7% | 81.6% | 73.6% (preview) |
| New platform | — | — | **14** |
| New canonical | 0 | 0 | **0** |
| Equivalence | PASS | PASS | **PASS** |

**26.4% is useful data, not regression** — deliberate FL→TL architecture boundary experiment.

Frozen TL baseline: `calibration/compounding_baseline_v1_whirlpool_tl.json`

### W10864849 platform knowledge breakdown (14 gate decisions)

| Subtype | Count |
|---------|------:|
| `reusable_tl_platform_concept` | 5 |
| `known_concept_new_tl_implementation` | 3 |
| `new_tl_alias` | 6 |
| `one_off_oem_terminology` | 4 |
| `new_tl_procedure_binding` | 24 (batch) |
| `newCanonicalKnowledge` | **0** |

### W10864849 publish gate

| Gate | Status |
|------|--------|
| Ontology routing = `top_load_washer` | ✓ |
| No FL overlay leakage | ✓ (`cg5-tl-architecture-boundary.test.ts`) |
| Platform topology resolves | ✓ |
| Canonical validation | ✓ |
| Compiler tests (CG-2) | ✓ |
| Human classification of 14 | ✓ |
| Promotion equivalence | ✓ |
| Publish | ✓ `promo-W10864849-20260913070539` |
| TL DS-7 torture | ✓ `tl-washer-torture.test.ts` |

### Compounding progression

```
Whirlpool FL #1 (W8178558)  → establishes corpus
Whirlpool FL #2 (W11169652) → reuses corpus
Whirlpool TL #1 (W10864849) → establishes TL platform knowledge  ← done
Whirlpool TL #2 (W11697231) → reuses TL platform knowledge     ← preview done
Samsung FL/TL               → cross-manufacturer stress test   ← deferred
```

### W11697231 TL #2 killer metric (compounding preview)

Permanent report: `calibration/compounding_tl_platform_v1.json`

| Metric | TL #1 (W10864849) | TL #2 (W11697231) |
|--------|------------------:|------------------:|
| TL platform inherited | 0 | **51** |
| FL corpus inherited | 39 | 0 |
| New platform | 14 | **0** |
| New canonical | 0 | 0 |
| New decisions | 14 | **0** |
| New decision rate | 26.4% | **0.0%** |

**Second-order compounding demonstrated:** TL #2 inherits `mode_shifter`, `pressure_sensor`, `lid_lock`, drive pre-test orchestration, and applicable procedure/measurement bindings from W10864849 platform vocabulary. `pressure_sensor` stays TL-platform scoped — not promoted to universal canonical.

Published: `promo-W11697231-20260913133238` · equivalence **PASS** · canonical validation **PASS**  
Frozen TL #2 baseline: `calibration/compounding_baseline_v1_whirlpool_tl2.json` (TL #1 baseline unchanged)

### W11697231 publish gate

| Gate | Status |
|------|--------|
| Term resolutions (16 inherited) | ✓ |
| Procedure bindings batch-approved | ✓ |
| Promotion equivalence | ✓ |
| Canonical validation | ✓ |
| TL DS-7 torture (`tl-washer-torture.test.ts`) | ✓ |
| Architecture boundary negative (`cg5-tl-architecture-boundary.test.ts`) | ✓ |

### W11416787 TL #3 replication preview (frozen methodology — no matching changes)

| Metric | TL #1 | TL #2 | TL #3 |
|--------|------:|------:|------:|
| TL platform inherited | 0 | 51 | **19** |
| New platform | 14 | 0 | **0** |
| New model-specific | 0 | 0 | **2** |
| New canonical | 0 | 0 | **0** |
| New decisions | 14 | 0 | **2** |
| New decision rate | 26.4% | 0.0% | **6.1%** |
| Equivalence | PASS | PASS | **PASS** |

**Verdict:** 1–3 bucket — very strong replication. The 2 gate decisions are model-line specific (`TEST #4: HMI`, `TEST #9: Load & Go Detergent`), not reusable platform vocabulary failures. **The important number is 0 new platform knowledge** — replication across `whirlpool_tl_dd` → `whirlpool_tl_dd_5100` seed boundary.

Published: `promo-W11416787-20260913135602` · equivalence **PASS**  
Frozen TL #3 baseline: `calibration/compounding_baseline_v1_whirlpool_tl3.json`  
Whirlpool evidence freeze: `calibration/compounding_baseline_whirlpool_washer_evidence.json`

### W11416787 publish gate

| Gate | Status |
|------|--------|
| Term resolutions (8 inherited + 2 model-specific) | ✓ |
| Procedure bindings batch-approved | ✓ |
| Promotion equivalence | ✓ |
| Canonical validation | ✓ |
| TL DS-7 (`cg5-tl-architecture-boundary` 5100 assertions) | ✓ |
| Whirlpool evidence frozen | ✓ |

**CG-5.5 provisionally validated through TL #3.** Experiment closed — see `CG-5.6-samsung-fl-cross-manufacturer.md`.

### Streamlined human review (CG-5.5)

Do **not** read `W10864849_review.json` line by line. Use the digest:

```bash
python backend/scripts/review_digest.py digest --manual W10864849
# open calibration/review_digest_W10864849.md
```

| Step | What | Time |
|------|------|------|
| 1 | Skim 16-row term resolution table in digest | ~5 min |
| 2 | Edit `w10864849_term_resolutions.json` if you disagree | optional |
| 3 | `review_digest.py apply-all --manual W10864849` | 1 command |
| 4 | `run_compounding_pipeline.py --manual W10864849 --skip-promotion` | verify metrics |

Only the term resolution table needs human judgment; bindings and easy aliases batch-approve.

## Hard rules (carry forward)

- 23 cross-appliance ontology candidates: **frozen** (hypotheses only)
- No retroactive metric tweaks to v1 baseline
- Equivalence must stay green on all published families
- Samsung FL: CG-5.6 (active) — Whirlpool curve complete
- Gate-preview = authoritative compounding metric; post-publish = debug only
