# Signal inventory — electric_range

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `no_bake` | No Bake / Oven Not Heating | `electric_range/electricRangeComplaints.ts` | chip | Yes (multi-select) | |
| `no_broil` | No Broil | `electric_range/electricRangeComplaints.ts` | chip | Yes (multi-select) | |
| `surface_burners` | Surface Burner Issue | `electric_range/electricRangeComplaints.ts` | chip | Yes (multi-select) | |
| `uneven_heat` | Uneven / Wrong Temperature | `electric_range/electricRangeComplaints.ts` | chip | Yes (multi-select) | |
| `no_power` | Dead / No Power | `electric_range/electricRangeComplaints.ts` | chip | Yes (multi-select) | |
| `error_code` | Error Code on Display | `electric_range/electricRangeComplaints.ts` | chip | Yes (multi-select) | |
| `self_clean` | Self-Clean / Door Lock | `electric_range/electricRangeComplaints.ts` | chip | Yes (multi-select) | |

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
| `commonly_missed.incoming_voltage` | Incoming voltage verified | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.miswired_outlet` | Miswired outlet / receptacle | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.terminal_burn` | Burnt terminal block / loose lugs | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.calibration` | Calibration / offset checked | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.cookware` | Customer cookware concerns | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `visual_inspection.terminal_block` | Terminal Block Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.wiring_condition` | Wiring / Harness Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.door_seal` | Door Seal Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.bake_element_visible` | Bake Element (visible damage) | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.broil_element_visible` | Broil Element (visible damage) | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `functional_checks.bake_operation` | Bake Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.broil_operation` | Broil Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.convection_operation` | Convection Operation | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.surface_burners` | Surface Burners (if equipped) | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.door_lock_operation` | Door Lock / Self-Clean Lock | gb | good, bad | `functional_checks` | always when step enabled | — |
| `terminal_block_readings.l1_l2_voltage` | L1–L2 at block (V) | text | free text / numeric | `terminal_block_readings` | always when step enabled | `supplyVoltage240` |
| `terminal_block_readings.l1_neutral_voltage` | L1–Neutral (V) | text | free text / numeric | `terminal_block_readings` | always when step enabled | `supplyVoltage120` |
| `terminal_block_readings.l2_neutral_voltage` | L2–Neutral (V) | text | free text / numeric | `terminal_block_readings` | always when step enabled | `supplyVoltage120` |
| `terminal_block_readings.neutral_ground_voltage` | Neutral–Ground (V) | text | free text / numeric | `terminal_block_readings` | always when step enabled | `neutralGroundVoltage` |
| `terminal_block_readings.supply_notes` | Supply / wiring notes | text | free text / numeric | `terminal_block_readings` | always when step enabled | — |
| `element_sensor_readings.bake_element_ohms` | Bake element resistance (Ω) | text | free text / numeric | `element_sensor_readings` | always when step enabled | `bakeElementOhms` |
| `element_sensor_readings.broil_element_ohms` | Broil element resistance (Ω) | text | free text / numeric | `element_sensor_readings` | always when step enabled | `broilElementOhms` |
| `element_sensor_readings.bake_element_amps` | Bake element amps (energized) | text | free text / numeric | `element_sensor_readings` | always when step enabled | `electricRangeElementAmps` |
| `element_sensor_readings.broil_element_amps` | Broil element amps (energized) | text | free text / numeric | `element_sensor_readings` | always when step enabled | `electricRangeElementAmps` |
| `element_sensor_readings.temp_sensor_ohms` | Oven temp sensor (Ω at room) | text | free text / numeric | `element_sensor_readings` | always when step enabled | `ovenTempSensorOhms` |
| `board_readings.board_supply_voltage` | Board supply voltage (V) | text | free text / numeric | `board_readings` | always when step enabled | `supplyVoltage240` |
| `board_readings.bake_relay_output` | Bake relay output / bake leg (V when on) | text | free text / numeric | `board_readings` | always when step enabled | `supplyVoltage240` |
| `board_readings.broil_relay_output` | Broil relay output / broil leg (V when on) | text | free text / numeric | `board_readings` | always when step enabled | `supplyVoltage240` |
| `board_readings.convection_output` | Convection motor / relay (V or amps) | text | free text / numeric | `board_readings` | always when step enabled | `convectionFanMotorAmps` |
| `board_readings.oven_temp_at_probe` | Oven temp at center probe (°F) | text | free text / numeric | `board_readings` | always when step enabled | — |
| `board_readings.board_notes` | Board test points / relay notes | textarea | free text | `board_readings` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `bakeElementOhms` | Bake Element Resistance | Ω | normal 15-40 | warning 10-50 | critical <3 or >70 | element_sensor_readings.bake_element_ohms | normal, warning, critical |
| `broilElementOhms` | Broil Element Resistance | Ω | normal 15-40 | warning 10-50 | critical <3 or >70 | element_sensor_readings.broil_element_ohms | normal, warning, critical |
| `convectionFanMotorAmps` | Convection Fan Motor Amperage | A | normal 0.3-1.2 | warning 0.15-1.8 | critical <0.05 or >2.5 | board_readings.convection_output | normal, warning, critical |
| `electricRangeElementAmps` | Electric Range Element Amperage (Single Element) | A | normal 7-18 | warning 4-22 | critical <1 or >28 | element_sensor_readings.bake_element_amps, element_sensor_readings.broil_element_amps | normal, warning, critical |
| `neutralGroundVoltage` | Neutral-to-Ground Voltage | V | normal 0-2 | warning 0-5 | critical <0 or >8 | terminal_block_readings.neutral_ground_voltage | normal, warning, critical |
| `ovenTempSensorOhms` | Oven Temperature Sensor (RTD) Resistance | Ω | normal 1000-1200 | warning 900-1300 | critical <500 or >2000 | element_sensor_readings.temp_sensor_ohms | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | terminal_block_readings.l1_neutral_voltage, terminal_block_readings.l2_neutral_voltage | normal, warning, critical |
| `supplyVoltage240` | Supply Voltage (240 VAC) | V | normal 220-250 | warning 210-260 | critical <200 or >270 | terminal_block_readings.l1_l2_voltage, board_readings.board_supply_voltage, board_readings.bake_relay_output, board_readings.broil_relay_output | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `bake_element_ok` | Bake element OK | `bake_element` | `bake_element_failed` |
| `bake_element_failed` | Bake element failed | `bake_element` | `bake_element_ok` |
| `broil_element_ok` | Broil element OK | `broil_element` | `broil_element_failed` |
| `broil_element_failed` | Broil element failed | `broil_element` | `broil_element_ok` |
| `temp_sensor_ok` | Oven temp sensor OK | `temp_sensor` | `temp_sensor_failed` |
| `temp_sensor_failed` | Oven temp sensor failed | `temp_sensor` | `temp_sensor_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / wiring issue | `electrical_supply` | `supply_ok` |
| `convection_fan_ok` | Convection fan OK | `convection` | `convection_fan_failed` |
| `convection_fan_failed` | Convection fan failed | `convection` | `convection_fan_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `bake_element_ol` | measurement:bakeElementOhms in critical | `bake_element_ok` | `bake_element_failed` | — |
| `bake_element_normal` | measurement:bakeElementOhms in normal | `bake_element_failed` | `bake_element_ok` | — |
| `broil_element_ol` | measurement:broilElementOhms in critical | `broil_element_ok` | `broil_element_failed` | — |
| `broil_element_normal` | measurement:broilElementOhms in normal | `broil_element_failed` | `broil_element_ok` | — |
| `temp_sensor_bad` | measurement:ovenTempSensorOhms in critical|warning | `temp_sensor_ok` | `temp_sensor_failed` | — |
| `temp_sensor_normal` | measurement:ovenTempSensorOhms in normal | `temp_sensor_failed` | `temp_sensor_ok` | — |
| `l1_l2_critical` | measurement:supplyVoltage240 in critical | `supply_ok` | `supply_fault` | — |
| `neutral_ground_bad` | measurement:neutralGroundVoltage in critical|warning | `supply_ok` | `supply_fault` | — |
| `bake_bad` | field:functional_checks.bake_operation=bad | `bake_element_ok` | `bake_element_failed` | — |
| `broil_bad` | field:functional_checks.broil_operation=bad | `broil_element_ok` | `broil_element_failed` | — |
| `convection_bad` | field:functional_checks.convection_operation=bad | `convection_fan_ok` | `convection_fan_failed` | — |
| `no_bake_chip` | chip:no_bake | — | — | `bake_element_failed`, `temp_sensor_failed`, `supply_fault` |
| `no_broil_chip` | chip:no_broil | — | — | `broil_element_failed` |
| `uneven_heat_chip` | chip:uneven_heat | — | — | `temp_sensor_failed` |

## 5. Existing evidence rules

Total: **41** (41 single-signal, 0 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_bake_element_ol_bake_element_failed` | measurement:bakeElementOhms in critical | `bake_element` | component | confirm | no |
| `cat_up_bake_element_ol_bake_element_failed` | measurement:bakeElementOhms in critical | `bake_element` | category | +38 | no |
| `eliminate_bake_element_ol_bake_element_ok` | measurement:bakeElementOhms in critical | `bake_element` | component | eliminate | no |
| `confirm_bake_element_normal_bake_element_ok` | measurement:bakeElementOhms in normal | `bake_element` | component | confirm | no |
| `cat_down_bake_element_normal_bake_element_ok` | measurement:bakeElementOhms in normal | `bake_element` | category | decrease | no |
| `eliminate_bake_element_normal_bake_element_failed` | measurement:bakeElementOhms in normal | `bake_element` | component | eliminate | no |
| `cat_unlikely_bake_element_normal_bake_element_failed` | measurement:bakeElementOhms in normal | `bake_element` | category | unlikely | no |
| `confirm_broil_element_ol_broil_element_failed` | measurement:broilElementOhms in critical | `broil_element` | component | confirm | no |
| `cat_up_broil_element_ol_broil_element_failed` | measurement:broilElementOhms in critical | `broil_element` | category | +38 | no |
| `eliminate_broil_element_ol_broil_element_ok` | measurement:broilElementOhms in critical | `broil_element` | component | eliminate | no |
| `confirm_broil_element_normal_broil_element_ok` | measurement:broilElementOhms in normal | `broil_element` | component | confirm | no |
| `cat_down_broil_element_normal_broil_element_ok` | measurement:broilElementOhms in normal | `broil_element` | category | decrease | no |
| `eliminate_broil_element_normal_broil_element_failed` | measurement:broilElementOhms in normal | `broil_element` | component | eliminate | no |
| `cat_unlikely_broil_element_normal_broil_element_failed` | measurement:broilElementOhms in normal | `broil_element` | category | unlikely | no |
| `confirm_temp_sensor_bad_temp_sensor_failed` | measurement:ovenTempSensorOhms in critical|warning | `temp_sensor` | component | confirm | no |
| `cat_up_temp_sensor_bad_temp_sensor_failed` | measurement:ovenTempSensorOhms in critical|warning | `temp_sensor` | category | +38 | no |
| `eliminate_temp_sensor_bad_temp_sensor_ok` | measurement:ovenTempSensorOhms in critical|warning | `temp_sensor` | component | eliminate | no |
| `confirm_temp_sensor_normal_temp_sensor_ok` | measurement:ovenTempSensorOhms in normal | `temp_sensor` | component | confirm | no |
| `cat_down_temp_sensor_normal_temp_sensor_ok` | measurement:ovenTempSensorOhms in normal | `temp_sensor` | category | decrease | no |
| `eliminate_temp_sensor_normal_temp_sensor_failed` | measurement:ovenTempSensorOhms in normal | `temp_sensor` | component | eliminate | no |
| `cat_unlikely_temp_sensor_normal_temp_sensor_failed` | measurement:ovenTempSensorOhms in normal | `temp_sensor` | category | unlikely | no |
| `confirm_l1_l2_critical_supply_fault` | measurement:supplyVoltage240 in critical | `supply` | component | confirm | no |
| `cat_up_l1_l2_critical_supply_fault` | measurement:supplyVoltage240 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_l1_l2_critical_supply_ok` | measurement:supplyVoltage240 in critical | `supply` | component | eliminate | no |
| `confirm_neutral_ground_bad_supply_fault` | measurement:neutralGroundVoltage in critical|warning | `supply` | component | confirm | no |
| `cat_up_neutral_ground_bad_supply_fault` | measurement:neutralGroundVoltage in critical|warning | `electrical_supply` | category | +38 | no |
| `eliminate_neutral_ground_bad_supply_ok` | measurement:neutralGroundVoltage in critical|warning | `supply` | component | eliminate | no |
| `confirm_bake_bad_bake_element_failed` | field:functional_checks.bake_operation=bad | `bake_element` | component | confirm | no |
| `cat_up_bake_bad_bake_element_failed` | field:functional_checks.bake_operation=bad | `bake_element` | category | +35 | no |
| `eliminate_bake_bad_bake_element_ok` | field:functional_checks.bake_operation=bad | `bake_element` | component | eliminate | no |
| `confirm_broil_bad_broil_element_failed` | field:functional_checks.broil_operation=bad | `broil_element` | component | confirm | no |
| `cat_up_broil_bad_broil_element_failed` | field:functional_checks.broil_operation=bad | `broil_element` | category | +35 | no |
| `eliminate_broil_bad_broil_element_ok` | field:functional_checks.broil_operation=bad | `broil_element` | component | eliminate | no |
| `confirm_convection_bad_convection_fan_failed` | field:functional_checks.convection_operation=bad | `convection_fan` | component | confirm | no |
| `cat_up_convection_bad_convection_fan_failed` | field:functional_checks.convection_operation=bad | `convection` | category | +35 | no |
| `eliminate_convection_bad_convection_fan_ok` | field:functional_checks.convection_operation=bad | `convection_fan` | component | eliminate | no |
| `chip_no_bake_bake_element` | chip:no_bake | `bake_element` | category | +22 | no |
| `chip_no_bake_temp_sensor` | chip:no_bake | `temp_sensor` | category | +22 | no |
| `chip_no_bake_electrical_supply` | chip:no_bake | `electrical_supply` | category | +22 | no |
| `chip_no_broil_broil_element` | chip:no_broil | `broil_element` | category | +22 | no |
| `chip_uneven_heat_temp_sensor` | chip:uneven_heat | `temp_sensor` | category | +22 | no |
