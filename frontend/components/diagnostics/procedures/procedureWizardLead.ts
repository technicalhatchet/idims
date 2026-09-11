import { resolveStepKeyLabel } from '../intelligence/stepKeyLabels';
import type { ProcedureRecommendation } from './recommendServiceProcedures';
import type { ServiceProcedure } from './types';

export const OEM_WIZARD_STEP_KEY = 'oem_test';
export const OEM_WIZARD_STEP_ID = '__oem_test__';

/** Single-chip complaints that get a dedicated OEM wizard step before mechanical checks. */
const OEM_INLINE_WIZARD_CHIPS = new Set(['lid_lock']);

/** Procedure tag → wizard stepKey (guided diagnostics). */
const PROCEDURE_TAG_WIZARD_STEPS: Record<string, string> = {
  // Laundry
  door_lock_check: 'mechanical',
  lid_lock: 'mechanical',
  door_switch_check: 'functional',
  drain_issue: 'electrical',
  pump_check: 'electrical',
  fill_issue: 'functional',
  no_fill: 'functional',
  wont_drain: 'functional',
  no_heat: 'electrical',
  dry_heat: 'electrical',
  heating_element_check: 'electrical',
  hmi_check: 'electrical',
  supply_issue: 'commonly_missed',
  voltage_check: 'electrical',
  motor_check: 'electrical',
  spin_issue: 'functional',
  igniter_check: 'electrical',
  gas_valve_check: 'electrical',
  thermistor: 'electrical',
  moisture_sensor: 'functional',
  vent_fan_check: 'functional',
  // Refrigerator
  sensor_check: 'fans',
  thermistor_check: 'fans',
  defrost_heater: 'defrost',
  frost_buildup: 'defrost',
  no_ice: 'functional',
  ice_maker: 'functional',
  compressor_check: 'sealedSystem',
  sealed_system: 'sealedSystem',
  no_cool: 'temperature',
  // Dishwasher
  wash_motor: 'motor',
  drain_motor: 'motor',
  overfill: 'functional',
  owi_check: 'functional',
  // Range
  bake_element: 'heat',
  broil_element: 'heat',
  convection_element: 'heat',
  cooktop_element: 'functional',
  surface_burner: 'functional',
  oven_lamp: 'functional',
  door_latch_check: 'functional',
  warming_drawer: 'functional',
  warming_zone: 'functional',
  dual_element: 'functional',
  surface_ignition: 'functional',
  no_power: 'commonly_missed',
  display_dead: 'commonly_missed',
};

/** Component id → wizard stepKey when tags do not resolve. */
const COMPONENT_WIZARD_STEPS: Record<string, string> = {
  door_lock: 'mechanical',
  drain_pump: 'electrical',
  inlet_valves: 'electrical',
  drive_motor: 'electrical',
  wash_heater: 'electrical',
  dryer_heater: 'electrical',
  gas_valve: 'electrical',
  ignitor: 'electrical',
  control_hmi: 'electrical',
  control_board: 'diagnosis',
  moisture_sensor: 'functional',
  pressure_switch: 'mechanical',
  shift_actuator: 'mechanical',
  temp_sensor: 'fans',
  defrost_heater: 'defrost',
  compressor: 'sealedSystem',
  ice_maker: 'functional',
  bake_element: 'heat',
  broil_element: 'heat',
  convection_element: 'heat',
  surface_element: 'functional',
  warming_drawer: 'functional',
  warming_zone: 'functional',
  surface_ignition: 'functional',
  supply: 'commonly_missed',
  main_control: 'commonly_missed',
  wash_motor: 'motor',
  diverter_motor: 'motor',
};

const TAG_RESOLVE_ORDER = [
  'door_lock_check',
  'lid_lock',
  'door_switch_check',
  'drain_issue',
  'pump_check',
  'no_heat',
  'heating_element_check',
  'sensor_check',
  'defrost_heater',
  'no_ice',
  'ice_maker',
  'no_fill',
  'wont_drain',
  'motor_check',
  'hmi_check',
  'supply_issue',
  'no_power',
  'igniter_check',
  'gas_valve_check',
];

/** Strong enough to show OEM lead card and bias wizard routing. */
export function isStrongProcedureLead(recommendation: ProcedureRecommendation): boolean {
  return recommendation.priority >= 28 || Boolean(recommendation.matchedErrorCodes?.length);
}

export function shouldInsertOemWizardStep(
  complaintChipIds: string[],
  recommendation: ProcedureRecommendation | null | undefined,
  skippedOemWizardStep?: boolean,
): boolean {
  if (skippedOemWizardStep || !recommendation || !isStrongProcedureLead(recommendation)) {
    return false;
  }
  if (complaintChipIds.length !== 1) return false;
  return OEM_INLINE_WIZARD_CHIPS.has(complaintChipIds[0]);
}

export function resolveWizardStepKeyForProcedure(procedure: ServiceProcedure): string | null {
  const tags = procedure.tags || [];
  for (const tag of TAG_RESOLVE_ORDER) {
    if (tags.includes(tag) && PROCEDURE_TAG_WIZARD_STEPS[tag]) {
      return PROCEDURE_TAG_WIZARD_STEPS[tag];
    }
  }

  for (const tag of tags) {
    const stepKey = PROCEDURE_TAG_WIZARD_STEPS[tag];
    if (stepKey) return stepKey;
  }

  for (const componentId of procedure.componentIds || []) {
    const stepKey = COMPONENT_WIZARD_STEPS[componentId];
    if (stepKey) return stepKey;
  }

  return null;
}

export function resolveWizardStepLabelForProcedure(
  procedure: ServiceProcedure,
  stepKeyLabels?: Record<string, string>,
): string | null {
  const stepKey = resolveWizardStepKeyForProcedure(procedure);
  if (!stepKey) return null;
  return resolveStepKeyLabel(stepKey, stepKeyLabels) || stepKey;
}

/**
 * Prepend OEM-matched wizard step when a platform procedure is a strong lead,
 * so WizardSuggestedStep and intelligence routing align with the OEM panel.
 */
export function mergeOemProcedureWizardSteps(
  baseStepKeys: string[],
  recommendation: ProcedureRecommendation | null | undefined,
  visitedStepKeys: string[],
  insertOemWizardStep = false,
): string[] {
  if (!recommendation) return baseStepKeys;

  if (
    insertOemWizardStep
    && !visitedStepKeys.includes(OEM_WIZARD_STEP_KEY)
  ) {
    const rest = baseStepKeys.filter((key) => key !== OEM_WIZARD_STEP_KEY);
    return [OEM_WIZARD_STEP_KEY, ...rest];
  }

  const stepKey = resolveWizardStepKeyForProcedure(recommendation.procedure);
  if (!stepKey || visitedStepKeys.includes(stepKey)) return baseStepKeys;

  if (!isStrongProcedureLead(recommendation) && recommendation.priority < 25) {
    return baseStepKeys;
  }

  return [stepKey, ...baseStepKeys.filter((key) => key !== stepKey)];
}
