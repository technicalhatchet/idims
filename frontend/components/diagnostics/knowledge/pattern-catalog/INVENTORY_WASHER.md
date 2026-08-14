# Signal inventory — washer

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `leaking` | Leaking Water | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `wont_drain` | Won't Drain | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `wont_spin` | Won't Spin / Clothes Wet | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `wont_agitate` | Won't Agitate / Wash | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `no_fill` | Won't Fill / Slow Fill | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Banging | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `vibration` | Walking / Vibration | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `lid_lock` | Door / Lid Lock Issue | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code on Display | `washer/washerComplaints.ts` | chip | Yes (multi-select) | |

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
| `commonly_missed.suspension` | Suspension / shocks | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.drain_restrictions` | Drain / standpipe restrictions | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.loading_habits` | Customer loading habits | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.water_pressure` | House water pressure / supply | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.shipping_bolts` | Shipping bolts removed (new install) | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.inlet_screens` | Inlet hose screens clear | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.level` | Unit level | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `visual_inspection.suspension` | Suspension | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.tub_movement` | Tub Movement | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.hoses_condition` | Hoses / Connections | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.leak_present` | Leak Present | yn | yes, no | `visual_inspection` | always when step enabled | — |
| `visual_inspection.drive_belt` | Belt / Pulley (if accessible) | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.door_boot` | Door boot / gasket (front load) | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `functional_checks.fill_operation` | Fill Operation (hot & cold) | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.agitation` | Agitation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.spin_operation` | Spin Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.drain_operation` | Drain Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.lid_lock_operation` | Lid / Door Lock Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.balance` | Balance / Vibration on spin | gb | good, bad | `functional_checks` | always when step enabled | — |
| `electrical_measurements.supply_voltage` | Supply voltage (V) | text | free text / numeric | `electrical_measurements` | always when step enabled | `supplyVoltage120` |
| `electrical_measurements.drive_motor_ohms` | Drive / wash motor resistance (Ω) | text | free text / numeric | `electrical_measurements` | always when step enabled | `washerMotorWindingOhms` |
| `electrical_measurements.drive_motor_amps` | Drive motor amps (agitate / spin) | text | free text / numeric | `electrical_measurements` | always when step enabled | — |
| `electrical_measurements.drain_pump_ohms` | Drain pump resistance (Ω) | text | free text / numeric | `electrical_measurements` | always when step enabled | `washerDrainPumpOhms` |
| `electrical_measurements.drain_pump_amps` | Drain pump amps | text | free text / numeric | `electrical_measurements` | always when step enabled | `washerDrainPumpAmps` |
| `electrical_measurements.inlet_valve_ohms` | Inlet valve coil(s) (Ω) | text | free text / numeric | `electrical_measurements` | always when step enabled | `washerWaterValveOhms` |
| `electrical_measurements.water_pressure` | Water pressure (PSI) | text | free text / numeric | `electrical_measurements` | always when step enabled | — |
| `mechanical_controls.shift_actuator` | Shift actuator / transmission | gb | good, bad | `mechanical_controls` | always when step enabled | — |
| `mechanical_controls.clutch` | Clutch / splutch | gb | good, bad | `mechanical_controls` | always when step enabled | — |
| `mechanical_controls.pressure_switch` | Pressure switch / hose | gb | good, bad | `mechanical_controls` | always when step enabled | — |
| `mechanical_controls.door_lock_ohms` | Door lock / latch (Ω) | text | free text / numeric | `mechanical_controls` | always when step enabled | `washerDoorLockSwitchOhms` |
| `mechanical_controls.board_notes` | Control / MCU notes | textarea | free text | `mechanical_controls` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | electrical_measurements.supply_voltage | normal, warning, critical |
| `washerDoorLockSwitchOhms` | Washer Door Lock/Switch Continuity | Ω | normal 0-5 | warning 0-20 | critical <0 or >50 | mechanical_controls.door_lock_ohms | normal, warning, critical |
| `washerDrainPumpAmps` | Washer Drain Pump Amperage | A | normal 0.3-1.5 | warning 0.15-2.2 | critical <0.05 or >3 | electrical_measurements.drain_pump_amps | normal, warning, critical |
| `washerDrainPumpOhms` | Washer Drain Pump Winding Resistance | Ω | normal 20-200 | warning 10-300 | critical <2 or >500 | electrical_measurements.drain_pump_ohms | normal, warning, critical |
| `washerMotorWindingOhms` | Washer Drive Motor Winding Resistance | Ω | normal 1-30 | warning 0.5-45 | critical <0.1 or >70 | electrical_measurements.drive_motor_ohms | normal, warning, critical |
| `washerWaterValveOhms` | Washer Water Inlet Valve Coil Resistance | Ω | normal 150-500 | warning 100-700 | critical <20 or >1000 | electrical_measurements.inlet_valve_ohms | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `drain_pump_ok` | Drain pump OK | `drain_pump` | `drain_pump_failed` |
| `drain_pump_failed` | Drain pump failed | `drain_pump` | `drain_pump_ok` |
| `inlet_valve_ok` | Inlet valve OK | `fill_supply` | `inlet_valve_failed` |
| `inlet_valve_failed` | Inlet valve failed | `fill_supply` | `inlet_valve_ok` |
| `drive_motor_ok` | Drive motor OK | `drive_motor` | `drive_motor_failed` |
| `drive_motor_failed` | Drive motor failed | `drive_motor` | `drive_motor_ok` |
| `door_lock_ok` | Door lock OK | `door_lock` | `door_lock_failed` |
| `door_lock_failed` | Door lock failed | `door_lock` | `door_lock_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `drain_pump_ol` | measurement:washerDrainPumpOhms in critical | `drain_pump_ok` | `drain_pump_failed` | — |
| `drain_pump_low_amps` | measurement:washerDrainPumpAmps in critical|warning | `drain_pump_ok` | `drain_pump_failed` | — |
| `inlet_valve_ol` | measurement:washerWaterValveOhms in critical | `inlet_valve_ok` | `inlet_valve_failed` | — |
| `drive_motor_ol` | measurement:washerMotorWindingOhms in critical | `drive_motor_ok` | `drive_motor_failed` | — |
| `door_lock_open` | measurement:washerDoorLockSwitchOhms in critical | `door_lock_ok` | `door_lock_failed` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `drain_bad` | field:functional_checks.drain_operation=bad | `drain_pump_ok` | `drain_pump_failed` | — |
| `fill_bad` | field:functional_checks.fill_operation=bad | `inlet_valve_ok` | `inlet_valve_failed` | — |
| `spin_bad` | field:functional_checks.spin_operation=bad | `drive_motor_ok` | `drive_motor_failed` | — |
| `agitate_bad` | field:functional_checks.agitation=bad | `drive_motor_ok` | `drive_motor_failed` | — |
| `lid_lock_bad` | field:functional_checks.lid_lock_operation=bad | `door_lock_ok` | `door_lock_failed` | — |
| `wont_drain_chip` | chip:wont_drain | — | — | `drain_pump_failed` |
| `no_fill_chip` | chip:no_fill | — | — | `inlet_valve_failed` |
| `wont_spin_chip` | chip:wont_spin | — | — | `drive_motor_failed` |
| `wont_agitate_chip` | chip:wont_agitate | — | — | `drive_motor_failed` |
| `lid_lock_chip` | chip:lid_lock | — | — | `door_lock_failed` |

## 5. Existing evidence rules

Total: **38** (38 single-signal, 0 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_drain_pump_ol_drain_pump_failed` | measurement:washerDrainPumpOhms in critical | `drain_pump` | component | confirm | no |
| `cat_up_drain_pump_ol_drain_pump_failed` | measurement:washerDrainPumpOhms in critical | `drain_pump` | category | +38 | no |
| `eliminate_drain_pump_ol_drain_pump_ok` | measurement:washerDrainPumpOhms in critical | `drain_pump` | component | eliminate | no |
| `confirm_drain_pump_low_amps_drain_pump_failed` | measurement:washerDrainPumpAmps in critical|warning | `drain_pump` | component | confirm | no |
| `cat_up_drain_pump_low_amps_drain_pump_failed` | measurement:washerDrainPumpAmps in critical|warning | `drain_pump` | category | +38 | no |
| `eliminate_drain_pump_low_amps_drain_pump_ok` | measurement:washerDrainPumpAmps in critical|warning | `drain_pump` | component | eliminate | no |
| `confirm_inlet_valve_ol_inlet_valve_failed` | measurement:washerWaterValveOhms in critical | `inlet_valve` | component | confirm | no |
| `cat_up_inlet_valve_ol_inlet_valve_failed` | measurement:washerWaterValveOhms in critical | `fill_supply` | category | +38 | no |
| `eliminate_inlet_valve_ol_inlet_valve_ok` | measurement:washerWaterValveOhms in critical | `inlet_valve` | component | eliminate | no |
| `confirm_drive_motor_ol_drive_motor_failed` | measurement:washerMotorWindingOhms in critical | `drive_motor` | component | confirm | no |
| `cat_up_drive_motor_ol_drive_motor_failed` | measurement:washerMotorWindingOhms in critical | `drive_motor` | category | +38 | no |
| `eliminate_drive_motor_ol_drive_motor_ok` | measurement:washerMotorWindingOhms in critical | `drive_motor` | component | eliminate | no |
| `confirm_door_lock_open_door_lock_failed` | measurement:washerDoorLockSwitchOhms in critical | `door_lock` | component | confirm | no |
| `cat_up_door_lock_open_door_lock_failed` | measurement:washerDoorLockSwitchOhms in critical | `door_lock` | category | +38 | no |
| `eliminate_door_lock_open_door_lock_ok` | measurement:washerDoorLockSwitchOhms in critical | `door_lock` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage120 in critical | `supply` | component | eliminate | no |
| `confirm_drain_bad_drain_pump_failed` | field:functional_checks.drain_operation=bad | `drain_pump` | component | confirm | no |
| `cat_up_drain_bad_drain_pump_failed` | field:functional_checks.drain_operation=bad | `drain_pump` | category | +35 | no |
| `eliminate_drain_bad_drain_pump_ok` | field:functional_checks.drain_operation=bad | `drain_pump` | component | eliminate | no |
| `confirm_fill_bad_inlet_valve_failed` | field:functional_checks.fill_operation=bad | `inlet_valve` | component | confirm | no |
| `cat_up_fill_bad_inlet_valve_failed` | field:functional_checks.fill_operation=bad | `fill_supply` | category | +35 | no |
| `eliminate_fill_bad_inlet_valve_ok` | field:functional_checks.fill_operation=bad | `inlet_valve` | component | eliminate | no |
| `confirm_spin_bad_drive_motor_failed` | field:functional_checks.spin_operation=bad | `drive_motor` | component | confirm | no |
| `cat_up_spin_bad_drive_motor_failed` | field:functional_checks.spin_operation=bad | `drive_motor` | category | +35 | no |
| `eliminate_spin_bad_drive_motor_ok` | field:functional_checks.spin_operation=bad | `drive_motor` | component | eliminate | no |
| `confirm_agitate_bad_drive_motor_failed` | field:functional_checks.agitation=bad | `drive_motor` | component | confirm | no |
| `cat_up_agitate_bad_drive_motor_failed` | field:functional_checks.agitation=bad | `drive_motor` | category | +35 | no |
| `eliminate_agitate_bad_drive_motor_ok` | field:functional_checks.agitation=bad | `drive_motor` | component | eliminate | no |
| `confirm_lid_lock_bad_door_lock_failed` | field:functional_checks.lid_lock_operation=bad | `door_lock` | component | confirm | no |
| `cat_up_lid_lock_bad_door_lock_failed` | field:functional_checks.lid_lock_operation=bad | `door_lock` | category | +35 | no |
| `eliminate_lid_lock_bad_door_lock_ok` | field:functional_checks.lid_lock_operation=bad | `door_lock` | component | eliminate | no |
| `chip_wont_drain_drain_pump` | chip:wont_drain | `drain_pump` | category | +22 | no |
| `chip_no_fill_fill_supply` | chip:no_fill | `fill_supply` | category | +22 | no |
| `chip_wont_spin_drive_motor` | chip:wont_spin | `drive_motor` | category | +22 | no |
| `chip_wont_agitate_drive_motor` | chip:wont_agitate | `drive_motor` | category | +22 | no |
| `chip_lid_lock_door_lock` | chip:lid_lock | `door_lock` | category | +22 | no |
