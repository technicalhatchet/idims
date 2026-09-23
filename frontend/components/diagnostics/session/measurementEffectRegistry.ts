import type { MeasurementStatus } from '../knowledge/types';
import type { DecisionBranch } from '../procedures/types';

export type MeasurementEffectRule = Pick<
  DecisionBranch,
  'nextTestCandidates' | 'deprioritize' | 'deprioritizeDomains'
>;

/**
 * Re-derived at rank time from frozen stepEvaluations — abnormal measurement ≠ auto-condemn.
 * Key: `${knowledgeId}:${status}`
 */
export const MEASUREMENT_EFFECT_RULES: Record<string, MeasurementEffectRule> = {
  'flWasherHarnessMotorLoadVoltage120:critical': {
    nextTestCandidates: [
      { testId: 'wiring_connection_test', priorityAdjustment: 0.4 },
      { testId: 'motor_output_test', priorityAdjustment: 0.35 },
      { testId: 'control_output_test', priorityAdjustment: 0.3 },
    ],
    deprioritize: [
      { target: 'control_board_test', amount: 0.4 },
      { target: 'control_failure', amount: 0.35 },
    ],
    deprioritizeDomains: ['control_failure'],
  },
  'flWasherHarnessMotorLoadVoltage120:warning': {
    nextTestCandidates: [
      { testId: 'wiring_connection_test', priorityAdjustment: 0.25 },
      { testId: 'motor_output_test', priorityAdjustment: 0.2 },
    ],
    deprioritize: [
      { target: 'control_board_test', amount: 0.2 },
    ],
  },
};

export function getMeasurementEffectRuleKey(
  knowledgeId: string,
  status: MeasurementStatus,
): string {
  return `${knowledgeId}:${status}`;
}

export function resolveMeasurementEffectRule(
  knowledgeId: string,
  status: MeasurementStatus,
): MeasurementEffectRule | null {
  const key = getMeasurementEffectRuleKey(knowledgeId, status);
  return MEASUREMENT_EFFECT_RULES[key] ?? null;
}
