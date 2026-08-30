# Batch 1 — Multi-signal pattern catalog (draft)

**Status: IMPLEMENTED** (Batch 1 — refrigerator + standalone freezer evidence JSON)

Refrigerator + standalone freezer only. Every signal ID below is verified in [INVENTORY_REFRIGERATOR.md](./INVENTORY_REFRIGERATOR.md) and [INVENTORY_STANDALONE_FREEZER.md](./INVENTORY_STANDALONE_FREEZER.md).

Evidence rules use **AND** logic: all `when` clauses must match.

## How to review

1. Confirm clinical story matches field-service reality.
2. Check **Duplication** column — singles may already nudge the same target; multi-signal rules should add *converging* evidence, not double-count the same observation.
3. Approve rows marked **Must** first; **Nice** can slip to a later batch.
4. After approval, implement only **Approved** rows in `knowledge/evidence/*.json`.

---

## Refrigerator

**Existing multi-signal rule (do not duplicate):**

| Rule ID | When | Target | Notes |
|---------|------|--------|-------|
| `fz_temp_normal_ff_warm` | `freezerCabinetTemp` normal AND `freshFoodCabinetTemp` warning/critical | `defrost_system` +15 | Already in JSON |

| ID | Pattern | Priority | Status | Target (layer) | Effect | recommendStepKey | Duplication / notes |
|----|---------|----------|--------|----------------|--------|------------------|---------------------|
| REF-MS-001 | Freezer cold, FF warm, damper failed | Must | **Implemented** | `airflow` (category) | increase +22 | `functional` | `ref_ms_001_damper_split_temp` |
| REF-MS-002 | Freezer cold, FF warm, evap fan not running | Must | **Implemented** | `evap_fan` (component) | confirm | `functional` | `ref_ms_002_evap_fan_split_temp` |
| REF-MS-003 | `weak_cooling_ff` chip + FF warm + FZ normal | Must | **Implemented** | `airflow` (category) | increase +18 | `fans` | `ref_ms_003_weak_ff_chip_split_temp` |
| REF-MS-004 | `not_cooling` + both cabinet temps high | Must | **Implemented** | `sealed_system` (category) | increase +20 | `sealedSystem` | `ref_ms_004_not_cooling_both_temps_high` |
| REF-MS-005 | `not_cooling` + compressor running + amps abnormal | Must | **Implemented** | `sealed_system` (category) | increase +25 | `sealedSystem` | `ref_ms_005_not_cooling_compressor_amps_abnormal` |
| REF-MS-006 | Frost chip + heavy frost + evap fan no | Must | **Implemented** | `evap_fan` (component) | confirm | `fans` | `ref_ms_006_frost_chip_heavy_frost_evap_fan_no` |
| REF-MS-007 | Heavy frost + defrost heater open (critical) | Must | **Implemented** | `heater` (component) | confirm | `defrost` | `ref_ms_007_heavy_frost_heater_open` |
| REF-MS-008 | Freezer temp high + condenser fan no | Must | **Implemented** | `condenser_fan` (component) | confirm | `fans` | `ref_ms_008_fz_temp_high_condenser_fan_no` |
| REF-MS-009 | `weak_cooling_ff` + FF gasket bad | Nice | **Implemented** | `door_gasket` (component) | confirm | `visual` | `ref_ms_009_weak_ff_gasket_bad` |
| REF-MS-010 | Water dispenser chip + FF temp critical | Nice | **Implemented** | `water_system` (category) | increase +18 | `commonly_missed` | `ref_ms_010_water_dispenser_ff_critical` |
| REF-MS-011 | Ice maker chip + FF temp high | Nice | **Implemented** | `ice_maker` (category) | increase +15 | `functional` | `ref_ms_011_ice_maker_ff_temp_high` |
| REF-MS-012 | Compressor not running + supply voltage critical | Nice | **Implemented** | `controls_sensors` (category) | increase +22 | `fans` | `ref_ms_012_compressor_no_supply_critical` |
| REF-MS-013 | FF warm + FZ normal + evap frost pattern bad | Must | **Implemented** | `defrost_system` (category) | increase +20 | `defrost` | `ref_ms_013_split_temp_evap_frost_bad` |
| REF-MS-014 | `not_cooling` + compressor not running | Must | **Implemented** | `compressor` (component) | confirm | `sealedSystem` | `ref_ms_014_not_cooling_compressor_no` |
| REF-NS-001 | `noisy` chip | Must | **Implemented** | `airflow` (category) | increase +14 | `fans` | `chip_noisy_airflow` |
| REF-NS-002 | `noisy` + condenser condition bad | Must | **Implemented** | `condenser_fan` (component) | increase +18 | `fans` | `ref_noisy_condenser_bad_fan_component` |
| REF-NS-003 | `noisy` + condenser bad + fan running | Must | **Implemented** | `condenser_fan` (component) | increase +20 | `fans` | `ref_noisy_condenser_bad_fan_running` |
| REF-NS-004 | `condenserFanAmps` abnormal | Must | **Implemented** | `condenser_fan` (component) | confirm | `fans` | `condenser_fan_amps_abnormal` |
| REF-NS-005 | normal fan amps + condenser bad | Nice | **Implemented** | `airflow` (category) | increase +14 | `fans` | `condenser_fan_amps_normal_condenser_bad` |

### REF-MS-001 — Freezer cold, FF warm, damper failed

**Explanation:** Freezer holding temperature while fresh food is warm, with a failed damper/air tower, points to airflow routing—not sealed system.

```json
"when": [
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["normal"] },
  { "type": "measurement", "knowledgeId": "freshFoodCabinetTemp", "statusIn": ["warning", "critical"] },
  { "type": "field", "path": "functional_checks.damper_operation", "equals": "bad" }
]
```

### REF-MS-002 — Freezer cold, FF warm, evap fan not running

**Explanation:** Classic split-temp pattern with evap fan confirmed off—iced tower or fan motor likely.

```json
"when": [
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["normal"] },
  { "type": "measurement", "knowledgeId": "freshFoodCabinetTemp", "statusIn": ["warning", "critical"] },
  { "type": "field", "path": "functional_checks.evaporator_fan_running", "equals": "no" }
]
```

### REF-MS-003 — Weak FF chip + split temps

**Explanation:** Customer reported FF weakness; measured split confirms airflow/defrost over sealed system.

```json
"when": [
  { "type": "chip", "id": "weak_cooling_ff" },
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["normal"] },
  { "type": "measurement", "knowledgeId": "freshFoodCabinetTemp", "statusIn": ["warning", "critical"] }
]
```

### REF-MS-004 — Not cooling + both sections warm

**Explanation:** Whole-box failure with both compartments out of range—prioritize sealed system and compressor path.

```json
"when": [
  { "type": "chip", "id": "not_cooling" },
  { "type": "measurement", "knowledgeId": "freshFoodCabinetTemp", "statusIn": ["warning", "critical"] },
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["warning", "critical"] }
]
```

### REF-MS-005 — Not cooling + compressor running + amps abnormal

**Explanation:** Compressor runs but cannot pull load—sealed system restriction/leak or weak compressor.

```json
"when": [
  { "type": "chip", "id": "not_cooling" },
  { "type": "field", "path": "functional_checks.compressor_running", "equals": "yes" },
  { "type": "measurement", "knowledgeId": "compressorRunAmps", "statusIn": ["warning", "critical"] }
]
```

### REF-MS-006 — Frost complaint + heavy frost + evap fan no

**Explanation:** Frost buildup with fan not running—evap fan failure or iced fan blade.

```json
"when": [
  { "type": "chip", "id": "frost_buildup" },
  { "type": "field", "path": "visual_inspection.frost_present", "equals": "yes" },
  { "type": "field", "path": "functional_checks.evaporator_fan_running", "equals": "no" }
]
```

### REF-MS-007 — Heavy frost + defrost heater open

**Explanation:** Visual frost with heater open at meter—defrost heater is root cause.

```json
"when": [
  { "type": "field", "path": "visual_inspection.frost_present", "equals": "yes" },
  { "type": "measurement", "knowledgeId": "defrostHeaterOhms", "statusIn": ["critical"] }
]
```

### REF-MS-008 — Freezer temp high + condenser fan no

**Explanation:** Warm freezer with condenser fan off—high head pressure / poor heat rejection.

```json
"when": [
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["warning", "critical"] },
  { "type": "field", "path": "functional_checks.condenser_fan_running", "equals": "no" }
]
```

### REF-MS-009 — Weak FF + gasket bad

**Explanation:** FF warming with bad gasket—section air leak before chasing damper or defrost.

```json
"when": [
  { "type": "chip", "id": "weak_cooling_ff" },
  { "type": "field", "path": "visual_inspection.gasket_condition", "equals": "bad" }
]
```

### REF-MS-010 — Water dispenser + FF critical

**Explanation:** No/slow water with warm FF—frozen reservoir or fill tube common on side-by-sides.

```json
"when": [
  { "type": "chip", "id": "water_dispenser" },
  { "type": "measurement", "knowledgeId": "freshFoodCabinetTemp", "statusIn": ["critical"] }
]
```

### REF-MS-011 — Ice maker + FF temp high

**Explanation:** No ice with warm fresh food—ice maker often secondary to FF cooling failure.

```json
"when": [
  { "type": "chip", "id": "ice_maker" },
  { "type": "measurement", "knowledgeId": "freshFoodCabinetTemp", "statusIn": ["warning", "critical"] }
]
```

### REF-MS-012 — Compressor not running + supply voltage critical

**Explanation:** Compressor off with bad supply—check voltage/relay before sealed system.

```json
"when": [
  { "type": "field", "path": "functional_checks.compressor_running", "equals": "no" },
  { "type": "measurement", "knowledgeId": "supplyVoltage120", "statusIn": ["critical"] }
]
```

### REF-MS-013 — Split temp + bad evap frost pattern

**Explanation:** FZ cold, FF warm, clogged evap pattern—defrost/airflow failure pattern.

```json
"when": [
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["normal"] },
  { "type": "measurement", "knowledgeId": "freshFoodCabinetTemp", "statusIn": ["warning", "critical"] },
  { "type": "field", "path": "visual_inspection.evaporator_frost_pattern", "equals": "bad" }
]
```

### REF-MS-014 — Not cooling + compressor not running

**Explanation:** Dead warm box with compressor off—start relay, overload, or control.

```json
"when": [
  { "type": "chip", "id": "not_cooling" },
  { "type": "field", "path": "functional_checks.compressor_running", "equals": "no" }
]
```

---

## Standalone freezer

**Existing multi-signal rules:** none (57 single-signal rules today).

| ID | Pattern | Priority | Status | Target (layer) | Effect | recommendStepKey | Duplication / notes |
|----|---------|----------|--------|----------------|--------|------------------|---------------------|
| SF-MS-001 | `not_cooling` + cabinet temp high | Must | **Implemented** | `sealed_system` (category) | increase +28 | `sealedSystem` | `sf_ms_001_not_cooling_cabinet_temp_high` |
| SF-MS-002 | Frost chip + frost pattern bad | Must | **Implemented** | `defrost_system` (category) | increase +30 | `defrost` | `sf_ms_002_frost_chip_frost_pattern_bad` |
| SF-MS-003 | Frost chip + defrost heater open | Must | **Implemented** | `defrost_heater` (component) | confirm | `defrost` | `sf_ms_003_frost_chip_heater_open` |
| SF-MS-004 | `not_cooling` + compressor not running | Must | **Implemented** | `compressor` (component) | confirm | `sealedSystem` | `sf_ms_004_not_cooling_compressor_no` |
| SF-MS-005 | `not_cooling` + compressor running + amps abnormal | Must | **Implemented** | `sealed_system` (component) | confirm | `sealedSystem` | `sf_ms_005_not_cooling_compressor_amps_abnormal` |
| SF-MS-006 | `not_cooling` + condenser fan no | Must | **Implemented** | `condenser_fan` (component) | confirm | `fans` | `sf_ms_006_not_cooling_condenser_fan_no` |
| SF-MS-007 | Frost chip + evap fan no | Must | **Implemented** | `evap_fan` (component) | confirm | `fans` | `sf_ms_007_frost_chip_evap_fan_no` |
| SF-MS-008 | Leaking + drain not clear | Must | **Implemented** | `drain` (component) | confirm | `visual` | `sf_ms_008_leaking_drain_not_clear` |
| SF-MS-009 | Leaking + defrost not operational | Must | **Implemented** | `defrost_system` (category) | increase +25 | `defrost` | `sf_ms_009_leaking_defrost_not_operational` |
| SF-MS-010 | Runs constantly + cabinet temp high | Nice | **Implemented** | `sealed_system` (category) | increase +18 | `sealedSystem` | `sf_ms_010_running_constant_cabinet_temp_high` |
| SF-MS-011 | Too cold + defrost not operational | Nice | **Implemented** | `defrost_system` (category) | increase +20 | `defrost` | `sf_ms_011_too_cold_defrost_not_operational` |
| SF-MS-012 | Frost pattern bad + defrost heater open | Must | **Implemented** | `defrost_heater` (component) | confirm | `defrost` | `sf_ms_012_frost_pattern_bad_heater_open` |

### SF-MS-001 — Not cooling + cabinet temp high

```json
"when": [
  { "type": "chip", "id": "not_cooling" },
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["warning", "critical"] }
]
```

### SF-MS-002 — Frost chip + frost pattern bad

```json
"when": [
  { "type": "chip", "id": "frost_buildup" },
  { "type": "field", "path": "visual_inspection.frost_pattern", "equals": "bad" }
]
```

### SF-MS-003 — Frost chip + defrost heater open

```json
"when": [
  { "type": "chip", "id": "frost_buildup" },
  { "type": "measurement", "knowledgeId": "defrostHeaterOhms", "statusIn": ["critical"] }
]
```

### SF-MS-004 — Not cooling + compressor not running

```json
"when": [
  { "type": "chip", "id": "not_cooling" },
  { "type": "field", "path": "functional_checks.compressor_running", "equals": "no" }
]
```

### SF-MS-005 — Not cooling + compressor running + amps abnormal

```json
"when": [
  { "type": "chip", "id": "not_cooling" },
  { "type": "field", "path": "functional_checks.compressor_running", "equals": "yes" },
  { "type": "measurement", "knowledgeId": "compressorRunAmps", "statusIn": ["warning", "critical"] }
]
```

### SF-MS-006 — Not cooling + condenser fan no

```json
"when": [
  { "type": "chip", "id": "not_cooling" },
  { "type": "field", "path": "functional_checks.condenser_fan_running", "equals": "no" }
]
```

### SF-MS-007 — Frost chip + evap fan no

```json
"when": [
  { "type": "chip", "id": "frost_buildup" },
  { "type": "field", "path": "functional_checks.evaporator_fan_running", "equals": "no" }
]
```

### SF-MS-008 — Leaking + drain not clear

```json
"when": [
  { "type": "chip", "id": "leaking" },
  { "type": "field", "path": "visual_inspection.drain_clear", "equals": "no" }
]
```

### SF-MS-009 — Leaking + defrost not operational

```json
"when": [
  { "type": "chip", "id": "leaking" },
  { "type": "field", "path": "functional_checks.defrost_operational", "equals": "no" }
]
```

### SF-MS-010 — Runs constantly + cabinet temp high

```json
"when": [
  { "type": "chip", "id": "running_constant" },
  { "type": "measurement", "knowledgeId": "freezerCabinetTemp", "statusIn": ["warning", "critical"] }
]
```

### SF-MS-011 — Too cold + defrost not operational

```json
"when": [
  { "type": "chip", "id": "too_cold" },
  { "type": "field", "path": "functional_checks.defrost_operational", "equals": "no" }
]
```

### SF-MS-012 — Frost pattern bad + defrost heater open

```json
"when": [
  { "type": "field", "path": "visual_inspection.frost_pattern", "equals": "bad" },
  { "type": "measurement", "knowledgeId": "defrostHeaterOhms", "statusIn": ["critical"] }
]
```

---

## Combinability guardrails (Batch 1)

| Constraint | Implication |
|------------|-------------|
| Complaint chips are multi-select | Patterns with chips AND fields require tech to have selected chip **and** completed later steps |
| Field visibility | e.g. SF `defrost_heater_ohms` only shows with `frost_buildup` chip — SF-MS-003 won't fire until that step |
| Measurement status | Requires numeric field filled and parsed — empty field = no match |
| Mutually exclusive elimination pairs | Evidence `confirm` on one side does not block category scoring on the other |

---

## Next step after review

1. Mark each row **Approved** / **Rejected** / **Revise** in this file or in chat.
2. Implement approved rows only in `knowledge/evidence/refrigerator.json` and `knowledge/evidence/standalone_freezer.json`.
3. Run scripted wizard scenarios (2–3 per appliance) to verify ledger, scores, and no double-count surprises.
