# Signal inventory — refrigerator

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `frost_buildup` | Frost / Ice Buildup | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `not_cooling` | Not Cooling | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `weak_cooling_ff` | Weak Cooling (Fresh Food) | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `weak_cooling_fz` | Weak Cooling (Freezer) | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `weak_cooling` | Weak Cooling (General) | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `ice_maker` | Ice Maker Issue | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `water_dispenser` | Won't Dispense Water | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Vibrating | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |
| `leaking` | Leaking Water | `refrigerator/refrigeratorComplaints.ts` | chip | Yes (multi-select) | |

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
| `frost_ice` | frost_buildup | temperature, visual, defrost, fans, functional |
| `not_cooling` | not_cooling | temperature, visual, sealedSystem, fans, functional, defrost |
| `weak_cooling_ff` | weak_cooling_ff | temperature, visual, functional, fans, defrost |
| `weak_cooling_fz` | weak_cooling_fz | temperature, visual, sealedSystem, functional, fans, defrost |
| `weak_cooling_general` | weak_cooling | temperature, visual, functional, fans, defrost, sealedSystem |
| `ice_maker` | ice_maker | functional, fans, temperature |
| `water_dispenser` | water_dispenser | functional, commonly_missed, temperature |
| `noisy` | noisy | visual, functional, fans, sealedSystem |
| `leaking` | leaking | visual, functional, defrost, commonly_missed |

## 2. Wizard field signals

| Field path | Label | Type | Values | Step / section | Visibility | Smart measurement |
|------------|-------|------|--------|----------------|------------|-------------------|
| `commonly_missed.door_alignment` | Door alignment / closing | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.gasket_sealing` | Gasket sealing all doors | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.cabinet_damage` | Cabinet / hinge damage | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.condenser_cleanliness` | Condenser coil cleanliness | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.airflow_obstruction` | Condenser / toe-kick airflow clear | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.leveling` | Unit level / door swing | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.ice_maker_fill_tube` | Ice maker fill tube / filter | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.duration` | Duration | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.intermittent_or_constant` | Intermittent or Constant | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.error_codes` | Display / Error Codes | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `temperature_checks.fresh_food_temp` | Fresh food compartment (°F) | text | free text / numeric | `temperature_checks` | always when step enabled | `freshFoodCabinetTemp` |
| `temperature_checks.freezer_temp` | Freezer compartment (°F) | text | free text / numeric | `temperature_checks` | always when step enabled | `freezerCabinetTemp` |
| `temperature_checks.ambient_room_temp` | Ambient room temp (°F) | text | free text / numeric | `temperature_checks` | always when step enabled | `ambientRoomTemp` |
| `temperature_checks.evap_air_temp` | Evaporator outlet air (°F, if accessible) | text | free text / numeric | `temperature_checks` | always when step enabled | — |
| `visual_inspection.door_alignment` | Door Alignment | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.gasket_condition` | Gasket Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.cabinet_condition` | Cabinet Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.condenser_condition` | Condenser Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.frost_present` | Heavy Frost / Ice Buildup Present | yn | yes, no | `visual_inspection` | always when step enabled | — |
| `visual_inspection.evaporator_frost_pattern` | Evaporator Frost Pattern | tri | good, fair, bad | `visual_inspection` | showWhen: chip:frost_buildup OR field:visual_inspection.frost_present=yes | — |
| `visual_inspection.ice_maker_visual` | Ice Maker / Dispenser (if equipped) | tri | good, fair, bad | `visual_inspection` | showWhen: chip:ice_maker | — |
| `functional_checks.compressor_running` | Compressor Running | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.condenser_fan_running` | Condenser Fan Running | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.evaporator_fan_running` | Evaporator Fan Running | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.damper_operation` | Fresh Food Damper / Air Tower | gb | good, bad | `functional_checks` | always when step enabled | — |
| `functional_checks.defrost_cycle_observed` | Defrost Cycle Heard / Observed | yn | yes, no | `functional_checks` | showWhen: chip:frost_buildup OR field:visual_inspection.frost_present=yes | — |
| `functional_checks.ice_maker_operation` | Ice Maker Operation (if equipped) | gb | good, bad | `functional_checks` | showWhen: chip:ice_maker | — |
| `functional_checks.water_dispenser` | Water Dispenser (if equipped) | gb | good, bad | `functional_checks` | showWhen: chip:water_dispenser | — |
| `compressor_sealed_system.compressor_amps_running` | Compressor amps — running | text | free text / numeric | `compressor_sealed_system` | always when step enabled | `compressorRunAmps` |
| `compressor_sealed_system.compressor_amps_startup` | Compressor amps — startup / LRA | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.run_winding_ohms` | Compressor run winding (Ω) | text | free text / numeric | `compressor_sealed_system` | always when step enabled | `compressorRunWindingOhms` |
| `compressor_sealed_system.start_winding_ohms` | Compressor start winding (Ω) | text | free text / numeric | `compressor_sealed_system` | always when step enabled | `compressorRunWindingOhms` |
| `compressor_sealed_system.common_to_run_ohms` | Common to run (Ω) | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.common_to_start_ohms` | Common to start (Ω) | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.compressor_voltage` | Voltage at compressor / relay | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.start_relay_overload` | Start relay / overload (part # or test) | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.start_capacitor_uf` | Start capacitor (µF) | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.suction_line_feel` | Suction line temp / frost pattern | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.discharge_line_feel` | Discharge line temp / feel | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.sealed_system_notes` | Sealed system / leak / restriction notes | textarea | free text | `compressor_sealed_system` | always when step enabled | — |
| `defrost_circuit.defrost_heater_ohms` | Defrost heater resistance (Ω) | text | free text / numeric | `defrost_circuit` | always when step enabled | `defrostHeaterOhms` |
| `defrost_circuit.defrost_thermostat` | Defrost thermostat / bi-metal | text | free text / numeric | `defrost_circuit` | always when step enabled | `defrostThermostatOhms` |
| `defrost_circuit.defrost_fuse` | Defrost fuse / thermal fuse | text | free text / numeric | `defrost_circuit` | always when step enabled | `defrostThermalFuseOhms` |
| `defrost_circuit.defrost_thermistor` | Defrost thermistor (Ω or °F) | text | free text / numeric | `defrost_circuit` | always when step enabled | `cabinetThermistorOhms` |
| `fans_and_electrical.condenser_fan_amps` | Condenser fan motor amps | text | free text / numeric | `fans_and_electrical` | always when step enabled | `condenserFanAmps` |
| `fans_and_electrical.evaporator_fan_amps` | Evaporator fan motor amps | text | free text / numeric | `fans_and_electrical` | always when step enabled | `evaporatorFanAmps` |
| `fans_and_electrical.supply_voltage` | Supply voltage (V) | text | free text / numeric | `fans_and_electrical` | always when step enabled | `supplyVoltage120` |
| `fans_and_electrical.fresh_food_thermistor` | Fresh food thermistor (Ω or °F) | text | free text / numeric | `fans_and_electrical` | always when step enabled | `cabinetThermistorOhms` |
| `fans_and_electrical.freezer_thermistor` | Freezer thermistor (Ω or °F) | text | free text / numeric | `fans_and_electrical` | always when step enabled | `cabinetThermistorOhms` |
| `fans_and_electrical.board_notes` | Control board / sensor notes | textarea | free text | `fans_and_electrical` | always when step enabled | — |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.additional_notes` | Additional Notes | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `ambientRoomTemp` | Ambient Room Temperature | °F | normal 65-78 | warning 55-85 | critical <40 or >95 | temperature_checks.ambient_room_temp | normal, warning, critical |
| `cabinetThermistorOhms` | Cabinet Thermistor Resistance | Ω | normal 0.1-0.3 | warning 0.05-0.4 | critical <0.02 or >0.5 | defrost_circuit.defrost_thermistor, fans_and_electrical.freezer_thermistor, fans_and_electrical.fresh_food_thermistor | normal, warning, critical |
| `compressorRunAmps` | Compressor Run Amperage | A | normal 1-4.5 | warning 0.5-6 | critical <0.2 or >8 | compressor_sealed_system.compressor_amps_running | normal, warning, critical |
| `compressorRunWindingOhms` | Compressor Run Winding Resistance | Ω | normal 2-30 | warning 1-40 | critical <0.3 or >60 | compressor_sealed_system.run_winding_ohms, compressor_sealed_system.start_winding_ohms | normal, warning, critical |
| `condenserFanAmps` | Condenser Fan Motor Amperage | A | normal 0.1-0.6 | warning 0.05-0.9 | critical <0.02 or >1.5 | fans_and_electrical.condenser_fan_amps | normal, warning, critical |
| `defrostHeaterOhms` | Defrost Heater Resistance | Ω | normal 20-40 | warning 15-50 | critical <5 or >80 | defrost_circuit.defrost_heater_ohms | normal, warning, critical |
| `defrostThermalFuseOhms` | Defrost Thermal Fuse Continuity | Ω | normal 0-2 | critical <0 or >5 | — | defrost_circuit.defrost_fuse | normal, warning, critical |
| `defrostThermostatOhms` | Defrost Thermostat / Bi-Metal Continuity | Ω | normal 0-5 | warning 0-20 | critical <0 or >50 | defrost_circuit.defrost_thermostat | normal, warning, critical |
| `evaporatorFanAmps` | Evaporator Fan Motor Amperage | A | normal 0.1-0.5 | warning 0.05-0.8 | critical <0.02 or >1.2 | fans_and_electrical.evaporator_fan_amps | normal, warning, critical |
| `freezerCabinetTemp` | Freezer Cabinet Temperature | °F | normal -2-5 | warning -10-10 | critical <-20 or >20 | temperature_checks.freezer_temp | normal, warning, critical |
| `freshFoodCabinetTemp` | Fresh Food Cabinet Temperature | °F | normal 34-40 | warning 30-45 | critical <25 or >50 | temperature_checks.fresh_food_temp | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | fans_and_electrical.supply_voltage | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `defrost_heater_ok` | Defrost heater good | `defrost_system` | `defrost_heater_failed` |
| `defrost_heater_failed` | Defrost heater failed | `defrost_system` | `defrost_heater_ok` |
| `defrost_thermostat_ok` | Defrost termination OK | `defrost_system` | `defrost_thermostat_failed` |
| `defrost_thermostat_failed` | Defrost thermostat / terminator failed | `defrost_system` | `defrost_thermostat_ok` |
| `defrost_fuse_ok` | Defrost fuse good | `defrost_system` | `defrost_fuse_failed` |
| `defrost_fuse_failed` | Defrost thermal fuse blown | `defrost_system` | `defrost_fuse_ok` |
| `evap_fan_ok` | Evap fan OK | `airflow` | `evap_fan_failed` |
| `evap_fan_failed` | Evap fan failed | `airflow` | `evap_fan_ok` |
| `condenser_fan_ok` | Condenser fan OK | `airflow` | `condenser_fan_failed` |
| `condenser_fan_failed` | Condenser fan failed | `airflow` | `condenser_fan_ok` |
| `compressor_ok` | Compressor running normally | `sealed_system` | `compressor_failed` |
| `compressor_failed` | Compressor / start issue | `sealed_system` | `compressor_ok` |
| `sealed_system_fault` | Sealed system restriction/leak | `sealed_system` | — |
| `door_alignment_ok` | Door alignment OK | `door_seal` | `door_alignment_fault` |
| `door_alignment_fault` | Door alignment fault | `door_seal` | `door_alignment_ok` |
| `gasket_ok` | Door gasket OK | `door_seal` | `gasket_fault` |
| `gasket_fault` | Door gasket fault | `door_seal` | `gasket_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `heater_ol` | measurement:defrostHeaterOhms in critical | `defrost_heater_ok` | `defrost_heater_failed` | — |
| `heater_normal` | measurement:defrostHeaterOhms in normal | `defrost_heater_failed` | `defrost_heater_ok` | — |
| `defrost_thermostat_ol` | measurement:defrostThermostatOhms in critical | `defrost_thermostat_ok` | `defrost_thermostat_failed` | — |
| `defrost_thermostat_good` | measurement:defrostThermostatOhms in normal | `defrost_thermostat_failed` | `defrost_thermostat_ok` | — |
| `defrost_fuse_ol` | measurement:defrostThermalFuseOhms in critical | `defrost_fuse_ok` | `defrost_fuse_failed` | — |
| `defrost_fuse_good` | measurement:defrostThermalFuseOhms in normal | `defrost_fuse_failed` | `defrost_fuse_ok` | — |
| `compressor_not_running` | field:functional_checks.compressor_running=no | `compressor_ok`, `sealed_system_fault` | `compressor_failed` | — |
| `compressor_running_low_amps` | measurement:compressorRunAmps in critical|warning | `compressor_ok` | `compressor_failed`, `sealed_system_fault` | — |
| `evap_fan_no` | field:functional_checks.evaporator_fan_running=no | `evap_fan_ok` | `evap_fan_failed` | — |
| `condenser_fan_no` | field:functional_checks.condenser_fan_running=no | `condenser_fan_ok` | `condenser_fan_failed` | — |
| `door_alignment_good` | field:visual_inspection.door_alignment=good | `door_alignment_fault` | `door_alignment_ok` | — |
| `door_alignment_bad` | field:visual_inspection.door_alignment=bad | `door_alignment_ok` | `door_alignment_fault` | — |
| `gasket_good` | field:visual_inspection.gasket_condition=good | `gasket_fault` | `gasket_ok` | — |
| `gasket_bad` | field:visual_inspection.gasket_condition=bad | `gasket_ok` | `gasket_fault` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `frost_chip` | chip:frost_buildup | — | — | `defrost_heater_failed`, `evap_fan_failed` |
| `heavy_frost_yes` | field:visual_inspection.frost_present=yes | — | — | `evap_fan_failed`, `defrost_heater_failed` |

## 5. Existing evidence rules

Total: **45** (44 single-signal, 1 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `chip_not_cooling` | chip:not_cooling | `defrost_system` | category | +10 | no |
| `chip_not_cooling_sealed` | chip:not_cooling | `sealed_system` | category | +8 | no |
| `chip_weak_cooling_ff` | chip:weak_cooling_ff | `airflow` | category | +14 | no |
| `chip_weak_cooling_ff_defrost` | chip:weak_cooling_ff | `defrost_system` | category | +12 | no |
| `chip_weak_cooling_ff_air_leak` | chip:weak_cooling_ff | `air_leak` | category | +10 | no |
| `chip_weak_cooling_fz` | chip:weak_cooling_fz | `sealed_system` | category | +16 | no |
| `chip_weak_cooling_fz_defrost` | chip:weak_cooling_fz | `defrost_system` | category | +12 | no |
| `chip_weak_cooling_fz_airflow` | chip:weak_cooling_fz | `airflow` | category | +10 | no |
| `chip_weak_cooling_general` | chip:weak_cooling | `defrost_system` | category | +8 | no |
| `chip_weak_cooling_general_sealed` | chip:weak_cooling | `sealed_system` | category | +6 | no |
| `chip_frost_buildup` | chip:frost_buildup | `defrost_system` | category | +15 | no |
| `chip_ice_maker` | chip:ice_maker | `ice_maker` | category | +25 | no |
| `chip_water_dispenser` | chip:water_dispenser | `water_system` | category | +25 | no |
| `ff_temp_warning` | measurement:freshFoodCabinetTemp in warning|critical | `defrost_system` | category | +20 | no |
| `ff_temp_normal` | measurement:freshFoodCabinetTemp in normal | `air_leak` | category | decrease | no |
| `fz_temp_critical` | measurement:freezerCabinetTemp in critical|warning | `sealed_system` | category | +25 | no |
| `fz_temp_normal_ff_warm` | measurement:freezerCabinetTemp in normal AND measurement:freshFoodCabinetTemp in warning|critical | `defrost_system` | category | +15 | **yes** |
| `heavy_frost_defrost` | field:visual_inspection.frost_present=yes | `defrost_system` | category | +35 | no |
| `evap_frost_clogged` | field:visual_inspection.evaporator_frost_pattern=bad | `defrost_system` | category | +25 | no |
| `door_good_air_leak` | field:visual_inspection.door_alignment=good | `air_leak` | category | decrease | no |
| `door_bad_air_leak` | field:visual_inspection.door_alignment=bad | `air_leak` | category | +40 | no |
| `gasket_bad_air_leak` | field:visual_inspection.gasket_condition=bad | `air_leak` | category | +30 | no |
| `gasket_good_air_leak` | field:visual_inspection.gasket_condition=good | `air_leak` | category | decrease | no |
| `door_alignment_good_component` | field:visual_inspection.door_alignment=good | `door_alignment` | component | eliminate | no |
| `door_alignment_bad_component` | field:visual_inspection.door_alignment=bad | `door_alignment` | component | confirm | no |
| `gasket_bad_component` | field:visual_inspection.gasket_condition=bad | `door_gasket` | component | confirm | no |
| `gasket_good_component` | field:visual_inspection.gasket_condition=good | `door_gasket` | component | eliminate | no |
| `compressor_not_running` | field:functional_checks.compressor_running=no | `sealed_system` | category | +40 | no |
| `compressor_not_running_confirm` | field:functional_checks.compressor_running=no | `compressor` | component | confirm | no |
| `compressor_running_ok` | field:functional_checks.compressor_running=yes | `compressor` | component | eliminate | no |
| `evap_fan_no` | field:functional_checks.evaporator_fan_running=no | `airflow` | category | +30 | no |
| `evap_fan_no_confirm` | field:functional_checks.evaporator_fan_running=no | `evap_fan` | component | confirm | no |
| `condenser_fan_no` | field:functional_checks.condenser_fan_running=no | `airflow` | category | +25 | no |
| `condenser_fan_no_confirm` | field:functional_checks.condenser_fan_running=no | `condenser_fan` | component | confirm | no |
| `heater_open` | measurement:defrostHeaterOhms in critical | `heater` | component | confirm | no |
| `heater_open_category` | measurement:defrostHeaterOhms in critical | `defrost_system` | category | +40 | no |
| `heater_normal` | measurement:defrostHeaterOhms in normal | `heater` | component | eliminate | no |
| `heater_normal_defrost_unlikely` | measurement:defrostHeaterOhms in normal | `defrost_system` | category | unlikely | no |
| `defrost_thermostat_ol` | measurement:defrostThermostatOhms in critical | `defrost_system` | category | +35 | no |
| `defrost_thermostat_ol_component` | measurement:defrostThermostatOhms in critical | `defrost_thermostat` | component | confirm | no |
| `defrost_fuse_ol` | measurement:defrostThermalFuseOhms in critical | `defrost_system` | category | +40 | no |
| `defrost_thermistor_bad` | measurement:cabinetThermistorOhms in critical|warning | `controls_sensors` | category | +20 | no |
| `defrost_thermistor_bad_component` | measurement:cabinetThermistorOhms in critical | `thermistor` | component | confirm | no |
| `compressor_amps_high` | measurement:compressorRunAmps in critical|warning | `sealed_system` | category | +30 | no |
| `supply_voltage_bad` | measurement:supplyVoltage120 in critical|warning | `controls_sensors` | category | +20 | no |

### Existing multi-signal rules (do not duplicate)

- `fz_temp_normal_ff_warm`: measurement:freezerCabinetTemp in normal AND measurement:freshFoodCabinetTemp in warning|critical → `defrost_system` (Freezer cold but fresh food warm — classic defrost/airflow pattern.)
