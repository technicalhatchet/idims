# Diagnostic signal inventory (Batch 0)

Reference for **multi-signal pattern** authoring. Evidence rules use **AND** logic: every clause in `when` must match.

**Rigorous inventories:** [INVENTORY_REFRIGERATOR.md](./INVENTORY_REFRIGERATOR.md), [INVENTORY_STANDALONE_FREEZER.md](./INVENTORY_STANDALONE_FREEZER.md) (ID → label → source → type → values → visibility → combinability).

**Batch 1 draft patterns:** [PATTERN_CATALOG.md](./PATTERN_CATALOG.md)

**Batch 2 (dryers):** [PATTERN_CATALOG_BATCH2.md](./PATTERN_CATALOG_BATCH2.md)

**Batch 3 (washer + dishwasher):** [PATTERN_CATALOG_BATCH3.md](./PATTERN_CATALOG_BATCH3.md)

**Batch 4 (ranges):** [PATTERN_CATALOG_BATCH4.md](./PATTERN_CATALOG_BATCH4.md)

**Batch 5 (microwave):** [PATTERN_CATALOG_BATCH5.md](./PATTERN_CATALOG_BATCH5.md)

**Batch 6 (stacked + AIO laundry):** [PATTERN_CATALOG_BATCH6.md](./PATTERN_CATALOG_BATCH6.md)

Regenerate this file: `node frontend/scripts/exportSignalInventory.mjs`  
Regenerate detailed inventories: `node frontend/scripts/exportDetailedInventory.mjs [templateId ...]`

## Signal types

| Type | Evidence `when` clause | Notes |
|------|------------------------|-------|
| Complaint chip | `{ "type": "chip", "id": "<chip_id>" }` | From complaint step tags |
| Field observation | `{ "type": "field", "path": "<section>.<field>", "equals": "<value>" }` | yn/tri/chip values: `yes`/`no`, `good`/`bad`, etc. |
| Smart measurement | `{ "type": "measurement", "knowledgeId": "<id>", "statusIn": ["normal","warning","critical"] }` | Auto-evaluated numeric fields |
| Test filled | `{ "type": "test", "testId": "<id>", "filled": true }` | From test catalog |

## Templates overview

| Template | Chips | Wizard steps | Fields | Smart measurements | Evidence rules | Multi-signal rules |
|----------|-------|----------------|--------|--------------------|--------------|-------------------|
| refrigerator | 9 | 9 | 54 | 15 | 45 | 1 |
| standalone_freezer | 6 | 9 | 35 | 12 | 57 | 0 |
| washer | 9 | 7 | 35 | 6 | 38 | 0 |
| electric_dryer | 7 | 7 | 29 | 7 | 41 | 0 |
| gas_dryer | 8 | 7 | 27 | 5 | 36 | 0 |
| stacked_laundry | 10 | 7 | 26 | 5 | 45 | 0 |
| aio_laundry | 3 | 7 | 27 | 6 | 53 | 0 |
| dishwasher | 8 | 7 | 29 | 9 | 44 | 0 |
| microwave | 8 | 7 | 27 | 8 | 31 | 0 |
| electric_range | 7 | 8 | 35 | 13 | 41 | 0 |
| gas_range | 7 | 8 | 32 | 8 | 34 | 0 |

---

## refrigerator

**Evidence categories:** air_leak, defrost_system, airflow, sealed_system, controls_sensors, water_system, ice_maker

**Components:** heater, defrost_thermostat, thermistor, control_board, evap_fan, condenser_fan, compressor, door_alignment, door_gasket

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `temperature`
- `visual`
- `functional`
- `sealedSystem`
- `defrost`
- `fans`
- `diagnosis`

### Complaint chips

- `frost_buildup` — Frost / Ice Buildup
- `not_cooling` — Not Cooling
- `weak_cooling_ff` — Weak Cooling (Fresh Food)
- `weak_cooling_fz` — Weak Cooling (Freezer)
- `weak_cooling` — Weak Cooling (General)
- `ice_maker` — Ice Maker Issue
- `water_dispenser` — Won't Dispense Water
- `noisy` — Noisy / Vibrating
- `leaking` — Leaking Water

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.door_alignment` (check) — Door alignment / closing
- `commonly_missed.gasket_sealing` (check) — Gasket sealing all doors
- `commonly_missed.cabinet_damage` (check) — Cabinet / hinge damage
- `commonly_missed.condenser_cleanliness` (check) — Condenser coil cleanliness
- `commonly_missed.airflow_obstruction` (check) — Condenser / toe-kick airflow clear
- `commonly_missed.leveling` (check) — Unit level / door swing
- `commonly_missed.ice_maker_fill_tube` (check) — Ice maker fill tube / filter

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.duration` (text) — Duration
- `customer_complaint.intermittent_or_constant` (text) — Intermittent or Constant
- `customer_complaint.error_codes` (text) — Display / Error Codes

#### temperature_checks — Temperature Checks

- `temperature_checks.fresh_food_temp` (text) — Fresh food compartment (°F) → **freshFoodCabinetTemp**
- `temperature_checks.freezer_temp` (text) — Freezer compartment (°F) → **freezerCabinetTemp**
- `temperature_checks.ambient_room_temp` (text) — Ambient room temp (°F) → **ambientRoomTemp**
- `temperature_checks.evap_air_temp` (text) — Evaporator outlet air (°F, if accessible)

#### visual_inspection — Visual Inspection

- `visual_inspection.door_alignment` (tri) — Door Alignment
- `visual_inspection.gasket_condition` (tri) — Gasket Condition
- `visual_inspection.cabinet_condition` (tri) — Cabinet Condition
- `visual_inspection.condenser_condition` (tri) — Condenser Condition
- `visual_inspection.frost_present` (yn) — Heavy Frost / Ice Buildup Present
- `visual_inspection.evaporator_frost_pattern` (tri) — Evaporator Frost Pattern
- `visual_inspection.ice_maker_visual` (tri) — Ice Maker / Dispenser (if equipped)

#### functional_checks — Functional Checks

- `functional_checks.compressor_running` (yn) — Compressor Running
- `functional_checks.condenser_fan_running` (yn) — Condenser Fan Running
- `functional_checks.evaporator_fan_running` (yn) — Evaporator Fan Running
- `functional_checks.damper_operation` (gb) — Fresh Food Damper / Air Tower
- `functional_checks.defrost_cycle_observed` (yn) — Defrost Cycle Heard / Observed
- `functional_checks.ice_maker_operation` (gb) — Ice Maker Operation (if equipped)
- `functional_checks.water_dispenser` (gb) — Water Dispenser (if equipped)

#### compressor_sealed_system — Compressor & Sealed System Readings

- `compressor_sealed_system.compressor_amps_running` (text) — Compressor amps — running → **compressorRunAmps**
- `compressor_sealed_system.compressor_amps_startup` (text) — Compressor amps — startup / LRA
- `compressor_sealed_system.run_winding_ohms` (text) — Compressor run winding (Ω) → **compressorRunWindingOhms**
- `compressor_sealed_system.start_winding_ohms` (text) — Compressor start winding (Ω) → **compressorRunWindingOhms**
- `compressor_sealed_system.common_to_run_ohms` (text) — Common to run (Ω)
- `compressor_sealed_system.common_to_start_ohms` (text) — Common to start (Ω)
- `compressor_sealed_system.compressor_voltage` (text) — Voltage at compressor / relay
- `compressor_sealed_system.start_relay_overload` (text) — Start relay / overload (part # or test)
- `compressor_sealed_system.start_capacitor_uf` (text) — Start capacitor (µF)
- `compressor_sealed_system.suction_line_feel` (text) — Suction line temp / frost pattern
- `compressor_sealed_system.discharge_line_feel` (text) — Discharge line temp / feel
- `compressor_sealed_system.sealed_system_notes` (textarea) — Sealed system / leak / restriction notes

#### defrost_circuit — Defrost Circuit Readings

- `defrost_circuit.defrost_heater_ohms` (text) — Defrost heater resistance (Ω) → **defrostHeaterOhms**
- `defrost_circuit.defrost_thermostat` (text) — Defrost thermostat / bi-metal → **defrostThermostatOhms**
- `defrost_circuit.defrost_fuse` (text) — Defrost fuse / thermal fuse → **defrostThermalFuseOhms**
- `defrost_circuit.defrost_thermistor` (text) — Defrost thermistor (Ω or °F) → **cabinetThermistorOhms**

#### fans_and_electrical — Fans & Electrical Readings

- `fans_and_electrical.condenser_fan_amps` (text) — Condenser fan motor amps → **condenserFanAmps**
- `fans_and_electrical.evaporator_fan_amps` (text) — Evaporator fan motor amps → **evaporatorFanAmps**
- `fans_and_electrical.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage120**
- `fans_and_electrical.fresh_food_thermistor` (text) — Fresh food thermistor (Ω or °F) → **cabinetThermistorOhms**
- `fans_and_electrical.freezer_thermistor` (text) — Freezer thermistor (Ω or °F) → **cabinetThermistorOhms**
- `fans_and_electrical.board_notes` (textarea) — Control board / sensor notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair
- `diagnosis.additional_notes` (textarea) — Additional Notes

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.compressor_running`
- `functional_checks.condenser_fan_running`
- `functional_checks.evaporator_fan_running`
- `visual_inspection.door_alignment`
- `visual_inspection.frost_present`
- `visual_inspection.gasket_condition`

**Measurement knowledge IDs:**
- `compressorRunAmps`
- `defrostHeaterOhms`
- `defrostThermalFuseOhms`
- `defrostThermostatOhms`
- `supplyVoltage120`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `temperature_checks.freezer_temp` | `freezerCabinetTemp` |
| `temperature_checks.fresh_food_temp` | `freshFoodCabinetTemp` |
| `temperature_checks.ambient_room_temp` | `ambientRoomTemp` |
| `defrost_circuit.defrost_heater_ohms` | `defrostHeaterOhms` |
| `defrost_circuit.defrost_thermostat` | `defrostThermostatOhms` |
| `defrost_circuit.defrost_fuse` | `defrostThermalFuseOhms` |
| `defrost_circuit.defrost_thermistor` | `cabinetThermistorOhms` |
| `compressor_sealed_system.compressor_amps_running` | `compressorRunAmps` |
| `compressor_sealed_system.run_winding_ohms` | `compressorRunWindingOhms` |
| `compressor_sealed_system.start_winding_ohms` | `compressorRunWindingOhms` |
| `fans_and_electrical.condenser_fan_amps` | `condenserFanAmps` |
| `fans_and_electrical.evaporator_fan_amps` | `evaporatorFanAmps` |
| `fans_and_electrical.supply_voltage` | `supplyVoltage120` |
| `fans_and_electrical.freezer_thermistor` | `cabinetThermistorOhms` |
| `fans_and_electrical.fresh_food_thermistor` | `cabinetThermistorOhms` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **1**

---

## standalone_freezer

**Evidence categories:** defrost_system, airflow, sealed_system, door_seal, electrical_supply

**Components:** compressor, condenser_fan, defrost_heater, defrost_system, door_alignment, drain, evap_fan, gasket, sealed_system, supply

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `temperature`
- `visual`
- `functional`
- `sealedSystem`
- `defrost`
- `fans`
- `diagnosis`

### Complaint chips

- `frost_buildup` — Frost / Ice Buildup
- `not_cooling` — Not Cooling / Too Warm
- `too_cold` — Too Cold / Over-freezing
- `noisy` — Noisy / Vibrating
- `leaking` — Leaking Water
- `running_constant` — Runs Constantly

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.door_sealing` (check) — Door sealing
- `commonly_missed.frost_source` (check) — Frost accumulation source
- `commonly_missed.condenser_cleanliness` (check) — Condenser cleanliness
- `commonly_missed.defrost_drain` (check) — Defrost drain / pan
- `commonly_missed.leveling` (check) — Unit level

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.duration` (text) — Duration
- `customer_complaint.intermittent_or_constant` (text) — Intermittent or Constant

#### temperature_checks — Temperature Checks

- `temperature_checks.freezer_temp` (text) — Cabinet temp (°F) → **freezerCabinetTemp**
- `temperature_checks.ambient_temp` (text) — Ambient temp (°F) → **ambientRoomTemp**

#### visual_inspection — Visual Inspection

- `visual_inspection.door_alignment` (tri) — Door Alignment
- `visual_inspection.gasket_condition` (tri) — Gasket Condition
- `visual_inspection.frost_pattern` (gb) — Frost Pattern
- `visual_inspection.condenser_condition` (tri) — Condenser Condition
- `visual_inspection.drain_clear` (yn) — Drain Clear

#### functional_checks — Functional Checks

- `functional_checks.compressor_running` (yn) — Compressor Running
- `functional_checks.condenser_fan_running` (yn) — Condenser Fan Running
- `functional_checks.evaporator_fan_running` (yn) — Evaporator Fan Running
- `functional_checks.defrost_operational` (yn) — Defrost System Operational

#### compressor_sealed_system — Compressor & Sealed System Readings

- `compressor_sealed_system.compressor_amps_running` (text) — Compressor amps — running → **compressorRunAmps**
- `compressor_sealed_system.compressor_amps_startup` (text) — Compressor amps — startup / LRA
- `compressor_sealed_system.run_winding_ohms` (text) — Compressor run winding (Ω) → **compressorRunWindingOhms**
- `compressor_sealed_system.start_winding_ohms` (text) — Compressor start winding (Ω)
- `compressor_sealed_system.compressor_voltage` (text) — Voltage at compressor / relay
- `compressor_sealed_system.suction_line_feel` (text) — Suction line temp / frost pattern
- `compressor_sealed_system.discharge_line_feel` (text) — Discharge line temp / feel
- `compressor_sealed_system.sealed_system_notes` (textarea) — Sealed system notes

#### defrost_circuit — Defrost Circuit Readings

- `defrost_circuit.defrost_heater_ohms` (text) — Defrost heater resistance (Ω) → **defrostHeaterOhms**
- `defrost_circuit.defrost_thermostat` (text) — Defrost thermostat / bi-metal → **defrostThermostatOhms**
- `defrost_circuit.thermistor_reading` (text) — Cabinet thermistor (Ω or °F)

#### fans_and_electrical — Fans & Electrical Readings

- `fans_and_electrical.condenser_fan_amps` (text) — Condenser fan amps → **condenserFanAmps**
- `fans_and_electrical.evaporator_fan_amps` (text) — Evaporator fan amps → **evaporatorFanAmps**
- `fans_and_electrical.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage120**

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.compressor_running`
- `functional_checks.condenser_fan_running`
- `functional_checks.defrost_operational`
- `functional_checks.evaporator_fan_running`
- `visual_inspection.door_alignment`
- `visual_inspection.drain_clear`
- `visual_inspection.frost_pattern`
- `visual_inspection.gasket_condition`

**Measurement knowledge IDs:**
- `compressorRunAmps`
- `defrostHeaterOhms`
- `supplyVoltage120`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `temperature_checks.freezer_temp` | `freezerCabinetTemp` |
| `temperature_checks.ambient_temp` | `ambientRoomTemp` |
| `defrost_circuit.defrost_heater_ohms` | `defrostHeaterOhms` |
| `defrost_circuit.defrost_thermostat` | `defrostThermostatOhms` |
| `defrost_circuit.defrost_fuse` | `defrostThermalFuseOhms` |
| `defrost_circuit.defrost_thermistor` | `cabinetThermistorOhms` |
| `compressor_sealed_system.compressor_amps_running` | `compressorRunAmps` |
| `compressor_sealed_system.run_winding_ohms` | `compressorRunWindingOhms` |
| `fans_and_electrical.condenser_fan_amps` | `condenserFanAmps` |
| `fans_and_electrical.evaporator_fan_amps` | `evaporatorFanAmps` |
| `fans_and_electrical.supply_voltage` | `supplyVoltage120` |
| `heat_pump_readings.compressor_amps` | `compressorRunAmps` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## washer

**Evidence categories:** drain_pump, fill_supply, drive_motor, door_lock, electrical_supply

**Components:** door_lock, drain_pump, drive_motor, inlet_valve, supply

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `visual`
- `functional`
- `electrical`
- `mechanical`
- `diagnosis`

### Complaint chips

- `leaking` — Leaking Water
- `wont_drain` — Won't Drain
- `wont_spin` — Won't Spin / Clothes Wet
- `wont_agitate` — Won't Agitate / Wash
- `no_fill` — Won't Fill / Slow Fill
- `noisy` — Noisy / Banging
- `vibration` — Walking / Vibration
- `lid_lock` — Door / Lid Lock Issue
- `error_code` — Error Code on Display

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.suspension` (check) — Suspension / shocks
- `commonly_missed.drain_restrictions` (check) — Drain / standpipe restrictions
- `commonly_missed.loading_habits` (check) — Customer loading habits
- `commonly_missed.water_pressure` (check) — House water pressure / supply
- `commonly_missed.shipping_bolts` (check) — Shipping bolts removed (new install)
- `commonly_missed.inlet_screens` (check) — Inlet hose screens clear
- `commonly_missed.level` (check) — Unit level

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### visual_inspection — Visual Inspection

- `visual_inspection.suspension` (gb) — Suspension
- `visual_inspection.tub_movement` (gb) — Tub Movement
- `visual_inspection.hoses_condition` (gb) — Hoses / Connections
- `visual_inspection.leak_present` (yn) — Leak Present
- `visual_inspection.drive_belt` (tri) — Belt / Pulley (if accessible)
- `visual_inspection.door_boot` (tri) — Door boot / gasket (front load)

#### functional_checks — Functional Checks

- `functional_checks.fill_operation` (gb) — Fill Operation (hot & cold)
- `functional_checks.agitation` (gb) — Agitation
- `functional_checks.spin_operation` (gb) — Spin Operation
- `functional_checks.drain_operation` (gb) — Drain Operation
- `functional_checks.lid_lock_operation` (gb) — Lid / Door Lock Operation
- `functional_checks.balance` (gb) — Balance / Vibration on spin

#### electrical_measurements — Electrical Measurements

- `electrical_measurements.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage120**
- `electrical_measurements.drive_motor_ohms` (text) — Drive / wash motor resistance (Ω) → **washerMotorWindingOhms**
- `electrical_measurements.drive_motor_amps` (text) — Drive motor amps (agitate / spin)
- `electrical_measurements.drain_pump_ohms` (text) — Drain pump resistance (Ω) → **washerDrainPumpOhms**
- `electrical_measurements.drain_pump_amps` (text) — Drain pump amps → **washerDrainPumpAmps**
- `electrical_measurements.inlet_valve_ohms` (text) — Inlet valve coil(s) (Ω) → **washerWaterValveOhms**
- `electrical_measurements.water_pressure` (text) — Water pressure (PSI)

#### mechanical_controls — Mechanical / Control Checks

- `mechanical_controls.shift_actuator` (gb) — Shift actuator / transmission
- `mechanical_controls.clutch` (gb) — Clutch / splutch
- `mechanical_controls.pressure_switch` (gb) — Pressure switch / hose
- `mechanical_controls.door_lock_ohms` (text) — Door lock / latch (Ω) → **washerDoorLockSwitchOhms**
- `mechanical_controls.board_notes` (textarea) — Control / MCU notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.agitation`
- `functional_checks.drain_operation`
- `functional_checks.fill_operation`
- `functional_checks.lid_lock_operation`
- `functional_checks.spin_operation`

**Measurement knowledge IDs:**
- `supplyVoltage120`
- `washerDoorLockSwitchOhms`
- `washerDrainPumpAmps`
- `washerDrainPumpOhms`
- `washerMotorWindingOhms`
- `washerWaterValveOhms`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `electrical_measurements.supply_voltage` | `supplyVoltage120` |
| `electrical_measurements.drive_motor_ohms` | `washerMotorWindingOhms` |
| `electrical_measurements.drain_pump_ohms` | `washerDrainPumpOhms` |
| `electrical_measurements.drain_pump_amps` | `washerDrainPumpAmps` |
| `electrical_measurements.inlet_valve_ohms` | `washerWaterValveOhms` |
| `mechanical_controls.door_lock_ohms` | `washerDoorLockSwitchOhms` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## electric_dryer

**Evidence categories:** heat_circuit, airflow, motor, electrical_supply

**Components:** cycling_thermostat, heating_element, motor, supply, thermal_fuse, vent

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `visual`
- `functional`
- `heat`
- `motor`
- `diagnosis`

### Complaint chips

- `no_heat` — No Heat
- `not_drying` — Takes Too Long / Damp Clothes
- `no_spin` — Won't Tumble / Drum Not Turning
- `wont_stop_spinning` — Won't Stop Spinning
- `noisy` — Noisy / Thumping
- `no_power` — Dead / Won't Start
- `error_code` — Error Code on Display

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.vent_restriction` (check) — Vent restriction / length
- `commonly_missed.crushed_vent` (check) — Crushed vent hose
- `commonly_missed.poor_airflow` (check) — Poor airflow at exterior hood
- `commonly_missed.overloading` (check) — Customer overloading
- `commonly_missed.lint_trap` (check) — Lint screen / housing clean

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### visual_inspection — Visual Inspection

- `visual_inspection.vent_condition` (gb) — Vent / Duct Condition
- `visual_inspection.lint_accumulation` (gb) — Lint Accumulation
- `visual_inspection.drum_condition` (gb) — Drum / Rollers / Glides
- `visual_inspection.element_coils` (tri) — Heating element (visual)

#### functional_checks — Functional Checks

- `functional_checks.drum_turning` (yn) — Drum Turning
- `functional_checks.heating` (yn) — Heating
- `functional_checks.airflow` (gb) — Airflow at vent
- `functional_checks.blower_operation` (gb) — Blower Operation
- `functional_checks.moisture_sensor` (gb) — Moisture sensor bars (if equipped)

#### heat_circuit — Heat Circuit Readings

- `heat_circuit.heater_ohms` (text) — Heating element resistance (Ω) → **electricDryerHeatingElementOhms**
- `heat_circuit.heater_amps` (text) — Heating element amps (energized) → **electricDryerSupplyAmps**
- `heat_circuit.thermal_fuse` (text) — Thermal fuse / hi-limit continuity → **dryerThermalFuseOhms**
- `heat_circuit.cycling_thermostat` (text) — Cycling thermostat → **dryerCyclingThermostatOhms**
- `heat_circuit.high_limit` (text) — High-limit thermostat → **dryerCyclingThermostatOhms**
- `heat_circuit.exhaust_temp` (text) — Exhaust air temp at vent (°F)

#### motor_electrical — Motor & Electrical Readings

- `motor_electrical.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage240**
- `motor_electrical.motor_ohms` (text) — Drive motor resistance (Ω) → **dryerDrumMotorWindingOhms**
- `motor_electrical.motor_amps` (text) — Motor amps (running)
- `motor_electrical.belt_idler` (text) — Belt / idler pulley condition
- `motor_electrical.board_notes` (textarea) — Control board / relay notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.airflow`
- `functional_checks.drum_turning`
- `functional_checks.heating`
- `visual_inspection.lint_accumulation`

**Measurement knowledge IDs:**
- `dryerCyclingThermostatOhms`
- `dryerDrumMotorWindingOhms`
- `dryerThermalFuseOhms`
- `electricDryerHeatingElementOhms`
- `supplyVoltage240`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `motor_electrical.supply_voltage` | `supplyVoltage240` |
| `heat_circuit.heater_ohms` | `electricDryerHeatingElementOhms` |
| `heat_circuit.heater_amps` | `electricDryerSupplyAmps` |
| `heat_circuit.thermal_fuse` | `dryerThermalFuseOhms` |
| `heat_circuit.cycling_thermostat` | `dryerCyclingThermostatOhms` |
| `heat_circuit.high_limit` | `dryerCyclingThermostatOhms` |
| `motor_electrical.motor_ohms` | `dryerDrumMotorWindingOhms` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## gas_dryer

**Evidence categories:** ignition, gas_valve, heat_safety, airflow, motor, electrical_supply

**Components:** gas_valve, igniter, motor, supply, thermal_fuse, vent

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `visual`
- `functional`
- `ignition`
- `motor`
- `diagnosis`

### Complaint chips

- `no_heat` — No Heat / Won\
- `not_drying` — Takes Too Long / Damp Clothes
- `no_spin` — Won't Tumble / Drum Not Turning
- `wont_stop_spinning` — Won't Stop Spinning
- `gas_smell` — Gas Smell / Leak Concern
- `weak_flame` — Weak Flame / Goes Out
- `noisy` — Noisy / Thumping
- `error_code` — Error Code on Display

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.vent_restriction` (check) — Vent restriction / length
- `commonly_missed.gas_supply` (check) — Gas supply valve on
- `commonly_missed.lint_trap` (check) — Lint screen / housing clean
- `commonly_missed.lp_orifices` (check) — LP conversion / orifices correct

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### visual_inspection — Visual Inspection

- `visual_inspection.vent_condition` (gb) — Vent / Duct Condition
- `visual_inspection.lint_accumulation` (gb) — Lint Accumulation
- `visual_inspection.igniter_condition` (tri) — Igniter condition
- `visual_inspection.gas_valve` (tri) — Gas valve / burner assembly

#### functional_checks — Functional Checks

- `functional_checks.drum_turning` (yn) — Drum Turning
- `functional_checks.ignition` (yn) — Burner Ignition
- `functional_checks.airflow` (gb) — Airflow at vent
- `functional_checks.blower_operation` (gb) — Blower Operation
- `functional_checks.flame_quality` (gb) — Flame quality / stays lit

#### gas_ignition — Gas & Ignition Readings

- `gas_ignition.igniter_amps` (text) — Igniter amps (glow)
- `gas_ignition.igniter_ohms` (text) — Igniter resistance cold (Ω) → **hotSurfaceIgniterOhms**
- `gas_ignition.gas_valve_coils` (text) — Gas valve coil(s) (Ω) → **gasValveCoilOhms**
- `gas_ignition.flame_sensor` (text) — Flame sensor / radiant sensor
- `gas_ignition.gas_pressure_note` (text) — Gas pressure / manifold (if measured)

#### motor_electrical — Motor & Electrical Readings

- `motor_electrical.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage120**
- `motor_electrical.motor_ohms` (text) — Drive motor resistance (Ω) → **dryerDrumMotorWindingOhms**
- `motor_electrical.thermal_fuse` (text) — Thermal fuse / hi-limit → **dryerThermalFuseOhms**
- `motor_electrical.exhaust_temp` (text) — Exhaust temp at vent (°F)
- `motor_electrical.board_notes` (textarea) — Control / radiant sensor notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.airflow`
- `functional_checks.drum_turning`
- `functional_checks.flame_quality`
- `functional_checks.ignition`

**Measurement knowledge IDs:**
- `dryerDrumMotorWindingOhms`
- `dryerThermalFuseOhms`
- `gasValveCoilOhms`
- `hotSurfaceIgniterAmps`
- `hotSurfaceIgniterOhms`
- `supplyVoltage120`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `motor_electrical.supply_voltage` | `supplyVoltage120` |
| `gas_ignition.igniter_ohms` | `hotSurfaceIgniterOhms` |
| `gas_ignition.gas_valve_coils` | `gasValveCoilOhms` |
| `motor_electrical.motor_ohms` | `dryerDrumMotorWindingOhms` |
| `motor_electrical.thermal_fuse` | `dryerThermalFuseOhms` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## stacked_laundry

**Evidence categories:** washer_drain, washer_drive, dryer_heat, dryer_motor, dryer_airflow, electrical_supply

**Components:** dryer_heat, dryer_motor, dryer_thermal_fuse, dryer_vent, supply, washer_drain_pump, washer_motor

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `washer`
- `dryer`
- `washerElectrical`
- `dryerElectrical`
- `diagnosis`

### Complaint chips

- `washer_drain` — Washer Won't Drain
- `washer_spin` — Washer Won't Spin
- `washer_leak` — Washer Leaking
- `washer_fill` — Washer Won't Fill
- `dryer_no_heat` — Dryer No Heat
- `dryer_not_drying` — Dryer Takes Too Long
- `dryer_no_tumble` — Dryer Won't Tumble
- `noisy` — Noisy / Vibration
- `no_power` — Dead / Won't Start
- `error_code` — Error Code

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.shared_power` (check) — Shared power / outlet load
- `commonly_missed.airflow_restrictions` (check) — Dryer vent / airflow
- `commonly_missed.installation` (check) — Installation / stacking kit / level
- `commonly_missed.water_supply` (check) — Washer water supply / drain

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### washer_section — Washer Section

- `washer_section.fill` (gb) — Fill
- `washer_section.agitate` (gb) — Agitate
- `washer_section.drain` (gb) — Drain
- `washer_section.spin` (gb) — Spin
- `washer_section.washer_leak` (yn) — Leak Present

#### dryer_section — Dryer Section

- `dryer_section.drum_turning` (yn) — Drum Turning
- `dryer_section.heat_present` (yn) — Heat Present
- `dryer_section.airflow` (gb) — Airflow
- `dryer_section.blower` (gb) — Blower Operation

#### washer_measurements — Washer Electrical Readings

- `washer_measurements.washer_motor_ohms` (text) — Wash motor (Ω) → **washerMotorWindingOhms**
- `washer_measurements.drain_pump_ohms` (text) — Drain pump (Ω) → **washerDrainPumpOhms**
- `washer_measurements.water_pressure` (text) — Water pressure (PSI)

#### dryer_measurements — Dryer Heat / Motor Readings

- `dryer_measurements.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage240**
- `dryer_measurements.heater_ohms` (text) — Heater / igniter (Ω)
- `dryer_measurements.heater_or_igniter_amps` (text) — Heater or igniter amps
- `dryer_measurements.motor_ohms` (text) — Dryer motor (Ω) → **dryerDrumMotorWindingOhms**
- `dryer_measurements.thermal_fuse` (text) — Thermal fuse / hi-limit → **dryerThermalFuseOhms**
- `dryer_measurements.exhaust_temp` (text) — Exhaust temp at vent (°F)

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `dryer_section.airflow`
- `dryer_section.drum_turning`
- `dryer_section.heat_present`
- `washer_section.agitate`
- `washer_section.drain`
- `washer_section.spin`

**Measurement knowledge IDs:**
- `dryerDrumMotorWindingOhms`
- `dryerThermalFuseOhms`
- `supplyVoltage240`
- `washerDrainPumpOhms`
- `washerMotorWindingOhms`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `washer_measurements.washer_motor_ohms` | `washerMotorWindingOhms` |
| `washer_measurements.drain_pump_ohms` | `washerDrainPumpOhms` |
| `dryer_measurements.supply_voltage` | `supplyVoltage240` |
| `dryer_measurements.motor_ohms` | `dryerDrumMotorWindingOhms` |
| `dryer_measurements.thermal_fuse` | `dryerThermalFuseOhms` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## aio_laundry

**Evidence categories:** washer_drain, washer_drive, heat_pump, heat_pump_airflow, condensate, electrical_supply

**Components:** compressor, condensate, filter_airflow, heat_pump_fan, sealed_system, supply, washer_drain_pump, washer_motor

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `wash`
- `dry`
- `washElectrical`
- `heatPump`
- `diagnosis`

### Complaint chips

- `heat_pump_dry` — Not Drying (Heat Pump)
- `condensate` — Condensate / Drain Issue
- `compressor` — Compressor / Sealed System

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.heat_pump_filter` (check) — Heat pump filter / condenser clean
- `commonly_missed.vent_airflow` (check) — Exhaust / condenser airflow
- `commonly_missed.water_pressure` (check) — Water pressure / inlet screens
- `commonly_missed.level_install` (check) — Level / installation / pedestal
- `commonly_missed.drain_filter` (check) — Drain pump filter / coin trap

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### wash_functions — Wash Functions

- `wash_functions.fill` (gb) — Fill
- `wash_functions.agitate` (gb) — Agitate
- `wash_functions.spin` (gb) — Spin
- `wash_functions.drain` (gb) — Drain
- `wash_functions.washer_leak` (yn) — Leak Present

#### dry_functions — Dry / Heat-Pump Functions

- `dry_functions.drum_turning` (yn) — Drum Turning
- `dry_functions.heat_present` (yn) — Heat / drying present
- `dry_functions.airflow` (gb) — Airflow / condenser fan
- `dry_functions.condensate_drain` (gb) — Condensate / drain pump

#### wash_electrical — Wash Electrical Readings

- `wash_electrical.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage120**
- `wash_electrical.wash_motor_ohms` (text) — Wash motor (Ω) → **washerMotorWindingOhms**
- `wash_electrical.drain_pump_ohms` (text) — Drain pump (Ω) → **washerDrainPumpOhms**
- `wash_electrical.water_pressure` (text) — Water pressure (PSI)

#### heat_pump_readings — Heat-Pump / Compressor Readings

- `heat_pump_readings.compressor_amps` (text) — Compressor amps (running) → **compressorRunAmps**
- `heat_pump_readings.compressor_ohms` (text) — Compressor windings (Ω) → **compressorRunWindingOhms**
- `heat_pump_readings.heat_pump_fan_amps` (text) — Condenser / heat-pump fan amps → **condenserFanAmps**
- `heat_pump_readings.heater_amps` (text) — Supplemental heater amps (if equipped)
- `heat_pump_readings.refrigerant_notes` (textarea) — Refrigerant / sealed system notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `dry_functions.airflow`
- `dry_functions.condensate_drain`
- `dry_functions.heat_present`
- `wash_functions.agitate`
- `wash_functions.drain`
- `wash_functions.spin`

**Measurement knowledge IDs:**
- `compressorRunAmps`
- `compressorRunWindingOhms`
- `condenserFanAmps`
- `supplyVoltage120`
- `washerDrainPumpOhms`
- `washerMotorWindingOhms`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `wash_electrical.supply_voltage` | `supplyVoltage120` |
| `wash_electrical.wash_motor_ohms` | `washerMotorWindingOhms` |
| `wash_electrical.drain_pump_ohms` | `washerDrainPumpOhms` |
| `heat_pump_readings.compressor_amps` | `compressorRunAmps` |
| `heat_pump_readings.compressor_ohms` | `compressorRunWindingOhms` |
| `heat_pump_readings.heat_pump_fan_amps` | `condenserFanAmps` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## dishwasher

**Evidence categories:** fill_supply, drain_pump, wash_circuit, heat_dry, electrical_supply, door_seal

**Components:** circulation_pump, door_gasket, drain_pump, heater, inlet_valve, supply

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `visual`
- `functional`
- `heat`
- `motor`
- `diagnosis`

### Complaint chips

- `not_cleaning` — Not Cleaning / Dirty Dishes
- `wont_drain` — Won't Drain
- `leaking` — Leaking Water
- `no_fill` — Won't Fill
- `no_heat_dry` — Not Drying / No Heat
- `noisy` — Noisy / Grinding
- `wont_start` — Dead / Won't Start
- `error_code` — Error Code on Display

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.disposal_knockout` (check) — Garbage disposal knockout
- `commonly_missed.drain_restrictions` (check) — Drain / air gap restrictions
- `commonly_missed.detergent_usage` (check) — Customer detergent / rinse aid
- `commonly_missed.water_temperature` (check) — Hot water at sink (120°F+)
- `commonly_missed.inlet_screen` (check) — Inlet valve screen

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### visual_inspection — Visual Inspection

- `visual_inspection.spray_arms_clear` (yn) — Spray Arms Clear
- `visual_inspection.filter_condition` (gb) — Filter Condition
- `visual_inspection.drain_path_clear` (yn) — Drain Path Clear
- `visual_inspection.leak_present` (yn) — Leak Present
- `visual_inspection.door_gasket` (tri) — Door Gasket / Tub Seal

#### functional_checks — Functional Checks

- `functional_checks.fill_operation` (gb) — Fill Operation
- `functional_checks.wash_operation` (gb) — Wash Operation (circulation)
- `functional_checks.drain_operation` (gb) — Drain Operation
- `functional_checks.drying_operation` (gb) — Drying / Heat Operation
- `functional_checks.detergent_dispenser` (gb) — Detergent / rinse dispenser

#### heat_water — Heat & Water Readings

- `heat_water.incoming_water_temp` (text) — Incoming water temp (°F) → **dishwasherIncomingWaterTemp**
- `heat_water.heater_ohms` (text) — Heater resistance (Ω) → **dishwasherHeatingElementOhms**
- `heat_water.heater_amps` (text) — Heater amps (energized) → **dishwasherHeaterAmps**
- `heat_water.thermistor` (text) — Thermistor / OWI (Ω) → **dishwasherTubThermistorOhms**

#### motor_electrical — Motor & Electrical Readings

- `motor_electrical.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage120**
- `motor_electrical.wash_motor_ohms` (text) — Wash / circulation motor (Ω) → **dishwasherCirculationPumpOhms**
- `motor_electrical.drain_motor_ohms` (text) — Drain motor (Ω) → **dishwasherDrainPumpOhms**
- `motor_electrical.inlet_valve_ohms` (text) — Inlet valve coil(s) (Ω) → **dishwasherWaterValveOhms**
- `motor_electrical.float_switch` (text) — Float switch / leak sensor → **dishwasherFloatSwitchOhms**
- `motor_electrical.board_notes` (textarea) — Control board / diverter notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.drain_operation`
- `functional_checks.drying_operation`
- `functional_checks.fill_operation`
- `functional_checks.wash_operation`
- `visual_inspection.door_gasket`
- `visual_inspection.leak_present`

**Measurement knowledge IDs:**
- `dishwasherCirculationPumpOhms`
- `dishwasherDrainPumpOhms`
- `dishwasherHeaterAmps`
- `dishwasherHeatingElementOhms`
- `dishwasherIncomingWaterTemp`
- `dishwasherWaterValveOhms`
- `supplyVoltage120`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `heat_water.incoming_water_temp` | `dishwasherIncomingWaterTemp` |
| `heat_water.heater_ohms` | `dishwasherHeatingElementOhms` |
| `heat_water.heater_amps` | `dishwasherHeaterAmps` |
| `heat_water.thermistor` | `dishwasherTubThermistorOhms` |
| `motor_electrical.supply_voltage` | `supplyVoltage120` |
| `motor_electrical.wash_motor_ohms` | `dishwasherCirculationPumpOhms` |
| `motor_electrical.drain_motor_ohms` | `dishwasherDrainPumpOhms` |
| `motor_electrical.inlet_valve_ohms` | `dishwasherWaterValveOhms` |
| `motor_electrical.float_switch` | `dishwasherFloatSwitchOhms` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## microwave

**Evidence categories:** hv_circuit, door_safety, power_supply

**Components:** door_interlock, hv_capacitor, line_fuse, magnetron, supply, thermal_cutout

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `visual`
- `functional`
- `door`
- `hv`
- `diagnosis`

### Complaint chips

- `no_heat` — Won't Heat / No Heat
- `no_power` — Dead / Won't Start
- `turntable` — Turntable Not Turning
- `sparking` — Arcing / Sparking
- `door_issue` — Door / Latch Problem
- `noisy` — Noisy / Loud Humming
- `vent_fan` — Vent Fan Not Working
- `error_code` — Error Code on Display

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.door_switch` (check) — Door switch operation
- `commonly_missed.installation` (check) — Installation / clearance
- `commonly_missed.misuse` (check) — Customer misuse / metal
- `commonly_missed.door_latching` (check) — Intermittent door latching
- `commonly_missed.ventilation` (check) — Over-range vent / grease filter

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### visual_inspection — Visual Inspection

- `visual_inspection.door_condition` (gb) — Door Condition
- `visual_inspection.latch_condition` (gb) — Latch / Hooks Condition
- `visual_inspection.waveguide_condition` (gb) — Waveguide / Stirrer Cover
- `visual_inspection.turntable_support` (tri) — Turntable / support ring

#### functional_checks — Functional Checks

- `functional_checks.powers_on` (yn) — Unit Powers On
- `functional_checks.heats_properly` (yn) — Heats Properly (water test)
- `functional_checks.turntable_operation` (gb) — Turntable Operation
- `functional_checks.fan_operation` (gb) — Cooling / stirrer Fan
- `functional_checks.cooktop_lights` (gb) — Cooktop / cavity lights (if equipped)

#### door_safety — Door & Safety Switch Readings

- `door_safety.primary_door_switch` (text) — Primary door switch continuity → **microwaveDoorInterlockSwitchOhms**
- `door_safety.monitor_switch` (text) — Monitor switch continuity → **microwaveDoorInterlockSwitchOhms**
- `door_safety.thermal_cutout` (text) — Thermal cutout / thermostat → **microwaveThermalCutoutOhms**
- `door_safety.fuse_continuity` (text) — Line fuse continuity → **microwaveLineFuseOhms**

#### electrical_hv — Electrical / HV Circuit (de-energized)

- `electrical_hv.supply_voltage` (text) — Supply voltage (V) → **supplyVoltage120**
- `electrical_hv.magnetron_ohms` (text) — Magnetron resistance (Ω) — if tested → **microwaveMagnetronFilamentOhms**
- `electrical_hv.hv_diode` (text) — HV diode — if tested → **microwaveHVDiodeCheck**
- `electrical_hv.capacitor_uf` (text) — High-voltage capacitor (µF) — if tested → **microwaveHVCapacitanceMFD**
- `electrical_hv.hv_notes` (textarea) — HV circuit notes (capacitor discharged?)

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.heats_properly`
- `functional_checks.powers_on`

**Measurement knowledge IDs:**
- `microwaveDoorInterlockSwitchOhms`
- `microwaveHVCapacitanceMFD`
- `microwaveLineFuseOhms`
- `microwaveMagnetronFilamentOhms`
- `microwaveThermalCutoutOhms`
- `supplyVoltage120`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `door_safety.primary_door_switch` | `microwaveDoorInterlockSwitchOhms` |
| `door_safety.monitor_switch` | `microwaveDoorInterlockSwitchOhms` |
| `door_safety.thermal_cutout` | `microwaveThermalCutoutOhms` |
| `door_safety.fuse_continuity` | `microwaveLineFuseOhms` |
| `electrical_hv.supply_voltage` | `supplyVoltage120` |
| `electrical_hv.magnetron_ohms` | `microwaveMagnetronFilamentOhms` |
| `electrical_hv.hv_diode` | `microwaveHVDiodeCheck` |
| `electrical_hv.capacitor_uf` | `microwaveHVCapacitanceMFD` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## electric_range

**Evidence categories:** bake_element, broil_element, temp_sensor, electrical_supply, convection

**Components:** bake_element, broil_element, convection_fan, supply, temp_sensor

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `visual`
- `functional`
- `terminal`
- `elements`
- `board`
- `diagnosis`

### Complaint chips

- `no_bake` — No Bake / Oven Not Heating
- `no_broil` — No Broil
- `surface_burners` — Surface Burner Issue
- `uneven_heat` — Uneven / Wrong Temperature
- `no_power` — Dead / No Power
- `error_code` — Error Code on Display
- `self_clean` — Self-Clean / Door Lock

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.incoming_voltage` (check) — Incoming voltage verified
- `commonly_missed.miswired_outlet` (check) — Miswired outlet / receptacle
- `commonly_missed.terminal_burn` (check) — Burnt terminal block / loose lugs
- `commonly_missed.calibration` (check) — Calibration / offset checked
- `commonly_missed.cookware` (check) — Customer cookware concerns

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### visual_inspection — Visual Inspection

- `visual_inspection.terminal_block` (tri) — Terminal Block Condition
- `visual_inspection.wiring_condition` (tri) — Wiring / Harness Condition
- `visual_inspection.door_seal` (tri) — Door Seal Condition
- `visual_inspection.bake_element_visible` (tri) — Bake Element (visible damage)
- `visual_inspection.broil_element_visible` (tri) — Broil Element (visible damage)

#### functional_checks — Functional Checks

- `functional_checks.bake_operation` (gb) — Bake Operation
- `functional_checks.broil_operation` (gb) — Broil Operation
- `functional_checks.convection_operation` (gb) — Convection Operation
- `functional_checks.surface_burners` (gb) — Surface Burners (if equipped)
- `functional_checks.door_lock_operation` (gb) — Door Lock / Self-Clean Lock

#### terminal_block_readings — Terminal Block / Supply Readings

- `terminal_block_readings.l1_l2_voltage` (text) — L1–L2 at block (V) → **supplyVoltage240**
- `terminal_block_readings.l1_neutral_voltage` (text) — L1–Neutral (V) → **supplyVoltage120**
- `terminal_block_readings.l2_neutral_voltage` (text) — L2–Neutral (V) → **supplyVoltage120**
- `terminal_block_readings.neutral_ground_voltage` (text) — Neutral–Ground (V) → **neutralGroundVoltage**
- `terminal_block_readings.supply_notes` (text) — Supply / wiring notes

#### element_sensor_readings — Element & Sensor Readings

- `element_sensor_readings.bake_element_ohms` (text) — Bake element resistance (Ω) → **bakeElementOhms**
- `element_sensor_readings.broil_element_ohms` (text) — Broil element resistance (Ω) → **broilElementOhms**
- `element_sensor_readings.bake_element_amps` (text) — Bake element amps (energized) → **electricRangeElementAmps**
- `element_sensor_readings.broil_element_amps` (text) — Broil element amps (energized) → **electricRangeElementAmps**
- `element_sensor_readings.temp_sensor_ohms` (text) — Oven temp sensor (Ω at room) → **ovenTempSensorOhms**

#### board_readings — Control Board Readings

- `board_readings.board_supply_voltage` (text) — Board supply voltage (V) → **supplyVoltage240**
- `board_readings.bake_relay_output` (text) — Bake relay output / bake leg (V when on) → **supplyVoltage240**
- `board_readings.broil_relay_output` (text) — Broil relay output / broil leg (V when on) → **supplyVoltage240**
- `board_readings.convection_output` (text) — Convection motor / relay (V or amps) → **convectionFanMotorAmps**
- `board_readings.oven_temp_at_probe` (text) — Oven temp at center probe (°F)
- `board_readings.board_notes` (textarea) — Board test points / relay notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.bake_operation`
- `functional_checks.broil_operation`
- `functional_checks.convection_operation`

**Measurement knowledge IDs:**
- `bakeElementOhms`
- `broilElementOhms`
- `neutralGroundVoltage`
- `ovenTempSensorOhms`
- `supplyVoltage240`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `terminal_block_readings.l1_l2_voltage` | `supplyVoltage240` |
| `terminal_block_readings.l1_neutral_voltage` | `supplyVoltage120` |
| `terminal_block_readings.l2_neutral_voltage` | `supplyVoltage120` |
| `terminal_block_readings.neutral_ground_voltage` | `neutralGroundVoltage` |
| `element_sensor_readings.bake_element_ohms` | `bakeElementOhms` |
| `element_sensor_readings.broil_element_ohms` | `broilElementOhms` |
| `element_sensor_readings.bake_element_amps` | `electricRangeElementAmps` |
| `element_sensor_readings.broil_element_amps` | `electricRangeElementAmps` |
| `element_sensor_readings.temp_sensor_ohms` | `ovenTempSensorOhms` |
| `board_readings.board_supply_voltage` | `supplyVoltage240` |
| `board_readings.bake_relay_output` | `supplyVoltage240` |
| `board_readings.broil_relay_output` | `supplyVoltage240` |
| `board_readings.convection_output` | `convectionFanMotorAmps` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## gas_range

**Evidence categories:** ignition, gas_valve, flame_sensing, electrical_supply, surface_burners

**Components:** flame_sensor, gas_valve, igniter, supply, surface_ignition

### Wizard steps (`recommendStepKey`)

- `commonly_missed`
- `complaint`
- `visual`
- `functional`
- `electrical`
- `flame`
- `board`
- `diagnosis`

### Complaint chips

- `no_oven_heat` — Oven Not Heating
- `no_ignition` — Won\
- `gas_smell` — Gas Smell / Leak Concern
- `surface_burners` — Surface Burner Issue
- `weak_flame` — Weak / Yellow Flame
- `error_code` — Error Code on Display
- `self_clean` — Self-Clean / Door Lock

### Fields by section

#### commonly_missed — Pre-Checks

- `commonly_missed.gas_supply` (check) — Gas supply valve on / line verified
- `commonly_missed.anti_tip` (check) — Anti-tip bracket installed
- `commonly_missed.lp_orifices` (check) — LP orifice / conversion correct
- `commonly_missed.ventilation` (check) — Adequate ventilation / hood
- `commonly_missed.gas_odor` (check) — Gas odor / leak check performed

#### customer_complaint — Client Complaint

- `customer_complaint.complaint` (text) — Complaint
- `customer_complaint.error_codes` (text) — Error Codes

#### visual_inspection — Visual Inspection

- `visual_inspection.burner_condition` (tri) — Oven burner / tube condition
- `visual_inspection.igniter_condition` (tri) — Oven igniter condition
- `visual_inspection.gas_valve_condition` (tri) — Gas valve / manifold condition
- `visual_inspection.door_seal` (tri) — Door Seal Condition
- `visual_inspection.surface_burners_visual` (tri) — Surface burner caps / ports

#### functional_checks — Functional Checks

- `functional_checks.oven_bake_ignition` (gb) — Oven Bake Ignition
- `functional_checks.oven_broil_ignition` (gb) — Oven Broil Ignition
- `functional_checks.surface_burner_ignition` (gb) — Surface Burner Ignition
- `functional_checks.convection_operation` (gb) — Convection Fan (if equipped)
- `functional_checks.door_lock_operation` (gb) — Door Lock / Self-Clean Lock

#### electrical_at_board — Electrical at Board / Valve

- `electrical_at_board.supply_voltage` (text) — Supply voltage at outlet (V) → **supplyVoltage120**
- `electrical_at_board.board_supply_voltage` (text) — Board supply voltage (V) → **supplyVoltage120**
- `electrical_at_board.igniter_amps` (text) — Oven igniter amps (glow) → **hotSurfaceIgniterAmps**
- `electrical_at_board.igniter_resistance` (text) — Oven igniter resistance cold (Ω) → **hotSurfaceIgniterOhms**
- `electrical_at_board.gas_valve_coil_ohms` (text) — Gas valve coil resistance (Ω) → **gasValveCoilOhms**
- `electrical_at_board.flame_sensor_continuity` (text) — Flame sensor / safety continuity → **gasFlameSensorContinuityOhms**

#### gas_flame_readings — Gas / Flame Readings

- `gas_flame_readings.oven_flame_quality` (gb) — Oven Flame Quality
- `gas_flame_readings.surface_flame_quality` (gb) — Surface Flame Quality
- `gas_flame_readings.manifold_pressure` (text) — Manifold / gas pressure (if measured)
- `gas_flame_readings.gas_notes` (text) — Gas line / regulator notes

#### board_readings — Control Board Readings

- `board_readings.valve_voltage_on` (text) — Gas valve voltage when commanded (V) → **supplyVoltage120**
- `board_readings.igniter_circuit_voltage` (text) — Igniter circuit voltage (V) → **supplyVoltage120**
- `board_readings.board_notes` (textarea) — Board relay / safety circuit notes

#### diagnosis — Diagnosis

- `diagnosis.root_cause` (textarea) — Root Cause
- `diagnosis.recommended_repair` (textarea) — Recommended Repair

### Elimination rule signals (Phase 5)

**Field paths:**
- `functional_checks.oven_bake_ignition`
- `functional_checks.oven_broil_ignition`
- `functional_checks.surface_burner_ignition`

**Measurement knowledge IDs:**
- `gasFlameSensorContinuityOhms`
- `gasValveCoilOhms`
- `hotSurfaceIgniterAmps`
- `hotSurfaceIgniterOhms`
- `supplyVoltage120`

### Smart measurement bindings

| Field key | Knowledge ID |
|-----------|--------------|
| `electrical_at_board.supply_voltage` | `supplyVoltage120` |
| `electrical_at_board.board_supply_voltage` | `supplyVoltage120` |
| `electrical_at_board.igniter_amps` | `hotSurfaceIgniterAmps` |
| `electrical_at_board.igniter_resistance` | `hotSurfaceIgniterOhms` |
| `electrical_at_board.gas_valve_coil_ohms` | `gasValveCoilOhms` |
| `electrical_at_board.flame_sensor_continuity` | `gasFlameSensorContinuityOhms` |
| `board_readings.valve_voltage_on` | `supplyVoltage120` |
| `board_readings.igniter_circuit_voltage` | `supplyVoltage120` |

### Pattern authoring notes

- Combine chips + fields + measurements in one rule `when` array (AND).
- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.
- Existing multi-signal rules in evidence JSON: **0**

---

## Next: Batch 1 pattern catalog

Draft multi-signal rows in `PATTERN_CATALOG.md` (refrigerator + standalone_freezer first).
Only use signal IDs listed above.
