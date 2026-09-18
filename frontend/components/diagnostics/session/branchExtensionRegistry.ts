import type { DecisionBranch } from '../procedures/types';

/**
 * Supplemental branch extensions for harness procedures not in the OEM seed catalog.
 * Key: `${procedureId}:${stepId}:${branchId}`
 */
export const BRANCH_EXTENSION_OVERRIDES: Record<string, Partial<DecisionBranch>> = {
  'fl-washer-scenario-harness:door_lock_step:door_lock_verified_good': {
    nextTestCandidates: [
      { testId: 'motor_command_test', priorityAdjustment: 0.35 },
      { testId: 'motor_output_test', priorityAdjustment: 0.3 },
      { testId: 'drain_test', priorityAdjustment: 0.25 },
    ],
    deprioritize: [
      { target: 'door_lock_test', amount: 0.5 },
    ],
    deprioritizeDomains: ['door_interlock_failure'],
  },
  'fl-washer-scenario-harness:drain_step:drain_verified_good': {
    nextTestCandidates: [
      { testId: 'motor_command_test', priorityAdjustment: 0.4 },
      { testId: 'motor_output_test', priorityAdjustment: 0.35 },
    ],
    deprioritize: [
      { target: 'drain_test', amount: 0.45 },
    ],
    deprioritizeDomains: ['drain_failure'],
  },
  'fl-washer-scenario-harness:motor_command_step:motor_command_present': {
    nextTestCandidates: [
      { testId: 'motor_output_test', priorityAdjustment: 0.45 },
      { testId: 'motor_winding_test', priorityAdjustment: 0.4 },
      { testId: 'mechanical_path_test', priorityAdjustment: 0.35 },
    ],
    deprioritize: [
      { target: 'motor_command_test', amount: 0.35 },
      { target: 'control_failure', amount: 0.25 },
    ],
    deprioritizeDomains: ['control_failure', 'communication_failure'],
  },
  'fl-washer-scenario-harness:motor_command_step:motor_command_absent': {
    deprioritize: [
      { target: 'motor_output_test', amount: 0.4 },
      { target: 'motor_winding_test', amount: 0.35 },
    ],
    nextTestCandidates: [
      { testId: 'motor_command_test', priorityAdjustment: 0.45 },
    ],
  },
  'fl-washer-scenario-harness:control_anomaly_step:control_communication_anomaly': {
    nextTestCandidates: [
      { testId: 'motor_command_test', priorityAdjustment: 0.35 },
      { testId: 'control_output_test', priorityAdjustment: 0.35 },
      { testId: 'motor_output_test', priorityAdjustment: 0.3 },
    ],
    deprioritize: [
      { target: 'control_board_test', amount: 0.2 },
    ],
  },
  'fl-washer-scenario-harness:noop_branch_step:noop_no_eligible_targets': {
    nextTestCandidates: [
      { testId: 'nonexistent_harness_target_xyz', priorityAdjustment: 0.99 },
    ],
  },
  'tl-washer-scenario-harness:lid_lock_step:lid_lock_verified_good': {
    nextTestCandidates: [
      { testId: 'motor_command_test', priorityAdjustment: 0.35 },
      { testId: 'motor_output_test', priorityAdjustment: 0.3 },
      { testId: 'shifter_test', priorityAdjustment: 0.28 },
      { testId: 'drain_test', priorityAdjustment: 0.25 },
    ],
    deprioritize: [
      { target: 'lid_lock_test', amount: 0.5 },
    ],
    deprioritizeDomains: ['lid_lock_issue'],
  },
  'tl-washer-scenario-harness:drain_step:drain_verified_good': {
    nextTestCandidates: [
      { testId: 'motor_command_test', priorityAdjustment: 0.4 },
      { testId: 'motor_output_test', priorityAdjustment: 0.35 },
      { testId: 'shifter_test', priorityAdjustment: 0.3 },
    ],
    deprioritize: [
      { target: 'drain_test', amount: 0.45 },
    ],
    deprioritizeDomains: ['drain_failure'],
  },
  'tl-washer-scenario-harness:motor_command_step:motor_command_present': {
    nextTestCandidates: [
      { testId: 'motor_output_test', priorityAdjustment: 0.45 },
      { testId: 'shifter_test', priorityAdjustment: 0.4 },
      { testId: 'motor_winding_test', priorityAdjustment: 0.35 },
    ],
    deprioritize: [
      { target: 'motor_command_test', amount: 0.35 },
    ],
    deprioritizeDomains: ['control_failure'],
  },
  'tl-washer-scenario-harness:shifter_step:shifter_verified_good': {
    nextTestCandidates: [
      { testId: 'motor_output_test', priorityAdjustment: 0.4 },
      { testId: 'motor_winding_test', priorityAdjustment: 0.35 },
    ],
    deprioritize: [
      { target: 'shifter_test', amount: 0.4 },
    ],
  },
  'vented-dryer-scenario-harness:door_step:door_closed_authorized': {
    nextTestCandidates: [
      { testId: 'motor_run_test', priorityAdjustment: 0.35 },
      { testId: 'blower_run_test', priorityAdjustment: 0.3 },
    ],
    deprioritize: [
      { target: 'door_switch_test', amount: 0.5 },
    ],
    deprioritizeDomains: ['door_authorization_failure'],
  },
  'vented-dryer-scenario-harness:motor_step:motor_running': {
    nextTestCandidates: [
      { testId: 'blower_run_test', priorityAdjustment: 0.35 },
      { testId: 'heat_command_test', priorityAdjustment: 0.25 },
    ],
    deprioritize: [
      { target: 'motor_run_test', amount: 0.4 },
    ],
    deprioritizeDomains: ['drive_failure'],
  },
  'vented-dryer-scenario-harness:blower_step:blower_running': {
    nextTestCandidates: [
      { testId: 'heat_command_test', priorityAdjustment: 0.35 },
      { testId: 'lint_filter_test', priorityAdjustment: 0.2 },
    ],
    deprioritize: [
      { target: 'blower_run_test', amount: 0.4 },
    ],
    deprioritizeDomains: ['blower_failure'],
  },
  'vented-dryer-scenario-harness:airflow_step:airflow_path_clear': {
    nextTestCandidates: [
      { testId: 'heat_command_test', priorityAdjustment: 0.4 },
      { testId: 'heat_output_test', priorityAdjustment: 0.25 },
    ],
    deprioritize: [
      { target: 'lint_filter_test', amount: 0.25 },
      { target: 'exhaust_path_test', amount: 0.25 },
    ],
    deprioritizeDomains: ['lint_filter_failure', 'exhaust_path_failure'],
  },
  'vented-dryer-scenario-harness:heat_command_step:heat_command_present': {
    nextTestCandidates: [
      { testId: 'heat_output_test', priorityAdjustment: 0.45 },
      { testId: 'thermal_protection_test', priorityAdjustment: 0.35 },
      { testId: 'exhaust_temperature_test', priorityAdjustment: 0.3 },
    ],
    deprioritize: [
      { target: 'heat_command_test', amount: 0.35 },
    ],
    deprioritizeDomains: ['control_failure'],
  },
};

export function getBranchExtensionOverrideKey(
  procedureId: string,
  stepId: string,
  branchId: string,
): string {
  return `${procedureId}:${stepId}:${branchId}`;
}

export function resolveBranchExtensionOverride(
  procedureId: string,
  stepId: string,
  branchId: string,
): Partial<DecisionBranch> | null {
  const key = getBranchExtensionOverrideKey(procedureId, stepId, branchId);
  return BRANCH_EXTENSION_OVERRIDES[key] ?? null;
}
