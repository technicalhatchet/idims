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
        { knowledgeId: 'whirlpoolFlWasherMotorOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashMotorOhms', platformId: 'samsung_flexwash' },
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
        { knowledgeId: 'whirlpoolFlWasherDrainPumpOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashDrainPumpOhms', platformId: 'samsung_flexwash' },
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
        { knowledgeId: 'whirlpoolFlWasherInletValveOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashInletValveOhms', platformId: 'samsung_flexwash' },
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
        { knowledgeId: 'whirlpoolFlWasherHeaterOhms', platformId: 'whirlpool_fl_dd' },
        { knowledgeId: 'samsungFlexWashHeaterOhms', platformId: 'samsung_flexwash' },
      ],
    },
    'electrical_measurements.recirc_pump_ohms': {
      candidates: [{ knowledgeId: 'whirlpoolFlWasherRecircPumpOhms', platformId: 'whirlpool_fl_dd' }],
    },
    'mechanical_controls.door_lock_ohms': {
      candidates: [
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
        { knowledgeId: 'dishwasherTubThermistorOhms', isDefault: true },
      ],
    },
    'motor_electrical.wash_motor_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolDishwasherAcuWashMotorOhms', platformId: 'whirlpool_dishwasher_acu' },
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
        { knowledgeId: 'dishwasherWaterValveOhms', isDefault: true },
      ],
    },
  },
  electric_dryer: {
    'heat_circuit.heater_ohms': {
      candidates: [
        { knowledgeId: 'whirlpoolCcuDryerHeaterOhms', platformId: 'whirlpool_ccu_dryer' },
        {
          knowledgeId: 'insigniaDryerHeaterOhms',
          platformId: 'insignia_dryer_tdre',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'electricDryerHeatingElementOhms', isDefault: true },
      ],
    },
    'heat_circuit.outlet_thermistor_kohm': {
      candidates: [
        {
          knowledgeId: 'insigniaDryerOutletThermistorKohm',
          platformId: 'insignia_dryer_tdre',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'dryerExhaustThermistorOhms', isDefault: true },
      ],
    },
    'motor_electrical.motor_ohms': {
      candidates: [{ knowledgeId: 'dryerDrumMotorWindingOhms', isDefault: true }],
    },
    'motor_electrical.motor_circuit_ohms': {
      candidates: [{ knowledgeId: 'dryerMotorCircuitOhms', isDefault: true }],
    },
  },
  gas_dryer: {
    'motor_electrical.outlet_thermistor_kohm': {
      candidates: [
        {
          knowledgeId: 'insigniaDryerOutletThermistorKohm',
          platformId: 'insignia_dryer_tdre',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'dryerExhaustThermistorOhms', isDefault: true },
      ],
    },
    'motor_electrical.motor_ohms': {
      candidates: [{ knowledgeId: 'dryerDrumMotorWindingOhms', isDefault: true }],
    },
    'motor_electrical.motor_circuit_ohms': {
      candidates: [{ knowledgeId: 'dryerMotorCircuitOhms', isDefault: true }],
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
        { knowledgeId: 'whirlpoolWrt311DefrostHeaterOhms', platformId: 'whirlpool_wrt311_adc' },
        { knowledgeId: 'whirlpoolWrtDefrostHeaterOhms', platformId: 'whirlpool_wrt_top_mount' },
        { knowledgeId: 'samsungRefrigeratorDefrostHeaterOhms', platformId: 'samsung_sxs' },
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
      candidates: [{ knowledgeId: 'compressorRunWindingOhms', isDefault: true }],
    },
    'compressor_sealed_system.start_winding_ohms': {
      candidates: [{ knowledgeId: 'compressorRunWindingOhms', isDefault: true }],
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
        {
          knowledgeId: 'mideaB3839ThermistorKohm',
          platformId: 'midea_rss',
          manufacturers: [...INSIGNIA],
        },
        { knowledgeId: 'cabinetThermistorOhms', isDefault: true },
      ],
    },
    'fans_and_electrical.thermistor_voltage_v': {
      candidates: [{ knowledgeId: 'refrigeratorThermistorVoltage', platformId: 'samsung_sxs' }],
    },
    'fans_and_electrical.evap_fan_feedback_voltage': {
      candidates: [{ knowledgeId: 'refrigeratorEvapFanFeedbackVoltage', platformId: 'samsung_sxs' }],
    },
    'fans_and_electrical.inverter_ipm_voltage': {
      candidates: [{ knowledgeId: 'refrigeratorInverterIpmVoltage', platformId: 'samsung_sxs' }],
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
