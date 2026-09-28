# CG-5.6 — Samsung FL Cross-Manufacturer Compounding

**Status:** CLOSED — Samsung FL #1 and #2 complete and frozen  
**Depends on:** CG-5.5 (closed — Whirlpool evidence frozen)

## CG-5.6 headline (frozen)

Samsung FL #1 demonstrated **cross-manufacturer canonical reuse** with **zero Whirlpool platform leakage** and **one genuinely Samsung-platform diagnostic concept**, while producing **zero new canonical concepts**.

The shape **14 inherited corpus / 0 Whirlpool platform / 1 platform / 0 canonical** is more valuable than the raw 14 — it proves Solomon's four-layer hierarchy survives a real manufacturer boundary.

```
                 CANONICAL FL WASHER
                        │
          ┌─────────────┴─────────────┐
          │                           │
      WHIRLPOOL                    SAMSUNG
          │                           │
   platform topology            platform topology
   / aliases                    / aliases
          │                           │
       models                      BB8700
```

**Architectural distinction (frozen):** `canonical.components` ≠ `overlay.add.components`.  
`inverter_board` is a first-class platform diagnostic target without pretending a universal appliance concept was discovered.

Frozen baseline: `calibration/compounding_baseline_v1_samsung_fl1.json`  
Published: `promo-SAMSUNG-FL-BB8700-WASHER-20260913142749`

| Metric | Samsung FL #1 (gate-preview) |
|--------|----------------------------:|
| Review records | 29 |
| Inherited corpus (Whirlpool FL) | **14** |
| Inherited Whirlpool platform | **0** |
| New platform (gate) | **1** (`inverter_board`) |
| New model-specific | **0** |
| New canonical | **0** |
| Gate decisions | 6 (5 corpus + 1 platform) |
| New decision rate | 20.7% |
| Equivalence | **PASS** |
| Architecture boundary | **PASS** |

**Killer metric:** 1 new platform / 0 new canonical — manufacturer platform knowledge without ontology expansion.

## Deferred (explicitly not now)

- **Samsung FL torture fixture** — architecture-boundary test already proves the CG-5.6 property. Optional DS-7 fixture deferred until a future compounding-efficiency experiment needs it.
- **Semantic OEM-title matcher** — `inverter_board` case documents human gate as the correct adjudication path for now.

## Samsung FL #2 — WF6000R (CLOSED & FROZEN)

Published: `promo-SAMSUNG-FL-WF6000R-WASHER-20260913194211`  
Frozen baseline: `calibration/compounding_baseline_v1_samsung_fl2.json`  
Raw gate preview (preserved): `calibration/compounding_samsung_fl2_gate_preview_SAMSUNG-FL-WF6000R-WASHER.json`  
Human classification: `calibration/samsung-fl-wf6000r-washer_human_classification.json`

### Raw gate preview vs human-resolved (killer distinction)

| Metric | Raw gate (matcher) | Human-resolved (7 decisions) |
|--------|-------------------:|-----------------------------:|
| Inherited corpus | 0* | **3** |
| Inherited Samsung platform | **16** | **1**† |
| Inherited Whirlpool platform | 0 | 0 |
| New platform | 0 | **1** (`mems_sensor`) |
| New model-specific | 7 (heuristic) | **2** |
| New canonical | 0 | 0 |
| Gate decisions | 7 | 7 |

\*Platform-priority bucketing — 14 records also match Whirlpool FL corpus.  
†Human gate count for `inverter_board` only; plus 2 auto-inherited exact OEM matches (3C, OC) at apply time.

**Killer case — `inverter_board`:** Matcher blocked on OEM title (BB8700 `9C5` vs WF6000R `9C1/9C2`). Human classified **inherited_platform_family** — matching limitation, not compounding failure.

### Human-resolved hierarchy (frozen)

```
Samsung FL #2
├── inherited corpus        → control_board, drain_pump, inlet_valve
├── inherited Samsung platform → inverter_board
├── new Samsung platform    → mems_sensor (MEMS PBA)
├── model-specific          → hmi_control (BC2), suspension (UV/UB)
└── new canonical           → NONE
```

**Headline:** First clean proof of canonical transfer + Samsung platform compounding across models + model isolation + zero Whirlpool leakage + zero ontology inflation.

Equivalence: **PASS** · Architecture boundary: **PASS**

## Experiment boundary change

CG-5.5 validated **intra-manufacturer** hierarchy (Whirlpool FL corpus → TL platform → model surface).

CG-5.6 tests **cross-manufacturer** knowledge transfer:

```
                 top-level washer ontology
                         │
              ┌──────────┴──────────┐
              │                     │
         Whirlpool               Samsung
         (frozen)                  │
        FL / TL platforms       FL platform #1
              │                     │
       model-specific          model-specific
```

**Carry forward:** canonical ontology (`front_load_washer`) + compiler machinery.  
**Do not carry:** Whirlpool platform vocabulary, OEM aliases, procedure bindings, topology overrides.

Methodology discipline: `calibration/compounding_methodology_v1.json`

## Four independent questions (Samsung FL #1)

| Question | What we want |
|----------|--------------|
| **Canonical transfer** | Samsung procedures map to existing functional concepts at the ontology layer |
| **Platform isolation** | Zero Whirlpool topology, aliases, bindings, or platform-family leakage |
| **Samsung platform establishment** | Genuinely Samsung-specific implementation vocabulary emerges in a new overlay |
| **Ontology pressure** | Do **not** promote frozen cross-appliance candidates from one unfamiliar manual |

## Classification hierarchy (same buckets as Whirlpool)

```
inheritedCorpusKnowledge          ← Whirlpool FL canonical concepts only (W8178558, W11169652)
        ↓
newPlatformKnowledge            ← Samsung FL implementation vocabulary (first manual)
        ↓
newModelSpecificKnowledge       ← OEM/model-line surface (high bar on manual #1)
        ↓
newCanonicalKnowledge           ← frozen at 0 unless extremely clear functional-ontology case
```

**Corpus prior for Samsung FL #1:** `W8178558`, `W11169652` (Whirlpool FL published baselines).  
**Platform prior:** none — Whirlpool TL platform vocabulary does not apply.

## Metric discipline

| Role | Question | Use in curves? |
|------|----------|----------------|
| **Gate-preview** | What did the system know before promotion? | **Yes — authoritative** |
| **Post-publish** | What does the pipeline report after apply-all? | Debug only — known inflation |

## Samsung FL #1 target

| Field | Value |
|-------|-------|
| Manual | `SAMSUNG-FL-BB8700-WASHER` |
| Platform | `samsung_fl_washer_bb8700` |
| Ontology | `front_load_washer` |
| Smoke model | `WF53BB8700` |
| Extraction | `pattern-catalog/SAMSUNG_FL_BB8700_WASHER_EXTRACTION.md` |

## Pipeline (unchanged compiler — fresh manufacturer overlay)

```
normalize → gap analysis → materialize review
  → gate-preview metrics (prior = Whirlpool FL corpus only)
  → human term resolutions (classify: inherited corpus / new platform / model-specific)
  → create samsung_front_load_washer.json overlay family (not Whirlpool)
  → approve bindings → equivalence → publish → canonical validation → DS-7 boundary test
```

**Do not** `approve-all` without human classification of genuinely new Samsung terms.

## Architecture boundary test (permanent negative assertion)

`session/__tests__/scenarios/cg5-samsung-fl-architecture-boundary.test.ts`

Samsung FL resolution **MUST NOT** load:

- `whirlpool_front_load_washer.json` platform families
- `whirlpool_top_load_washer.json` platform families
- Whirlpool OEM aliases (e.g. `TEST #6: Water Level` → `pressure_sensor`)
- Whirlpool procedure bindings (`w8178558*`, `w11169652*`, `w10864849*`, …)
- Whirlpool topology overrides

Cross-manufacturer equivalent of the CG-5 TL/FL isolation test.

## Hard rules

- 23 cross-appliance ontology candidates: **frozen** — one Samsung manual is not evidence
- Do not promote `pressure_sensor` or other Whirlpool TL concepts to canonical because Samsung has a physically similar part
- Whirlpool frozen baselines (`compounding_baseline_whirlpool_washer_evidence.json`) are immutable
- No compiler/matching changes during Samsung FL #1 gate measurement

## CG-5.6 — CLOSED (experiment sign-off)

Four-layer behavior demonstrated with evidence for both directions of reuse:

```
                    CANONICAL
                       │
          ┌────────────┴────────────┐
          │                         │
       WHIRLPOOL                  SAMSUNG
          │                         │
       platform                  platform
          │                         │
       models                    models
                              BB8700 → WF6000R
```

| Evidence path | Status |
|---------------|--------|
| Whirlpool → canonical corpus | ✅ |
| Samsung #1 → canonical corpus | ✅ |
| Samsung #1 → Samsung platform | ✅ |
| Samsung #2 → Samsung platform from #1 | ✅ |
| Samsung #2 → model-specific isolation | ✅ |
| Samsung → 0 Whirlpool platform knowledge | ✅ |
| Canonical ontology restraint (`mems_sensor`, `suspension` stay platform/model-scoped) | ✅ |
| Raw vs human gate evidence separation | ✅ |
| Compiler/matcher integrity during experiment | ✅ |

**`inverter_board` sequence (stronger than exact vocabulary match):**

```
BB8700  9C5  →  inverter_board  →  Samsung platform knowledge
WF6000R 9C1/9C2  →  human semantic resolution  →  inherited_platform_family
```

Matcher limitation on OEM-title variation is **preserved evidence**, not a rush fix. Human adjudication promoted an existing platform concept without duplicate knowledge.

**23 cross-appliance ontology candidates:** frozen — unchanged.

**Next question:** Not *"Can Solomon compound?"* — demonstrated. *"How efficiently can Solomon compound as the corpus gets larger and more heterogeneous?"*

Frozen baselines: `compounding_baseline_v1_samsung_fl1.json`, `compounding_baseline_v1_samsung_fl2.json`

**Successor:** [CG-6 Production Compounding](./CG-6-production-compounding.md) — hierarchy frozen as `knowledge_hierarchy_contract_v1.json`

## CG-5.5 close summary (reference only)

Whirlpool evidence: FL corpus compounding (24.4% → 18.4%), TL platform compounding (14 → 0 → 0 new platform), seed-boundary replication with 2 model-specific surface decisions, **newCanonicalKnowledge = 0** on all paths.

See `CG-5.5-whirlpool-washer-compounding.md` and `compounding_baseline_whirlpool_washer_evidence.json`.
