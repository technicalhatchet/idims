import { resolveStepKeyLabel } from '../intelligence/stepKeyLabels';
import type { ProcedureRecommendation } from './recommendServiceProcedures';
import type { ServiceProcedure } from './types';

/** Procedure tag → wizard stepKey (washer/dryer guided diagnostics). */
const PROCEDURE_TAG_WIZARD_STEPS: Record<string, string> = {
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
  supply_issue: 'electrical',
  voltage_check: 'electrical',
  motor_check: 'electrical',
  spin_issue: 'functional',
  igniter_check: 'electrical',
  gas_valve_check: 'electrical',
  thermistor: 'electrical',
  moisture_sensor: 'functional',
  vent_fan_check: 'functional',
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
  moisture_sensor: 'functional',
  pressure_switch: 'mechanical',
  shift_actuator: 'mechanical',
};

const TAG_RESOLVE_ORDER = [
  'door_lock_check',
  'lid_lock',
  'door_switch_check',
  'drain_issue',
  'pump_check',
  'no_heat',
  'heating_element_check',
  'motor_check',
  'hmi_check',
  'supply_issue',
  'igniter_check',
  'gas_valve_check',
];

export function isStrongProcedureLead(recommendation: ProcedureRecommendation): boolean {
  return recommendation.priority >= 35 || Boolean(recommendation.matchedErrorCodes?.length);
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
): string[] {
  if (!recommendation) return baseStepKeys;

  const stepKey = resolveWizardStepKeyForProcedure(recommendation.procedure);
  if (!stepKey || visitedStepKeys.includes(stepKey)) return baseStepKeys;

  const shouldMerge = isStrongProcedureLead(recommendation) || recommendation.priority >= 25;
  if (!shouldMerge) return baseStepKeys;

  return [stepKey, ...baseStepKeys.filter((key) => key !== stepKey)];
}
