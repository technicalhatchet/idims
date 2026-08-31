/** templateId → full field key (sectionId.fieldId) → knowledge catalog id */

const REFRIGERATOR_FIELD_KNOWLEDGE: Record<string, string> = {
  'temperature_checks.freezer_temp': 'freezerCabinetTemp',
  'temperature_checks.fresh_food_temp': 'freshFoodCabinetTemp',
  'temperature_checks.ambient_room_temp': 'ambientRoomTemp',
  'defrost_circuit.defrost_heater_ohms': 'defrostHeaterOhms',
  'defrost_circuit.defrost_thermostat': 'defrostThermostatOhms',
  'defrost_circuit.defrost_fuse': 'defrostThermalFuseOhms',
  'defrost_circuit.defrost_thermistor': 'cabinetThermistorOhms',
  'compressor_sealed_system.compressor_amps_running': 'compressorRunAmps',
  'compressor_sealed_system.run_winding_ohms': 'compressorRunWindingOhms',
  'compressor_sealed_system.start_winding_ohms': 'compressorRunWindingOhms',
  'fans_and_electrical.condenser_fan_amps': 'condenserFanAmps',
  'fans_and_electrical.evaporator_fan_amps': 'evaporatorFanAmps',
  'fans_and_electrical.supply_voltage': 'supplyVoltage120',
  'fans_and_electrical.freezer_thermistor': 'cabinetThermistorOhms',
  'fans_and_electrical.fresh_food_thermistor': 'cabinetThermistorOhms',
};

const WASHER_FIELD_KNOWLEDGE: Record<string, string> = {
  'electrical_measurements.supply_voltage': 'supplyVoltage120',
  'electrical_measurements.drive_motor_ohms': 'washerMotorWindingOhms',
  'electrical_measurements.drain_pump_ohms': 'washerDrainPumpOhms',
  'electrical_measurements.drain_pump_amps': 'washerDrainPumpAmps',
  'electrical_measurements.inlet_valve_ohms': 'washerWaterValveOhms',
  'mechanical_controls.door_lock_ohms': 'washerDoorLockSwitchOhms',
};

const ELECTRIC_DRYER_FIELD_KNOWLEDGE: Record<string, string> = {
  'motor_electrical.supply_voltage': 'supplyVoltage240',
  'heat_circuit.heater_ohms': 'electricDryerHeatingElementOhms',
  'heat_circuit.heater_amps': 'electricDryerSupplyAmps',
  'heat_circuit.thermal_fuse': 'dryerThermalFuseOhms',
  'heat_circuit.cycling_thermostat': 'dryerCyclingThermostatOhms',
  'heat_circuit.high_limit': 'dryerCyclingThermostatOhms',
  'heat_circuit.exhaust_temp': 'dryerExhaustAirTemp',
  'heat_circuit.thermal_cutoff': 'dryerThermalCutoffOhms',
  'heat_circuit.outlet_thermistor_kohm': 'dryerExhaustThermistorOhms',
  'heat_circuit.inlet_thermistor_kohm': 'dryerInletThermistorOhmsElectric',
  'motor_electrical.motor_ohms': 'dryerDrumMotorWindingOhms',
  'motor_electrical.motor_circuit_ohms': 'dryerMotorCircuitOhms',
};

const GAS_DRYER_FIELD_KNOWLEDGE: Record<string, string> = {
  'motor_electrical.supply_voltage': 'supplyVoltage120',
  'gas_ignition.igniter_ohms': 'hotSurfaceIgniterOhms',
  'gas_ignition.igniter_amps': 'hotSurfaceIgniterAmps',
  'gas_ignition.gas_valve_coils': 'gasValveCoilOhms',
  'gas_ignition.flame_sensor_continuity': 'gasFlameSensorContinuityOhms',
  'motor_electrical.motor_ohms': 'dryerDrumMotorWindingOhms',
  'motor_electrical.motor_circuit_ohms': 'dryerMotorCircuitOhms',
  'motor_electrical.thermal_fuse': 'dryerThermalFuseOhms',
  'motor_electrical.exhaust_temp': 'dryerExhaustAirTemp',
  'motor_electrical.outlet_thermistor_kohm': 'dryerExhaustThermistorOhms',
  'motor_electrical.inlet_thermistor_kohm': 'dryerInletThermistorOhmsGas',
};

/** Stacked units vary (electric heat vs gas igniter) — bind unambiguous fields only. */
const STACKED_LAUNDRY_FIELD_KNOWLEDGE: Record<string, string> = {
  'washer_measurements.washer_motor_ohms': 'washerMotorWindingOhms',
  'washer_measurements.drain_pump_ohms': 'washerDrainPumpOhms',
  'dryer_measurements.supply_voltage': 'supplyVoltage240',
  'dryer_measurements.motor_ohms': 'dryerDrumMotorWindingOhms',
  'dryer_measurements.thermal_fuse': 'dryerThermalFuseOhms',
  'dryer_measurements.exhaust_temp': 'dryerExhaustAirTemp',
};

const AIO_LAUNDRY_FIELD_KNOWLEDGE: Record<string, string> = {
  'wash_electrical.supply_voltage': 'supplyVoltage120',
  'wash_electrical.wash_motor_ohms': 'washerMotorWindingOhms',
  'wash_electrical.drain_pump_ohms': 'washerDrainPumpOhms',
  'heat_pump_readings.compressor_amps': 'compressorRunAmps',
  'heat_pump_readings.compressor_ohms': 'compressorRunWindingOhms',
  'heat_pump_readings.heat_pump_fan_amps': 'condenserFanAmps',
};

const DISHWASHER_FIELD_KNOWLEDGE: Record<string, string> = {
  'heat_water.incoming_water_temp': 'dishwasherIncomingWaterTemp',
  'heat_water.heater_ohms': 'dishwasherHeatingElementOhms',
  'heat_water.heater_amps': 'dishwasherHeaterAmps',
  'heat_water.thermistor': 'dishwasherTubThermistorOhms',
  'motor_electrical.supply_voltage': 'supplyVoltage120',
  'motor_electrical.wash_motor_ohms': 'dishwasherCirculationPumpOhms',
  'motor_electrical.drain_motor_ohms': 'dishwasherDrainPumpOhms',
  'motor_electrical.inlet_valve_ohms': 'dishwasherWaterValveOhms',
  'motor_electrical.float_switch': 'dishwasherFloatSwitchOhms',
};

const ELECTRIC_RANGE_FIELD_KNOWLEDGE: Record<string, string> = {
  'terminal_block_readings.l1_l2_voltage': 'supplyVoltage240',
  'terminal_block_readings.l1_neutral_voltage': 'supplyVoltage120',
  'terminal_block_readings.l2_neutral_voltage': 'supplyVoltage120',
  'terminal_block_readings.neutral_ground_voltage': 'neutralGroundVoltage',
  'element_sensor_readings.bake_element_ohms': 'bakeElementOhms',
  'element_sensor_readings.broil_element_ohms': 'broilElementOhms',
  'element_sensor_readings.bake_element_amps': 'electricRangeElementAmps',
  'element_sensor_readings.broil_element_amps': 'electricRangeElementAmps',
  'element_sensor_readings.temp_sensor_ohms': 'ovenTempSensorOhms',
  'board_readings.board_supply_voltage': 'supplyVoltage240',
  'board_readings.bake_relay_output': 'supplyVoltage240',
  'board_readings.broil_relay_output': 'supplyVoltage240',
  'board_readings.convection_output': 'convectionFanMotorAmps',
};

const GAS_RANGE_FIELD_KNOWLEDGE: Record<string, string> = {
  'electrical_at_board.supply_voltage': 'supplyVoltage120',
  'electrical_at_board.board_supply_voltage': 'supplyVoltage120',
  'electrical_at_board.igniter_amps': 'hotSurfaceIgniterAmps',
  'electrical_at_board.igniter_resistance': 'hotSurfaceIgniterOhms',
  'electrical_at_board.gas_valve_coil_ohms': 'gasValveCoilOhms',
  'electrical_at_board.flame_sensor_continuity': 'gasFlameSensorContinuityOhms',
  'board_readings.valve_voltage_on': 'supplyVoltage120',
  'board_readings.igniter_circuit_voltage': 'supplyVoltage120',
};

const MICROWAVE_FIELD_KNOWLEDGE: Record<string, string> = {
  'door_safety.primary_door_switch': 'microwaveDoorInterlockSwitchOhms',
  'door_safety.monitor_switch': 'microwaveDoorInterlockSwitchOhms',
  'door_safety.thermal_cutout': 'microwaveThermalCutoutOhms',
  'door_safety.fuse_continuity': 'microwaveLineFuseOhms',
  'electrical_hv.supply_voltage': 'supplyVoltage120',
  'electrical_hv.magnetron_ohms': 'microwaveMagnetronFilamentOhms',
  'electrical_hv.hv_diode': 'microwaveHVDiodeCheck',
  'electrical_hv.capacitor_uf': 'microwaveHVCapacitanceMFD',
};

const FIELD_BINDINGS_BY_TEMPLATE: Record<string, Record<string, string>> = {
  refrigerator: REFRIGERATOR_FIELD_KNOWLEDGE,
  standalone_freezer: {
    'temperature_checks.freezer_temp': 'freezerCabinetTemp',
    'temperature_checks.ambient_temp': 'ambientRoomTemp',
    'defrost_circuit.defrost_heater_ohms': 'defrostHeaterOhms',
    'defrost_circuit.defrost_thermostat': 'defrostThermostatOhms',
    'defrost_circuit.defrost_fuse': 'defrostThermalFuseOhms',
    'defrost_circuit.defrost_thermistor': 'cabinetThermistorOhms',
    'compressor_sealed_system.compressor_amps_running': 'compressorRunAmps',
    'compressor_sealed_system.run_winding_ohms': 'compressorRunWindingOhms',
    'fans_and_electrical.condenser_fan_amps': 'condenserFanAmps',
    'fans_and_electrical.evaporator_fan_amps': 'evaporatorFanAmps',
    'fans_and_electrical.supply_voltage': 'supplyVoltage120',
    'heat_pump_readings.compressor_amps': 'compressorRunAmps',
  },
  washer: WASHER_FIELD_KNOWLEDGE,
  electric_dryer: ELECTRIC_DRYER_FIELD_KNOWLEDGE,
  gas_dryer: GAS_DRYER_FIELD_KNOWLEDGE,
  stacked_laundry: STACKED_LAUNDRY_FIELD_KNOWLEDGE,
  aio_laundry: AIO_LAUNDRY_FIELD_KNOWLEDGE,
  dishwasher: DISHWASHER_FIELD_KNOWLEDGE,
  electric_range: ELECTRIC_RANGE_FIELD_KNOWLEDGE,
  gas_range: GAS_RANGE_FIELD_KNOWLEDGE,
  microwave: MICROWAVE_FIELD_KNOWLEDGE,
};

export function getFieldKnowledgeId(
  templateId: string | null | undefined,
  fieldKey: string,
): string | null {
  if (!templateId || !fieldKey) return null;
  return FIELD_BINDINGS_BY_TEMPLATE[templateId]?.[fieldKey] || null;
}

export function listSmartFieldKeysForTemplate(templateId: string): string[] {
  return Object.keys(FIELD_BINDINGS_BY_TEMPLATE[templateId] || {});
}
