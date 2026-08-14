# Signal inventory — dishwasher

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `not_cleaning` | Not Cleaning / Dirty Dishes | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |
| `wont_drain` | Won't Drain | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |
| `leaking` | Leaking Water | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |
| `no_fill` | Won't Fill | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |
| `no_heat_dry` | Not Drying / No Heat | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Grinding | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |
| `wont_start` | Dead / Won't Start | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code on Display | `dishwasher/dishwasherComplaints.ts` | chip | Yes (multi-select) | |

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
| `commonly_missed.disposal_knockout` | Garbage disposal knockout | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.drain_restrictions` | Drain / air gap restrictions | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.detergent_usage` | Customer detergent / rinse aid | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.water_temperature` | Hot water at sink (120°F+) | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.inlet_screen` | Inlet valve screen | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `visual_inspection.spray_arms_clear` | Spray Arms Clear | yn | yes, no | `visual_inspection` | always when step enabled | — |
| `visual_inspection.filter_condition` | Filter Condition | gb | good, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.drain_path_clear` | Drain Path Clear | yn | yes, no | `visual_inspection` | always when step enabled | — |
| `visual_inspection.leak_present` | Leak Present | yn | yes, no | `visual_inspection` | always when step enabled | — |
| `visual_inspection.door_gasket` | Door Gasket / Tub Seal | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `functional_checks.fill_operation` | Fill Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.wash_operation` | Wash Operation (circulation) | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.drain_operation` | Drain Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.drying_operation` | Drying / Heat Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.detergent_dispenser` | Detergent / rinse dispenser | gb | good, bad | `functional_checks` | always when step enabled | — |
| `heat_water.incoming_water_temp` | Incoming water temp (°F) | text | free text / numeric | `heat_water` | always when step enabled | `dishwasherIncomingWaterTemp` |
| `heat_water.heater_ohms` | Heater resistance (Ω) | text | free text / numeric | `heat_water` | always when step enabled | `dishwasherHeatingElementOhms` |
| `heat_water.heater_amps` | Heater amps (energized) | text | free text / numeric | `heat_water` | always when step enabled | `dishwasherHeaterAmps` |
| `heat_water.thermistor` | Thermistor / OWI (Ω) | text | free text / numeric | `heat_water` | always when step enabled | `dishwasherTubThermistorOhms` |
| `motor_electrical.supply_voltage` | Supply voltage (V) | text | free text / numeric | `motor_electrical` | always when step enabled | `supplyVoltage120` |
| `motor_electrical.wash_motor_ohms` | Wash / circulation motor (Ω) | text | free text / numeric | `motor_electrical` | always when step enabled | `dishwasherCirculationPumpOhms` |
| `motor_electrical.drain_motor_ohms` | Drain motor (Ω) | text | free text / numeric | `motor_electrical` | always when step enabled | `dishwasherDrainPumpOhms` |
| `motor_electrical.inlet_valve_ohms` | Inlet valve coil(s) (Ω) | text | free text / numeric | `motor_electrical` | always when step enabled | `dishwasherWaterValveOhms` |
| `motor_electrical.float_switch` | Float switch / leak sensor | text | free text / numeric | `motor_electrical` | always when step enabled | `dishwasherFloatSwitchOhms` |
| `motor_electrical.board_notes` | Control board / diverter notes | textarea | free text | `motor_electrical` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `dishwasherCirculationPumpOhms` | Dishwasher Circulation Pump Winding Resistance | Ω | normal 5-80 | warning 2-120 | critical <0.5 or >200 | motor_electrical.wash_motor_ohms | normal, warning, critical |
| `dishwasherDrainPumpOhms` | Dishwasher Drain Pump Winding Resistance | Ω | normal 20-200 | warning 10-300 | critical <2 or >500 | motor_electrical.drain_motor_ohms | normal, warning, critical |
| `dishwasherFloatSwitchOhms` | Dishwasher Float Switch / Leak Sensor Continuity | Ω | normal 0-5 | warning 0-20 | critical <0 or >50 | motor_electrical.float_switch | normal, warning, critical |
| `dishwasherHeaterAmps` | Dishwasher Heating Element Amperage | A | normal 5-12 | warning 3-14 | critical <1 or >16 | heat_water.heater_amps | normal, warning, critical |
| `dishwasherHeatingElementOhms` | Dishwasher Heating Element Resistance | Ω | normal 15-30 | warning 10-40 | critical <3 or >60 | heat_water.heater_ohms | normal, warning, critical |
| `dishwasherIncomingWaterTemp` | Dishwasher Incoming Hot Water Temperature | °F | normal 110-140 | warning 100-150 | critical <90 or >160 | heat_water.incoming_water_temp | normal, warning, critical |
| `dishwasherTubThermistorOhms` | Dishwasher Tub Thermistor / OWI Resistance | Ω | normal 5000-20000 | warning 2000-40000 | critical <500 or >80000 | heat_water.thermistor | normal, warning, critical |
| `dishwasherWaterValveOhms` | Dishwasher Water Inlet Valve Coil Resistance | Ω | normal 200-900 | warning 150-1200 | critical <20 or >1500 | motor_electrical.inlet_valve_ohms | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | motor_electrical.supply_voltage | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `inlet_valve_ok` | Inlet valve OK | `fill_supply` | `inlet_valve_failed` |
| `inlet_valve_failed` | Inlet valve failed | `fill_supply` | `inlet_valve_ok` |
| `drain_pump_ok` | Drain pump OK | `drain_pump` | `drain_pump_failed` |
| `drain_pump_failed` | Drain pump failed | `drain_pump` | `drain_pump_ok` |
| `circulation_pump_ok` | Circulation pump OK | `wash_circuit` | `circulation_pump_failed` |
| `circulation_pump_failed` | Circulation pump failed | `wash_circuit` | `circulation_pump_ok` |
| `heater_ok` | Heating element OK | `heat_dry` | `heater_failed` |
| `heater_failed` | Heating element failed | `heat_dry` | `heater_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |
| `door_gasket_ok` | Door gasket / seal OK | `door_seal` | `door_gasket_fault` |
| `door_gasket_fault` | Door gasket / seal fault | `door_seal` | `door_gasket_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `heater_ol` | measurement:dishwasherHeatingElementOhms in critical | `heater_ok` | `heater_failed` | — |
| `heater_normal` | measurement:dishwasherHeatingElementOhms in normal | `heater_failed` | `heater_ok` | — |
| `heater_low_amps` | measurement:dishwasherHeaterAmps in critical|warning | `heater_ok` | `heater_failed` | — |
| `inlet_valve_ol` | measurement:dishwasherWaterValveOhms in critical | `inlet_valve_ok` | `inlet_valve_failed` | — |
| `drain_pump_ol` | measurement:dishwasherDrainPumpOhms in critical | `drain_pump_ok` | `drain_pump_failed` | — |
| `circulation_pump_ol` | measurement:dishwasherCirculationPumpOhms in critical | `circulation_pump_ok` | `circulation_pump_failed` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `low_incoming_water` | measurement:dishwasherIncomingWaterTemp in critical|warning | — | — | `heater_failed` |
| `drain_bad` | field:functional_checks.drain_operation=bad | `drain_pump_ok` | `drain_pump_failed` | — |
| `wash_bad` | field:functional_checks.wash_operation=bad | `circulation_pump_ok` | `circulation_pump_failed` | — |
| `dry_bad` | field:functional_checks.drying_operation=bad | `heater_ok` | `heater_failed` | — |
| `fill_bad` | field:functional_checks.fill_operation=bad | `inlet_valve_ok` | `inlet_valve_failed` | — |
| `gasket_bad` | field:visual_inspection.door_gasket=bad | `door_gasket_ok` | `door_gasket_fault` | — |
| `leak_yes` | field:visual_inspection.leak_present=yes | — | — | `door_gasket_fault`, `inlet_valve_failed` |
| `wont_drain_chip` | chip:wont_drain | — | — | `drain_pump_failed` |
| `no_heat_dry_chip` | chip:no_heat_dry | — | — | `heater_failed` |
| `no_fill_chip` | chip:no_fill | — | — | `inlet_valve_failed` |
| `not_cleaning_chip` | chip:not_cleaning | — | — | `circulation_pump_failed` |

## 5. Existing evidence rules

Total: **44** (44 single-signal, 0 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_heater_ol_heater_failed` | measurement:dishwasherHeatingElementOhms in critical | `heater` | component | confirm | no |
| `cat_up_heater_ol_heater_failed` | measurement:dishwasherHeatingElementOhms in critical | `heat_dry` | category | +38 | no |
| `eliminate_heater_ol_heater_ok` | measurement:dishwasherHeatingElementOhms in critical | `heater` | component | eliminate | no |
| `confirm_heater_normal_heater_ok` | measurement:dishwasherHeatingElementOhms in normal | `heater` | component | confirm | no |
| `cat_down_heater_normal_heater_ok` | measurement:dishwasherHeatingElementOhms in normal | `heat_dry` | category | decrease | no |
| `eliminate_heater_normal_heater_failed` | measurement:dishwasherHeatingElementOhms in normal | `heater` | component | eliminate | no |
| `cat_unlikely_heater_normal_heater_failed` | measurement:dishwasherHeatingElementOhms in normal | `heat_dry` | category | unlikely | no |
| `confirm_heater_low_amps_heater_failed` | measurement:dishwasherHeaterAmps in critical|warning | `heater` | component | confirm | no |
| `cat_up_heater_low_amps_heater_failed` | measurement:dishwasherHeaterAmps in critical|warning | `heat_dry` | category | +38 | no |
| `eliminate_heater_low_amps_heater_ok` | measurement:dishwasherHeaterAmps in critical|warning | `heater` | component | eliminate | no |
| `confirm_inlet_valve_ol_inlet_valve_failed` | measurement:dishwasherWaterValveOhms in critical | `inlet_valve` | component | confirm | no |
| `cat_up_inlet_valve_ol_inlet_valve_failed` | measurement:dishwasherWaterValveOhms in critical | `fill_supply` | category | +38 | no |
| `eliminate_inlet_valve_ol_inlet_valve_ok` | measurement:dishwasherWaterValveOhms in critical | `inlet_valve` | component | eliminate | no |
| `confirm_drain_pump_ol_drain_pump_failed` | measurement:dishwasherDrainPumpOhms in critical | `drain_pump` | component | confirm | no |
| `cat_up_drain_pump_ol_drain_pump_failed` | measurement:dishwasherDrainPumpOhms in critical | `drain_pump` | category | +38 | no |
| `eliminate_drain_pump_ol_drain_pump_ok` | measurement:dishwasherDrainPumpOhms in critical | `drain_pump` | component | eliminate | no |
| `confirm_circulation_pump_ol_circulation_pump_failed` | measurement:dishwasherCirculationPumpOhms in critical | `circulation_pump` | component | confirm | no |
| `cat_up_circulation_pump_ol_circulation_pump_failed` | measurement:dishwasherCirculationPumpOhms in critical | `wash_circuit` | category | +38 | no |
| `eliminate_circulation_pump_ol_circulation_pump_ok` | measurement:dishwasherCirculationPumpOhms in critical | `circulation_pump` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage120 in critical | `supply` | component | eliminate | no |
| `suspect_low_incoming_water_heater_failed` | measurement:dishwasherIncomingWaterTemp in critical|warning | `heat_dry` | category | +18 | no |
| `confirm_drain_bad_drain_pump_failed` | field:functional_checks.drain_operation=bad | `drain_pump` | component | confirm | no |
| `cat_up_drain_bad_drain_pump_failed` | field:functional_checks.drain_operation=bad | `drain_pump` | category | +35 | no |
| `eliminate_drain_bad_drain_pump_ok` | field:functional_checks.drain_operation=bad | `drain_pump` | component | eliminate | no |
| `confirm_wash_bad_circulation_pump_failed` | field:functional_checks.wash_operation=bad | `circulation_pump` | component | confirm | no |
| `cat_up_wash_bad_circulation_pump_failed` | field:functional_checks.wash_operation=bad | `wash_circuit` | category | +35 | no |
| `eliminate_wash_bad_circulation_pump_ok` | field:functional_checks.wash_operation=bad | `circulation_pump` | component | eliminate | no |
| `confirm_dry_bad_heater_failed` | field:functional_checks.drying_operation=bad | `heater` | component | confirm | no |
| `cat_up_dry_bad_heater_failed` | field:functional_checks.drying_operation=bad | `heat_dry` | category | +35 | no |
| `eliminate_dry_bad_heater_ok` | field:functional_checks.drying_operation=bad | `heater` | component | eliminate | no |
| `confirm_fill_bad_inlet_valve_failed` | field:functional_checks.fill_operation=bad | `inlet_valve` | component | confirm | no |
| `cat_up_fill_bad_inlet_valve_failed` | field:functional_checks.fill_operation=bad | `fill_supply` | category | +35 | no |
| `eliminate_fill_bad_inlet_valve_ok` | field:functional_checks.fill_operation=bad | `inlet_valve` | component | eliminate | no |
| `confirm_gasket_bad_door_gasket_fault` | field:visual_inspection.door_gasket=bad | `door_gasket` | component | confirm | no |
| `cat_up_gasket_bad_door_gasket_fault` | field:visual_inspection.door_gasket=bad | `door_seal` | category | +35 | no |
| `eliminate_gasket_bad_door_gasket_ok` | field:visual_inspection.door_gasket=bad | `door_gasket` | component | eliminate | no |
| `suspect_leak_yes_door_gasket_fault` | field:visual_inspection.leak_present=yes | `door_seal` | category | +18 | no |
| `suspect_leak_yes_inlet_valve_failed` | field:visual_inspection.leak_present=yes | `fill_supply` | category | +18 | no |
| `chip_wont_drain_drain_pump` | chip:wont_drain | `drain_pump` | category | +22 | no |
| `chip_no_heat_dry_heat_dry` | chip:no_heat_dry | `heat_dry` | category | +22 | no |
| `chip_no_fill_fill_supply` | chip:no_fill | `fill_supply` | category | +22 | no |
| `chip_not_cleaning_wash_circuit` | chip:not_cleaning | `wash_circuit` | category | +22 | no |
