# CG-3 — Automated Manual Normalization Pipeline

**Depends on:** CG-2  
**Rule:** Auto-extraction produces **candidates only** — never mutates production canonical graphs or approved overlays.

## Goal

Transform ~70 existing procedure seeds into validated, provenance-preserving overlay **candidates**.

```
procedure seeds + manifest
        ↓
normalized procedures
        ↓
canonical mapping candidates
        ↓
overlay candidates
        ↓
conflict detection
        ↓
human approval → manufacturer_overlays/ (manual publish)
```

## Three outputs

### 1. Normalized procedures

Uniform structure: `procedureId`, `manufacturer`, `platform`, `steps[]`, `measurements[]`, `branches[]`, `source`, `provenance`.

### 2. Canonical mapping candidates

```json
{
  "sourceTerm": "MCU",
  "canonicalId": "motor_controller",
  "confidence": 0.98,
  "mappingType": "alias",
  "provenance": { "manualId": "W8178558", "sources": [...] }
}
```

### 3. Overlay candidates

`procedureTestBinding`, `measurementBinding` with confidence + provenance.

## Conflict detection

Flags `CONFLICT_REQUIRES_REVIEW` for:

- `ALIAS_CONFLICT` — same OEM term → different canonical ids across manuals
- `RELATIONSHIP_CONFLICT` — inferred motor architecture differs (CCU→MCU vs direct drive)
- `TEST_TARGET_CONFLICT` — procedure maps to multiple test targets

**Never auto-resolved.**

## Commands

```bash
python backend/scripts/run_normalization_pipeline.py --manual W8178558
python backend/scripts/run_normalization_pipeline.py --all
python backend/scripts/run_normalization_pipeline.py --all --template washer
python backend/scripts/validate_normalization_candidates.py
pytest backend/scripts/tests/test_normalization_pipeline.py
```

## Output

`frontend/components/diagnostics/knowledge/normalization/candidates/{manualId}/`

## Out of scope

- All 19 appliance ontologies
- Autonomous ontology creation
- Auto conflict resolution / auto publish
- LLM diagnosis
- Replacing `extract_pdf.py`

## Next

Human review UI + approved-candidate publish step into `manufacturer_overlays/`.
