import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { submitProcedureStep, createProcedureRun } from '../../procedures/procedureRunner';
import { getServiceProcedure } from '../../procedures/procedureRegistry';
import type { ProcedureRunState } from '../../procedures/types';
import {
  deriveBranchCandidateAdjustments,
  getNextDiagnosticActions,
  hydrateDiagnosticSession,
  replanDiagnosticActions,
} from '../index';
import type { NextTestCandidate } from '../candidates/types';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

function candidateKey(candidate: NextTestCandidate): string {
  return candidate.procedureId || candidate.wizardStepKey || candidate.id;
}

function buildRankContext(fields: Record<string, unknown>, procedureRuns: Record<string, ProcedureRunState> = {}) {
  const visitedStepKeys = ['complaint', 'visual', 'functional'];
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns,
  });
  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields,
      visitedStepKeys,
      currentStepKey: 'functional',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    derived: { intelligence },
  });
  const procedureContext = {
    templateId: 'washer',
    measurementContext: MEASUREMENT_CONTEXT,
    intelligence,
    complaintChipIds: ['wont_spin'],
    errorCodes: [],
    procedureRuns,
  };
  const wizardContext = { intelligence, wizardDefinition, defaultStepOrder };

  return { session, procedureContext, wizardContext, intelligence };
}

function withResolvedBranches(
  entries: Array<{
    procedureId: string;
    stepId: string;
    branchId: string;
    effects?: Array<{ type: 'eliminate'; componentId: string; evidenceId?: string }>;
  }>,
): Record<string, ProcedureRunState> {
  const runs: Record<string, ProcedureRunState> = {};
  for (const entry of entries) {
    const event = { stepId: entry.stepId, branchId: entry.branchId, at: '2026-03-12T10:05:00.000Z' };
    const effectEntry = entry.effects?.length
      ? [{ stepId: entry.stepId, branchId: entry.branchId, effects: entry.effects, at: event.at }]
      : [];
    const existing = runs[entry.procedureId];
    if (!existing) {
      runs[entry.procedureId] = {
        procedureId: entry.procedureId,
        version: '1.0.0',
        startedAt: '2026-03-12T10:00:00.000Z',
        currentStepId: entry.stepId,
        completedStepIds: [entry.stepId],
        stepInputs: {},
        status: 'completed',
        resolvedBranchEvents: [event],
        appliedDiagnosticEffects: effectEntry,
      };
      continue;
    }
    runs[entry.procedureId] = {
      ...existing,
      completedStepIds: [...new Set([...existing.completedStepIds, entry.stepId])],
      resolvedBranchEvents: [...(existing.resolvedBranchEvents || []), event],
      appliedDiagnosticEffects: [...(existing.appliedDiagnosticEffects || []), ...effectEntry],
    };
  }
  return runs;
}

function testH_motorCommandPresentBoostsOutputPath() {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const before = buildRankContext(fields);
  const beforeRank = getNextDiagnosticActions(before);

  const afterRuns = withResolvedBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'door_lock_step', branchId: 'door_lock_verified_good' },
    { procedureId: 'fl-washer-scenario-harness', stepId: 'drain_step', branchId: 'drain_verified_good' },
    { procedureId: 'fl-washer-scenario-harness', stepId: 'motor_command_step', branchId: 'motor_command_present' },
  ]);
  const after = buildRankContext(fields, afterRuns);
  const afterRank = replanDiagnosticActions(after);

  const motorOutputBefore = beforeRank.candidates.findIndex(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  const motorOutputAfter = afterRank.candidates.findIndex(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );

  assert.ok(motorOutputBefore >= 0, 'motor output candidate present initially');
  assert.ok(motorOutputAfter >= 0, 'motor output candidate present after branch');
  assert.ok(
    motorOutputAfter < motorOutputBefore,
    'motor output should rank higher after motor command present branch',
  );

  const motorOutputCandidate = afterRank.candidates.find(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  assert.ok((motorOutputCandidate?.scoreBreakdown.branchBoost || 0) > 0);
}

function testI_motorCommandAbsentDeprioritizesMotorOutput() {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const before = buildRankContext(fields);
  const beforeMotorIdx = before.session.payload.procedureRuns;

  const afterRuns = withResolvedBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'motor_command_step', branchId: 'motor_command_absent' },
  ]);
  const after = buildRankContext(fields, afterRuns);
  const afterRank = replanDiagnosticActions(after);

  const motorBefore = getNextDiagnosticActions(before).candidates.findIndex(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  const motorAfter = afterRank.candidates.findIndex(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );

  assert.ok(motorBefore >= 0);
  assert.ok(motorAfter >= 0);
  assert.ok(motorAfter > motorBefore, 'motor output should fall when command absent');

  const motorCandidate = afterRank.candidates.find(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  assert.ok((motorCandidate?.scoreBreakdown.deprioritizationPenalty || 0) > 0);
}

function testProcedureRunnerRecordsResolvedBranch() {
  const procedure = getServiceProcedure('w8178558-door-lock');
  assert.ok(procedure);

  const run: ProcedureRunState = {
    ...createProcedureRun(procedure),
    currentStepId: 'live_test_door_lock',
    completedStepIds: ['live_test_door_lock'],
  };

  const lockTest = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' });
  assert.equal(lockTest.matchedBranch?.id, 'lock_energizes_yes');
  assert.ok(
    lockTest.runState.resolvedBranchEvents?.some(
      (event) => event.branchId === 'lock_energizes_yes',
    ),
  );
}

function testBranchAdjustmentsAreRecomputable() {
  const runs = withResolvedBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'motor_command_step', branchId: 'motor_command_present' },
  ]);
  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields: { 'customer_complaint.complaint_tags': ['wont_spin'] },
      visitedStepKeys: ['complaint'],
      currentStepKey: 'complaint',
      procedureRuns: runs,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
  });

  const first = deriveBranchCandidateAdjustments(session);
  const second = deriveBranchCandidateAdjustments(session);
  assert.deepEqual(
    [...first.boosts.entries()],
    [...second.boosts.entries()],
  );
  assert.ok(first.resolvedBranchCount === 1);
}

const tests: Array<[string, () => void]> = [
  ['H motor command present boosts output path', testH_motorCommandPresentBoostsOutputPath],
  ['I motor command absent deprioritizes motor output', testI_motorCommandAbsentDeprioritizesMotorOutput],
  ['procedure runner records resolved branch', testProcedureRunnerRecordsResolvedBranch],
  ['branch adjustments are recomputable', testBranchAdjustmentsAreRecomputable],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} branch rerank tests passed`);
}
