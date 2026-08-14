# Signal inventory — standalone_freezer

Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`

See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).

## 1. Complaint signals

| Signal ID | Label | Source | Type | Can combine? | Notes |
|-----------|-------|--------|------|--------------|-------|
| `frost_buildup` | Frost / Ice Buildup | `standalone_freezer/standaloneFreezerComplaints.ts` | chip | Yes (multi-select) | |
| `not_cooling` | Not Cooling / Too Warm | `standalone_freezer/standaloneFreezerComplaints.ts` | chip | Yes (multi-select) | |
| `too_cold` | Too Cold / Over-freezing | `standalone_freezer/standaloneFreezerComplaints.ts` | chip | Yes (multi-select) | |
| `noisy` | Noisy / Vibrating | `standalone_freezer/standaloneFreezerComplaints.ts` | chip | Yes (multi-select) | |
| `leaking` | Leaking Water | `standalone_freezer/standaloneFreezerComplaints.ts` | chip | Yes (multi-select) | |
| `running_constant` | Runs Constantly | `standalone_freezer/standaloneFreezerComplaints.ts` | chip | Yes (multi-select) | |

### Combinability

Complaint chips are **multi-select** — any combination can be selected in the UI.

**Common co-occurring clusters** (not enforced):
- Cooling: `not_cooling` often pairs with section-specific weak cooling chips
- Frost path: `frost_buildup` + cooling complaints

**Semantic opposites** (UI allows both; interpret carefully):
- `too_cold` vs `not_cooling`
- Section weak cooling chips are **not** mutually exclusive

**Elimination hypothesis `oppositeId` pairs** are true mutual exclusivity.

### Routing (chip → enabled wizard steps)

| Route ID | When (chip keywords) | Enables stepKeys |
|----------|----------------------|------------------|
| `frost_ice` | frost_buildup | temperature, visual, defrost, fans, functional |
| `not_cooling` | not_cooling | temperature, visual, sealedSystem, fans, functional |
| `too_cold` | too_cold | temperature, functional, defrost |
| `noisy` | noisy | visual, functional, fans, sealedSystem |
| `leaking` | leaking | visual, functional, defrost, commonly_missed |
| `running_constant` | running_constant | temperature, visual, functional, fans, sealedSystem |

## 2. Wizard field signals

| Field path | Label | Type | Values | Step / section | Visibility | Smart measurement |
|------------|-------|------|--------|----------------|------------|-------------------|
| `commonly_missed.door_sealing` | Door sealing | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.frost_source` | Frost accumulation source | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.condenser_cleanliness` | Condenser cleanliness | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.defrost_drain` | Defrost drain / pan | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `commonly_missed.leveling` | Unit level | check | checked (checklist) | `commonly_missed` | always when step enabled | — |
| `customer_complaint.complaint` | Complaint | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.duration` | Duration | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `customer_complaint.intermittent_or_constant` | Intermittent or Constant | text | free text / numeric | `customer_complaint` | always when step enabled | — |
| `temperature_checks.freezer_temp` | Cabinet temp (°F) | text | free text / numeric | `temperature_checks` | always when step enabled | `freezerCabinetTemp` |
| `temperature_checks.ambient_temp` | Ambient temp (°F) | text | free text / numeric | `temperature_checks` | always when step enabled | `ambientRoomTemp` |
| `visual_inspection.door_alignment` | Door Alignment | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.gasket_condition` | Gasket Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.frost_pattern` | Frost Pattern | gb | good, bad | `visual_inspection` | showWhen: chip:frost_buildup OR chip:not_cooling | — |
| `visual_inspection.condenser_condition` | Condenser Condition | tri | good, fair, bad | `visual_inspection` | always when step enabled | — |
| `visual_inspection.drain_clear` | Drain Clear | yn | yes, no | `visual_inspection` | always when step enabled | — |
| `functional_checks.compressor_running` | Compressor Running | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.condenser_fan_running` | Condenser Fan Running | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.evaporator_fan_running` | Evaporator Fan Running | yn | yes, no | `functional_checks` | always when step enabled | — |
| `functional_checks.defrost_operational` | Defrost System Operational | yn | yes, no | `functional_checks` | showWhen: chip:frost_buildup OR field:visual_inspection.drain_clear=no | — |
| `compressor_sealed_system.compressor_amps_running` | Compressor amps — running | text | free text / numeric | `compressor_sealed_system` | showWhen: chip:not_cooling OR chip:running_constant OR field:functional_checks.compressor_running=no | `compressorRunAmps` |
| `compressor_sealed_system.compressor_amps_startup` | Compressor amps — startup / LRA | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.run_winding_ohms` | Compressor run winding (Ω) | text | free text / numeric | `compressor_sealed_system` | showWhen: chip:not_cooling OR field:functional_checks.compressor_running=no | `compressorRunWindingOhms` |
| `compressor_sealed_system.start_winding_ohms` | Compressor start winding (Ω) | text | free text / numeric | `compressor_sealed_system` | showWhen: field:functional_checks.compressor_running=no | — |
| `compressor_sealed_system.compressor_voltage` | Voltage at compressor / relay | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.suction_line_feel` | Suction line temp / frost pattern | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.discharge_line_feel` | Discharge line temp / feel | text | free text / numeric | `compressor_sealed_system` | always when step enabled | — |
| `compressor_sealed_system.sealed_system_notes` | Sealed system notes | textarea | free text | `compressor_sealed_system` | showWhen: chip:not_cooling OR chip:running_constant | — |
| `defrost_circuit.defrost_heater_ohms` | Defrost heater resistance (Ω) | text | free text / numeric | `defrost_circuit` | showWhen: chip:frost_buildup | `defrostHeaterOhms` |
| `defrost_circuit.defrost_thermostat` | Defrost thermostat / bi-metal | text | free text / numeric | `defrost_circuit` | showWhen: chip:frost_buildup | `defrostThermostatOhms` |
| `defrost_circuit.thermistor_reading` | Cabinet thermistor (Ω or °F) | text | free text / numeric | `defrost_circuit` | always when step enabled | — |
| `fans_and_electrical.condenser_fan_amps` | Condenser fan amps | text | free text / numeric | `fans_and_electrical` | always when step enabled | `condenserFanAmps` |
| `fans_and_electrical.evaporator_fan_amps` | Evaporator fan amps | text | free text / numeric | `fans_and_electrical` | always when step enabled | `evaporatorFanAmps` |
| `fans_and_electrical.supply_voltage` | Supply voltage (V) | text | free text / numeric | `fans_and_electrical` | always when step enabled | `supplyVoltage120` |
| `diagnosis.root_cause` | Root Cause | textarea | free text | `diagnosis` | always when step enabled | — |
| `diagnosis.recommended_repair` | Recommended Repair | textarea | free text | `diagnosis` | always when step enabled | — |

## 3. Smart measurements

| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |
|--------------|------|------|--------|---------|----------|----------------|---------------|
| `ambientRoomTemp` | Ambient Room Temperature | °F | normal 65-78 | warning 55-85 | critical <40 or >95 | temperature_checks.ambient_temp | normal, warning, critical |
| `cabinetThermistorOhms` | Cabinet Thermistor Resistance | Ω | normal 0.1-0.3 | warning 0.05-0.4 | critical <0.02 or >0.5 | defrost_circuit.defrost_thermistor | normal, warning, critical |
| `compressorRunAmps` | Compressor Run Amperage | A | normal 1-4.5 | warning 0.5-6 | critical <0.2 or >8 | compressor_sealed_system.compressor_amps_running, heat_pump_readings.compressor_amps | normal, warning, critical |
| `compressorRunWindingOhms` | Compressor Run Winding Resistance | Ω | normal 2-30 | warning 1-40 | critical <0.3 or >60 | compressor_sealed_system.run_winding_ohms | normal, warning, critical |
| `condenserFanAmps` | Condenser Fan Motor Amperage | A | normal 0.1-0.6 | warning 0.05-0.9 | critical <0.02 or >1.5 | fans_and_electrical.condenser_fan_amps | normal, warning, critical |
| `defrostHeaterOhms` | Defrost Heater Resistance | Ω | normal 20-40 | warning 15-50 | critical <5 or >80 | defrost_circuit.defrost_heater_ohms | normal, warning, critical |
| `defrostThermalFuseOhms` | Defrost Thermal Fuse Continuity | Ω | normal 0-2 | critical <0 or >5 | — | defrost_circuit.defrost_fuse | normal, warning, critical |
| `defrostThermostatOhms` | Defrost Thermostat / Bi-Metal Continuity | Ω | normal 0-5 | warning 0-20 | critical <0 or >50 | defrost_circuit.defrost_thermostat | normal, warning, critical |
| `evaporatorFanAmps` | Evaporator Fan Motor Amperage | A | normal 0.1-0.5 | warning 0.05-0.8 | critical <0.02 or >1.2 | fans_and_electrical.evaporator_fan_amps | normal, warning, critical |
| `freezerCabinetTemp` | Freezer Cabinet Temperature | °F | normal -2-5 | warning -10-10 | critical <-20 or >20 | temperature_checks.freezer_temp | normal, warning, critical |
| `supplyVoltage120` | Supply Voltage (120 VAC) | V | normal 110-125 | warning 105-130 | critical <100 or >135 | fans_and_electrical.supply_voltage | normal, warning, critical |

## 4. Elimination suspects (Phase 5)

| Hypothesis ID | Label | Category | Opposite |
|---------------|-------|----------|----------|
| `defrost_heater_ok` | Defrost heater good | `defrost_system` | `defrost_heater_failed` |
| `defrost_heater_failed` | Defrost heater failed | `defrost_system` | `defrost_heater_ok` |
| `defrost_system_ok` | Defrost system operational | `defrost_system` | `defrost_system_failed` |
| `defrost_system_failed` | Defrost system fault | `defrost_system` | `defrost_system_ok` |
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
| `drain_ok` | Defrost drain clear | `door_seal` | `drain_blocked` |
| `drain_blocked` | Defrost drain blocked | `door_seal` | `drain_ok` |
| `supply_ok` | Supply voltage OK | `electrical_supply` | `supply_fault` |
| `supply_fault` | Supply / voltage issue | `electrical_supply` | `supply_ok` |

### Elimination triggers

| Rule ID | Trigger | Eliminate | Confirm | Suspect |
|---------|---------|-----------|---------|---------|
| `heater_ol` | measurement:defrostHeaterOhms in critical | `defrost_heater_ok` | `defrost_heater_failed` | — |
| `heater_normal` | measurement:defrostHeaterOhms in normal | `defrost_heater_failed` | `defrost_heater_ok` | — |
| `compressor_not_running` | field:functional_checks.compressor_running=no | `compressor_ok`, `sealed_system_fault` | `compressor_failed` | — |
| `compressor_low_amps` | measurement:compressorRunAmps in critical|warning | `compressor_ok` | `compressor_failed`, `sealed_system_fault` | — |
| `evap_fan_no` | field:functional_checks.evaporator_fan_running=no | `evap_fan_ok` | `evap_fan_failed` | — |
| `condenser_fan_no` | field:functional_checks.condenser_fan_running=no | `condenser_fan_ok` | `condenser_fan_failed` | — |
| `defrost_not_operational` | field:functional_checks.defrost_operational=no | `defrost_system_ok` | `defrost_system_failed`, `defrost_heater_failed` | — |
| `door_alignment_bad` | field:visual_inspection.door_alignment=bad | `door_alignment_ok` | `door_alignment_fault` | — |
| `door_alignment_good` | field:visual_inspection.door_alignment=good | `door_alignment_fault` | `door_alignment_ok` | — |
| `gasket_bad` | field:visual_inspection.gasket_condition=bad | `gasket_ok` | `gasket_fault` | — |
| `gasket_good` | field:visual_inspection.gasket_condition=good | `gasket_fault` | `gasket_ok` | — |
| `drain_not_clear` | field:visual_inspection.drain_clear=no | `drain_ok` | `drain_blocked` | — |
| `supply_critical` | measurement:supplyVoltage120 in critical | `supply_ok` | `supply_fault` | — |
| `frost_chip` | chip:frost_buildup | — | — | `defrost_heater_failed`, `evap_fan_failed`, `gasket_fault`, `door_alignment_fault` |
| `frost_pattern_bad` | field:visual_inspection.frost_pattern=bad | — | — | `defrost_heater_failed`, `evap_fan_failed` |
| `not_cooling_chip` | chip:not_cooling | — | — | `compressor_failed`, `sealed_system_fault`, `condenser_fan_failed` |
| `leaking_chip` | chip:leaking | — | — | `drain_blocked`, `defrost_system_failed` |

## 5. Existing evidence rules

Total: **57** (57 single-signal, 0 multi-signal).

| Rule ID | When | Target | Layer | Effect | Multi? |
|---------|------|--------|-------|--------|--------|
| `confirm_heater_ol_defrost_heater_failed` | measurement:defrostHeaterOhms in critical | `defrost_heater` | component | confirm | no |
| `cat_up_heater_ol_defrost_heater_failed` | measurement:defrostHeaterOhms in critical | `defrost_system` | category | +38 | no |
| `eliminate_heater_ol_defrost_heater_ok` | measurement:defrostHeaterOhms in critical | `defrost_heater` | component | eliminate | no |
| `confirm_heater_normal_defrost_heater_ok` | measurement:defrostHeaterOhms in normal | `defrost_heater` | component | confirm | no |
| `cat_down_heater_normal_defrost_heater_ok` | measurement:defrostHeaterOhms in normal | `defrost_system` | category | decrease | no |
| `eliminate_heater_normal_defrost_heater_failed` | measurement:defrostHeaterOhms in normal | `defrost_heater` | component | eliminate | no |
| `cat_unlikely_heater_normal_defrost_heater_failed` | measurement:defrostHeaterOhms in normal | `defrost_system` | category | unlikely | no |
| `confirm_compressor_not_running_compressor_failed` | field:functional_checks.compressor_running=no | `compressor` | component | confirm | no |
| `cat_up_compressor_not_running_compressor_failed` | field:functional_checks.compressor_running=no | `sealed_system` | category | +35 | no |
| `eliminate_compressor_not_running_compressor_ok` | field:functional_checks.compressor_running=no | `compressor` | component | eliminate | no |
| `eliminate_compressor_not_running_sealed_system_fault` | field:functional_checks.compressor_running=no | `sealed_system` | component | eliminate | no |
| `cat_unlikely_compressor_not_running_sealed_system_fault` | field:functional_checks.compressor_running=no | `sealed_system` | category | unlikely | no |
| `confirm_compressor_low_amps_compressor_failed` | measurement:compressorRunAmps in critical|warning | `compressor` | component | confirm | no |
| `cat_up_compressor_low_amps_compressor_failed` | measurement:compressorRunAmps in critical|warning | `sealed_system` | category | +38 | no |
| `confirm_compressor_low_amps_sealed_system_fault` | measurement:compressorRunAmps in critical|warning | `sealed_system` | component | confirm | no |
| `cat_up_compressor_low_amps_sealed_system_fault` | measurement:compressorRunAmps in critical|warning | `sealed_system` | category | +38 | no |
| `eliminate_compressor_low_amps_compressor_ok` | measurement:compressorRunAmps in critical|warning | `compressor` | component | eliminate | no |
| `confirm_evap_fan_no_evap_fan_failed` | field:functional_checks.evaporator_fan_running=no | `evap_fan` | component | confirm | no |
| `cat_up_evap_fan_no_evap_fan_failed` | field:functional_checks.evaporator_fan_running=no | `airflow` | category | +35 | no |
| `eliminate_evap_fan_no_evap_fan_ok` | field:functional_checks.evaporator_fan_running=no | `evap_fan` | component | eliminate | no |
| `confirm_condenser_fan_no_condenser_fan_failed` | field:functional_checks.condenser_fan_running=no | `condenser_fan` | component | confirm | no |
| `cat_up_condenser_fan_no_condenser_fan_failed` | field:functional_checks.condenser_fan_running=no | `airflow` | category | +35 | no |
| `eliminate_condenser_fan_no_condenser_fan_ok` | field:functional_checks.condenser_fan_running=no | `condenser_fan` | component | eliminate | no |
| `confirm_defrost_not_operational_defrost_system_failed` | field:functional_checks.defrost_operational=no | `defrost_system` | component | confirm | no |
| `cat_up_defrost_not_operational_defrost_system_failed` | field:functional_checks.defrost_operational=no | `defrost_system` | category | +35 | no |
| `confirm_defrost_not_operational_defrost_heater_failed` | field:functional_checks.defrost_operational=no | `defrost_heater` | component | confirm | no |
| `cat_up_defrost_not_operational_defrost_heater_failed` | field:functional_checks.defrost_operational=no | `defrost_system` | category | +35 | no |
| `eliminate_defrost_not_operational_defrost_system_ok` | field:functional_checks.defrost_operational=no | `defrost_system` | component | eliminate | no |
| `confirm_door_alignment_bad_door_alignment_fault` | field:visual_inspection.door_alignment=bad | `door_alignment` | component | confirm | no |
| `cat_up_door_alignment_bad_door_alignment_fault` | field:visual_inspection.door_alignment=bad | `door_seal` | category | +35 | no |
| `eliminate_door_alignment_bad_door_alignment_ok` | field:visual_inspection.door_alignment=bad | `door_alignment` | component | eliminate | no |
| `confirm_door_alignment_good_door_alignment_ok` | field:visual_inspection.door_alignment=good | `door_alignment` | component | confirm | no |
| `cat_down_door_alignment_good_door_alignment_ok` | field:visual_inspection.door_alignment=good | `door_seal` | category | decrease | no |
| `eliminate_door_alignment_good_door_alignment_fault` | field:visual_inspection.door_alignment=good | `door_alignment` | component | eliminate | no |
| `cat_unlikely_door_alignment_good_door_alignment_fault` | field:visual_inspection.door_alignment=good | `door_seal` | category | unlikely | no |
| `confirm_gasket_bad_gasket_fault` | field:visual_inspection.gasket_condition=bad | `gasket` | component | confirm | no |
| `cat_up_gasket_bad_gasket_fault` | field:visual_inspection.gasket_condition=bad | `door_seal` | category | +35 | no |
| `eliminate_gasket_bad_gasket_ok` | field:visual_inspection.gasket_condition=bad | `gasket` | component | eliminate | no |
| `confirm_gasket_good_gasket_ok` | field:visual_inspection.gasket_condition=good | `gasket` | component | confirm | no |
| `cat_down_gasket_good_gasket_ok` | field:visual_inspection.gasket_condition=good | `door_seal` | category | decrease | no |
| `eliminate_gasket_good_gasket_fault` | field:visual_inspection.gasket_condition=good | `gasket` | component | eliminate | no |
| `cat_unlikely_gasket_good_gasket_fault` | field:visual_inspection.gasket_condition=good | `door_seal` | category | unlikely | no |
| `confirm_drain_not_clear_drain_blocked` | field:visual_inspection.drain_clear=no | `drain` | component | confirm | no |
| `cat_up_drain_not_clear_drain_blocked` | field:visual_inspection.drain_clear=no | `door_seal` | category | +35 | no |
| `eliminate_drain_not_clear_drain_ok` | field:visual_inspection.drain_clear=no | `drain` | component | eliminate | no |
| `confirm_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `supply` | component | confirm | no |
| `cat_up_supply_critical_supply_fault` | measurement:supplyVoltage120 in critical | `electrical_supply` | category | +38 | no |
| `eliminate_supply_critical_supply_ok` | measurement:supplyVoltage120 in critical | `supply` | component | eliminate | no |
| `chip_frost_buildup_defrost_system` | chip:frost_buildup | `defrost_system` | category | +22 | no |
| `chip_frost_buildup_airflow` | chip:frost_buildup | `airflow` | category | +22 | no |
| `chip_frost_buildup_door_seal` | chip:frost_buildup | `door_seal` | category | +22 | no |
| `suspect_frost_pattern_bad_defrost_heater_failed` | field:visual_inspection.frost_pattern=bad | `defrost_system` | category | +18 | no |
| `suspect_frost_pattern_bad_evap_fan_failed` | field:visual_inspection.frost_pattern=bad | `airflow` | category | +18 | no |
| `chip_not_cooling_sealed_system` | chip:not_cooling | `sealed_system` | category | +22 | no |
| `chip_not_cooling_airflow` | chip:not_cooling | `airflow` | category | +22 | no |
| `chip_leaking_door_seal` | chip:leaking | `door_seal` | category | +22 | no |
| `chip_leaking_defrost_system` | chip:leaking | `defrost_system` | category | +22 | no |
