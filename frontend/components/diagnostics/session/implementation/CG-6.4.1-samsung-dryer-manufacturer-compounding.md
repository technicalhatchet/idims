# CG-6.4.1 — Samsung Dryer Manufacturer Compounding

**Status:** CLOSED (2026-09-14)  
**Predecessor:** CG-6.4 dryer canonical graph (`vented_dryer.json` rev 2 frozen)  
**Successor:** Cross-manufacturer or cross-appliance-family compounding — not a fourth Samsung dryer

## Question answered

Can the frozen `vented_dryer` functional ontology absorb Samsung dryer platforms across increasing implementation distance — including a structurally different top-load chassis — without canonical expansion or re-teaching the Samsung manufacturer vocabulary?

**Answer: Yes.**

```text
                    vented_dryer
                         │
              samsung_vented_dryer.json
                 /         |        \
               FL          FL         TL
            BB8700      DV6000     DV50
               13          0          0
```

## Frozen curve

| Manual | Platform family | Chassis | Procedures | Mapping candidates | New human decisions | New canonical |
|--------|-----------------|---------|------------|------------------|---------------------|---------------|
| SAMSUNG-FL-BB8700-DRYER | `samsung_fl_dryer_bb8700` | FL | 11 | 25 | **13** | 0 |
| SAMSUNG-FL-DV6000-DRYER | `samsung_fl_dryer_dv6000` | FL | 8 | 19 | **0** | 0 |
| SAMSUNG-TL-DV50-DRYER | `samsung_tl_dryer_dv50` | TL | 11 | 25 | **0** | 0 |
| **Totals** | **3 platforms** | | **30** | **69** | **13 → 0 → 0** | **0** |

Machine-readable freeze: `normalization/calibration/compounding_samsung_dryer_curve_v1.json`

## What each point proved

| Point | Role | Evidence |
|-------|------|----------|
| BB8700 | Baseline | Samsung vented_dryer manufacturer vocabulary established (13 semantic gate decisions) |
| DV6000 | Platform transfer | Same manufacturer layer, different FL implementation — 0 new semantic decisions |
| TL DV50 | Chassis transfer | TL chassis did not trigger `top_load_washer` mis-route; 0 new semantic decisions |

Platform-specific knowledge (Ω specs, TL display terms, measurement bindings) is tracked as `newPlatformKnowledge` — not semantic teaching and not inflated into compounding metrics.

## Architecture invariants (permanent)

1. **Explicit `platformId` is authoritative over model-pattern inference.**  
   When `platformId` is set, only the matching platform family may participate. Other families must not fall through to their `modelPatterns`.

2. **Top-load chassis ≠ new canonical dryer ontology.**  
   TL DV50 resolves `vented_dryer` for all dryer templates including mistaken `washer` templateId.

3. **Burden of proof shifted.**  
   Future Samsung dryers must demonstrate they cannot be represented by existing functional ontology + manufacturer overlay before proposing canonical expansion.

4. **Heat-pump / combo excluded.**  
   `samsung_laundry_combo` / WD53DBA900 remains outside `vented_dryer`.

## Routing-boundary regression (permanent)

`session/__tests__/scenarios/cg6-samsung-dryer-routing-boundary.test.ts`

| Case | Expected |
|------|----------|
| Explicit `samsung_tl_dryer_dv50` + `DVE50R5200` | TL DV50 family only |
| Explicit `samsung_fl_dryer_bb8700` + colliding `DVE50R5200` | BB8700 family only — no TL fallthrough |
| No explicit platform + `DVE50R5200` | Model-pattern routing → TL DV50 |

Implementation: `platformFamilyApplies()` in `resolveDiagnosticGraph.ts` — explicit platform mismatch returns `false` before model-pattern evaluation.

## Promotion ledger

| Manual | Promotion ID | Status |
|--------|--------------|--------|
| SAMSUNG-FL-BB8700-DRYER | (prior publish) | published |
| SAMSUNG-FL-DV6000-DRYER | (prior publish) | published |
| SAMSUNG-TL-DV50-DRYER | `promo-SAMSUNG-TL-DV50-DRYER-20260914170644` | published |

## Validation gate

- `cg6-vented-dryer-ontology.test.ts` — 13/13 pass (three-family cross-isolation)
- `cg6-samsung-dryer-routing-boundary.test.ts` — routing invariant
- `validate_canonical_graph.py` — pass
- `npx tsc --noEmit` — pass
- Dev harness preset: Samsung TL DV50 dryer (`DVE50R5200AW`)

## Do not do next

- Add a fourth Samsung dryer purely to extend the curve — diminishing returns; three points test the intended boundary.
- Re-open dryer canonical ontology growth as default optimization — evidence supports manufacturer/platform layering first.

## Related artifacts

| Artifact | Role |
|----------|------|
| `compounding_samsung_dryer_curve_v1.json` | Frozen three-point curve |
| `samsung_vented_dryer.json` | Shared manufacturer overlay (3 platform families) |
| `SAMSUNG_TL_DV50_DRYER_overlay_mapping_table_v1.json` | TL gate + compounding evidence |
| `knowledge_hierarchy_contract_v1.json` | Layer stack + routing invariant |
