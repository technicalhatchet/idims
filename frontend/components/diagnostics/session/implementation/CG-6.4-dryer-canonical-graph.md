# CG-6.4 — Canonical Graph #2: Dryer

**Status:** FROZEN (rev 2) — `vented_dryer.json` signed off 2026-09-13; W8178559 normalization active  
**Predecessor:** CG-6.3 CLOSED (semantic inheritance operationalized; R5 abstention policy frozen)  
**Graph #1:** `front_load_washer.json` + `top_load_washer.json` (washer family)

## Why dryer next

Washer graph #1 exercised the full chain: manual → knowledge → canonical → overlay → procedure → evidence → re-rank.  
Dryer is the first **cross-appliance-type** proof that the architecture generalizes — not another architecture invention sprint.

Dryer diagnostic domain is substantially different from washer:

| Domain | Dryer relevance |
|--------|-----------------|
| Electrical heating | Element, supply, thermal limits |
| Thermal safety | Thermal fuse, high-limit, cutoff |
| Airflow / exhaust | Vent restriction, blower, thermistor |
| Motor / drive | Drum motor, belt, idler |
| Door authorization | Door switch, interlock |
| Sensing | Moisture sensor, exhaust/inlet NTC |
| Gas ignition | Valve, ignitor, flame sensor (gas template) |
| Control / output | CCU/MCE, HMI, dryness algorithms |

**Question shifts from** “Can we build this?” **to** “What does a good dryer ontology need to contain?”

## Usability tiers (product framing)

| Tier | Target | Gate |
|------|--------|------|
| 🟡 Development | Pipeline + session + re-rank inspectable | **Here now** |
| 🟢 Personal repair pilot | Washer + Dryer + Dishwasher with real overlays | ~3 strong canonical families |
| 🔵 Other technicians / customers | Coverage, UX, outcome capture, regression | Later — field feedback loop |

Field feedback (“what did I actually find?”) beats another 100 synthetic matcher tests once 🟢 is reachable.

## Deliverable

**Shipped:** `frontend/components/diagnostics/knowledge/canonical/vented_dryer.json`  
**Registry:** `canonicalRegistry.ts` + `ontology_resolver.py` route `electric_dryer` / `gas_dryer` → `vented_dryer`  
**Reference overlay stub:** `platform_overlays/vented_dryer.reference.json` (platforms empty until W8178559 gate preview)  
**Test:** `session/__tests__/scenarios/cg6-vented-dryer-ontology.test.ts`

**Schema:** `canonical/schemas/canonical_ontology_contract.json` (same as washer)

### Seed systems (draft — refine during graph authoring)

1. `power` — supply, line voltage, neutral/ground
2. `control` — main control board / ACU / CCU
3. `user_interface` — UI, buttons, indicators
4. `door_interlock` — door switch, cycle authorization
5. `drive` — motor, belt, idler, centrifugal switch
6. `heating_electric` — element, relays, thermal path
7. `heating_gas` — valve, ignitor, flame sensor, gas supply (gas template overlay)
8. `airflow` — blower, exhaust path, lint restriction
9. `temperature_sensing` — exhaust thermistor, inlet thermistor, high-limit
10. `moisture_sensing` — moisture strips, dryness algorithm inputs
11. `steam` — optional water valve (platform overlay, not universal canonical)

### Seed components (from existing procedure seeds — not invented)

Cross-reference Whirlpool Duet Sport dryer (`W8178559`), CCU dryer (`W10680150`/`W10881701`), ACU TL dryer, Insignia TDRE, Samsung FL/TL dryers already in repo:

| Component id | Notes |
|--------------|-------|
| `control_board` | Reuse washer canonical id |
| `drive_motor` | Reuse |
| `door_switch` | Reuse |
| `heat_source` | Fuel-agnostic canonical heat (overlay: electric_heater, gas_burner, gas_valve, ignitor) |
| `lint_filter` | In-appliance lint path — distinct from `exhaust_path` |
| `thermal_fuse` | Dryer-primary |
| `thermal_cutoff` | Dryer-primary |
| `high_limit_thermostat` | Dryer-primary |
| `exhaust_thermistor` | Dryer-primary |
| `inlet_thermistor` | Gas / some electric |
| `moisture_sensor` | Dryer-primary |
| `gas_valve` | Gas template only |
| `hot_surface_igniter` | Gas template only |
| `flame_sensor` | Gas template only |
| `idler_pulley` / `drive_belt` | Mechanical — model/platform scope |

**Reuse rule:** If functional role matches washer canonical concept, **reuse id** — do not fork `control_board` into `dryer_control_board`.

**New canonical ids:** Only when dryer introduces a functional role absent from washer ontology (e.g. `moisture_sensor`, `heat_source`, `lint_filter` as first-class dryer nodes).

## Compounding order (ontology scaffold ✅ — continue here)

1. ~~Author `vented_dryer.json`~~ **FROZEN** (rev 2, 2026-09-13 sign-off)
2. ~~Run W8178559 normalization~~ **DONE** (2026-09-14) — `ontologyId: vented_dryer`, 13 procedures, 24 mappings, 4 overlays, 0 conflicts
   - **10 canonical auto-resolve:** door_switch, moisture_sensor, temperature_sensor (exhaust_thermistor), heat_source (heating_element), thermal_fuse, thermal_cutoff, drive_motor
   - **14 unresolved → overlay gate:** gas_valve, igniter, supply, user_interface/HMI, procedural TEST titles — **not** canonical promotion candidates
   - Matcher fix: dryer ontology aliases loaded; cross-template washer hints blocked (`heating_element` → `heat_source`, not `wash_heater`)
3. ~~**Human gate**~~ **DONE** — `normalization/calibration/W8178559_overlay_mapping_table_v1.json` (`status: published`; 15 approved / 10 rejected TEST titles)
4. ~~Publish manufacturer overlay~~ **DONE** (2026-09-14) — `manufacturer_overlays/whirlpool_vented_dryer.json` wired in `resolveDiagnosticGraph.ts`; promotion `equivalent=true`
   - Post-publish: `validate_canonical_graph.py`, `validate_normalization_candidates.py --manual W8178559`, `tsc --noEmit`, `cg6-vented-dryer-ontology.test.ts`, `vented-dryer-torture.test.ts` ✅
   - Torture harness: no-heat chain surfaces door → airflow → heat command → heater/thermal re-rank (`session/__tests__/scenarios/vented-dryer-torture.test.ts`)
5. **CCU dryer compounding (`W10680150`)** — **PUBLISHED** (2026-09-14)
   - Gate: **15 approved / 11 rejected** (native cohort only)
   - Headline: **W8178559: 25/25 new → W10680150 native: 13/30 new** — zero new canonical concepts
   - Platform family `whirlpool_ccu_dryer` on `whirlpool_vented_dryer.json`; promotion `equivalent=true`
   - Frozen curve: `calibration/compounding_dryer_curve_v1.json`
6. Supplemental cohort (`w10881701-*`, `w11169659-*`) — deferred; not in authoritative compounding metric
7. **Samsung dryer manufacturer compounding** — **CLOSED** (2026-09-14) — see [CG-6.4.1](./CG-6.4.1-samsung-dryer-manufacturer-compounding.md)
   - 3 platforms / 30 procedures / 69 mapping candidates on `samsung_vented_dryer.json`
   - **13 → 0 → 0** new human semantic decisions (BB8700 → DV6000 → TL DV50)
   - 0 canonical expansion; TL chassis did not justify `top_load_washer` ontology
   - Routing invariant: explicit `platformId` authoritative over model patterns
8. Semantic inheritance: **only** if new human-proven gaps appear — R5 policy applies

## Graph expansion roadmap

```text
Graph 1  Washer (FL + TL)     ✅ exercised
Graph 2  Dryer                ← ACTIVE (this doc)
Graph 3  Dishwasher
Graph 4  Refrigerator
Graph 5  Range
```

Compounding pipeline continues feeding each graph. CG-6.2 efficiency instrument remains the control; do not rewrite frozen baselines.

## Hard rules (carry forward)

- Gate-preview = authoritative compounding metrics
- `canonical.components` ≠ `overlay.add.components`
- CG-5 + CG-6.3 frozen artifacts immutable
- R5: when in doubt, abstain — human gate
- No semantic rule fishing for 67→66 without new evidence class

## Related artifacts

| Artifact | Role |
|----------|------|
| `semantic_inheritance_abstention_policy_v1.json` | R5 frozen policy |
| `knowledge_hierarchy_contract_v1.json` | Layer stack + promotion bars |
| `front_load_washer.json` | Graph #1 reference shape |
| `W8178559` / `whirlpool_duet_sport_dryer` | First dryer compounding target |
