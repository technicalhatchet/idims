import type { MeasurementContext } from './types';
import { getPlatformRule, normalizeMake, resolvePlatformIdFromModel } from './platformRegistry';

export interface FieldKnowledgeCandidate {
  knowledgeId: string;
  /** Platform-specific — only used when model matches platform modelPattern. */
  platformId?: string;
  /** Brand-level — used when make matches and no explicit platform from model. */
  manufacturers?: string[];
  isDefault?: boolean;
}

export interface FieldKnowledgeBinding {
  candidates: FieldKnowledgeCandidate[];
}

const INSIGNIA = ['Insignia'] as const;

const LAYERED_BINDINGS_BY_TEMPLATE: Record<string, Record<string, FieldKnowledgeBinding>> = {
  washer: {
    'electrical_measurements.supply_voltage': {
      candidates: [{ knowledgeId: 'supplyVoltage120', isDefault: true }],
    },
    'electrical_measurements.drive_motor_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolMvw6200WasherMotorWindingOhms', platformId: 'whirlpool_mvw6200' },
        { knowledgeId: 'whirlpoolMvw6200WasherMotorWindingOhms', platformId: 'whirlpool_tl_dd_6157' },
        { knowledgeId: 'whirlpoolWtw4100WasherMotorWindingOhms', platformId: 'whirlpool_tl_dd_4100' },
        { knowledgeId: 'whirlpoolTlDdWasherMotorOhms', platformId: 'whirlpool_tl_dd' },
        { knowledgeId: 'whirlpoolDuetSportWasherMotorOhms', platformId: 'whirlpool_duet_sport' },
        { knowledgeId: 'whirlpoolFlWasherMotorOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashMotorOhms', platformId: 'samsung_flexwash' },
        { knowledgeId: 'samsungTlA50WasherMotorOhms', platformId: 'samsung_tl_washer_a50' },
        { knowledgeId: 'samsungFlBb8700WasherMotorOhms', platformId: 'samsung_fl_washer_bb8700' },
        {
          knowledgeId: 'insigniaWasherFreqDriveMotorOhms',
          platformId: 'insignia_washer_freq',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'washerMotorWindingOhms', isDefault: true },
      ],
    },
    'electrical_measurements.drain_pump_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolMvw6200WasherDrainPumpOhms', platformId: 'whirlpool_mvw6200' },
        { knowledgeId: 'whirlpoolMvw6200WasherDrainPumpOhms', platformId: 'whirlpool_tl_dd_6157' },
        { knowledgeId: 'whirlpoolWtw4100WasherDrainPumpOhms', platformId: 'whirlpool_tl_dd_4100' },
        { knowledgeId: 'whirlpoolTlDdWasherDrainPumpOhms', platformId: 'whirlpool_tl_dd' },
        { knowledgeId: 'whirlpoolDuetSportWasherDrainPumpOhms', platformId: 'whirlpool_duet_sport' },
        { knowledgeId: 'whirlpoolFlWasherDrainPumpOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashDrainPumpOhms', platformId: 'samsung_flexwash' },
        { knowledgeId: 'samsungTlA50WasherDrainPumpOhms', platformId: 'samsung_tl_washer_a50' },
        {
          knowledgeId: 'insigniaWasherCapDrainPumpOhms',
          platformId: 'insignia_washer_cap',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'insigniaWasherFreqDrainPumpOhms', platformId: 'insignia_washer_freq' },
        { knowledgeId: 'washerDrainPumpOhms', isDefault: true },
      ],
    },
    'electrical_measurements.drain_pump_amps': {
      candidates: [{ knowledgeId: 'washerDrainPumpAmps', isDefault: true }],
    },
    'electrical_measurements.inlet_valve_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolMvw6200WasherInletValveOhms', platformId: 'whirlpool_mvw6200' },
        { knowledgeId: 'whirlpoolMvw6200WasherInletValveOhms', platformId: 'whirlpool_tl_dd_6157' },
        { knowledgeId: 'whirlpoolWtw4100WasherInletValveOhms', platformId: 'whirlpool_tl_dd_4100' },
        { knowledgeId: 'whirlpoolTlDdWasherInletValveOhms', platformId: 'whirlpool_tl_dd' },
        { knowledgeId: 'whirlpoolDuetSportWasherInletValveOhms', platformId: 'whirlpool_duet_sport' },
        { knowledgeId: 'whirlpoolFlWasherInletValveOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashInletValveOhms', platformId: 'samsung_flexwash' },
        { knowledgeId: 'samsungTlA50WasherInletValveOhms', platformId: 'samsung_tl_washer_a50' },
        {
          knowledgeId: 'insigniaWasherCapInletValveOhms',
          platformId: 'insignia_washer_cap',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'insigniaWasherFreqInletValveOhms', platformId: 'insignia_washer_freq' },
        { knowledgeId: 'washerWaterValveOhms', isDefault: true },
      ],
    },
    'electrical_measurements.wash_heater_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolTlDdWasherHeaterOhms', platformId: 'whirlpool_tl_dd' },
        { knowledgeId: 'whirlpoolDuetSportWasherHeaterOhms', platformId: 'whirlpool_duet_sport' },
        { knowledgeId: 'whirlpoolFlWasherHeaterOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashHeaterOhms', platformId: 'samsung_flexwash' },
        { knowledgeId: 'samsungFlBb8700WasherHeaterOhms', platformId: 'samsung_fl_washer_bb8700' },
      ],
    },
    'electrical_measurements.recirc_pump_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolTlDdWasherRecircPumpOhms', platformId: 'whirlpool_tl_dd' },
        { knowledgeId: 'whirlpoolFlWasherRecircPumpOhms', platformId: 'whirlpool_fl_dd' },
      ],
    },
    'mechanical_controls.door_lock_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolMvw6200WasherLidLockSolenoidOhms', platformId: 'whirlpool_mvw6200' },
        { knowledgeId: 'whirlpoolMvw6200WasherLidLockSolenoidOhms', platformId: 'whirlpool_tl_dd_6157' },
        { knowledgeId: 'whirlpoolWtw4100WasherLidLockSolenoidOhms', platformId: 'whirlpool_tl_dd_4100' },
        { knowledgeId: 'whirlpoolTlDdWasherLidLockMotorOhms', platformId: 'whirlpool_tl_dd' },
        { knowledgeId: 'whirlpoolFlWasherDoorLockSolenoidOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'whirlpoolDuetSportWasherDoorLockSolenoidOhms', platformId: 'whirlpool_duet_sport' },
        { knowledgeId: 'samsungTlA50WasherDoorLockMotorOhms', platformId: 'samsung_tl_washer_a50' },
        { knowledgeId: 'samsungFlBb8700WasherDoorLockOhms', platformId: 'samsung_fl_washer_bb8700' },
        {
          knowledgeId: 'insigniaWasherCapDoorLockOhms',
          platformId: 'insignia_washer_cap',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'washerDoorLockSwitchOhms', isDefault: true },
      ],
    },
  },
  dishwasher: {
    'heat_water.heater_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolDishwasherAcuHeaterOhms', platformId: 'whirlpool_dishwasher_acu' },
        {
          knowledgeId: 'insigniaDishwasherHeaterOhms',
          platformId: 'insignia_dishwasher',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'lgDishwasherLdt7808HeaterOhms', platformId: 'lg_dishwasher_ldt7808' },
        { knowledgeId: 'dishwasherHeatingElementOhms', isDefault: true },
      ],
    },
    'heat_water.thermistor': {
      candidates: [
        { knowledgeId: 'whirlpoolDishwasherAcuOwiThermistorOhms', platformId: 'whirlpool_dishwasher_acu' },
        {
          knowledgeId: 'insigniaDishwasherTubThermistorOhms',
          platformId: 'insignia_dishwasher',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'lgDishwasherLdt7808ThermistorOhms', platformId: 'lg_dishwasher_ldt7808' },
        { knowledgeId: 'dishwasherTubThermistorOhms', isDefault: true },
      ],
    },
    'motor_electrical.wash_motor_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolDishwasherAcuWashMotorOhms', platformId: 'whirlpool_dishwasher_acu' },
        { knowledgeId: 'lgDishwasherLdt7808WashMotorOhms', platformId: 'lg_dishwasher_ldt7808' },
        { knowledgeId: 'dishwasherCirculationPumpOhms', isDefault: true },
      ],
    },
    'motor_electrical.drain_motor_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolDishwasherAcuDrainMotorOhms', platformId: 'whirlpool_dishwasher_acu' },
        {
          knowledgeId: 'insigniaDishwasherDrainPumpOhms',
          platformId: 'insignia_dishwasher',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'lgDishwasherLdt7808DrainPumpOhms', platformId: 'lg_dishwasher_ldt7808' },
        { knowledgeId: 'dishwasherDrainPumpOhms', isDefault: true },
      ],
    },
    'motor_electrical.inlet_valve_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolDishwasherAcuFillValveOhms', platformId: 'whirlpool_dishwasher_acu' },
        {
          knowledgeId: 'insigniaDishwasherFillValveOhms',
          platformId: 'insignia_dishwasher',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'lgDishwasherLdt7808InletValveOhms', platformId: 'lg_dishwasher_ldt7808' },
        { knowledgeId: 'dishwasherWaterValveOhms', isDefault: true },
      ],
    },
  },
  electric_dryer: {
    'heat_circuit.heater_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerHeaterElementOhms', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'whirlpoolDuetSportDryerHeaterOhms', platformId: 'whirlpool_duet_sport_dryer' },
        { knowledgeId: 'whirlpoolAcuTlDryerHeaterOhms', platformId: 'whirlpool_acu_tl_dryer' },
        { knowledgeId: 'whirlpoolCcuDryerHeaterOhms', platformId: 'whirlpool_ccu_dryer' },
        {
          knowledgeId: 'insigniaDryerHeaterOhms',
          platformId: 'insignia_dryer_tdre',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'samsungTlDv50DryerHeaterSingleOhms', platformId: 'samsung_tl_dryer_dv50' },
        { knowledgeId: 'samsungFlBb8700DryerHeaterOhms', platformId: 'samsung_fl_dryer_bb8700' },
        { knowledgeId: 'samsungFlDv6000DryerHeaterSingleOhms', platformId: 'samsung_fl_dryer_dv6000' },
        { knowledgeId: 'electricDryerHeatingElementOhms', isDefault: true },
      ],
    },
    'heat_circuit.outlet_thermistor_kohm': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerExhaustThermistorKohm', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'whirlpoolDuetSportDryerExhaustThermistorKohm', platformId: 'whirlpool_duet_sport_dryer' },
        {
          knowledgeId: 'insigniaDryerOutletThermistorKohm',
          platformId: 'insignia_dryer_tdre',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'dryerExhaustThermistorOhms', isDefault: true },
      ],
    },
    'motor_electrical.motor_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerMotorOhms', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'whirlpoolDuetSportDryerMotorOhms', platformId: 'whirlpool_duet_sport_dryer' },
        { knowledgeId: 'dryerDrumMotorWindingOhms', isDefault: true },
      ],
    },
    'motor_electrical.motor_circuit_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerMotorCircuitOhms', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'dryerMotorCircuitOhms', isDefault: true },
      ],
    },
  },
  gas_dryer: {
    'gas_ignition.igniter_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerIgnitorOhms', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'whirlpoolDuetSportDryerIgnitorOhms', platformId: 'whirlpool_duet_sport_dryer' },
        { knowledgeId: 'samsungTlDv50DryerIgnitorOhms', platformId: 'samsung_tl_dryer_dv50' },
        { knowledgeId: 'samsungFlBb8700DryerIgnitorOhms', platformId: 'samsung_fl_dryer_bb8700' },
        { knowledgeId: 'hotSurfaceIgniterOhms', isDefault: true },
      ],
    },
    'gas_ignition.gas_valve_coils': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerGasValveCoilOhms', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'whirlpoolDuetSportDryerGasValveCoilOhms', platformId: 'whirlpool_duet_sport_dryer' },
        { knowledgeId: 'samsungTlDv50DryerGasValve12Ohms', platformId: 'samsung_tl_dryer_dv50' },
        { knowledgeId: 'samsungFlBb8700DryerGasValve12Ohms', platformId: 'samsung_fl_dryer_bb8700' },
        { knowledgeId: 'gasValveCoilOhms', isDefault: true },
      ],
    },
    'motor_electrical.outlet_thermistor_kohm': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerExhaustThermistorKohm', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'whirlpoolDuetSportDryerExhaustThermistorKohm', platformId: 'whirlpool_duet_sport_dryer' },
        {
          knowledgeId: 'insigniaDryerOutletThermistorKohm',
          platformId: 'insignia_dryer_tdre',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'dryerExhaustThermistorOhms', isDefault: true },
      ],
    },
    'motor_electrical.motor_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerMotorOhms', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'whirlpoolDuetSportDryerMotorOhms', platformId: 'whirlpool_duet_sport_dryer' },
        { knowledgeId: 'dryerDrumMotorWindingOhms', isDefault: true },
      ],
    },
    'motor_electrical.motor_circuit_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolCentennialDryerMotorCircuitOhms', platformId: 'whirlpool_centennial_dryer' },
        { knowledgeId: 'dryerMotorCircuitOhms', isDefault: true },
      ],
    },
  },
  standalone_freezer: {
    'defrost_circuit.defrost_heater_ohms': {
      candidates: [
        {
          knowledgeId: 'mideaUz21DefrostHeaterOhms',
          platformId: 'midea_uz21',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'defrostHeaterOhms', isDefault: true },
      ],
    },
    'defrost_circuit.defrost_thermistor': {
      candidates: [
        {
          knowledgeId: 'mideaB3839ThermistorKohm',
          platformId: 'midea_uz21',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'cabinetThermistorOhms', isDefault: true },
      ],
    },
    'fans_and_electrical.freezer_thermistor': {
      candidates: [
        {
          knowledgeId: 'mideaB3839ThermistorKohm',
          platformId: 'midea_uz21',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'cabinetThermistorOhms', isDefault: true },
      ],
    },
  },
  gas_range: {
    'electrical_at_board.igniter_resistance': {
      candidates: [
        { knowledgeId: 'samsungNx60OvenIgnitorOhms', platformId: 'samsung_range_nx60' },
        { knowledgeId: 'hotSurfaceIgniterOhms', isDefault: true },
      ],
    },
    'electrical_at_board.igniter_amps': {
      candidates: [
        { knowledgeId: 'samsungNx60GasSafetyValveAmps', platformId: 'samsung_range_nx60' },
        { knowledgeId: 'hotSurfaceIgniterAmps', isDefault: true },
      ],
    },
    'element_sensor_readings.temp_sensor_ohms': {
      candidates: [
        { knowledgeId: 'samsungNx60OvenSensorOhms', platformId: 'samsung_range_nx60' },
        { knowledgeId: 'ovenTempSensorOhms', isDefault: true },
      ],
    },
  },
  electric_range: {
    'element_sensor_readings.temp_sensor_ohms': {
      candidates: [
        { knowledgeId: 'samsungNx60OvenSensorOhms', platformId: 'samsung_range_nx60' },
        { knowledgeId: 'ovenTempSensorOhms', isDefault: true },
      ],
    },
    'board_readings.convection_output': {
      candidates: [
        { knowledgeId: 'samsungNx60ConvectionFanOhms', platformId: 'samsung_range_nx60' },
        { knowledgeId: 'convectionFanMotorAmps', isDefault: true },
      ],
    },
  },
  refrigerator: {
    'temperature_checks.freezer_temp': {
      candidates: [{ knowledgeId: 'freezerCabinetTemp', isDefault: true }],
    },
    'temperature_checks.fresh_food_temp': {
      candidates: [{ knowledgeId: 'freshFoodCabinetTemp', isDefault: true }],
    },
    'temperature_checks.ambient_room_temp': {
      candidates: [{ knowledgeId: 'ambientRoomTemp', isDefault: true }],
    },
    'defrost_circuit.defrost_heater_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolKaFdDefrostHeaterOhms', platformId: 'whirlpool_ka_french_door' },
        { knowledgeId: 'whirlpoolJazzFdDefrostHeaterOhms', platformId: 'whirlpool_jazz_french_door' },
        { knowledgeId: 'whirlpoolWrt311DefrostHeaterOhms', platformId: 'whirlpool_wrt311_adc' },
        { knowledgeId: 'whirlpoolWrtDefrostHeaterOhms', platformId: 'whirlpool_wrt_top_mount' },
        { knowledgeId: 'samsungRefrigeratorDefrostHeaterOhms', platformId: 'samsung_sxs' },
        { knowledgeId: 'samsungBespokeFridgeDefrostHeaterOhms63', platformId: 'samsung_fridge_bespoke' },
        {
          knowledgeId: 'mideaRssDefrostHeaterOhms',
          platformId: 'midea_rss',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'defrostHeaterOhms', isDefault: true },
      ],
    },
    'defrost_circuit.defrost_thermostat': {
      candidates: [
        { knowledgeId: 'whirlpoolKaFdDefrostBimetalOhms', platformId: 'whirlpool_ka_french_door' },
        { knowledgeId: 'whirlpoolJazzFdDefrostBimetalOhms', platformId: 'whirlpool_jazz_french_door' },
        { knowledgeId: 'whirlpoolWrt311DefrostBimetalOhms', platformId: 'whirlpool_wrt311_adc' },
        { knowledgeId: 'whirlpoolWrtDefrostBimetalOhms', platformId: 'whirlpool_wrt_top_mount' },
        { knowledgeId: 'defrostThermostatOhms', isDefault: true },
      ],
    },
    'defrost_circuit.defrost_fuse': {
      candidates: [{ knowledgeId: 'defrostThermalFuseOhms', isDefault: true }],
    },
    'defrost_circuit.defrost_thermistor': {
      candidates: [
        { knowledgeId: 'whirlpoolKaFdThermistorOhms', platformId: 'whirlpool_ka_french_door' },
        { knowledgeId: 'whirlpoolJazzFdThermistorOhms', platformId: 'whirlpool_jazz_french_door' },
        {
          knowledgeId: 'mideaB3839ThermistorKohm',
          platformId: 'midea_rss',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'cabinetThermistorOhms', isDefault: true },
      ],
    },
    'compressor_sealed_system.compressor_amps_running': {
      candidates: [{ knowledgeId: 'compressorRunAmps', isDefault: true }],
    },
    'compressor_sealed_system.run_winding_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolKaFdCompressorRunOhms', platformId: 'whirlpool_ka_french_door' },
        { knowledgeId: 'whirlpoolJazzFdCompressorRunOhms', platformId: 'whirlpool_jazz_french_door' },
        { knowledgeId: 'compressorRunWindingOhms', isDefault: true },
      ],
    },
    'compressor_sealed_system.start_winding_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolKaFdCompressorStartOhms', platformId: 'whirlpool_ka_french_door' },
        { knowledgeId: 'whirlpoolJazzFdCompressorStartOhms', platformId: 'whirlpool_jazz_french_door' },
        { knowledgeId: 'compressorRunWindingOhms', isDefault: true },
      ],
    },
    'compressor_sealed_system.start_relay_overload': {
      candidates: [
        { knowledgeId: 'whirlpoolWrtPtcStartOhms', platformId: 'whirlpool_wrt_top_mount' },
        { knowledgeId: 'whirlpoolWrtPtcStartOhms', platformId: 'whirlpool_wrt311_adc' },
      ],
    },
    'compressor_sealed_system.ptc_start_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolWrtPtcStartOhms', platformId: 'whirlpool_wrt_top_mount' },
        { knowledgeId: 'whirlpoolWrtPtcStartOhms', platformId: 'whirlpool_wrt311_adc' },
      ],
    },
    'defrost_circuit.adc_heater_output_v': {
      candidates: [
        { knowledgeId: 'whirlpoolWrt311AdcDefrostHeaterVoltage', platformId: 'whirlpool_wrt311_adc' },
      ],
    },
    'fans_and_electrical.adc_cooling_output_v': {
      candidates: [
        { knowledgeId: 'whirlpoolWrt311AdcCoolingOutputVoltage', platformId: 'whirlpool_wrt311_adc' },
      ],
    },
    'fans_and_electrical.condenser_fan_amps': {
      candidates: [{ knowledgeId: 'condenserFanAmps', isDefault: true }],
    },
    'fans_and_electrical.evaporator_fan_amps': {
      candidates: [{ knowledgeId: 'evaporatorFanAmps', isDefault: true }],
    },
    'fans_and_electrical.supply_voltage': {
      candidates: [{ knowledgeId: 'supplyVoltage120', isDefault: true }],
    },
    'fans_and_electrical.freezer_thermistor': {
      candidates: [
        { knowledgeId: 'whirlpoolJazzFdThermistorOhms', platformId: 'whirlpool_jazz_french_door' },
        {
          knowledgeId: 'mideaB3839ThermistorKohm',
          platformId: 'midea_rss',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'cabinetThermistorOhms', isDefault: true },
      ],
    },
    'fans_and_electrical.fresh_food_thermistor': {
      candidates: [
        { knowledgeId: 'whirlpoolJazzFdThermistorOhms', platformId: 'whirlpool_jazz_french_door' },
        {
          knowledgeId: 'mideaB3839ThermistorKohm',
          platformId: 'midea_rss',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'cabinetThermistorOhms', isDefault: true },
      ],
    },
    'fans_and_electrical.thermistor_voltage_v': {
      candidates: [
        { knowledgeId: 'samsungBespokeFridgeThermistorVoltage', platformId: 'samsung_fridge_bespoke' },
        { knowledgeId: 'refrigeratorThermistorVoltage', platformId: 'samsung_sxs' },
      ],
    },
    'fans_and_electrical.evap_fan_feedback_voltage': {
      candidates: [
        { knowledgeId: 'samsungBespokeFridgeEvapFanFeedbackVoltage', platformId: 'samsung_fridge_bespoke' },
        { knowledgeId: 'refrigeratorEvapFanFeedbackVoltage', platformId: 'samsung_sxs' },
      ],
    },
    'fans_and_electrical.inverter_ipm_voltage': {
      candidates: [
        { knowledgeId: 'samsungBespokeFridgeInverterIpmVoltage', platformId: 'samsung_fridge_bespoke' },
        { knowledgeId: 'refrigeratorInverterIpmVoltage', platformId: 'samsung_sxs' },
      ],
    },
    'fans_and_electrical.lg_fan_voltage': {
      candidates: [{ knowledgeId: 'lgRefrigeratorFanVoltage', platformId: 'lg_lrmvs' }],
    },
    'defrost_circuit.lg_defrost_heater_voltage': {
      candidates: [{ knowledgeId: 'lgDefrostHeaterVoltage', platformId: 'lg_lrmvs' }],
    },
    'ice_maker_diagnostics.im_mold_heater_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolModularIceMakerMoldHeaterOhms', platformId: 'whirlpool_modular_ice_maker' },
      ],
    },
    'ice_maker_diagnostics.im_motor_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolModularIceMakerMotorOhms', platformId: 'whirlpool_modular_ice_maker' },
      ],
    },
    'ice_maker_diagnostics.im_bimetal_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolModularIceMakerBimetalOhms', platformId: 'whirlpool_modular_ice_maker' },
      ],
    },
    'ice_maker_diagnostics.im_harness_fuse_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolWrtIceMakerThermalFuseOhms', platformId: 'whirlpool_wrt_top_mount' },
        { knowledgeId: 'whirlpoolWrtIceMakerThermalFuseOhms', platformId: 'whirlpool_wrt311_adc' },
        { knowledgeId: 'whirlpoolModularIceMakerHarnessFuseOhms', platformId: 'whirlpool_modular_ice_maker' },
      ],
    },
  },
};

/** Flat bindings for templates not yet migrated to layered resolution. */
const FLAT_BINDINGS_BY_TEMPLATE: Record<string, Record<string, string>> = {};

function bindingFromFlat(knowledgeId: string): FieldKnowledgeBinding {
  return { candidates: [{ knowledgeId, isDefault: true }] };
}

function candidateMatchesBrand(
  candidate: FieldKnowledgeCandidate,
  make: string,
): boolean {
  if (candidate.manufacturers?.includes(make)) return true;

  if (!candidate.platformId) return false;

  const rule = getPlatformRule(candidate.platformId);
  if (!rule?.manufacturers.includes(make)) return false;

  // Brand-wide platform rules (no model pattern) apply at make level.
  return !rule.modelPatterns?.length;
}

export function getFieldBinding(
  templateId: string,
  fieldKey: string,
): FieldKnowledgeBinding | null {
  const layered = LAYERED_BINDINGS_BY_TEMPLATE[templateId]?.[fieldKey];
  if (layered) return layered;

  const flatId = FLAT_BINDINGS_BY_TEMPLATE[templateId]?.[fieldKey];
  if (flatId) return bindingFromFlat(flatId);

  return null;
}

export function resolveFieldKnowledgeId(
  templateId: string | null | undefined,
  fieldKey: string,
  ctx?: MeasurementContext | null,
): string | null {
  if (!templateId || !fieldKey) return null;

  const binding = getFieldBinding(templateId, fieldKey);
  if (!binding) return null;

  const context: MeasurementContext = ctx || { templateId };
  const explicitPlatformId = resolvePlatformIdFromModel(context);
  const make = normalizeMake(context.equipmentMake);

  // 1. Explicit platform from model number
  if (explicitPlatformId) {
    const platformMatch = binding.candidates.find(
      (candidate) => candidate.platformId === explicitPlatformId,
    );
    if (platformMatch) return platformMatch.knowledgeId;
  }

  // 2. Brand (make) — not platform-specific unless model selected above
  if (make) {
    for (const candidate of binding.candidates) {
      if (candidate.isDefault) continue;
      if (candidateMatchesBrand(candidate, make)) {
        return candidate.knowledgeId;
      }
    }
  }

  // 3. Generic default
  const defaultCandidate = binding.candidates.find((candidate) => candidate.isDefault);
  return defaultCandidate?.knowledgeId ?? null;
}

export function listLayeredFieldKeysForTemplate(templateId: string): string[] {
  const layered = Object.keys(LAYERED_BINDINGS_BY_TEMPLATE[templateId] || {});
  const flat = Object.keys(FLAT_BINDINGS_BY_TEMPLATE[templateId] || {});
  return [...new Set([...layered, ...flat])];
}

/** Register flat bindings for non-layered templates (called from fieldBindings.ts). */
export function registerFlatBindings(
  templateId: string,
  bindings: Record<string, string>,
): void {
  FLAT_BINDINGS_BY_TEMPLATE[templateId] = bindings;
}
