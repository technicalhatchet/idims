import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { buildMeasurementStatusMap } from '../../knowledge/measurementContext';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { evaluateRouting } from '../../routing/routingEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import type { ProcedureRunState } from '../types';
import {
  executeProcedureContinuationPlan,
  planContinuationAfterProcedureComplete,
  type PlanContinuationAfterProcedureCompleteInput,
} from '../planContinuationAfterProcedureComplete';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

function buildWontSpinContinuationInput(
  procedureRuns: Record<string, ProcedureRunState>,
  overrides: Partial<PlanContinuationAfterProcedureCompleteInput['options']> = {},
): PlanContinuationAfterProcedureCompleteInput {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const visitedStepKeys = ['complaint', 'visual', 'functional', 'oem_test'];
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const measurementStatuses = buildMeasurementStatusMap('washer', fields, MEASUREMENT_CONTEXT);
  const routingResult = evaluateRouting(wizardDefinition, fields, measurementStatuses)!;

  return {
    completedProcedureId: 'w8178558-door-lock',
    completedRunState: procedureRuns['w8178558-door-lock'],
    payload: {
      templateId: 'washer',
      fields,
      visitedStepKeys,
      currentStepKey: 'oem_test',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    routingResult,
    wizardDefinition,
    defaultStepOrder,
    measurementContext: MEASUREMENT_CONTEXT,
    complaintChipIds: ['wont_spin'],
    errorCodes: [],
    visitedStepKeys,
    options: {
      oemRunnerEnabled: true,
      skippedOemWizardStep: false,
      readOnly: false,
      ...overrides,
    },
  };
}

function doorLockVerifiedCompletedRun(): ProcedureRunState {
  return {
    procedureId: 'w8178558-door-lock',
    version: '1.0.0',
    startedAt: '2026-03-12T10:00:00.000Z',
    currentStepId: 'door_lock_path_verified',
    completedStepIds: ['live_test_door_lock', 'door_lock_path_verified'],
    stepInputs: {},
    status: 'completed',
    resolvedBranchEvents: [{
      stepId: 'live_test_door_lock',
      branchId: 'lock_energizes_yes',
      at: '2026-03-12T10:05:00.000Z',
    }],
    appliedDiagnosticEffects: [{
      stepId: 'live_test_door_lock',
      branchId: 'lock_energizes_yes',
      at: '2026-03-12T10:05:00.000Z',
      effects: [
        { type: 'eliminate', componentId: 'door_lock', evidenceId: 'eliminate_door_lock_open_door_lock_ok' },
      ],
    }],
  };
}

function simulateWorkOrderProcedureCompleteContinuation(
  input: PlanContinuationAfterProcedureCompleteInput,
) {
  const plan = planContinuationAfterProcedureComplete(input);
  const jumps: string[] = [];
  const starts: string[] = [];
  executeProcedureContinuationPlan(plan, {
    jumpToStepKey: (stepKey) => jumps.push(stepKey),
    startOemProcedure: (procedureId) => starts.push(procedureId),
  });
  return { plan, jumps, starts };
}

test('completed OEM with another eligible procedure → next_oem', () => {
  const runs = { 'w8178558-door-lock': doorLockVerifiedCompletedRun() };
  const input = buildWontSpinContinuationInput(runs);
  input.completedProcedureId = 'w8178558-door-lock';
  input.completedRunState = runs['w8178558-door-lock'];

  const plan = planContinuationAfterProcedureComplete(input);
  assert.equal(plan.type, 'next_oem');
  if (plan.type === 'next_oem') {
    assert.notEqual(plan.procedureId, 'w8178558-door-lock');
  }
});

test('completed OEM is not selected again', () => {
  const runs = { 'w8178558-door-lock': doorLockVerifiedCompletedRun() };
  const plan = planContinuationAfterProcedureComplete(buildWontSpinContinuationInput(runs));
  assert.notEqual(plan.type === 'next_oem' ? plan.procedureId : null, 'w8178558-door-lock');
});

test('read-only does not allow OEM foreground chaining', () => {
  const runs = { 'w8178558-door-lock': doorLockVerifiedCompletedRun() };
  const plan = planContinuationAfterProcedureComplete(
    buildWontSpinContinuationInput(runs, { readOnly: true }),
  );
  assert.notEqual(plan.type, 'next_oem');
});

test('skipped OEM wizard step does not auto-chain OEM', () => {
  const runs = { 'w8178558-door-lock': doorLockVerifiedCompletedRun() };
  const plan = planContinuationAfterProcedureComplete(
    buildWontSpinContinuationInput(runs, { skippedOemWizardStep: true }),
  );
  assert.notEqual(plan.type, 'next_oem');
});

test('door-lock verified with another OEM remains → next_oem', () => {
  const runs = { 'w8178558-door-lock': doorLockVerifiedCompletedRun() };
  const plan = planContinuationAfterProcedureComplete(buildWontSpinContinuationInput(runs));
  assert.equal(plan.type, 'next_oem');
});

test('door-lock verified with no OEM remains → mechanical or wizard', () => {
  const template = doorLockVerifiedCompletedRun();
  const completedIds = [
    'w8178558-door-lock',
    'w8178558-drain-pump',
    'w8178558-motor-circuit',
    'w8178558-inlet-valves',
    'w8178558-wash-heater',
    'w8178558-pressure-switch',
    'w8178558-dispenser-motor',
    'w8178558-interlock-switch',
  ];
  const runs = Object.fromEntries(
    completedIds.map((procedureId) => [
      procedureId,
      { ...template, procedureId, currentStepId: 'path_verified' },
    ]),
  ) as Record<string, ProcedureRunState>;
  const input = buildWontSpinContinuationInput(runs);
  input.completedProcedureId = 'w8178558-motor-circuit';
  input.completedRunState = runs['w8178558-motor-circuit'];
  const plan = planContinuationAfterProcedureComplete(input);
  assert.notEqual(plan.type, 'next_oem');
  assert.ok(plan.type === 'mechanical' || plan.type === 'next_wizard_step');
});

test('action_required → repair_action', () => {
  const actionRun: ProcedureRunState = {
    procedureId: 'w8178558-door-lock',
    version: '1.0.0',
    startedAt: '2026-03-12T10:00:00.000Z',
    currentStepId: 'replace_door_lock',
    completedStepIds: ['replace_door_lock'],
    stepInputs: {},
    status: 'completed',
    oemOutcome: 'Replace door lock assembly',
  };
  const runs = { 'w8178558-door-lock': actionRun };
  const plan = planContinuationAfterProcedureComplete(buildWontSpinContinuationInput(runs));
  assert.equal(plan.type, 'repair_action');
});

test('work-order orchestration jumps oem_test and starts ranked procedure', () => {
  const runs = { 'w8178558-door-lock': doorLockVerifiedCompletedRun() };
  const { plan, jumps, starts } = simulateWorkOrderProcedureCompleteContinuation(
    buildWontSpinContinuationInput(runs),
  );
  assert.equal(plan.type, 'next_oem');
  assert.deepEqual(jumps, ['oem_test']);
  assert.equal(starts.length, 1);
  assert.notEqual(starts[0], 'w8178558-door-lock');
});

test('executeProcedureContinuationPlan mechanical fallback', () => {
  const jumps: string[] = [];
  executeProcedureContinuationPlan({ type: 'mechanical' }, {
    jumpToStepKey: (key) => jumps.push(key),
    startOemProcedure: () => {},
  });
  assert.deepEqual(jumps, ['mechanical']);
});
