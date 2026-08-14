# Signal inventory — electric_dryer

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `no_heat` | No Heat | `electric_dryer/electricDryerComplaints.ts` | chip | Yes (multi-select) | |
| `not_drying` | Takes Too Long / Damp Clothes | `electric_dryer/electricDryerComplaints.ts` | chip | Yes (multi-select) | |
| `no_spin` | Won't Tumble / Drum Not Turning | `electric_dryer/electricDryerComplaints.ts` | chip | Yes (multi-select) | |
| `wont_stop_spinning` | Won't Stop Spinning | `electric_dryer/electricDryerComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Thumping | `electric_dryer/electricDryerComplaints.ts` | chip | Yes (multi-select) | |
| `no_power` | Dead / Won't Start | `electric_dryer/electricDryerComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code on Display | `electric_dryer/electricDryerComplaints.ts` | chip | Yes (multi-select) | |

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
| `no_heat` | no_heat | visual, functional, heat, motor |
| `not_drying` | not_drying | visual, functional, heat |
| `no_spin` | no_spin | visual, functional, motor |
| `noisy` | noisy | visual, motor |
| `no_power` | no_power | motor, functional |
| `error_code` | error_code | motor, functional |

## 2. Wizard field signals

| Field path | Label | Type | Values | Step / section | Visibility | Smart measurement |
|------------|-------|------|--------|----------------|------------|-------------------|
| `commonly_missed.vent_restriction` | Vent restriction / length | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.crushed_vent` | Crushed vent hose | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.poor_airflow` | Poor airflow at exterior hood | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.overloading` | Customer overloading | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.lint_trap` | Lint screen / housing clean | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `visual_inspection.vent_condition` | Vent / Duct Condition | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.lint_accumulation` | Lint Accumulation | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.drum_condition` | Drum / Rollers / Glides | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.element_coils` | Heating element (visual) | tri | good, fair, bad | `visual_inspection` | showWhen: chip:no_heat | — |
| `functional_checks.drum_turning` | Drum Turning | yn | yes, no | `functional_checks` | showWhen: chip:no_spin OR chip:wont_stop_spinning | — |
| `functional_checks.heating` | Heating | yn | yes, no | `functional_checks` | showWhen: chip:no_heat OR chip:not_drying | — |
| `functional_checks.airflow` | Airflow at vent | gb | good, bad | `functional_checks` | showWhen: chip:not_drying | — |
| `functional_checks.blower_operation` | Blower Operation | gb | good, bad | `functional_checks` | showWhen: chip:no_heat OR chip:not_drying | — |
| `functional_checks.moisture_sensor` | Moisture sensor bars (if equipped) | gb | good, bad | `functional_checks` | showWhen: chip:not_drying | — |
| `heat_circuit.heater_ohms` | Heating element resistance (Ω) | text | free text / numeric | `heat_circuit` | always when step enabled | `electricDryerHeatingElementOhms` |
| `heat_circuit.heater_amps` | Heating element amps (energized) | text | free text / numeric | `heat_circuit` | always when step enabled | `electricDryerSupplyAmps` |
| `heat_circuit.thermal_fuse` | Thermal fuse / hi-limit continuity | text | free text / numeric | `heat_circuit` | always when step enabled | `dryerThermalFuseOhms` |
| `heat_circuit.cycling_thermostat` | Cycling thermostat | text | free text / numeric | `heat_circuit` | always when step enabled | `dryerCyclingThermostatOhms` |
| `heat_circuit.high_limit` | High-limit thermostat | text | free text / numeric | `heat_circuit` | always when step enabled | `dryerCyclingThermostatOhms` |
| `heat_circuit.exhaust_temp` | Exhaust air temp at vent (°F) | text | free text / numeric | `heat_circuit` | always when step enabled | — |
| `motor_electrical.supply_voltage` | Supply voltage (V) | text | free text / numeric | `motor_electrical` | always when step enabled | `supplyVoltage240` |
| `motor_electrical.motor_ohms` | Drive motor resistance (Ω) | text | free text / numeric | `motor_electrical` | always when step enabled | `dryerDrumMotorWindingOhms` |
| `motor_electrical.motor_amps` | Motor amps (running) | text | free text / numeric | `motor_electrical` | always when step enabled | — |
| `motor_electrical.belt_idler` | Belt / idler pulley condition | text | free text / numeric | `motor_electrical` | always when step enabled | — |
| `motor_electrical.board_notes` | Control board / relay notes | textarea | free text | `motor_electrical` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `dryerCyclingThermostatOhms` | Dryer Cycling Thermostat Continuity | Ω | normal 0-2 | warning 0-10 | critical <0 or >30 | heat_circuit.cycling_thermostat, heat_circuit.high_limit | normal, warning, critical |
| `dryerDrumMotorWindingOhms` | Dryer Drum Motor Winding Resistance | Ω | normal 1-10 | warning 0.5-20 | critical <0.1 or >40 | motor_electrical.motor_ohms | normal, warning, critical |
| `dryerThermalFuseOhms` | Dryer Thermal Fuse Continuity | Ω | normal 0-2 | critical <0 or >5 | — | heat_circuit.thermal_fuse | normal, warning, critical |
| `electricDryerHeatingElementOhms` | Electric Dryer Heating Element Resistance | Ω | normal 8-15 | warning 5-20 | critical <1 or >30 | heat_circuit.heater_ohms | normal, warning, critical |
| `electricDryerSupplyAmps` | Electric Dryer Supply Amperage | A | normal 15-24 | warning 10-27 | critical <5 or >30 | heat_circuit.heater_amps | normal, warning, critical |
| `supplyVoltage240` | Supply Voltage (240 VAC) | V | normal 220-250 | warning 210-260 | critical <200 or >270 | motor_electrical.supply_voltage | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `heating_element_ok` | Heating element OK | `heat_circuit` | `heating_element_failed` |
| `heating_element_failed` | Heating element failed | `heat_circuit` | `heating_element_ok` |
| `thermal_fuse_ok` | Thermal fuse OK | `heat_circuit` | `thermal_fuse_failed` |
| `thermal_fuse_failed` | Thermal fuse open | `heat_circuit` | `thermal_fuse_ok` |
| `cycling_thermostat_ok` | Cycling thermostat OK | `heat_circuit` | `cycling_thermostat_failed` |
| `cycling_thermostat_failed` | Cycling thermostat failed | `heat_circuit` | `cycling_thermostat_ok` |
| `vent_ok` | Vent / airflow OK | `airflow` | `vent_restricted` |
| `vent_restricted` | Vent restriction / poor airflow | `airflow` | `vent_ok` |
| `motor_ok` | Drum motor OK | `motor` | `motor_failed` |
| `motor_failed` | Drum motor failed | `motor` | `motor_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `heater_ol` | measurement:electricDryerHeatingElementOhms in critical | `heating_element_ok` | `heating_element_failed` | — |
| `heater_normal` | measurement:electricDryerHeatingElementOhms in normal | `heating_element_failed` | `heating_element_ok` | — |
| `thermal_fuse_open` | measurement:dryerThermalFuseOhms in critical | `thermal_fuse_ok` | `thermal_fuse_failed` | — |
| `thermal_fuse_good` | measurement:dryerThermalFuseOhms in normal | `thermal_fuse_failed` | `thermal_fuse_ok` | — |
| `cycling_stat_open` | measurement:dryerCyclingThermostatOhms in critical | `cycling_thermostat_ok` | `cycling_thermostat_failed` | — |
| `motor_ol` | measurement:dryerDrumMotorWindingOhms in critical | `motor_ok` | `motor_failed` | — |
| `supply_critical` | measurement:supplyVoltage240 in critical | `supply_ok` | `supply_fault` | — |
| `no_heat_functional` | field:functional_checks.heating=no | `heating_element_ok`, `thermal_fuse_ok` | `heating_element_failed`, `thermal_fuse_failed` | — |
| `drum_not_turning` | field:functional_checks.drum_turning=no | `motor_ok` | `motor_failed` | — |
| `airflow_bad` | field:functional_checks.airflow=bad | `vent_ok` | `vent_restricted` | — |
| `lint_excessive` | field:visual_inspection.lint_accumulation=bad | — | — | `vent_restricted`, `thermal_fuse_failed` |
| `no_heat_chip` | chip:no_heat | — | — | `heating_element_failed`, `thermal_fuse_failed` |
| `not_drying_chip` | chip:not_drying | — | — | `vent_restricted`, `heating_element_failed` |
| `no_spin_chip` | chip:no_spin | — | — | `motor_failed` |

## 5. Existing evidence rules

Total: **55** (41 single-signal, 14 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_heater_ol_heating_element_failed` | measurement:electricDryerHeatingElementOhms in critical | `heating_element` | component | confirm | no |
| `cat_up_heater_ol_heating_element_failed` | measurement:electricDryerHeatingElementOhms in critical | `heat_circuit` | category | +38 | no |
| `eliminate_heater_ol_heating_element_ok` | measurement:electricDryerHeatingElementOhms in critical | `heating_element` | component | eliminate | no |
| `confirm_heater_normal_heating_element_ok` | measurement:electricDryerHeatingElementOhms in normal | `heating_element` | component | confirm | no |
| `cat_down_heater_normal_heating_element_ok` | measurement:electricDryerHeatingElementOhms in normal | `heat_circuit` | category | decrease | no |
| `eliminate_heater_normal_heating_element_failed` | measurement:electricDryerHeatingElementOhms in normal | `heating_element` | component | eliminate | no |
| `cat_unlikely_heater_normal_heating_element_failed` | measurement:electricDryerHeatingElementOhms in normal | `heat_circuit` | category | unlikely | no |
| `confirm_thermal_fuse_open_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | confirm | no |
| `cat_up_thermal_fuse_open_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in critical | `heat_circuit` | category | +38 | no |
| `eliminate_thermal_fuse_open_thermal_fuse_ok` | measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | eliminate | no |
| `confirm_thermal_fuse_good_thermal_fuse_ok` | measurement:dryerThermalFuseOhms in normal | `thermal_fuse` | component | confirm | no |
| `cat_down_thermal_fuse_good_thermal_fuse_ok` | measurement:dryerThermalFuseOhms in normal | `heat_circuit` | category | decrease | no |
| `eliminate_thermal_fuse_good_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in normal | `thermal_fuse` | component | eliminate | no |
| `cat_unlikely_thermal_fuse_good_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in normal | `heat_circuit` | category | unlikely | no |
| `confirm_cycling_stat_open_cycling_thermostat_failed` | measurement:dryerCyclingThermostatOhms in critical | `cycling_thermostat` | component | confirm | no |
| `cat_up_cycling_stat_open_cycling_thermostat_failed` | measurement:dryerCyclingThermostatOhms in critical | `heat_circuit` | category | +38 | no |
| `eliminate_cycling_stat_open_cycling_thermostat_ok` | measurement:dryerCyclingThermostatOhms in critical | `cycling_thermostat` | component | eliminate | no |
| `confirm_motor_ol_motor_failed` | measurement:dryerDrumMotorWindingOhms in critical | `motor` | component | confirm | no |
| `cat_up_motor_ol_motor_failed` | measurement:dryerDrumMotorWindingOhms in critical | `motor` | category | +38 | no |
| `eliminate_motor_ol_motor_ok` | measurement:dryerDrumMotorWindingOhms in critical | `motor` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage240 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage240 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage240 in critical | `supply` | component | eliminate | no |
| `confirm_no_heat_functional_heating_element_failed` | field:functional_checks.heating=no | `heating_element` | component | confirm | no |
| `cat_up_no_heat_functional_heating_element_failed` | field:functional_checks.heating=no | `heat_circuit` | category | +35 | no |
| `confirm_no_heat_functional_thermal_fuse_failed` | field:functional_checks.heating=no | `thermal_fuse` | component | confirm | no |
| `cat_up_no_heat_functional_thermal_fuse_failed` | field:functional_checks.heating=no | `heat_circuit` | category | +35 | no |
| `eliminate_no_heat_functional_heating_element_ok` | field:functional_checks.heating=no | `heating_element` | component | eliminate | no |
| `eliminate_no_heat_functional_thermal_fuse_ok` | field:functional_checks.heating=no | `thermal_fuse` | component | eliminate | no |
| `confirm_drum_not_turning_motor_failed` | field:functional_checks.drum_turning=no | `motor` | component | confirm | no |
| `cat_up_drum_not_turning_motor_failed` | field:functional_checks.drum_turning=no | `motor` | category | +35 | no |
| `eliminate_drum_not_turning_motor_ok` | field:functional_checks.drum_turning=no | `motor` | component | eliminate | no |
| `confirm_airflow_bad_vent_restricted` | field:functional_checks.airflow=bad | `vent` | component | confirm | no |
| `cat_up_airflow_bad_vent_restricted` | field:functional_checks.airflow=bad | `airflow` | category | +35 | no |
| `eliminate_airflow_bad_vent_ok` | field:functional_checks.airflow=bad | `vent` | component | eliminate | no |
| `suspect_lint_excessive_vent_restricted` | field:visual_inspection.lint_accumulation=bad | `airflow` | category | +18 | no |
| `suspect_lint_excessive_thermal_fuse_failed` | field:visual_inspection.lint_accumulation=bad | `heat_circuit` | category | +18 | no |
| `chip_no_heat_heat_circuit` | chip:no_heat | `heat_circuit` | category | +22 | no |
| `chip_not_drying_airflow` | chip:not_drying | `airflow` | category | +22 | no |
| `chip_not_drying_heat_circuit` | chip:not_drying | `heat_circuit` | category | +22 | no |
| `chip_no_spin_motor` | chip:no_spin | `motor` | category | +22 | no |
| `ed_ms_001_no_heat_heating_no` | chip:no_heat AND field:functional_checks.heating=no | `heating_element` | component | confirm | **yes** |
| `ed_ms_002_no_heat_heater_ol` | chip:no_heat AND measurement:electricDryerHeatingElementOhms in critical | `heating_element` | component | confirm | **yes** |
| `ed_ms_003_no_heat_thermal_fuse_open` | chip:no_heat AND measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | confirm | **yes** |
| `ed_ms_004_not_drying_airflow_bad` | chip:not_drying AND field:functional_checks.airflow=bad | `vent` | component | confirm | **yes** |
| `ed_ms_005_not_drying_airflow_lint_bad` | chip:not_drying AND field:functional_checks.airflow=bad AND field:visual_inspection.lint_accumulation=bad | `airflow` | category | +28 | **yes** |
| `ed_ms_006_no_spin_drum_no` | chip:no_spin AND field:functional_checks.drum_turning=no | `motor` | component | confirm | **yes** |
| `ed_ms_007_heating_no_heater_ol` | field:functional_checks.heating=no AND measurement:electricDryerHeatingElementOhms in critical | `heating_element` | component | confirm | **yes** |
| `ed_ms_008_not_drying_heating_no` | chip:not_drying AND field:functional_checks.heating=no | `heat_circuit` | category | +25 | **yes** |
| `ed_ms_009_no_heat_supply_critical` | chip:no_heat AND measurement:supplyVoltage240 in critical | `supply` | component | confirm | **yes** |
| `ed_ms_010_no_power_supply_critical` | chip:no_power AND measurement:supplyVoltage240 in critical | `supply` | component | confirm | **yes** |
| `ed_ms_011_no_heat_cycling_stat_open` | chip:no_heat AND measurement:dryerCyclingThermostatOhms in critical | `cycling_thermostat` | component | confirm | **yes** |
| `ed_ms_012_not_drying_vent_bad` | chip:not_drying AND field:visual_inspection.vent_condition=bad | `vent` | component | confirm | **yes** |
| `ed_ms_013_lint_bad_thermal_fuse_open` | field:visual_inspection.lint_accumulation=bad AND measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | confirm | **yes** |
| `ed_ms_014_no_heat_heating_no_thermal_fuse` | chip:no_heat AND field:functional_checks.heating=no AND measurement:dryerThermalFuseOhms in critical | `thermal_fuse` | component | confirm | **yes** |

### Existing multi-signal rules (do not duplicate)

- `ed_ms_001_no_heat_heating_no`: chip:no_heat AND field:functional_checks.heating=no → `heating_element` (No heat complaint with no heating observed — element or heat circuit path.)
- `ed_ms_002_no_heat_heater_ol`: chip:no_heat AND measurement:electricDryerHeatingElementOhms in critical → `heating_element` (No heat with heating element open — element failure confirmed.)
- `ed_ms_003_no_heat_thermal_fuse_open`: chip:no_heat AND measurement:dryerThermalFuseOhms in critical → `thermal_fuse` (No heat with thermal fuse open — safety device tripped.)
- `ed_ms_004_not_drying_airflow_bad`: chip:not_drying AND field:functional_checks.airflow=bad → `vent` (Long dry times with poor vent airflow — restriction likely.)
- `ed_ms_005_not_drying_airflow_lint_bad`: chip:not_drying AND field:functional_checks.airflow=bad AND field:visual_inspection.lint_accumulation=bad → `airflow` (Damp clothes, bad airflow, and heavy lint — vent restriction pattern.)
- `ed_ms_006_no_spin_drum_no`: chip:no_spin AND field:functional_checks.drum_turning=no → `motor` (Won't tumble complaint with drum not turning — motor/drive path.)
- `ed_ms_007_heating_no_heater_ol`: field:functional_checks.heating=no AND measurement:electricDryerHeatingElementOhms in critical → `heating_element` (No heating observed with element open at meter — replace element.)
- `ed_ms_008_not_drying_heating_no`: chip:not_drying AND field:functional_checks.heating=no → `heat_circuit` (Long dry times with no heat — weak or absent heat circuit.)
- `ed_ms_009_no_heat_supply_critical`: chip:no_heat AND measurement:supplyVoltage240 in critical → `supply` (No heat with 240 V supply out of range — check breaker and outlet.)
- `ed_ms_010_no_power_supply_critical`: chip:no_power AND measurement:supplyVoltage240 in critical → `supply` (Dead dryer with bad supply voltage — electrical supply root cause.)
- `ed_ms_011_no_heat_cycling_stat_open`: chip:no_heat AND measurement:dryerCyclingThermostatOhms in critical → `cycling_thermostat` (No heat with cycling thermostat open — heat circuit cannot close.)
- `ed_ms_012_not_drying_vent_bad`: chip:not_drying AND field:visual_inspection.vent_condition=bad → `vent` (Long dry times with bad vent/duct condition — clear vent path.)
- `ed_ms_013_lint_bad_thermal_fuse_open`: field:visual_inspection.lint_accumulation=bad AND measurement:dryerThermalFuseOhms in critical → `thermal_fuse` (Heavy lint with blown thermal fuse — overheat from restriction.)
- `ed_ms_014_no_heat_heating_no_thermal_fuse`: chip:no_heat AND field:functional_checks.heating=no AND measurement:dryerThermalFuseOhms in critical → `thermal_fuse` (No heat observed with thermal fuse open — fuse is root cause.)
