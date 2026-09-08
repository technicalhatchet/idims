# Service procedure onboarding playbook

Repeatable workflow for adding OEM **ServiceProcedure** content to idims without re-architecting per manual.

**Field validation** (running tests on a real unit) is valuable but **not a gate** for shipping seeds — correctness comes from extraction docs, measurement knowledge cross-refs, and `validate_procedure_seed.py`. Field feedback refines content over time.

---

## Prerequisites (per manual)

| Requirement | Where |
|-------------|--------|
| PDF extracted to `*-extracted.txt` | `backend/docs/manuals/` |
| Human extraction doc with TEST # table | `frontend/components/diagnostics/knowledge/pattern-catalog/*_EXTRACTION.md` |
| `platformId` in `platformRegistry.ts` | Model patterns resolve to this platform |
| Measurement knowledge IDs for ohms/voltage steps | `knowledge/seed/measurement-knowledge*.json` |
| Evidence components (if using `diagnosticEffects`) | `knowledge/evidence/{template}.json` |

---

## Folder layout

```
frontend/components/diagnostics/procedures/
├── procedureManualManifest.json    # registry of manuals + pipeline scripts
├── procedureRegistry.ts            # runtime loader (imports generated file)
├── procedureRegistry.generated.ts  # AUTO-GENERATED — do not edit
└── seed/
    └── {platformId}/                   # e.g. whirlpool_fl_dd
        ├── bundles/                    # optional service-mode bundles
        └── {manualId}-test-*.json
```

After adding JSON files, **always** run registry codegen (see below).

---

## Onboarding a new manual (checklist)

### 1. Register the manual

Add an entry to `procedureManualManifest.json` (next to `procedureRegistry.ts`, not under `seed/`):

```json
{
  "manualId": "W8178558",
  "platformId": "whirlpool_duet_sport",
  "templateId": "washer",
  "seedDir": "whirlpool_duet_sport",
  "label": "Whirlpool Duet Sport CCU washer",
  "extractionDoc": "frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_DUET_SPORT_8178558_EXTRACTION.md",
  "pipeline": {
    "generate": "backend/scripts/generate_w8178558_procedure_seeds.py",
    "attachDiagrams": null,
    "attachDiagnosticEffects": "backend/scripts/attach_w8178558_diagnostic_effects.py",
    "attachServiceModes": null
  }
}
```

Null attach steps are fine — not every manual needs service modes or diagrams on day one.

### 2. Author procedure seeds

**Option A — Python generator** (W11169652 pattern): one script builds JSON from structured definitions; good when many tests share patterns.

**Option B — Hand-edit JSON**: start with 1–3 high-value TEST # (motor, heater, pump); copy structure from an existing seed in the same appliance type.

Each procedure file must include:

- `id`, `platformId`, `componentIds`, `tags`, `source` (manualId, oemTestNumber, pages)
- `steps[]` with `measurementKnowledgeId` on measurement steps
- Optional `serviceModes[]` refs to bundles under `bundles/`

### 3. Run the pipeline

```bash
# Full pipeline for a registered manual
python backend/scripts/run_procedure_manual_pipeline.py --manual W11169652

# Seeds already written — only attach + codegen + validate
python backend/scripts/run_procedure_manual_pipeline.py --manual W11169652 --skip-generate
```

Individual steps:

```bash
python backend/scripts/generate_procedure_registry.py   # after any seed JSON change
python backend/scripts/validate_procedure_seed.py
```

### 4. Extend knowledge (when needed)

- New ohms ranges → measurement batch JSON + `knowledgeRegistry`
- New components / evidence rules → `evidence/{template}.json`
- Error code → TEST # mapping → extraction doc table (DMA / resolver later)

### 5. Diagrams (optional)

1. Crop PNGs → `frontend/public/images/procedures/{platformId}/`
2. Catalog entries → `procedureDiagramCatalog.ts`
3. Attach script patches `images[]` on steps (see W11169652 attach scripts)

### 6. Ship gate (automated)

- `validate_procedure_seed.py` passes
- `npx tsc --noEmit` in `frontend/`
- Platform resolves on a representative model in Solomon
- Procedures appear in catalog when `platformId` matches (no manual allowlist)

---

## What generalizes vs stays manual-specific

| Generalized (Cut A) | Still per-manual (content) |
|---------------------|----------------------------|
| `generate_procedure_registry.py` | TEST # definitions in generator or JSON |
| `validate_procedure_seed.py` | Extraction doc curation |
| `procedureManualManifest.json` | Attach scripts for diagrams/effects/service modes |
| `procedurePlatformAccess.ts` (template gate) | Evidence component IDs |
| `run_procedure_manual_pipeline.py` | Diagram crops |
| Runner, UI, session state | Service-mode console vs LCD variants |

---

## W11169652 reference (pilot)

| Item | Path |
|------|------|
| Manifest entry | `procedureManualManifest.json` → `W11169652` |
| 17 tests + 6 bundles | `seed/whirlpool_fl_dd/` |
| Generator | `backend/scripts/generate_w11169652_procedure_seeds.py` |
| Pipeline | `python backend/scripts/run_procedure_manual_pipeline.py --manual W11169652` |

---

## Suggested order for manual #2

1. **Duet Sport washer (8178558)** — same `washer` template, different `platformId` and Ω specs; proves playbook without new appliance wizard.
2. Start with **TEST #3 motor** + 2–3 related tests, not full manual coverage.
3. Add manifest entry + `seed/whirlpool_duet_sport/` + thin generator or hand JSON.
4. Run pipeline → registry codegen → validate → ship.

---

## Not in scope for this playbook

- DB-backed procedure library (Phase 9)
- Canonical cross-OEM tests (Phase 10)
- Bulk LLM extraction from PDFs
- RAG over extracted text

See original *Service Procedure Layer — Scope Assessment* for long-term phases.
