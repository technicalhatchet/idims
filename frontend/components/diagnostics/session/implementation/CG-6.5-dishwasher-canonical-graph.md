# CG-6.5 — Canonical Graph #3: Dishwasher

**Status:** ACTIVE — scaffold saved, **not frozen**  
**Predecessor:** CG-6.4.1 Samsung dryer compounding CLOSED  
**Graph #1:** `front_load_washer.json` + `top_load_washer.json`  
**Graph #2:** `vented_dryer.json` (frozen rev 2)

## Why dishwasher next

Dryer compounding proved manufacturer + chassis transfer without canonical inflation. Dishwasher is the next cross-appliance proof — and the repo already has substantial procedure seed coverage waiting for a canonical layer.

**Design intent:** Save `dishwasher.json` as a freeze *candidate*, then let the first manual challenge it — same discipline as W8178559 for dryer.

## Scaffold (saved, unfrozen)

**File:** `frontend/components/diagnostics/knowledge/canonical/dishwasher.json`  
**Registry:** `canonicalRegistry.ts` routes `templateId: dishwasher` → `dishwasher`  
**Reference overlay:** `platform_overlays/dishwasher.reference.json` (empty until W11633848 gate)  
**Test:** `session/__tests__/scenarios/cg6-dishwasher-ontology.test.ts`

### Deliberately exposed for first manual

| Area | Canonical choice | Expected overlay pressure |
|------|------------------|---------------------------|
| Circulation | `circulation_pump` | Integrated wash motor, VSM/SSM, diverter — not canonical |
| Drying | `drying_system` (abstract) | Fan/vent, condensation, heat-dry, mineral drying |
| Water level | `water_level_sensor` | Pressure switch vs OWI vs float — functional concept only |

### Explicitly NOT in canonical v1

`diverter_valve`, `check_valve`, `turbidity_sensor`, `flow_meter`, `circulation_motor`, `pump_housing`, `wash_motor_capacitor`, `sump_gasket` — compounding discovery candidates.

### Diagnostic backbone targets

**no_heat:** door authorized → fill complete → circulation → heat command → heater current → thermal protection → temperature response

**wont_drain:** drain command → drain pump → water movement → drain path → drain completion

## Manual inventory (repo)

| Manual | Platform | Procedures | PDF in repo | Extraction | Notes |
|--------|----------|------------|-------------|------------|-------|
| **W11633848** | `whirlpool_dishwasher_acu` | 13 base + deltas | ✅ | ✅ | **First normalization target** — ACU 24", F#E# matrix |
| W11480208 | shared ACU | 8 delta | ✅ | ✅ | VSM motors, diverter, DC fan |
| W11366142 | shared ACU | 6 delta | ✅ | ✅ | KitchenAid KDTM404 — RIF filter, vent wax |
| W11499711 | shared ACU | 1 delta | — | ✅ | SSM wash motor |
| W11794121 | shared ACU | 1 delta | — | ✅ | JennAir D.O.S. |
| W11187658 | `whirlpool_dishwasher_ada` | 6 | — | partial | ADA built-in |
| SAMSUNG-DISHWASHER | `samsung_dishwasher` | ~10 | ✅ | ✅ | DW80 family |
| SAMSUNG-DISHWASHER-M9 | `samsung_dishwasher_m9` | — | — | candidates exist | Waterwall / Auto Door |
| LG-LDT7808 | `lg_dishwasher_ldt7808` | 10 | — | ✅ | QuadWash |
| INSIGNIA-DWR3 | `insignia_dishwasher` | 9 | — | ✅ | NS-DWR3 |

## W11633848 fresh CG-3 baseline (2026-09-14)

| Metric | Value |
|--------|-------|
| Procedures | **13** (W11633848-only; shared seed dir filtered by `source.manualId`) |
| Mapping candidates | **21** |
| Overlay bindings | **23** (13 procedure + 10 measurement) |
| Conflicts | **0** |
| Canonical ontology candidates | **0** |
| Ontology | `dishwasher` (unfrozen) |

Machine-readable: `calibration/W11633848_normalization_baseline_v1.json`

### Abstract boundary review (first manual)

| Boundary | Result |
|----------|--------|
| `circulation_pump` | Wash motor + diverter motor → canonical; diverter position sensor → **platform** |
| `drying_system` | DC fan → canonical `drying_system`; heat-dry title unresolved at gate |
| `water_level_sensor` | Float switch → canonical; OWI/thermistor dual-role → **platform gate** |

Deferred (not canonical): `diverter_position_sensor`, `f500_triac_fuse`→`thermal_protection`, `door_gasket`, VSM/RIF (delta manuals).

**Do not freeze `dishwasher.json` yet** — overlay + architecture review first.

## W11633848 human gate (2026-09-14)

Artifact: `calibration/W11633848_overlay_mapping_table_v1.json`  
Apply: `python backend/scripts/apply_w11633848_dishwasher_human_gate.py`

| Bucket | Count | Gate outcome |
|--------|-------|--------------|
| 1 — Straight canonical | 8 | 4 auto-reuse + 4 Whirlpool aliases |
| 2 — Compound | 5 | 5 approved → canonical (platform notes for SSM/DC fan) |
| 3 — Unresolved | 8 | 2 approved, 3 rejected titles/tokens, 3 deferred platform/model |
| **Ledger** | **21** | **15 approved / 3 rejected / 3 deferred** |

**First-manual teaching cost: 11 new human semantic decisions, 0 new canonical concepts.**

Key gate decisions:
- **OWI / Thermistor** — deferred platform dual-role (`owi_sensor`); not forced → `water_level_sensor`
- **Diverter position sensor** — deferred platform; not `diverter_valve` canonical
- **F500 triac fuse** → `thermal_protection`
- **§3-10 Water Heating / Heat Dry** — title rejected; heat_source vs drying_system preserved

## Whirlpool manufacturer overlay (2026-09-14)

Artifact: `canonical/manufacturer_overlays/whirlpool_dishwasher.json`  
Wired in `resolveDiagnosticGraph.ts` → `dishwasher` ontology.

| Layer | Content |
|-------|---------|
| Manufacturer aliases | 15 gated mappings (11 distinct canonical targets) |
| Platform `add.components` | `diverter_motor`, `ssm_wash_motor`, `diverter_position_sensor`, `owi_sensor`, `dc_fan_motor`, `f500_triac_fuse` |
| Deferred | `owi_sensor`, `diverter_position_sensor` (platform); `door_gasket` (model) |
| Procedure bindings | 13 W11633848 procedures |
| Measurement bindings | 7 Ω knowledge ids |

Architecture boundary: `cg6-dishwasher-architecture-boundary.test.ts` (7 assertions) + existing `cg6-dishwasher-ontology.test.ts` (6).

**`dishwasher.json` frozen rev1** (2026-09-15) — W11480208 compounding next.

## W11633848 promotion dry-run (2026-09-15)

Command: `python backend/scripts/run_w11633848_promotion_dry_run.py`

| Gate | Result |
|------|--------|
| `equivalent` | **true** |
| Ledger scope | 15 mappings / 13 procedures / 7 measurements approved; 3 rejected; 3 deferred |
| Architecture preservation | 10/10 (OWI dual-role, §3-10 split, F500→thermal_protection, no washer/dryer bleed) |
| `validate_canonical_graph.py` | OK |
| `validate_normalization_candidates.py` | OK |
| `cg6-dishwasher-ontology.test.ts` | 6/6 |
| `cg6-dishwasher-architecture-boundary.test.ts` | 7/7 |
| `dishwasher.json` frozen | **true** (`rev1`) |

Artifacts: `promotion_dry_run_W11633848.json`, `promotion_equivalence_W11633848.json`, `compiler_loop_W11633848.json`, `promo-W11633848-*` (dry-run overlay_before/after).

**Key preservation proofs:**
- `w11633848-dc-fan` → `drying_airflow_test` (not `heater_command_test`)
- `w11633848-heater` → `heater_command_test` (§3-10 title not collapsed)
- OWI measurement gated to `water_level_test`; platform `owi_sensor` dual-role intact
- Wrong `overfill-switch` fill-valve Ω candidate **not** promoted

## Compounding order (proposed)

1. ~~Author `dishwasher.json` scaffold~~ **DONE** (unfrozen)
2. ~~Run `validate_canonical_graph.py` + `cg6-dishwasher-ontology.test.ts`~~ **DONE**
3. ~~**W11633848** fresh CG-3 normalize + human gate~~ **DONE**
4. ~~Whirlpool manufacturer overlay + architecture boundary~~ **DONE**
5. Compiler/promotion dry-run (equivalence checker)
4. Second Whirlpool ACU delta or **Samsung DW80** for cross-manufacturer compounding curve
5. Freeze `dishwasher.json` only after first manual proves or disproves abstraction boundaries

## Hard rules (carry forward)

- First manual challenges the graph — do not pre-create OEM concepts in canonical layer
- `water_level_sensor` ≠ `pressure_sensor` at canonical level
- Hydraulic graph is functional, not literal hose topology
- Gate-preview = authoritative compounding metrics
- CG-6.4.1 Samsung dryer curve is frozen — do not extend for prettiness
