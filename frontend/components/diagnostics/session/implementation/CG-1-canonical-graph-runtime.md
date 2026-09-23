# CG-1 — Canonical Diagnostic Graph Runtime + FL Washer v1

**Depends on:** DS-7 (diagnostic loop validated v1)  
**Goal:** Prove canonical graph → functional relationships → dependencies → candidate eligibility/ranking → NEXT TEST.

## Sub-tickets

| Piece | Deliverable |
|-------|-------------|
| **CG-1A** | Ontology contract — `canonicalTypes.ts`, `schemas/canonical_ontology_contract.json` |
| **CG-1B** | FL washer graph — `testTargets`, `establishedFactSources`, semantic edges in `front_load_washer.json` |
| **CG-1C** | Runtime — `canonicalGraphRuntime.ts` (facts, dependencies, routing fit) |
| **CG-1D** | Candidate wiring — `collectCanonicalCandidates.ts` merges via `routingFit` (weight 0.25) |

## Architecture rules

1. **Three layers stay separate:** physical topology (`relationships`), diagnostic topology (`functionalDependencies`, facts, test targets), procedural knowledge (OEM seeds).
2. **Canonical ≠ universal truth** — manufacturer/model overlays win without corrupting canonical layer (`source` + `confidence` on edges).
3. **Do not rewrite the ranker** — canonical candidates merge in `collectDiagnosticCandidates()`; conservative `routingFit` weight.
4. **Do not bulk-generate graph edges from manuals** — skeleton + runtime proof first; overlays in CG-2.

## Files

| File | Role |
|------|------|
| `knowledge/canonical/canonicalTypes.ts` | CG-1A contract types |
| `knowledge/canonical/canonicalGraphRuntime.ts` | CG-1C graph state + routing fit |
| `knowledge/canonical/front_load_washer.json` | CG-1B FL washer v1 graph |
| `session/candidates/collectCanonicalCandidates.ts` | CG-1D fourth candidate source |
| `session/candidates/diagnosticWeights.ts` | `routingFit: 0.25` |
| `session/__tests__/scenarios/canonical-graph-wont-spin.test.ts` | Killer test |

## Killer test (WON'T SPIN)

Stages assert:

1. Initial — upstream prerequisites rank above blocked downstream (`door_lock_test` routingFit > `motor_output_test`)
2. Door good — `door_lock_authorized` established; motor routingFit rises
3. Drain good — `drain_completion` established; motor routingFit rises further
4. Command present — `motor_command_present` established; downstream path peaks
5. 37 VAC — `motor_output_abnormal` established; investigation routingFit maintained

## Ship gate

```bash
python backend/scripts/validate_canonical_graph.py
cd frontend && npm run test:diagnostic-session
cd frontend && npx tsc --noEmit
```

## Out of scope (CG-2+)

- Whirlpool FL family overlay normalization
- Samsung / GE manufacturer overlays
- Auto-ingest graph edges from extracted manuals
