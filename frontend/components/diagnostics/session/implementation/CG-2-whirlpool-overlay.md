# CG-2 — Whirlpool FL Washer Family Overlay + Canonical Resolution

**Depends on:** CG-1  
**Rule:** The overlay may add manufacturer specificity; it may **not** become a replacement diagnostic ontology.

## Goal

Prove the canonical skeleton absorbs a real Whirlpool family architecture without corrupting the canonical layer:

```
Canonical FL Washer
        ↓
Whirlpool Family Overlay (W8178558 / Duet Sport)
        ↓
Model Overlay (future)
        ↓
Resolved Diagnostic Graph → ranking
```

## Deliverables

| Piece | Files |
|-------|--------|
| Overlay contract | `canonicalTypes.ts` — `ManufacturerOverlayFile`, `GraphOverride`, bindings |
| Resolution runtime | `resolveDiagnosticGraph.ts` — deterministic precedence, explicit overrides |
| Alias resolution | `resolveCanonicalAlias.ts` |
| Whirlpool overlay | `manufacturer_overlays/whirlpool_front_load_washer.json` |
| Runtime wiring | `canonicalGraphRuntime.ts`, `collectCanonicalCandidates.ts` |

## Precedence

```
Canonical → Manufacturer → Platform family → Model → Session facts
```

- **Additive:** merge arrays by id; merge `establishedFactSources` branch lists
- **Override:** explicit `remove` / `replace` / `merge` only — never infer from absence

## Killer test

`cg2-whirlpool-overlay.test.ts` — DS-7 torture harness against **resolved** Whirlpool graph (WFW8300 / `whirlpool_duet_sport`).

## Acceptance criteria

- [x] Canonical loads without overlay
- [x] Overlay does not mutate canonical source JSON
- [x] Resolved graph = canonical + Whirlpool additions
- [x] Explicit override removes CCU→motor direct control
- [x] Canonical relationships intact unless overridden
- [x] OEM aliases → canonical ids
- [x] Procedure bindings → canonical test targets
- [x] Platform/model applicability enforced
- [x] OEM measurement bindings retain units/spec ids
- [x] Display terms for UI (`CCU`, `MCU`, etc.)
- [x] Canonical routingFit + branch + measurement effects preserved
- [x] DS-6 verified_failed semantics unchanged
- [x] Torture scenario passes on resolved graph
- [x] Serialize → reload → same top-5 ordering
- [x] Candidates never empty due to overlay resolution failure

## Ship gate

```bash
python backend/scripts/validate_canonical_graph.py
cd frontend && npm run test:diagnostic-session
cd frontend && npx tsc --noEmit
```

## Next: CG-3

Automated normalization pipeline for existing manuals — not another hand-built graph.
