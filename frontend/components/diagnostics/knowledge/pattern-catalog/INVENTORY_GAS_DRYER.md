# Signal inventory — gas_dryer

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `no_heat` | No Heat / Won\ | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |
| `not_drying` | Takes Too Long / Damp Clothes | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |
| `no_spin` | Won't Tumble / Drum Not Turning | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |
| `wont_stop_spinning` | Won't Stop Spinning | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |
| `gas_smell` | Gas Smell / Leak Concern | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |
| `weak_flame` | Weak Flame / Goes Out | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Thumping | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code on Display | `gas_dryer/gasDryerComplaints.ts` | chip | Yes (multi-select) | |

### Combinability

Complaint chips are **multi-select** — any combination can be selected in the UI.

**Common co-occurring clusters** (not enforced):
- Cooling: `not_cooling` often pairs with section-specific weak cooling chips
- Frost path: `frost_buildup` + cooling complaints

**Semantic opposites** (UI allows both; interpret carefully):
- Section weak cooling chips are **not** mutually exclusive

**Elimination hypothesis `oppositeId` pairs** are true mutual exclusivity.

### Routing (chip → enabled wizard steps)

| Route ID | When (chip keywords) | Enables stepKeys |
|----------|----------------------|------------------|
| `no_heat` | no_heat | visual, functional, ignition, motor |
| `not_drying` | not_drying | visual, functional, ignition |
| `no_spin` | no_spin | visual, functional, motor |
| `gas_smell` | gas_smell | commonly_missed, visual |
| `weak_flame` | weak_flame | visual, functional, ignition |
| `noisy` | noisy | visual, motor |
| `error_code` | error_code | motor, functional, ignition |

## 2. Wizard field signals

| Field path | Label | Type | Values | Step / section | Visibility | Smart measurement |
|------------|-------|------|--------|----------------|------------|-------------------|
| `commonly_missed.vent_restriction` | Vent restriction / length | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.gas_supply` | Gas supply valve on | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.lint_trap` | Lint screen / housing clean | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.lp_orifices` | LP conversion / orifices correct | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `visual_inspection.vent_condition` | Vent / Duct Condition | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.lint_accumulation` | Lint Accumulation | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.igniter_condition` | Igniter condition | tri | good, fair, bad | `visual_inspection` | showWhen: chip:no_heat OR chip:weak_flame | — |
| `visual_inspection.gas_valve` | Gas valve / burner assembly | tri | good, fair, bad | `visual_inspection` | showWhen: chip:gas_smell OR chip:no_heat | — |
| `functional_checks.drum_turning` | Drum Turning | yn | yes, no | `functional_checks` | showWhen: chip:no_spin OR chip:wont_stop_spinning | — |
| `functional_checks.ignition` | Burner Ignition | yn | yes, no | `functional_checks` | showWhen: chip:no_heat OR chip:weak_flame | — |
| `functional_checks.airflow` | Airflow at vent | gb | good, bad | `functional_checks` | showWhen: chip:not_drying | — |
| `functional_checks.blower_operation` | Blower Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.flame_quality` | Flame quality / stays lit | gb | good, bad | `functional_checks` | showWhen: chip:no_heat OR chip:weak_flame | — |
| `gas_ignition.igniter_amps` | Igniter amps (glow) | text | free text / numeric | `gas_ignition` | always when step enabled | — |
| `gas_ignition.igniter_ohms` | Igniter resistance cold (Ω) | text | free text / numeric | `gas_ignition` | always when step enabled | `hotSurfaceIgniterOhms` |
| `gas_ignition.gas_valve_coils` | Gas valve coil(s) (Ω) | text | free text / numeric | `gas_ignition` | always when step enabled | `gasValveCoilOhms` |
| `gas_ignition.flame_sensor` | Flame sensor / radiant sensor | text | free text / numeric | `gas_ignition` | always when step enabled | — |
| `gas_ignition.gas_pressure_note` | Gas pressure / manifold (if measured) | text | free text / numeric | `gas_ignition` | always when step enabled | — |
| `motor_electrical.supply_voltage` | Supply voltage (V) | text | free text / numeric | `motor_electrical` | always when step enabled | `supplyVoltage120` |
| `motor_electrical.motor_ohms` | Drive motor resistance (Ω) | text | free text / numeric | `motor_electrical` | always when step enabled | `dryerDrumMotorWindingOhms` |
| `motor_electrical.thermal_fuse` | Thermal fuse / hi-limit | text | free text / numeric | `motor_electrical` | always when step enabled | `dryerThermalFuseOhms` |
| `motor_electrical.exhaust_temp` | Exhaust temp at vent (°F) | text | free text / numeric | `motor_electrical` | always when step enabled | — |
| `motor_electrical.board_notes` | Control / radiant sensor notes | textarea | free text | `motor_electrical` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `dryerDrumMotorWindingOhms` | Dryer Drum Motor Winding Resistance | Ω | normal 1-10 | warning 0.5-20 | critical <0.1 or >40 | motor_electrical.motor_ohms | normal, warning, critical |
| `dryerThermalFuseOhms` | Dryer Thermal Fuse Continuity | Ω | normal 0-2 | critical <0 or >5 | — | motor_electrical.thermal_fuse | normal, warning, critical |
| `gasValveCoilOhms` | Gas Valve Safety Coil Resistance | Ω | normal 900-1600 | warning 700-2000 | critical <100 or >3000 | gas_ignition.gas_valve_coils | normal, warning, critical |
| `hotSurfaceIgniterAmps` | Hot Surface Igniter Amperage (Glow) | A | normal 2.5-4.5 | warning 1.5-5.5 | critical <0.5 or >7 | — | normal, warning, critical |
| `hotSurfaceIgniterOhms` | Hot Surface Igniter Resistance | Ω | normal 40-400 | warning 20-600 | critical <5 or >1000 | gas_ignition.igniter_ohms | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | motor_electrical.supply_voltage | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `igniter_ok` | Igniter OK | `ignition` | `igniter_failed` |
| `igniter_failed` | Igniter failed | `ignition` | `igniter_ok` |
| `gas_valve_ok` | Gas valve coil OK | `gas_valve` | `gas_valve_failed` |
| `gas_valve_failed` | Gas valve coil failed | `gas_valve` | `gas_valve_ok` |
| `thermal_fuse_ok` | Thermal fuse OK | `heat_safety` | `thermal_fuse_failed` |
| `thermal_fuse_failed` | Thermal fuse open | `heat_safety` | `thermal_fuse_ok` |
| `vent_ok` | Vent / airflow OK | `airflow` | `vent_restricted` |
| `vent_restricted` | Vent restriction / poor airflow | `airflow` | `vent_ok` |
| `motor_ok` | Drum motor OK | `motor` | `motor_failed` |
| `motor_failed` | Drum motor failed | `motor` | `motor_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `igniter_ol` | measurement:hotSurfaceIgniterOhms in critical | `igniter_ok` | `igniter_failed` | — |
| `igniter_low_amps` | measurement:hotSurfaceIgniterAmps in critical|warning | `igniter_ok` | `igniter_failed` | — |
| `gas_valve_ol` | measurement:gasValveCoilOhms in critical | `gas_valve_ok` | `gas_valve_failed` | — |
| `thermal_fuse_open` | measurement:dryerThermalFuseOhms in critical | `thermal_fuse_ok` | `thermal_fuse_failed` | — |
| `motor_ol` | measurement:dryerDrumMotorWindingOhms in critical | `motor_ok` | `motor_failed` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `no_ignition` | field:functional_checks.ignition=no | `igniter_ok`, `gas_valve_ok` | `igniter_failed` | — |
| `drum_not_turning` | field:functional_checks.drum_turning=no | `motor_ok` | `motor_failed` | — |
| `airflow_bad` | field:functional_checks.airflow=bad | `vent_ok` | `vent_restricted` | — |
| `flame_poor` | field:functional_checks.flame_quality=bad | — | — | `gas_valve_failed`, `vent_restricted` |
| `no_heat_chip` | chip:no_heat | — | — | `igniter_failed`, `gas_valve_failed`, `thermal_fuse_failed` |
| `not_drying_chip` | chip:not_drying | — | — | `vent_restricted` |
| `weak_flame_chip` | chip:weak_flame | — | — | `gas_valve_failed`, `vent_restricted` |

## 5. Existing evidence rules

Total: **50** (36 single-signal, 14 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_igniter_ol_igniter_failed` | measurement:hotSurfaceIgniterOhms in critical | `igniter` | component | confirm | no |
| `cat_up_igniter_ol_igniter_failed` | measurement:hotSurfaceIgniterOhms in critical | `ignition` | category | +38 | no |
| `eliminate_igniter_ol_igniter_ok` | measurement:hotSurfaceIgniterOhms in critical | `igniter` | component | eliminate | no |
| `confirm_igniter_low_amps_igniter_failed` | measurement:hotSurfaceIgniterAmps in critical|warning | `igniter` | component | confirm | no |
| `cat_up_igniter_low_amps_igniter_failed` | measurement:hotSurfaceIgniterAmps in critical|warning | `ignition` | category | +38 | no |
| `eliminate_igniter_low_amps_igniter_ok` | measurement:hotSurfaceIgniterAmps in critical|warning | `igniter` | component | eliminate | no |
| `confirm_gas_valve_ol_gas_valve_failed` | measurement:gasValveCoilOhms in critical | `gas_valve` | component | confirm | no |
| `cat_up_gas_valve_ol_gas_valve_failed` | measurement:gasValveCoilOhms in critical | `gas_valve` | category | +38 | no |
| `eliminate_gas_valve_ol_gas_valve_ok` | measurement:gasValveCoilOhms in critical | `gas_valve` | component | eliminate | no |
| `confirm_thermal_fuse_open_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | confirm | no |
| `cat_up_thermal_fuse_open_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in critical | `heat_safety` | category | +38 | no |
| `eliminate_thermal_fuse_open_thermal_fuse_ok` | measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | eliminate | no |
| `confirm_motor_ol_motor_failed` | measurement:dryerDrumMotorWindingOhms in critical | `motor` | component | confirm | no |
| `cat_up_motor_ol_motor_failed` | measurement:dryerDrumMotorWindingOhms in critical | `motor` | category | +38 | no |
| `eliminate_motor_ol_motor_ok` | measurement:dryerDrumMotorWindingOhms in critical | `motor` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage120 in critical | `supply` | component | eliminate | no |
| `confirm_no_ignition_igniter_failed` | field:functional_checks.ignition=no | `igniter` | component | confirm | no |
| `cat_up_no_ignition_igniter_failed` | field:functional_checks.ignition=no | `ignition` | category | +35 | no |
| `eliminate_no_ignition_igniter_ok` | field:functional_checks.ignition=no | `igniter` | component | eliminate | no |
| `eliminate_no_ignition_gas_valve_ok` | field:functional_checks.ignition=no | `gas_valve` | component | eliminate | no |
| `confirm_drum_not_turning_motor_failed` | field:functional_checks.drum_turning=no | `motor` | component | confirm | no |
| `cat_up_drum_not_turning_motor_failed` | field:functional_checks.drum_turning=no | `motor` | category | +35 | no |
| `eliminate_drum_not_turning_motor_ok` | field:functional_checks.drum_turning=no | `motor` | component | eliminate | no |
| `confirm_airflow_bad_vent_restricted` | field:functional_checks.airflow=bad | `vent` | component | confirm | no |
| `cat_up_airflow_bad_vent_restricted` | field:functional_checks.airflow=bad | `airflow` | category | +35 | no |
| `eliminate_airflow_bad_vent_ok` | field:functional_checks.airflow=bad | `vent` | component | eliminate | no |
| `suspect_flame_poor_gas_valve_failed` | field:functional_checks.flame_quality=bad | `gas_valve` | category | +18 | no |
| `suspect_flame_poor_vent_restricted` | field:functional_checks.flame_quality=bad | `airflow` | category | +18 | no |
| `chip_no_heat_ignition` | chip:no_heat | `ignition` | category | +22 | no |
| `chip_no_heat_gas_valve` | chip:no_heat | `gas_valve` | category | +22 | no |
| `chip_no_heat_heat_safety` | chip:no_heat | `heat_safety` | category | +22 | no |
| `chip_not_drying_airflow` | chip:not_drying | `airflow` | category | +22 | no |
| `chip_weak_flame_gas_valve` | chip:weak_flame | `gas_valve` | category | +22 | no |
| `chip_weak_flame_airflow` | chip:weak_flame | `airflow` | category | +22 | no |
| `gd_ms_001_no_heat_ignition_no` | chip:no_heat AND field:functional_checks.ignition=no | `igniter` | component | confirm | **yes** |
| `gd_ms_002_no_heat_igniter_ol` | chip:no_heat AND measurement:hotSurfaceIgniterOhms in critical | `igniter` | component | confirm | **yes** |
| `gd_ms_003_no_heat_thermal_fuse_open` | chip:no_heat AND measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | confirm | **yes** |
| `gd_ms_004_no_heat_gas_valve_ol` | chip:no_heat AND measurement:gasValveCoilOhms in critical | `gas_valve` | component | confirm | **yes** |
| `gd_ms_005_not_drying_airflow_bad` | chip:not_drying AND field:functional_checks.airflow=bad | `vent` | component | confirm | **yes** |
| `gd_ms_006_not_drying_airflow_lint_bad` | chip:not_drying AND field:functional_checks.airflow=bad AND field:visual_inspection.lint_accumulation=bad | `airflow` | category | +28 | **yes** |
| `gd_ms_007_weak_flame_flame_bad` | chip:weak_flame AND field:functional_checks.flame_quality=bad | `gas_valve` | component | confirm | **yes** |
| `gd_ms_008_weak_flame_airflow_bad` | chip:weak_flame AND field:functional_checks.airflow=bad | `vent` | component | confirm | **yes** |
| `gd_ms_009_no_spin_drum_no` | chip:no_spin AND field:functional_checks.drum_turning=no | `motor` | component | confirm | **yes** |
| `gd_ms_010_ignition_no_igniter_ol` | field:functional_checks.ignition=no AND measurement:hotSurfaceIgniterOhms in critical | `igniter` | component | confirm | **yes** |
| `gd_ms_011_flame_bad_gas_valve_ol` | field:functional_checks.flame_quality=bad AND measurement:gasValveCoilOhms in critical | `gas_valve` | component | confirm | **yes** |
| `gd_ms_012_not_drying_vent_bad` | chip:not_drying AND field:visual_inspection.vent_condition=bad | `vent` | component | confirm | **yes** |
| `gd_ms_013_no_heat_supply_critical` | chip:no_heat AND measurement:supplyVoltage120 in critical | `supply` | component | confirm | **yes** |
| `gd_ms_014_no_heat_ignition_no_igniter_low_amps` | chip:no_heat AND field:functional_checks.ignition=no AND measurement:hotSurfaceIgniterAmps in warning|critical | `igniter` | component | confirm | **yes** |

### Existing multi-signal rules (do not duplicate)

- `gd_ms_001_no_heat_ignition_no`: chip:no_heat AND field:functional_checks.ignition=no → `igniter` (No heat complaint with no burner ignition — igniter path likely.)
- `gd_ms_002_no_heat_igniter_ol`: chip:no_heat AND measurement:hotSurfaceIgniterOhms in critical → `igniter` (No heat with igniter open at meter — igniter failure confirmed.)
- `gd_ms_003_no_heat_thermal_fuse_open`: chip:no_heat AND measurement:dryerThermalFuseOhms in critical → `thermal_fuse` (No heat with thermal fuse open — safety device tripped.)
- `gd_ms_004_no_heat_gas_valve_ol`: chip:no_heat AND measurement:gasValveCoilOhms in critical → `gas_valve` (No heat with gas valve coil open — valve cannot open.)
- `gd_ms_005_not_drying_airflow_bad`: chip:not_drying AND field:functional_checks.airflow=bad → `vent` (Long dry times with poor vent airflow — restriction likely.)
- `gd_ms_006_not_drying_airflow_lint_bad`: chip:not_drying AND field:functional_checks.airflow=bad AND field:visual_inspection.lint_accumulation=bad → `airflow` (Damp clothes, bad airflow, and heavy lint — vent restriction pattern.)
- `gd_ms_007_weak_flame_flame_bad`: chip:weak_flame AND field:functional_checks.flame_quality=bad → `gas_valve` (Weak flame complaint with poor flame quality — gas valve or vent issue.)
- `gd_ms_008_weak_flame_airflow_bad`: chip:weak_flame AND field:functional_checks.airflow=bad → `vent` (Weak flame with poor vent airflow — flame starvation from restriction.)
- `gd_ms_009_no_spin_drum_no`: chip:no_spin AND field:functional_checks.drum_turning=no → `motor` (Won't tumble complaint with drum not turning — motor/drive path.)
- `gd_ms_010_ignition_no_igniter_ol`: field:functional_checks.ignition=no AND measurement:hotSurfaceIgniterOhms in critical → `igniter` (No ignition with igniter open — replace igniter.)
- `gd_ms_011_flame_bad_gas_valve_ol`: field:functional_checks.flame_quality=bad AND measurement:gasValveCoilOhms in critical → `gas_valve` (Poor flame with gas valve coil open — valve failure confirmed.)
- `gd_ms_012_not_drying_vent_bad`: chip:not_drying AND field:visual_inspection.vent_condition=bad → `vent` (Long dry times with bad vent/duct condition — clear vent path.)
- `gd_ms_013_no_heat_supply_critical`: chip:no_heat AND measurement:supplyVoltage120 in critical → `supply` (No heat with supply voltage out of range — check breaker and outlet first.)
- `gd_ms_014_no_heat_ignition_no_igniter_low_amps`: chip:no_heat AND field:functional_checks.ignition=no AND measurement:hotSurfaceIgniterAmps in warning|critical → `igniter` (No ignition with weak igniter draw — igniter not glowing hot enough.)
