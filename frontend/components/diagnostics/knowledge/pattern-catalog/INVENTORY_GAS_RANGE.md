# Signal inventory — gas_range

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `no_oven_heat` | Oven Not Heating | `gas_range/gasRangeComplaints.ts` | chip | Yes (multi-select) | |
| `no_ignition` | Won\ | `gas_range/gasRangeComplaints.ts` | chip | Yes (multi-select) | |
| `gas_smell` | Gas Smell / Leak Concern | `gas_range/gasRangeComplaints.ts` | chip | Yes (multi-select) | |
| `surface_burners` | Surface Burner Issue | `gas_range/gasRangeComplaints.ts` | chip | Yes (multi-select) | |
| `weak_flame` | Weak / Yellow Flame | `gas_range/gasRangeComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code on Display | `gas_range/gasRangeComplaints.ts` | chip | Yes (multi-select) | |
| `self_clean` | Self-Clean / Door Lock | `gas_range/gasRangeComplaints.ts` | chip | Yes (multi-select) | |

### Combinability

Complaint chips are **multi-select** — any combination can be selected in the UI.

**Common co-occurring clusters** (not enforced):
- Cooling: `not_cooling` often pairs with section-specific weak cooling chips
- Frost path: `frost_buildup` + cooling complaints

**Semantic opposites** (UI allows both; interpret carefully):
- Section weak cooling chips are **not** mutually exclusive

**Elimination hypothesis `oppositeId` pairs** are true mutual exclusivity.

## 2. Wizard field signals

| Field path | Label | Type | Values | Step / section | Visibility | Smart measurement |
|------------|-------|------|--------|----------------|------------|-------------------|
| `commonly_missed.gas_supply` | Gas supply valve on / line verified | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.anti_tip` | Anti-tip bracket installed | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.lp_orifices` | LP orifice / conversion correct | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.ventilation` | Adequate ventilation / hood | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.gas_odor` | Gas odor / leak check performed | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `visual_inspection.burner_condition` | Oven burner / tube condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.igniter_condition` | Oven igniter condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.gas_valve_condition` | Gas valve / manifold condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.door_seal` | Door Seal Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.surface_burners_visual` | Surface burner caps / ports | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `functional_checks.oven_bake_ignition` | Oven Bake Ignition | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.oven_broil_ignition` | Oven Broil Ignition | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.surface_burner_ignition` | Surface Burner Ignition | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.convection_operation` | Convection Fan (if equipped) | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.door_lock_operation` | Door Lock / Self-Clean Lock | gb | good, bad | `functional_checks` | always when step enabled | — |
| `electrical_at_board.supply_voltage` | Supply voltage at outlet (V) | text | free text / numeric | `electrical_at_board` | always when step enabled | `supplyVoltage120` |
| `electrical_at_board.board_supply_voltage` | Board supply voltage (V) | text | free text / numeric | `electrical_at_board` | always when step enabled | `supplyVoltage120` |
| `electrical_at_board.igniter_amps` | Oven igniter amps (glow) | text | free text / numeric | `electrical_at_board` | always when step enabled | `hotSurfaceIgniterAmps` |
| `electrical_at_board.igniter_resistance` | Oven igniter resistance cold (Ω) | text | free text / numeric | `electrical_at_board` | always when step enabled | `hotSurfaceIgniterOhms` |
| `electrical_at_board.gas_valve_coil_ohms` | Gas valve coil resistance (Ω) | text | free text / numeric | `electrical_at_board` | always when step enabled | `gasValveCoilOhms` |
| `electrical_at_board.flame_sensor_continuity` | Flame sensor / safety continuity | text | free text / numeric | `electrical_at_board` | always when step enabled | `gasFlameSensorContinuityOhms` |
| `gas_flame_readings.oven_flame_quality` | Oven Flame Quality | gb | good, bad | `gas_flame_readings` | always when step enabled | — |
| `gas_flame_readings.surface_flame_quality` | Surface Flame Quality | gb | good, bad | `gas_flame_readings` | always when step enabled | — |
| `gas_flame_readings.manifold_pressure` | Manifold / gas pressure (if measured) | text | free text / numeric | `gas_flame_readings` | always when step enabled | — |
| `gas_flame_readings.gas_notes` | Gas line / regulator notes | text | free text / numeric | `gas_flame_readings` | always when step enabled | — |
| `board_readings.valve_voltage_on` | Gas valve voltage when commanded (V) | text | free text / numeric | `board_readings` | always when step enabled | `supplyVoltage120` |
| `board_readings.igniter_circuit_voltage` | Igniter circuit voltage (V) | text | free text / numeric | `board_readings` | always when step enabled | `supplyVoltage120` |
| `board_readings.board_notes` | Board relay / safety circuit notes | textarea | free text | `board_readings` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `gasFlameSensorContinuityOhms` | Gas Flame Sensor Continuity | Ω | normal 0-5 | warning 0-20 | critical <0 or >50 | electrical_at_board.flame_sensor_continuity | normal, warning, critical |
| `gasValveCoilOhms` | Gas Valve Safety Coil Resistance | Ω | normal 900-1600 | warning 700-2000 | critical <100 or >3000 | electrical_at_board.gas_valve_coil_ohms | normal, warning, critical |
| `hotSurfaceIgniterAmps` | Hot Surface Igniter Amperage (Glow) | A | normal 2.5-4.5 | warning 1.5-5.5 | critical <0.5 or >7 | electrical_at_board.igniter_amps | normal, warning, critical |
| `hotSurfaceIgniterOhms` | Hot Surface Igniter Resistance | Ω | normal 40-400 | warning 20-600 | critical <5 or >1000 | electrical_at_board.igniter_resistance | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | electrical_at_board.supply_voltage, electrical_at_board.board_supply_voltage, board_readings.valve_voltage_on, board_readings.igniter_circuit_voltage | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `igniter_ok` | Oven igniter OK | `ignition` | `igniter_failed` |
| `igniter_failed` | Oven igniter failed | `ignition` | `igniter_ok` |
| `gas_valve_ok` | Gas valve coil OK | `gas_valve` | `gas_valve_failed` |
| `gas_valve_failed` | Gas valve coil failed | `gas_valve` | `gas_valve_ok` |
| `flame_sensor_ok` | Flame sensor OK | `flame_sensing` | `flame_sensor_failed` |
| `flame_sensor_failed` | Flame sensor fault | `flame_sensing` | `flame_sensor_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |
| `surface_ignition_ok` | Surface ignition OK | `surface_burners` | `surface_ignition_failed` |
| `surface_ignition_failed` | Surface burner ignition fault | `surface_burners` | `surface_ignition_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `igniter_ol` | measurement:hotSurfaceIgniterOhms in critical | `igniter_ok` | `igniter_failed` | — |
| `igniter_normal` | measurement:hotSurfaceIgniterOhms in normal | `igniter_failed` | — | — |
| `igniter_low_amps` | measurement:hotSurfaceIgniterAmps in critical|warning | `igniter_ok` | `igniter_failed` | — |
| `gas_valve_ol` | measurement:gasValveCoilOhms in critical | `gas_valve_ok` | `gas_valve_failed` | — |
| `flame_sensor_open` | measurement:gasFlameSensorContinuityOhms in critical | `flame_sensor_ok` | `flame_sensor_failed` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `bake_ignition_bad` | field:functional_checks.oven_bake_ignition=bad | `igniter_ok`, `gas_valve_ok` | `igniter_failed` | — |
| `broil_ignition_bad` | field:functional_checks.oven_broil_ignition=bad | `igniter_ok`, `gas_valve_ok` | `igniter_failed` | — |
| `surface_burners_bad` | field:functional_checks.surface_burner_ignition=bad | `surface_ignition_ok` | `surface_ignition_failed` | — |
| `no_ignition_chip` | chip:no_ignition | — | — | `igniter_failed`, `gas_valve_failed`, `flame_sensor_failed` |
| `no_oven_heat_chip` | chip:no_oven_heat | — | — | `igniter_failed`, `gas_valve_failed` |
| `surface_burners_chip` | chip:surface_burners | — | — | `surface_ignition_failed` |

## 5. Existing evidence rules

Total: **34** (34 single-signal, 0 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_igniter_ol_igniter_failed` | measurement:hotSurfaceIgniterOhms in critical | `igniter` | component | confirm | no |
| `cat_up_igniter_ol_igniter_failed` | measurement:hotSurfaceIgniterOhms in critical | `ignition` | category | +38 | no |
| `eliminate_igniter_ol_igniter_ok` | measurement:hotSurfaceIgniterOhms in critical | `igniter` | component | eliminate | no |
| `eliminate_igniter_normal_igniter_failed` | measurement:hotSurfaceIgniterOhms in normal | `igniter` | component | eliminate | no |
| `cat_unlikely_igniter_normal_igniter_failed` | measurement:hotSurfaceIgniterOhms in normal | `ignition` | category | unlikely | no |
| `confirm_igniter_low_amps_igniter_failed` | measurement:hotSurfaceIgniterAmps in critical|warning | `igniter` | component | confirm | no |
| `cat_up_igniter_low_amps_igniter_failed` | measurement:hotSurfaceIgniterAmps in critical|warning | `ignition` | category | +38 | no |
| `eliminate_igniter_low_amps_igniter_ok` | measurement:hotSurfaceIgniterAmps in critical|warning | `igniter` | component | eliminate | no |
| `confirm_gas_valve_ol_gas_valve_failed` | measurement:gasValveCoilOhms in critical | `gas_valve` | component | confirm | no |
| `cat_up_gas_valve_ol_gas_valve_failed` | measurement:gasValveCoilOhms in critical | `gas_valve` | category | +38 | no |
| `eliminate_gas_valve_ol_gas_valve_ok` | measurement:gasValveCoilOhms in critical | `gas_valve` | component | eliminate | no |
| `confirm_flame_sensor_open_flame_sensor_failed` | measurement:gasFlameSensorContinuityOhms in critical | `flame_sensor` | component | confirm | no |
| `cat_up_flame_sensor_open_flame_sensor_failed` | measurement:gasFlameSensorContinuityOhms in critical | `flame_sensing` | category | +38 | no |
| `eliminate_flame_sensor_open_flame_sensor_ok` | measurement:gasFlameSensorContinuityOhms in critical | `flame_sensor` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage120 in critical | `supply` | component | eliminate | no |
| `confirm_bake_ignition_bad_igniter_failed` | field:functional_checks.oven_bake_ignition=bad | `igniter` | component | confirm | no |
| `cat_up_bake_ignition_bad_igniter_failed` | field:functional_checks.oven_bake_ignition=bad | `ignition` | category | +35 | no |
| `eliminate_bake_ignition_bad_igniter_ok` | field:functional_checks.oven_bake_ignition=bad | `igniter` | component | eliminate | no |
| `eliminate_bake_ignition_bad_gas_valve_ok` | field:functional_checks.oven_bake_ignition=bad | `gas_valve` | component | eliminate | no |
| `confirm_broil_ignition_bad_igniter_failed` | field:functional_checks.oven_broil_ignition=bad | `igniter` | component | confirm | no |
| `cat_up_broil_ignition_bad_igniter_failed` | field:functional_checks.oven_broil_ignition=bad | `ignition` | category | +35 | no |
| `eliminate_broil_ignition_bad_igniter_ok` | field:functional_checks.oven_broil_ignition=bad | `igniter` | component | eliminate | no |
| `eliminate_broil_ignition_bad_gas_valve_ok` | field:functional_checks.oven_broil_ignition=bad | `gas_valve` | component | eliminate | no |
| `confirm_surface_burners_bad_surface_ignition_failed` | field:functional_checks.surface_burner_ignition=bad | `surface_ignition` | component | confirm | no |
| `cat_up_surface_burners_bad_surface_ignition_failed` | field:functional_checks.surface_burner_ignition=bad | `surface_burners` | category | +35 | no |
| `eliminate_surface_burners_bad_surface_ignition_ok` | field:functional_checks.surface_burner_ignition=bad | `surface_ignition` | component | eliminate | no |
| `chip_no_ignition_ignition` | chip:no_ignition | `ignition` | category | +22 | no |
| `chip_no_ignition_gas_valve` | chip:no_ignition | `gas_valve` | category | +22 | no |
| `chip_no_ignition_flame_sensing` | chip:no_ignition | `flame_sensing` | category | +22 | no |
| `chip_no_oven_heat_ignition` | chip:no_oven_heat | `ignition` | category | +22 | no |
| `chip_no_oven_heat_gas_valve` | chip:no_oven_heat | `gas_valve` | category | +22 | no |
| `chip_surface_burners_surface_burners` | chip:surface_burners | `surface_burners` | category | +22 | no |
