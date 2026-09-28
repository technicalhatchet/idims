# Solomon Canonical Diagnostic Ontology

Machine-readable **component topology** and **functional dependencies** for appliance families. This layer sits above platform-specific OEM procedures and below live diagnostic evidence.

## Stack

```
CANONICAL GRAPH (this folder)
        ↓
PLATFORM OVERLAY (platform_overlays/*.json + platformRegistry)
        ↓
SERVICE PROCEDURES (procedures/seed/{platformId}/)
        ↓
TEST MEASUREMENT + EVIDENCE (measurement knowledge + evidence/*.json)
        ↓
DIAGNOSTIC STATE + NEXT TEST (intelligence engine — Phase 2+)
```

## Files

| File | Purpose |
|------|---------|
| `front_load_washer.json` | Canonical FL washer systems, components, relationships, dependencies |
| `platform_overlays/front_load_washer.reference.json` | Reference procedure→domain maps (validation) |
| `manufacturer_overlays/whirlpool_front_load_washer.json` | CG-2 Whirlpool FL family overlay (W8178558 Duet Sport) |
| `component_aliases.json` | Runtime seed id → evidence id aliases (Samsung `main_control` / `inverter`, etc.) |
| `schemas/decision_branch_extension.json` | Documented extension to procedure `DecisionBranch` (not wired yet) |

## Conventions

- **Component ids** use Solomon `componentId` strings from `evidence/{templateId}.json` where they exist.
- New canonical-only components are marked `pendingEvidenceGraph: true` until added to the evidence graph.
- **Categories** (`categoryId`) are unchanged — canonical `systemId` maps to existing evidence categories via `categoryId` on each component.
- **Relationships** model functional diagnostic topology, not every wire.
- **Tests and branch logic** stay in procedure seeds — not in the canonical graph.

## Runtime

- `resolveCanonicalRouting()` — complaint chips + error codes → entry points → failure domains
- `resolveDiagnosticGraph()` — canonical + manufacturer/platform overlay merge (CG-2)
- `evaluateCanonicalGraphState()` — established facts + dependency status on resolved graph
- `deriveCanonicalRoutingAdjustments()` — test-target routing fit from graph state
- `collectCanonicalCandidates()` — fourth candidate source in unified ranker (CG-1D)
- `recommendServiceProcedures()` — adds +18 priority per matching canonical domain
- Dev harness: `/solomon/procedures/dev` — canonical routing panel + ranked procedures

## Validation

```bash
python backend/scripts/validate_canonical_graph.py
```

Ship gate (with procedure work): `validate_canonical_graph.py` + `validate_procedure_seed.py` + `cd frontend && npx tsc --noEmit`.

## Docs

| Doc | Purpose |
|-----|---------|
| `SOLOMON_DIAGNOSTIC_LOOP_V1.md` | **Implementation contract** — layers, hard rules, Phase 2 wiring order |
| `../../session/implementation/README.md` | **Cursor tickets DS-1 … DS-7** — one PR each, file paths, tests |
| `pattern-catalog/CANONICAL_FL_WASHER_MAPPING.md` | Human-readable mapping tables and gap analysis |
