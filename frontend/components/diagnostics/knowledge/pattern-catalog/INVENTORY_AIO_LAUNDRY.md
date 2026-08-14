# Signal inventory — aio_laundry

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `heat_pump_dry` | Not Drying (Heat Pump) | `aio_laundry/aioLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `condensate` | Condensate / Drain Issue | `aio_laundry/aioLaundryComplaints.ts` | chip | Yes (multi-select) | |
| `compressor` | Compressor / Sealed System | `aio_laundry/aioLaundryComplaints.ts` | chip | Yes (multi-select) | |

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
| `commonly_missed.heat_pump_filter` | Heat pump filter / condenser clean | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.vent_airflow` | Exhaust / condenser airflow | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.water_pressure` | Water pressure / inlet screens | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.level_install` | Level / installation / pedestal | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.drain_filter` | Drain pump filter / coin trap | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `wash_functions.fill` | Fill | gb | good, bad | `wash_functions` | always when step enabled | — |
| `wash_functions.agitate` | Agitate | gb | good, bad | `wash_functions` | always when step enabled | — |
| `wash_functions.spin` | Spin | gb | good, bad | `wash_functions` | always when step enabled | — |
| `wash_functions.drain` | Drain | gb | good, bad | `wash_functions` | always when step enabled | — |
| `wash_functions.washer_leak` | Leak Present | yn | yes, no | `wash_functions` | always when step enabled | — |
| `dry_functions.drum_turning` | Drum Turning | yn | yes, no | `dry_functions` | always when step enabled | — |
| `dry_functions.heat_present` | Heat / drying present | yn | yes, no | `dry_functions` | always when step enabled | — |
| `dry_functions.airflow` | Airflow / condenser fan | gb | good, bad | `dry_functions` | always when step enabled | — |
| `dry_functions.condensate_drain` | Condensate / drain pump | gb | good, bad | `dry_functions` | always when step enabled | — |
| `wash_electrical.supply_voltage` | Supply voltage (V) | text | free text / numeric | `wash_electrical` | always when step enabled | `supplyVoltage120` |
| `wash_electrical.wash_motor_ohms` | Wash motor (Ω) | text | free text / numeric | `wash_electrical` | always when step enabled | `washerMotorWindingOhms` |
| `wash_electrical.drain_pump_ohms` | Drain pump (Ω) | text | free text / numeric | `wash_electrical` | always when step enabled | `washerDrainPumpOhms` |
| `wash_electrical.water_pressure` | Water pressure (PSI) | text | free text / numeric | `wash_electrical` | always when step enabled | — |
| `heat_pump_readings.compressor_amps` | Compressor amps (running) | text | free text / numeric | `heat_pump_readings` | always when step enabled | `compressorRunAmps` |
| `heat_pump_readings.compressor_ohms` | Compressor windings (Ω) | text | free text / numeric | `heat_pump_readings` | always when step enabled | `compressorRunWindingOhms` |
| `heat_pump_readings.heat_pump_fan_amps` | Condenser / heat-pump fan amps | text | free text / numeric | `heat_pump_readings` | always when step enabled | `condenserFanAmps` |
| `heat_pump_readings.heater_amps` | Supplemental heater amps (if equipped) | text | free text / numeric | `heat_pump_readings` | always when step enabled | — |
| `heat_pump_readings.refrigerant_notes` | Refrigerant / sealed system notes | textarea | free text | `heat_pump_readings` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `compressorRunAmps` | Compressor Run Amperage | A | normal 1-4.5 | warning 0.5-6 | critical <0.2 or >8 | heat_pump_readings.compressor_amps | normal, warning, critical |
| `compressorRunWindingOhms` | Compressor Run Winding Resistance | Ω | normal 2-30 | warning 1-40 | critical <0.3 or >60 | heat_pump_readings.compressor_ohms | normal, warning, critical |
| `condenserFanAmps` | Condenser Fan Motor Amperage | A | normal 0.1-0.6 | warning 0.05-0.9 | critical <0.02 or >1.5 | heat_pump_readings.heat_pump_fan_amps | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | wash_electrical.supply_voltage | normal, warning, critical |
| `washerDrainPumpOhms` | Washer Drain Pump Winding Resistance | Ω | normal 20-200 | warning 10-300 | critical <2 or >500 | wash_electrical.drain_pump_ohms | normal, warning, critical |
| `washerMotorWindingOhms` | Washer Drive Motor Winding Resistance | Ω | normal 1-30 | warning 0.5-45 | critical <0.1 or >70 | wash_electrical.wash_motor_ohms | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `washer_drain_pump_ok` | Drain pump OK | `washer_drain` | `washer_drain_pump_failed` |
| `washer_drain_pump_failed` | Drain pump failed | `washer_drain` | `washer_drain_pump_ok` |
| `washer_motor_ok` | Wash motor OK | `washer_drive` | `washer_motor_failed` |
| `washer_motor_failed` | Wash motor failed | `washer_drive` | `washer_motor_ok` |
| `compressor_ok` | Compressor running normally | `heat_pump` | `compressor_failed` |
| `compressor_failed` | Compressor / start issue | `heat_pump` | `compressor_ok` |
| `sealed_system_fault` | Sealed system restriction/leak | `heat_pump` | — |
| `heat_pump_fan_ok` | Heat-pump fan OK | `heat_pump_airflow` | `heat_pump_fan_failed` |
| `heat_pump_fan_failed` | Heat-pump / condenser fan failed | `heat_pump_airflow` | `heat_pump_fan_ok` |
| `filter_airflow_ok` | Filter / airflow OK | `heat_pump_airflow` | `filter_airflow_restricted` |
| `filter_airflow_restricted` | Filter clogged / poor airflow | `heat_pump_airflow` | `filter_airflow_ok` |
| `condensate_ok` | Condensate drain OK | `condensate` | `condensate_failed` |
| `condensate_failed` | Condensate / drain pump fault | `condensate` | `condensate_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `drain_pump_ol` | measurement:washerDrainPumpOhms in critical | `washer_drain_pump_ok` | `washer_drain_pump_failed` | — |
| `wash_motor_ol` | measurement:washerMotorWindingOhms in critical | `washer_motor_ok` | `washer_motor_failed` | — |
| `compressor_low_amps` | measurement:compressorRunAmps in critical|warning | `compressor_ok` | `compressor_failed`, `sealed_system_fault` | — |
| `compressor_winding_ol` | measurement:compressorRunWindingOhms in critical | `compressor_ok` | `compressor_failed` | — |
| `heat_pump_fan_low` | measurement:condenserFanAmps in critical|warning | `heat_pump_fan_ok` | `heat_pump_fan_failed` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `wash_drain_bad` | field:wash_functions.drain=bad | `washer_drain_pump_ok` | `washer_drain_pump_failed` | — |
| `wash_spin_bad` | field:wash_functions.spin=bad | `washer_motor_ok` | `washer_motor_failed` | — |
| `wash_agitate_bad` | field:wash_functions.agitate=bad | `washer_motor_ok` | `washer_motor_failed` | — |
| `no_heat_dry` | field:dry_functions.heat_present=no | `compressor_ok` | `compressor_failed`, `heat_pump_fan_failed` | — |
| `dry_airflow_bad` | field:dry_functions.airflow=bad | `filter_airflow_ok`, `heat_pump_fan_ok` | `filter_airflow_restricted`, `heat_pump_fan_failed` | — |
| `condensate_bad` | field:dry_functions.condensate_drain=bad | `condensate_ok` | `condensate_failed` | — |
| `washer_drain_chip` | chip:washer_drain | — | — | `washer_drain_pump_failed`, `condensate_failed` |
| `washer_spin_chip` | chip:washer_spin | — | — | `washer_motor_failed` |
| `dryer_no_heat_chip` | chip:dryer_no_heat | — | — | `compressor_failed`, `heat_pump_fan_failed` |
| `heat_pump_dry_chip` | chip:heat_pump_dry | — | — | `filter_airflow_restricted`, `compressor_failed`, `heat_pump_fan_failed` |
| `condensate_chip` | chip:condensate | — | — | `condensate_failed`, `washer_drain_pump_failed` |
| `compressor_chip` | chip:compressor | — | — | `compressor_failed`, `sealed_system_fault` |

## 5. Existing evidence rules

Total: **67** (53 single-signal, 14 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_drain_pump_ol_washer_drain_pump_failed` | measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | confirm | no |
| `cat_up_drain_pump_ol_washer_drain_pump_failed` | measurement:washerDrainPumpOhms in critical | `washer_drain` | category | +38 | no |
| `eliminate_drain_pump_ol_washer_drain_pump_ok` | measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | eliminate | no |
| `confirm_wash_motor_ol_washer_motor_failed` | measurement:washerMotorWindingOhms in critical | `washer_motor` | component | confirm | no |
| `cat_up_wash_motor_ol_washer_motor_failed` | measurement:washerMotorWindingOhms in critical | `washer_drive` | category | +38 | no |
| `eliminate_wash_motor_ol_washer_motor_ok` | measurement:washerMotorWindingOhms in critical | `washer_motor` | component | eliminate | no |
| `confirm_compressor_low_amps_compressor_failed` | measurement:compressorRunAmps in critical|warning | `compressor` | component | confirm | no |
| `cat_up_compressor_low_amps_compressor_failed` | measurement:compressorRunAmps in critical|warning | `heat_pump` | category | +38 | no |
| `confirm_compressor_low_amps_sealed_system_fault` | measurement:compressorRunAmps in critical|warning | `sealed_system` | component | confirm | no |
| `cat_up_compressor_low_amps_sealed_system_fault` | measurement:compressorRunAmps in critical|warning | `heat_pump` | category | +38 | no |
| `eliminate_compressor_low_amps_compressor_ok` | measurement:compressorRunAmps in critical|warning | `compressor` | component | eliminate | no |
| `confirm_compressor_winding_ol_compressor_failed` | measurement:compressorRunWindingOhms in critical | `compressor` | component | confirm | no |
| `cat_up_compressor_winding_ol_compressor_failed` | measurement:compressorRunWindingOhms in critical | `heat_pump` | category | +38 | no |
| `eliminate_compressor_winding_ol_compressor_ok` | measurement:compressorRunWindingOhms in critical | `compressor` | component | eliminate | no |
| `confirm_heat_pump_fan_low_heat_pump_fan_failed` | measurement:condenserFanAmps in critical|warning | `heat_pump_fan` | component | confirm | no |
| `cat_up_heat_pump_fan_low_heat_pump_fan_failed` | measurement:condenserFanAmps in critical|warning | `heat_pump_airflow` | category | +38 | no |
| `eliminate_heat_pump_fan_low_heat_pump_fan_ok` | measurement:condenserFanAmps in critical|warning | `heat_pump_fan` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage120 in critical | `supply` | component | eliminate | no |
| `confirm_wash_drain_bad_washer_drain_pump_failed` | field:wash_functions.drain=bad | `washer_drain_pump` | component | confirm | no |
| `cat_up_wash_drain_bad_washer_drain_pump_failed` | field:wash_functions.drain=bad | `washer_drain` | category | +35 | no |
| `eliminate_wash_drain_bad_washer_drain_pump_ok` | field:wash_functions.drain=bad | `washer_drain_pump` | component | eliminate | no |
| `confirm_wash_spin_bad_washer_motor_failed` | field:wash_functions.spin=bad | `washer_motor` | component | confirm | no |
| `cat_up_wash_spin_bad_washer_motor_failed` | field:wash_functions.spin=bad | `washer_drive` | category | +35 | no |
| `eliminate_wash_spin_bad_washer_motor_ok` | field:wash_functions.spin=bad | `washer_motor` | component | eliminate | no |
| `confirm_wash_agitate_bad_washer_motor_failed` | field:wash_functions.agitate=bad | `washer_motor` | component | confirm | no |
| `cat_up_wash_agitate_bad_washer_motor_failed` | field:wash_functions.agitate=bad | `washer_drive` | category | +35 | no |
| `eliminate_wash_agitate_bad_washer_motor_ok` | field:wash_functions.agitate=bad | `washer_motor` | component | eliminate | no |
| `confirm_no_heat_dry_compressor_failed` | field:dry_functions.heat_present=no | `compressor` | component | confirm | no |
| `cat_up_no_heat_dry_compressor_failed` | field:dry_functions.heat_present=no | `heat_pump` | category | +35 | no |
| `confirm_no_heat_dry_heat_pump_fan_failed` | field:dry_functions.heat_present=no | `heat_pump_fan` | component | confirm | no |
| `cat_up_no_heat_dry_heat_pump_fan_failed` | field:dry_functions.heat_present=no | `heat_pump_airflow` | category | +35 | no |
| `eliminate_no_heat_dry_compressor_ok` | field:dry_functions.heat_present=no | `compressor` | component | eliminate | no |
| `confirm_dry_airflow_bad_filter_airflow_restricted` | field:dry_functions.airflow=bad | `filter_airflow` | component | confirm | no |
| `cat_up_dry_airflow_bad_filter_airflow_restricted` | field:dry_functions.airflow=bad | `heat_pump_airflow` | category | +35 | no |
| `confirm_dry_airflow_bad_heat_pump_fan_failed` | field:dry_functions.airflow=bad | `heat_pump_fan` | component | confirm | no |
| `cat_up_dry_airflow_bad_heat_pump_fan_failed` | field:dry_functions.airflow=bad | `heat_pump_airflow` | category | +35 | no |
| `eliminate_dry_airflow_bad_filter_airflow_ok` | field:dry_functions.airflow=bad | `filter_airflow` | component | eliminate | no |
| `eliminate_dry_airflow_bad_heat_pump_fan_ok` | field:dry_functions.airflow=bad | `heat_pump_fan` | component | eliminate | no |
| `confirm_condensate_bad_condensate_failed` | field:dry_functions.condensate_drain=bad | `condensate` | component | confirm | no |
| `cat_up_condensate_bad_condensate_failed` | field:dry_functions.condensate_drain=bad | `condensate` | category | +35 | no |
| `eliminate_condensate_bad_condensate_ok` | field:dry_functions.condensate_drain=bad | `condensate` | component | eliminate | no |
| `chip_washer_drain_washer_drain` | chip:washer_drain | `washer_drain` | category | +22 | no |
| `chip_washer_drain_condensate` | chip:washer_drain | `condensate` | category | +22 | no |
| `chip_washer_spin_washer_drive` | chip:washer_spin | `washer_drive` | category | +22 | no |
| `chip_dryer_no_heat_heat_pump` | chip:dryer_no_heat | `heat_pump` | category | +22 | no |
| `chip_dryer_no_heat_heat_pump_airflow` | chip:dryer_no_heat | `heat_pump_airflow` | category | +22 | no |
| `chip_heat_pump_dry_heat_pump_airflow` | chip:heat_pump_dry | `heat_pump_airflow` | category | +22 | no |
| `chip_heat_pump_dry_heat_pump` | chip:heat_pump_dry | `heat_pump` | category | +22 | no |
| `chip_condensate_condensate` | chip:condensate | `condensate` | category | +22 | no |
| `chip_condensate_washer_drain` | chip:condensate | `washer_drain` | category | +22 | no |
| `chip_compressor_heat_pump` | chip:compressor | `heat_pump` | category | +22 | no |
| `al_ms_001_washer_drain_drain_bad` | chip:washer_drain AND field:wash_functions.drain=bad | `washer_drain_pump` | component | confirm | **yes** |
| `al_ms_002_washer_drain_pump_ol` | chip:washer_drain AND measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | confirm | **yes** |
| `al_ms_003_washer_spin_spin_bad` | chip:washer_spin AND field:wash_functions.spin=bad | `washer_motor` | component | confirm | **yes** |
| `al_ms_004_washer_spin_motor_ol` | chip:washer_spin AND measurement:washerMotorWindingOhms in critical | `washer_motor` | component | confirm | **yes** |
| `al_ms_005_drain_bad_pump_ol` | field:wash_functions.drain=bad AND measurement:washerDrainPumpOhms in critical | `washer_drain_pump` | component | confirm | **yes** |
| `al_ms_006_heat_pump_dry_airflow_bad` | chip:heat_pump_dry AND field:dry_functions.airflow=bad | `filter_airflow` | component | confirm | **yes** |
| `al_ms_007_heat_pump_dry_heat_no` | chip:heat_pump_dry AND field:dry_functions.heat_present=no | `compressor` | component | confirm | **yes** |
| `al_ms_008_dryer_no_heat_compressor_low` | chip:dryer_no_heat AND measurement:compressorRunAmps in critical|warning | `compressor` | component | confirm | **yes** |
| `al_ms_009_compressor_chip_winding_ol` | chip:compressor AND measurement:compressorRunWindingOhms in critical | `compressor` | component | confirm | **yes** |
| `al_ms_010_condensate_drain_bad` | chip:condensate AND field:dry_functions.condensate_drain=bad | `condensate` | component | confirm | **yes** |
| `al_ms_011_condensate_pump_ol` | chip:condensate AND measurement:washerDrainPumpOhms in critical | `condensate` | component | confirm | **yes** |
| `al_ms_012_heat_pump_dry_fan_low` | chip:heat_pump_dry AND measurement:condenserFanAmps in critical|warning | `heat_pump_fan` | component | confirm | **yes** |
| `al_ms_013_compressor_chip_low_amps` | chip:compressor AND measurement:compressorRunAmps in critical|warning | `sealed_system` | component | confirm | **yes** |
| `al_ms_014_no_power_supply_critical` | chip:no_power AND measurement:supplyVoltage120 in critical | `supply` | component | confirm | **yes** |

### Existing multi-signal rules (do not duplicate)

- `al_ms_001_washer_drain_drain_bad`: chip:washer_drain AND field:wash_functions.drain=bad → `washer_drain_pump` (Washer won't drain with failed drain — pump or clog path.)
- `al_ms_002_washer_drain_pump_ol`: chip:washer_drain AND measurement:washerDrainPumpOhms in critical → `washer_drain_pump` (Drain complaint with pump open — drain pump failure confirmed.)
- `al_ms_003_washer_spin_spin_bad`: chip:washer_spin AND field:wash_functions.spin=bad → `washer_motor` (Won't spin with failed spin cycle — drive motor path.)
- `al_ms_004_washer_spin_motor_ol`: chip:washer_spin AND measurement:washerMotorWindingOhms in critical → `washer_motor` (Spin complaint with wash motor open — motor failure confirmed.)
- `al_ms_005_drain_bad_pump_ol`: field:wash_functions.drain=bad AND measurement:washerDrainPumpOhms in critical → `washer_drain_pump` (Failed drain with pump open — replace drain pump.)
- `al_ms_006_heat_pump_dry_airflow_bad`: chip:heat_pump_dry AND field:dry_functions.airflow=bad → `filter_airflow` (Heat-pump not drying with poor airflow — filter or condenser path.)
- `al_ms_007_heat_pump_dry_heat_no`: chip:heat_pump_dry AND field:dry_functions.heat_present=no → `compressor` (Not drying with no heat — compressor or sealed system path.)
- `al_ms_008_dryer_no_heat_compressor_low`: chip:dryer_no_heat AND measurement:compressorRunAmps in critical|warning → `compressor` (No heat with abnormal compressor amps — start or sealed system issue.)
- `al_ms_009_compressor_chip_winding_ol`: chip:compressor AND measurement:compressorRunWindingOhms in critical → `compressor` (Compressor complaint with windings open — compressor failure confirmed.)
- `al_ms_010_condensate_drain_bad`: chip:condensate AND field:dry_functions.condensate_drain=bad → `condensate` (Condensate complaint with failed drain — pump or coin trap path.)
- `al_ms_011_condensate_pump_ol`: chip:condensate AND measurement:washerDrainPumpOhms in critical → `condensate` (Condensate issue with drain pump open — shared pump failure.)
- `al_ms_012_heat_pump_dry_fan_low`: chip:heat_pump_dry AND measurement:condenserFanAmps in critical|warning → `heat_pump_fan` (Not drying with low condenser fan amps — fan motor path.)
- `al_ms_013_compressor_chip_low_amps`: chip:compressor AND measurement:compressorRunAmps in critical|warning → `sealed_system` (Compressor complaint with abnormal run amps — sealed system or start issue.)
- `al_ms_014_no_power_supply_critical`: chip:no_power AND measurement:supplyVoltage120 in critical → `supply` (Dead unit with supply voltage out of range — outlet or breaker path.)
