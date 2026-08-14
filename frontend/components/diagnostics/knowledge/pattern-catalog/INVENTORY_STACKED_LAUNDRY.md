# Signal inventory — stacked_laundry

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `washer_drain` | Washer Won't Drain | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `washer_spin` | Washer Won't Spin | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `washer_leak` | Washer Leaking | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `washer_fill` | Washer Won't Fill | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `dryer_no_heat` | Dryer No Heat | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `dryer_not_drying` | Dryer Takes Too Long | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `dryer_no_tumble` | Dryer Won't Tumble | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Vibration | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `no_power` | Dead / Won't Start | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code | `stacked_laundry/stackedLaundryComplaints.ts` | chip | Yes (multi-select) | |

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
| `commonly_missed.shared_power` | Shared power / outlet load | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.airflow_restrictions` | Dryer vent / airflow | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.installation` | Installation / stacking kit / level | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.water_supply` | Washer water supply / drain | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `washer_section.fill` | Fill | gb | good, bad | `washer_section` | always when step enabled | — |
| `washer_section.agitate` | Agitate | gb | good, bad | `washer_section` | always when step enabled | — |
| `washer_section.drain` | Drain | gb | good, bad | `washer_section` | always when step enabled | — |
| `washer_section.spin` | Spin | gb | good, bad | `washer_section` | always when step enabled | — |
| `washer_section.washer_leak` | Leak Present | yn | yes, no | `washer_section` | always when step enabled | — |
| `dryer_section.drum_turning` | Drum Turning | yn | yes, no | `dryer_section` | always when step enabled | — |
| `dryer_section.heat_present` | Heat Present | yn | yes, no | `dryer_section` | always when step enabled | — |
| `dryer_section.airflow` | Airflow | gb | good, bad | `dryer_section` | always when step enabled | — |
| `dryer_section.blower` | Blower Operation | gb | good, bad | `dryer_section` | always when step enabled | — |
| `washer_measurements.washer_motor_ohms` | Wash motor (Ω) | text | free text / numeric | `washer_measurements` | always when step enabled | `washerMotorWindingOhms` |
| `washer_measurements.drain_pump_ohms` | Drain pump (Ω) | text | free text / numeric | `washer_measurements` | always when step enabled | `washerDrainPumpOhms` |
| `washer_measurements.water_pressure` | Water pressure (PSI) | text | free text / numeric | `washer_measurements` | always when step enabled | — |
| `dryer_measurements.supply_voltage` | Supply voltage (V) | text | free text / numeric | `dryer_measurements` | always when step enabled | `supplyVoltage240` |
| `dryer_measurements.heater_ohms` | Heater / igniter (Ω) | text | free text / numeric | `dryer_measurements` | always when step enabled | — |
| `dryer_measurements.heater_or_igniter_amps` | Heater or igniter amps | text | free text / numeric | `dryer_measurements` | always when step enabled | — |
| `dryer_measurements.motor_ohms` | Dryer motor (Ω) | text | free text / numeric | `dryer_measurements` | always when step enabled | `dryerDrumMotorWindingOhms` |
| `dryer_measurements.thermal_fuse` | Thermal fuse / hi-limit | text | free text / numeric | `dryer_measurements` | always when step enabled | `dryerThermalFuseOhms` |
| `dryer_measurements.exhaust_temp` | Exhaust temp at vent (°F) | text | free text / numeric | `dryer_measurements` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `dryerDrumMotorWindingOhms` | Dryer Drum Motor Winding Resistance | Ω | normal 1-10 | warning 0.5-20 | critical <0.1 or >40 | dryer_measurements.motor_ohms | normal, warning, critical |
| `dryerThermalFuseOhms` | Dryer Thermal Fuse Continuity | Ω | normal 0-2 | critical <0 or >5 | — | dryer_measurements.thermal_fuse | normal, warning, critical |
| `supplyVoltage240` | Supply Voltage (240 VAC) | V | normal 220-250 | warning 210-260 | critical <200 or >270 | dryer_measurements.supply_voltage | normal, warning, critical |
| `washerDrainPumpOhms` | Washer Drain Pump Winding Resistance | Ω | normal 20-200 | warning 10-300 | critical <2 or >500 | washer_measurements.drain_pump_ohms | normal, warning, critical |
| `washerMotorWindingOhms` | Washer Drive Motor Winding Resistance | Ω | normal 1-30 | warning 0.5-45 | critical <0.1 or >70 | washer_measurements.washer_motor_ohms | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `washer_drain_pump_ok` | Washer drain pump OK | `washer_drain` | `washer_drain_pump_failed` |
| `washer_drain_pump_failed` | Washer drain pump failed | `washer_drain` | `washer_drain_pump_ok` |
| `washer_motor_ok` | Wash motor OK | `washer_drive` | `washer_motor_failed` |
| `washer_motor_failed` | Wash motor failed | `washer_drive` | `washer_motor_ok` |
| `dryer_thermal_fuse_ok` | Dryer thermal fuse OK | `dryer_heat` | `dryer_thermal_fuse_failed` |
| `dryer_thermal_fuse_failed` | Dryer thermal fuse open | `dryer_heat` | `dryer_thermal_fuse_ok` |
| `dryer_heat_ok` | Dryer heat OK | `dryer_heat` | `dryer_heat_failed` |
| `dryer_heat_failed` | Dryer heat circuit fault | `dryer_heat` | `dryer_heat_ok` |
| `dryer_motor_ok` | Dryer drum motor OK | `dryer_motor` | `dryer_motor_failed` |
| `dryer_motor_failed` | Dryer drum motor failed | `dryer_motor` | `dryer_motor_ok` |
| `dryer_vent_ok` | Dryer vent / airflow OK | `dryer_airflow` | `dryer_vent_restricted` |
| `dryer_vent_restricted` | Dryer vent restriction | `dryer_airflow` | `dryer_vent_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `washer_drain_pump_ol` | measurement:washerDrainPumpOhms in critical | `washer_drain_pump_ok` | `washer_drain_pump_failed` | — |
| `washer_motor_ol` | measurement:washerMotorWindingOhms in critical | `washer_motor_ok` | `washer_motor_failed` | — |
| `dryer_thermal_fuse_open` | measurement:dryerThermalFuseOhms in critical | `dryer_thermal_fuse_ok`, `dryer_heat_ok` | `dryer_thermal_fuse_failed`, `dryer_heat_failed` | — |
| `dryer_motor_ol` | measurement:dryerDrumMotorWindingOhms in critical | `dryer_motor_ok` | `dryer_motor_failed` | — |
| `supply_critical` | measurement:supplyVoltage240 in critical | `supply_ok` | `supply_fault` | — |
| `washer_drain_bad` | field:washer_section.drain=bad | `washer_drain_pump_ok` | `washer_drain_pump_failed` | — |
| `washer_spin_bad` | field:washer_section.spin=bad | `washer_motor_ok` | `washer_motor_failed` | — |
| `washer_agitate_bad` | field:washer_section.agitate=bad | `washer_motor_ok` | `washer_motor_failed` | — |
| `dryer_no_heat` | field:dryer_section.heat_present=no | `dryer_heat_ok` | `dryer_heat_failed`, `dryer_thermal_fuse_failed` | — |
| `dryer_no_tumble` | field:dryer_section.drum_turning=no | `dryer_motor_ok` | `dryer_motor_failed` | — |
| `dryer_airflow_bad` | field:dryer_section.airflow=bad | `dryer_vent_ok` | `dryer_vent_restricted` | — |
| `washer_drain_chip` | chip:washer_drain | — | — | `washer_drain_pump_failed` |
| `washer_spin_chip` | chip:washer_spin | — | — | `washer_motor_failed` |
| `washer_fill_chip` | chip:washer_fill | — | — | `supply_fault` |
| `dryer_no_heat_chip` | chip:dryer_no_heat | — | — | `dryer_heat_failed`, `dryer_thermal_fuse_failed` |
| `dryer_not_drying_chip` | chip:dryer_not_drying | — | — | `dryer_vent_restricted`, `dryer_heat_failed` |
| `dryer_no_tumble_chip` | chip:dryer_no_tumble | — | — | `dryer_motor_failed` |

## 5. Existing evidence rules

Total: **59** (45 single-signal, 14 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_washer_drain_pump_ol_washer_drain_pump_failed` | measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | confirm | no |
| `cat_up_washer_drain_pump_ol_washer_drain_pump_failed` | measurement:washerDrainPumpOhms in critical | `washer_drain` | category | +38 | no |
| `eliminate_washer_drain_pump_ol_washer_drain_pump_ok` | measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | eliminate | no |
| `confirm_washer_motor_ol_washer_motor_failed` | measurement:washerMotorWindingOhms in critical | `washer_motor` | component | confirm | no |
| `cat_up_washer_motor_ol_washer_motor_failed` | measurement:washerMotorWindingOhms in critical | `washer_drive` | category | +38 | no |
| `eliminate_washer_motor_ol_washer_motor_ok` | measurement:washerMotorWindingOhms in critical | `washer_motor` | component | eliminate | no |
| `confirm_dryer_thermal_fuse_open_dryer_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in critical | `dryer_thermal_fuse` | component | confirm | no |
| `cat_up_dryer_thermal_fuse_open_dryer_thermal_fuse_failed` | measurement:dryerThermalFuseOhms in critical | `dryer_heat` | category | +38 | no |
| `confirm_dryer_thermal_fuse_open_dryer_heat_failed` | measurement:dryerThermalFuseOhms in critical | `dryer_heat` | component | confirm | no |
| `cat_up_dryer_thermal_fuse_open_dryer_heat_failed` | measurement:dryerThermalFuseOhms in critical | `dryer_heat` | category | +38 | no |
| `eliminate_dryer_thermal_fuse_open_dryer_thermal_fuse_ok` | measurement:dryerThermalFuseOhms in critical | `dryer_thermal_fuse` | component | eliminate | no |
| `eliminate_dryer_thermal_fuse_open_dryer_heat_ok` | measurement:dryerThermalFuseOhms in critical | `dryer_heat` | component | eliminate | no |
| `confirm_dryer_motor_ol_dryer_motor_failed` | measurement:dryerDrumMotorWindingOhms in critical | `dryer_motor` | component | confirm | no |
| `cat_up_dryer_motor_ol_dryer_motor_failed` | measurement:dryerDrumMotorWindingOhms in critical | `dryer_motor` | category | +38 | no |
| `eliminate_dryer_motor_ol_dryer_motor_ok` | measurement:dryerDrumMotorWindingOhms in critical | `dryer_motor` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage240 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage240 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage240 in critical | `supply` | component | eliminate | no |
| `confirm_washer_drain_bad_washer_drain_pump_failed` | field:washer_section.drain=bad | `washer_drain_pump` | component | confirm | no |
| `cat_up_washer_drain_bad_washer_drain_pump_failed` | field:washer_section.drain=bad | `washer_drain` | category | +35 | no |
| `eliminate_washer_drain_bad_washer_drain_pump_ok` | field:washer_section.drain=bad | `washer_drain_pump` | component | eliminate | no |
| `confirm_washer_spin_bad_washer_motor_failed` | field:washer_section.spin=bad | `washer_motor` | component | confirm | no |
| `cat_up_washer_spin_bad_washer_motor_failed` | field:washer_section.spin=bad | `washer_drive` | category | +35 | no |
| `eliminate_washer_spin_bad_washer_motor_ok` | field:washer_section.spin=bad | `washer_motor` | component | eliminate | no |
| `confirm_washer_agitate_bad_washer_motor_failed` | field:washer_section.agitate=bad | `washer_motor` | component | confirm | no |
| `cat_up_washer_agitate_bad_washer_motor_failed` | field:washer_section.agitate=bad | `washer_drive` | category | +35 | no |
| `eliminate_washer_agitate_bad_washer_motor_ok` | field:washer_section.agitate=bad | `washer_motor` | component | eliminate | no |
| `confirm_dryer_no_heat_dryer_heat_failed` | field:dryer_section.heat_present=no | `dryer_heat` | component | confirm | no |
| `cat_up_dryer_no_heat_dryer_heat_failed` | field:dryer_section.heat_present=no | `dryer_heat` | category | +35 | no |
| `confirm_dryer_no_heat_dryer_thermal_fuse_failed` | field:dryer_section.heat_present=no | `dryer_thermal_fuse` | component | confirm | no |
| `cat_up_dryer_no_heat_dryer_thermal_fuse_failed` | field:dryer_section.heat_present=no | `dryer_heat` | category | +35 | no |
| `eliminate_dryer_no_heat_dryer_heat_ok` | field:dryer_section.heat_present=no | `dryer_heat` | component | eliminate | no |
| `confirm_dryer_no_tumble_dryer_motor_failed` | field:dryer_section.drum_turning=no | `dryer_motor` | component | confirm | no |
| `cat_up_dryer_no_tumble_dryer_motor_failed` | field:dryer_section.drum_turning=no | `dryer_motor` | category | +35 | no |
| `eliminate_dryer_no_tumble_dryer_motor_ok` | field:dryer_section.drum_turning=no | `dryer_motor` | component | eliminate | no |
| `confirm_dryer_airflow_bad_dryer_vent_restricted` | field:dryer_section.airflow=bad | `dryer_vent` | component | confirm | no |
| `cat_up_dryer_airflow_bad_dryer_vent_restricted` | field:dryer_section.airflow=bad | `dryer_airflow` | category | +35 | no |
| `eliminate_dryer_airflow_bad_dryer_vent_ok` | field:dryer_section.airflow=bad | `dryer_vent` | component | eliminate | no |
| `chip_washer_drain_washer_drain` | chip:washer_drain | `washer_drain` | category | +22 | no |
| `chip_washer_spin_washer_drive` | chip:washer_spin | `washer_drive` | category | +22 | no |
| `chip_washer_fill_electrical_supply` | chip:washer_fill | `electrical_supply` | category | +22 | no |
| `chip_dryer_no_heat_dryer_heat` | chip:dryer_no_heat | `dryer_heat` | category | +22 | no |
| `chip_dryer_not_drying_dryer_airflow` | chip:dryer_not_drying | `dryer_airflow` | category | +22 | no |
| `chip_dryer_not_drying_dryer_heat` | chip:dryer_not_drying | `dryer_heat` | category | +22 | no |
| `chip_dryer_no_tumble_dryer_motor` | chip:dryer_no_tumble | `dryer_motor` | category | +22 | no |
| `sl_ms_001_washer_drain_drain_bad` | chip:washer_drain AND field:washer_section.drain=bad | `washer_drain_pump` | component | confirm | **yes** |
| `sl_ms_002_washer_drain_pump_ol` | chip:washer_drain AND measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | confirm | **yes** |
| `sl_ms_003_washer_spin_spin_bad` | chip:washer_spin AND field:washer_section.spin=bad | `washer_motor` | component | confirm | **yes** |
| `sl_ms_004_washer_spin_motor_ol` | chip:washer_spin AND measurement:washerMotorWindingOhms in critical | `washer_motor` | component | confirm | **yes** |
| `sl_ms_005_drain_bad_pump_ol` | field:washer_section.drain=bad AND measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | confirm | **yes** |
| `sl_ms_006_dryer_no_heat_heat_no` | chip:dryer_no_heat AND field:dryer_section.heat_present=no | `dryer_heat` | component | confirm | **yes** |
| `sl_ms_007_dryer_no_heat_fuse_open` | chip:dryer_no_heat AND measurement:dryerThermalFuseOhms in critical | `dryer_thermal_fuse` | component | confirm | **yes** |
| `sl_ms_008_dryer_no_tumble_drum_no` | chip:dryer_no_tumble AND field:dryer_section.drum_turning=no | `dryer_motor` | component | confirm | **yes** |
| `sl_ms_009_dryer_no_tumble_motor_ol` | chip:dryer_no_tumble AND measurement:dryerDrumMotorWindingOhms in critical | `dryer_motor` | component | confirm | **yes** |
| `sl_ms_010_dryer_not_drying_airflow_bad` | chip:dryer_not_drying AND field:dryer_section.airflow=bad | `dryer_vent` | component | confirm | **yes** |
| `sl_ms_011_dryer_not_drying_heat_no` | chip:dryer_not_drying AND field:dryer_section.heat_present=no | `dryer_heat` | component | confirm | **yes** |
| `sl_ms_012_no_power_supply_critical` | chip:no_power AND measurement:supplyVoltage240 in critical | `supply` | component | confirm | **yes** |
| `sl_ms_013_heat_no_fuse_open` | field:dryer_section.heat_present=no AND measurement:dryerThermalFuseOhms in critical | `dryer_thermal_fuse` | component | confirm | **yes** |
| `sl_ms_014_spin_bad_motor_ol` | field:washer_section.spin=bad AND measurement:washerMotorWindingOhms in critical | `washer_motor` | component | confirm | **yes** |

### Existing multi-signal rules (do not duplicate)

- `sl_ms_001_washer_drain_drain_bad`: chip:washer_drain AND field:washer_section.drain=bad → `washer_drain_pump` (Washer won't drain with failed drain cycle — pump or clog path.)
- `sl_ms_002_washer_drain_pump_ol`: chip:washer_drain AND measurement:washerDrainPumpOhms in critical → `washer_drain_pump` (Drain complaint with pump open at meter — drain pump failure confirmed.)
- `sl_ms_003_washer_spin_spin_bad`: chip:washer_spin AND field:washer_section.spin=bad → `washer_motor` (Won't spin complaint with failed spin — drive motor or clutch path.)
- `sl_ms_004_washer_spin_motor_ol`: chip:washer_spin AND measurement:washerMotorWindingOhms in critical → `washer_motor` (Spin complaint with wash motor open — motor failure confirmed.)
- `sl_ms_005_drain_bad_pump_ol`: field:washer_section.drain=bad AND measurement:washerDrainPumpOhms in critical → `washer_drain_pump` (Failed drain with pump open — replace drain pump.)
- `sl_ms_006_dryer_no_heat_heat_no`: chip:dryer_no_heat AND field:dryer_section.heat_present=no → `dryer_heat` (No heat complaint with no heat at exhaust — element or fuse path.)
- `sl_ms_007_dryer_no_heat_fuse_open`: chip:dryer_no_heat AND measurement:dryerThermalFuseOhms in critical → `dryer_thermal_fuse` (No heat with thermal fuse open — safety fuse tripped.)
- `sl_ms_008_dryer_no_tumble_drum_no`: chip:dryer_no_tumble AND field:dryer_section.drum_turning=no → `dryer_motor` (Drum won't turn with confirmed no tumble — drum motor or belt path.)
- `sl_ms_009_dryer_no_tumble_motor_ol`: chip:dryer_no_tumble AND measurement:dryerDrumMotorWindingOhms in critical → `dryer_motor` (No tumble with dryer motor open — drum motor failure confirmed.)
- `sl_ms_010_dryer_not_drying_airflow_bad`: chip:dryer_not_drying AND field:dryer_section.airflow=bad → `dryer_vent` (Long dry times with poor airflow — vent restriction first.)
- `sl_ms_011_dryer_not_drying_heat_no`: chip:dryer_not_drying AND field:dryer_section.heat_present=no → `dryer_heat` (Not drying with no heat — heat circuit before blaming vent alone.)
- `sl_ms_012_no_power_supply_critical`: chip:no_power AND measurement:supplyVoltage240 in critical → `supply` (Dead unit with supply voltage out of range — outlet or breaker path.)
- `sl_ms_013_heat_no_fuse_open`: field:dryer_section.heat_present=no AND measurement:dryerThermalFuseOhms in critical → `dryer_thermal_fuse` (No heat at vent with fuse open — thermal fuse is root cause.)
- `sl_ms_014_spin_bad_motor_ol`: field:washer_section.spin=bad AND measurement:washerMotorWindingOhms in critical → `washer_motor` (Failed spin with motor open — replace wash motor.)
