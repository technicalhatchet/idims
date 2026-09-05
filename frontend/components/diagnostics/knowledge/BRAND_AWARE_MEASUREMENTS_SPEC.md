# Brand-aware measurement knowledge — design spec

**Status:** Phase 1 implemented (`washer` + `refrigerator`)  
**Author:** Solomon diagnostics / knowledge layer  
**Related:** [MANUAL_EXTRACTION_QUEUE.md](./pattern-catalog/MANUAL_EXTRACTION_QUEUE.md), `fieldBindings.ts`, `measurement-knowledge-batch*.json`

---

## 1. Problem

Today, smart measurement fields resolve like this:

```
templateId + fieldKey  →  knowledgeId  →  ranges / evaluation
```

`equipment_make` is **not** part of resolution. Consequences:

| Issue | Example |
|-------|---------|
| Generic ranges on brand-specific platforms | All washers use `washerMotorWindingOhms` even when Whirlpool FL J6 pairs are 6–20 Ω |
| Wrong brand spec wired globally | `wash_heater_ohms` always binds to `whirlpoolFlWasherHeaterOhms` |
| Orphan brand specs in seed | `whirlpoolFlWasherMotorOhms`, `samsungRefrigeratorDefrostHeaterOhms` exist but never evaluate on technician input |
| LG-only template fields shown to everyone | `lg_fan_voltage` visible on any refrigerator, not gated on LG |

Manual extractions already encode **platform-specific** Ω/V/A values. Brand-aware resolution unlocks that investment at field-entry time.

---

## 2. Goals

1. When **make + template** match ingested platform data, load the correct measurement definition (ranges, typical, notes, test tips).
2. **Graceful fallback** to generic definitions when make is blank, unknown, or unmapped.
3. **No breaking change** to saved diagnostics — stored field values stay the same; only evaluation context changes.
4. **Reuse existing seed JSON** — extend schema, don’t fork templates per brand.
5. **Phase 1:** `washer` + `refrigerator` (highest manual coverage + most brand-specific batch entries).

## 3. Non-goals (v1)

- Model-number-level resolution (e.g. `W11169652` vs `WFW5620`) — defer to v2 via `platformId` hints
- Auto-detect make from model prefix (nice follow-up, not required for v1)
- Separate diagnostic templates per brand (keep one `washer` template)
- Backend API changes — client-side resolution only
- Rewriting evidence JSON — rules keep using `knowledgeId`; resolution must be consistent end-to-end

---

## 4. Recommended approach: **Measurement context + layered bindings**

Introduce a single **measurement context** object passed through the diagnostic stack:

```ts
export interface MeasurementContext {
  /** Normalized DMA make, e.g. "Samsung", "Whirlpool" */
  equipmentMake?: string | null;
  /** Raw model string — used for platform hints in v2 */
  equipmentModel?: string | null;
  templateId: string;
}
```

Resolution becomes:

```
(templateId, fieldKey, context) → knowledgeId → MeasurementKnowledgeDefinition
```

### Why this is the right layer

- Matches how **DMA nudges** already use `equipment_make` on the work order
- Keeps **one template** per appliance type (field tech UX unchanged)
- Aligns with manual extraction docs (organized by **platform**, not SKU)
- Small, testable surface: `fieldBindings.ts`, `measurementContext.ts`, `DiagnosticSectionFields.js`, `DiagnosticResultsForm.js`

---

## 5. Data model changes

### 5.1 Extend `MeasurementKnowledgeDefinition` (`types.ts`)

```ts
appliesTo?: {
  equipmentSubtypes?: string[];
  templates?: string[];
  /** NEW — normalized manufacturer keys */
  manufacturers?: string[];
  /**
   * NEW — platform slug shared across manuals (optional v1, required for sister brands)
   * e.g. "whirlpool_fl_dd", "samsung_sxs", "lg_lrmvs_instaview", "midea_rss"
   */
  platformId?: string;
};
```

### 5.2 Platform registry (new file: `platformRegistry.ts`)

Maps **manufacturer + template** → **platformId** with optional model patterns.

```ts
export interface PlatformRule {
  id: string;
  label: string;
  manufacturers: string[];      // ["Whirlpool", "Maytag"]
  templateId: string;           // "washer"
  modelPatterns?: RegExp[];     // optional v2
  knowledgePlatformId: string;  // links to appliesTo.platformId on seed entries
}

// Example entries (Phase 1)
const PLATFORM_RULES: PlatformRule[] = [
  {
    id: 'whirlpool_fl_dd',
    label: 'Whirlpool 27" front-load direct drive',
    manufacturers: ['Whirlpool', 'Maytag', 'KitchenAid'],
    templateId: 'washer',
    knowledgePlatformId: 'whirlpool_fl_dd',
    modelPatterns: [/W1[01]\d{5}/i, /MWH/i],
  },
  {
    id: 'samsung_flexwash',
    label: 'Samsung FlexWash dual-load',
    manufacturers: ['Samsung'],
    templateId: 'washer',
    knowledgePlatformId: 'samsung_flexwash',
    modelPatterns: [/WV55/i],
  },
  {
    id: 'samsung_sxs',
    label: 'Samsung side-by-side',
    manufacturers: ['Samsung'],
    templateId: 'refrigerator',
    knowledgePlatformId: 'samsung_sxs',
  },
  {
    id: 'lg_lrmvs',
    label: 'LG InstaView 4-door',
    manufacturers: ['LG'],
    templateId: 'refrigerator',
    knowledgePlatformId: 'lg_lrmvs',
    modelPatterns: [/LRMVS/i],
  },
  {
    id: 'midea_rss',
    label: 'Midea / Insignia RSS platform',
    manufacturers: ['Insignia'],
    templateId: 'refrigerator',
    knowledgePlatformId: 'midea_rss',
    modelPatterns: [/NS-RSS/i, /NS-RTM/i],
  },
];
```

**Sister-brand policy:**

| Make | Resolves via |
|------|----------------|
| Maytag | Whirlpool platform rules (same OEM) — `expandOemModelVariants()` maps MED→WED, MHWE→WFW, MFI→WRF, etc. |
| KitchenAid | Whirlpool platform rules where shared; own only when manual differs |
| Insignia | Midea platform IDs from extraction docs |
| Kenmore | Parent OEM inferred later (v2); v1 = generic fallback |

### 5.3 Layered field bindings (evolve `fieldBindings.ts`)

Replace flat `Record<fieldKey, knowledgeId>` with **priority-ordered candidates**:

```ts
export interface FieldKnowledgeBinding {
  fieldKey: string;
  candidates: Array<{
    knowledgeId: string;
    /** Most specific wins: platform > manufacturer > default */
    platformId?: string;
    manufacturers?: string[];
    /** When no make/platform match */
    isDefault?: boolean;
  }>;
}

// Washer example
{
  fieldKey: 'electrical_measurements.drive_motor_ohms',
  candidates: [
    { knowledgeId: 'whirlpoolFlWasherMotorOhms', platformId: 'whirlpool_fl_dd' },
    { knowledgeId: 'washerMotorWindingOhms', isDefault: true },
  ],
},
{
  fieldKey: 'electrical_measurements.wash_heater_ohms',
  candidates: [
    { knowledgeId: 'whirlpoolFlWasherHeaterOhms', platformId: 'whirlpool_fl_dd' },
    // no default — field hidden unless platform matches OR generic heater added
  ],
},
```

**Refrigerator example:**

```ts
{
  fieldKey: 'defrost_circuit.defrost_heater_ohms',
  candidates: [
    { knowledgeId: 'samsungRefrigeratorDefrostHeaterOhms', platformId: 'samsung_sxs' },
    { knowledgeId: 'lgRefrigeratorDefrostHeaterOhms', platformId: 'lg_lrmvs' }, // new seed row
    { knowledgeId: 'defrostHeaterOhms', isDefault: true },
  ],
},
```

---

## 6. Resolution algorithm

New module: `resolveFieldKnowledge.ts`

```ts
export function resolvePlatformId(ctx: MeasurementContext): string | null {
  const make = normalizeMake(ctx.equipmentMake);
  if (!make) return null;
  const rules = PLATFORM_RULES.filter(
    (r) => r.templateId === ctx.templateId && r.manufacturers.includes(make),
  );
  if (!rules.length) return null;
  // v1: first matching rule for make+template
  // v2: score by modelPatterns match
  if (ctx.equipmentModel) {
    const byModel = rules.find((r) =>
      r.modelPatterns?.some((re) => re.test(ctx.equipmentModel!)),
    );
    if (byModel) return byModel.knowledgePlatformId;
  }
  return rules[0].knowledgePlatformId;
}

export function resolveFieldKnowledgeId(
  templateId: string,
  fieldKey: string,
  ctx: MeasurementContext,
): string | null {
  const binding = getFieldBinding(templateId, fieldKey);
  if (!binding) return null;

  const platformId = resolvePlatformId(ctx);
  const make = normalizeMake(ctx.equipmentMake);

  for (const tier of ['platform', 'manufacturer', 'default'] as const) {
    for (const c of binding.candidates) {
      if (tier === 'platform' && platformId && c.platformId === platformId) return c.knowledgeId;
      if (tier === 'manufacturer' && make && c.manufacturers?.includes(make)) return c.knowledgeId;
      if (tier === 'default' && c.isDefault) return c.knowledgeId;
    }
  }
  return null;
}
```

`normalizeMake()` maps aliases: `KitchenAid` → same bucket as Whirlpool for platform lookup where appropriate; trim + case-fold.

---

## 7. UI integration

### 7.1 Thread context through call sites

| File | Change |
|------|--------|
| `DiagnosticResultsForm.js` | Build `measurementContext` from `workOrder` / Solomon `equipment` state; pass to `buildMeasurementStatusMap`, wizard sections |
| `DiagnosticSectionFields.js` | Accept `measurementContext` prop; use `resolveFieldKnowledgeId` instead of `getFieldKnowledgeId` |
| `measurementContext.ts` | `buildMeasurementStatusMap(templateId, fields, ctx)` |
| `buildTestCatalogForTemplate.ts` | Include resolved `knowledgeId` per field for catalog display |
| `buildBaselineEvidenceConfig.ts` | Match evidence rules using **resolved** knowledgeId for active context |

### 7.2 Field visibility (brand-gated fields)

Extend `FieldVisibilityRule` with optional:

```ts
{ type: 'make', match: 'LG' }
{ type: 'platform', id: 'samsung_sxs' }
```

Examples:

- `lg_fan_voltage` → show when `platform: lg_lrmvs` OR `make: LG` + complaint chip
- `wash_heater_ohms` → show only when `platform: whirlpool_fl_dd`
- `flex_compartment` → show when `platform: samsung_flexwash` OR flexwash chips (already chip-driven)

### 7.3 Technician feedback when make is missing

If a field has **only** platform-specific candidates (no default):

- Hide field when make blank (preferred), OR
- Show field with badge: *“Select brand for spec”* and skip pass/fail until make set

Solomon `SolomonEquipmentBar` already encourages make + model — use `equipmentComplete` gate for platform-only fields on Pro sessions.

### 7.4 `SmartMeasurementField` / reference card

No component change required if `definition` passed in is already resolved. Optionally show subtle source line:

> Spec: Whirlpool FL DD (W11169652 family)

from `platformRegistry` label.

---

## 8. Evidence & elimination compatibility

Evidence rules reference `knowledgeId` in `when` clauses, e.g.:

```json
{ "type": "measurement", "knowledgeId": "samsungRefrigeratorDefrostHeaterOhms", "statusIn": ["critical"] }
```

**Rule:** `buildMeasurementStatusMap` must key evaluations by **resolved** `knowledgeId`, not field key.

When Samsung fridge + defrost heater field resolves to `samsungRefrigeratorDefrostHeaterOhms`, the existing evidence rule fires. No JSON edits needed if bindings are correct.

**Edge case:** If technician changes make mid-session, re-resolve and re-run intelligence (same as template change today).

---

## 9. Seed data migration (Phase 1)

### Washer — wire batch8 + fix incorrect global bind

| Field | Platform | Knowledge ID | Action |
|-------|----------|--------------|--------|
| `drive_motor_ohms` | `whirlpool_fl_dd` | `whirlpoolFlWasherMotorOhms` | Add binding |
| `inlet_valve_ohms` | `whirlpool_fl_dd` | `whirlpoolFlWasherInletValveOhms` | Add binding |
| `drain_pump_ohms` | `whirlpool_fl_dd` | `whirlpoolFlWasherDrainPumpOhms` | Add binding |
| `wash_heater_ohms` | `whirlpool_fl_dd` | `whirlpoolFlWasherHeaterOhms` | **Scope** to platform only |
| `recirc_pump_ohms` | `whirlpool_fl_dd` | `whirlpoolFlWasherRecircPumpOhms` | **Scope** to platform only |
| All above | default | `washer*` generics | Keep as `isDefault` |

Add when manuals land:

| Platform | Knowledge IDs to add |
|----------|---------------------|
| `samsung_flexwash` | Inverter motor, upper/lower valve pairs (from WV55 extraction) |
| `insignia_washer` / `midea_washer` | E/F platform Ω values from Insignia extraction |

### Refrigerator

| Field | Platform | Knowledge ID |
|-------|----------|--------------|
| `defrost_heater_ohms` | `samsung_sxs` | `samsungRefrigeratorDefrostHeaterOhms` |
| `lg_fan_voltage` | `lg_lrmvs` | `lgRefrigeratorFanVoltage` |
| `lg_defrost_heater_voltage` | `lg_lrmvs` | `lgDefrostHeaterVoltage` |
| `thermistor_voltage_v` | `samsung_sxs` | `refrigeratorThermistorVoltage` |
| `evap_fan_feedback_voltage` | `samsung_sxs` | `refrigeratorEvapFanFeedbackVoltage` |
| `inverter_ipm_voltage` | `samsung_sxs` | `refrigeratorInverterIpmVoltage` |
| defaults | — | existing generic IDs |

Tag seed entries with `appliesTo.platformId` + `appliesTo.manufacturers` for documentation and validation scripts.

---

## 10. Implementation phases

### Phase 1 — Foundation + washer/refrigerator (recommended first PR)

1. `MeasurementContext` type + `normalizeMake()` + `platformRegistry.ts` (5–8 platforms)
2. `resolveFieldKnowledge.ts` + unit tests
3. Refactor `fieldBindings.ts` to layered candidates (washer + refrigerator only)
4. Thread context: `DiagnosticResultsForm` → `DiagnosticSectionFields` → `measurementContext.ts`
5. Brand-gated visibility for LG/Samsung-only refrigerator fields
6. Fix Whirlpool heater/recirc global mis-bind
7. `npx tsc --noEmit` + snapshot tests for resolution matrix

**Acceptance criteria:**

- Whirlpool FL washer + motor field → 6–20 Ω spec, pass/fail correct
- Samsung fridge + defrost heater → 63 Ω ±7% spec
- LG fridge + `lg_fan_voltage` field visible; Whirlpool fridge → hidden
- Blank make → generic `defrostHeaterOhms` / `washerMotorWindingOhms`
- Existing saved diagnostics still load (fallback when make missing on old records)

### Phase 2 — Dryer, dishwasher, microwave

- Samsung/LG/Whirlpool dryer thermistor kΩ specs (batch5 already Whirlpool-biased in notes)
- Dishwasher ACU platforms (Whirlpool/KitchenAid shared, LG VARIO, Insignia)
- Microwave F-1/C-F1 families

### Phase 3 — Model pattern scoring + Kenmore parent resolution

- `modelPatterns` priority in `resolvePlatformId`
- Kenmore prefix table → Whirlpool vs Electrolux vs LG parent

### Phase 4 — Validation tooling

- Script: `validate_measurement_bindings.ts` — every platform-specific knowledge ID must have a binding path; every binding candidate must exist in seed
- CI check on PRs touching `fieldBindings.ts` or seed batches

---

## 11. Testing strategy

### Unit tests (`resolveFieldKnowledge.test.ts`)

| Make | Template | Field | Expected knowledgeId |
|------|----------|-------|----------------------|
| Whirlpool | washer | drive_motor_ohms | whirlpoolFlWasherMotorOhms |
| Samsung | washer | drive_motor_ohms | washerMotorWindingOhms (default) |
| Samsung | refrigerator | defrost_heater_ohms | samsungRefrigeratorDefrostHeaterOhms |
| LG | refrigerator | lg_fan_voltage | lgRefrigeratorFanVoltage |
| Whirlpool | refrigerator | lg_fan_voltage | null (field hidden) |
| *(empty)* | washer | drain_pump_ohms | washerDrainPumpOhms |

### Integration

- Enter 8 Ω on Whirlpool FL motor → **normal**
- Enter 50 Ω on same → **critical**
- Enter 30 Ω on Samsung washer motor → evaluated against generic band, not Whirlpool spec

---

## 12. Open questions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Store resolved `knowledgeId` on save for audit? | Optional metadata `fields_meta[fieldKey].knowledgeId` — defer unless compliance needs it |
| 2 | DIY Solomon sessions often skip make? | Keep generics; show “Add brand for model-specific spec” nudge on measurement card |
| 3 | Insignia in DMA but not in `DMA_MANUFACTURERS` dropdown? | Add Insignia to `dmaEquipmentOptions.js` as part of Phase 1 |
| 4 | Multiple platforms per make (Samsung top-load vs FlexWash)? | v1: model pattern `WV55` → flexwash; default Samsung washer → generic until manual |
| 5 | Rename `getFieldKnowledgeId`? | Keep as thin wrapper calling `resolveFieldKnowledgeId(ctx)` with empty context for backward compat |

---

## 13. Why this is the right next step

1. **Unlocks manual batch ROI** — extractions already list Ω/V; today they only nudge evidence textually.
2. **Fixes a real bug** — Whirlpool FL heater spec on all washers is actively misleading.
3. **Small blast radius** — no new templates, no DB migration; pure frontend knowledge layer.
4. **Composes with existing intelligence** — evidence rules, elimination, DMA nudges all get sharper without rewrites.
5. **Matches field-service mental model** — techs think “it’s a Samsung SxS,” not “refrigerator template #3.”

---

## 14. File checklist (Phase 1 PR)

| File | Action |
|------|--------|
| `knowledge/types.ts` | Add `manufacturers`, `platformId` to `appliesTo` |
| `knowledge/platformRegistry.ts` | **New** |
| `knowledge/resolveFieldKnowledge.ts` | **New** |
| `knowledge/fieldBindings.ts` | Refactor to layered candidates |
| `knowledge/measurementContext.ts` | Accept `MeasurementContext` |
| `knowledge/seed/measurement-knowledge-batch8.json` | Add `appliesTo.platformId` tags |
| `knowledge/seed/measurement-knowledge-batch6.json` | Tag Samsung/LG entries |
| `washer/washerFieldVisibility.ts` | Platform gates for FL-only fields |
| `refrigerator/refrigeratorFieldVisibility.ts` | Platform gates for LG/Samsung fields |
| `DiagnosticSectionFields.js` | Pass context |
| `work_orders/DiagnosticResultsForm.js` | Build context from work order |
| `constants/dmaEquipmentOptions.js` | Add Insignia |
| `knowledge/__tests__/resolveFieldKnowledge.test.ts` | **New** |

**Docs:** Update [MANUAL_EXTRACTION_QUEUE.md](./pattern-catalog/MANUAL_EXTRACTION_QUEUE.md) workflow step 5 to include platform binding.
