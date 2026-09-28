import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import type { ProcedureRunState } from '../../procedures/types';
import { getNextDiagnosticActions, hydrateDiagnosticSession, replanDiagnosticActions } from '../index';
import type { NextTestCandidate } from '../candidates/types';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

function candidateKey(candidate: NextTestCandidate): string {
  return candidate.procedureId || candidate.wizardStepKey || candidate.id;
}

function buildScenario(procedureRuns: Record<string, ProcedureRunState> = {}) {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
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

  return getNextDiagnosticActions({
    session,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns,
    },
    limit: 12,
  });
}

function withBranches(
  entries: Array<{
    procedureId: string;
    stepId: string;
    branchId: string;
    effects?: ProcedureRunState['appliedDiagnosticEffects'];
  }>,
): Record<string, ProcedureRunState> {
  const runs: Record<string, ProcedureRunState> = {};

  for (const entry of entries) {
    const existing = runs[entry.procedureId];
    const resolvedEvent = {
      stepId: entry.stepId,
      branchId: entry.branchId,
      at: '2026-03-12T10:05:00.000Z',
    };
    if (!existing) {
      runs[entry.procedureId] = {
        procedureId: entry.procedureId,
        version: '1.0.0',
        startedAt: '2026-03-12T10:00:00.000Z',
        currentStepId: entry.stepId,
        completedStepIds: [entry.stepId],
        stepInputs: {},
        status: 'completed',
        resolvedBranchEvents: [resolvedEvent],
        appliedDiagnosticEffects: entry.effects || [],
      };
      continue;
    }

    runs[entry.procedureId] = {
      ...existing,
      completedStepIds: [...new Set([...existing.completedStepIds, entry.stepId])],
      resolvedBranchEvents: [...(existing.resolvedBranchEvents || []), resolvedEvent],
      appliedDiagnosticEffects: [
        ...(existing.appliedDiagnosticEffects || []),
        ...(entry.effects || []),
      ],
    };
  }

  return runs;
}

function rankOf(candidates: NextTestCandidate[], key: string): number {
  return candidates.findIndex((item) => candidateKey(item) === key);
}

function scoreOf(candidates: NextTestCandidate[], key: string): number {
  return candidates.find((item) => candidateKey(item) === key)?.score ?? -1;
}

function testInitialPoolContainsDoorDrainMotorPaths() {
  const result = buildScenario();
  const keys = result.candidates.map(candidateKey);

  assert.ok(keys.includes('w8178558-door-lock'), 'door lock OEM candidate');
  assert.ok(keys.includes('w8178558-drain-pump'), 'drain OEM candidate');
  assert.ok(keys.includes('w8178558-motor-circuit'), 'motor OEM candidate');
}

function testDoorLockVerifiedGoodShiftsRanking() {
  const initial = buildScenario();
  const after = buildScenario(withBranches([{
    procedureId: 'w8178558-door-lock',
    stepId: 'live_test_door_lock',
    branchId: 'lock_energizes_yes',
    effects: [{
      stepId: 'live_test_door_lock',
      branchId: 'lock_energizes_yes',
      at: '2026-03-12T10:05:00.000Z',
      effects: [
        { type: 'eliminate', componentId: 'door_lock', evidenceId: 'eliminate_door_lock_open_door_lock_ok' },
      ],
    }],
  }]));

  const doorBeforeScore = scoreOf(initial.candidates, 'w8178558-door-lock');
  const doorAfterScore = scoreOf(after.candidates, 'w8178558-door-lock');
  const motorBeforeScore = scoreOf(initial.candidates, 'w8178558-motor-circuit');
  const motorAfterScore = scoreOf(after.candidates, 'w8178558-motor-circuit');

  assert.ok(doorBeforeScore > 0 && motorBeforeScore > 0);
  assert.ok(
    doorAfterScore < doorBeforeScore
    || after.blockedCandidates.some((item) => item.procedureId === 'w8178558-door-lock'),
    'door lock should fall or leave eligible pool after verified good',
  );
  assert.ok(motorAfterScore > motorBeforeScore, 'motor path score should rise after door lock verified good');
}

function testDrainVerifiedGoodShiftsTowardMotorPath() {
  const afterDoor = buildScenario(withBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'door_lock_step', branchId: 'door_lock_verified_good' },
  ]));
  const afterDrain = buildScenario(withBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'door_lock_step', branchId: 'door_lock_verified_good' },
    { procedureId: 'fl-washer-scenario-harness', stepId: 'drain_step', branchId: 'drain_verified_good' },
  ]));

  const drainAfterDoorScore = scoreOf(afterDoor.candidates, 'w8178558-drain-pump');
  const drainAfterDrainScore = scoreOf(afterDrain.candidates, 'w8178558-drain-pump');
  const motorAfterDoorScore = scoreOf(afterDoor.candidates, 'w8178558-motor-circuit');
  const motorAfterDrainScore = scoreOf(afterDrain.candidates, 'w8178558-motor-circuit');

  assert.ok(drainAfterDrainScore < drainAfterDoorScore, 'drain score should fall after drain verified good');
  assert.ok(motorAfterDrainScore > motorAfterDoorScore, 'motor score should rise after drain verified good');
}

function testMotorCommandPresentNarrowsToOutputPathWithoutAutoCondemn() {
  const afterDrain = buildScenario(withBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'door_lock_step', branchId: 'door_lock_verified_good' },
    { procedureId: 'fl-washer-scenario-harness', stepId: 'drain_step', branchId: 'drain_verified_good' },
  ]));
  const afterCommand = buildScenario(withBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'door_lock_step', branchId: 'door_lock_verified_good' },
    { procedureId: 'fl-washer-scenario-harness', stepId: 'drain_step', branchId: 'drain_verified_good' },
    { procedureId: 'fl-washer-scenario-harness', stepId: 'motor_command_step', branchId: 'motor_command_present' },
  ]));

  const motorBeforeScore = scoreOf(afterDrain.candidates, 'w8178558-motor-circuit');
  const motorAfterScore = scoreOf(afterCommand.candidates, 'w8178558-motor-circuit');
  assert.ok(motorAfterScore > motorBeforeScore, 'motor output score should rise when command present');

  const top = afterCommand.candidates[0];
  assert.ok(
    top.procedureId === 'w8178558-motor-circuit'
    || top.wizardStepKey === 'electrical'
    || top.wizardStepKey === 'mechanical',
    'top candidate should be downstream output/mechanical path, not auto-condemn',
  );

  const motorCandidate = afterCommand.candidates.find(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  assert.ok(motorCandidate);
  assert.equal(motorCandidate.scoreBreakdown.hypothesisAlignment, 0);
}

function testReplanLoopChangesNextTest() {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const visitedStepKeys = ['complaint', 'visual', 'functional'];
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];

  let procedureRuns: Record<string, ProcedureRunState> = {};
  const intelligenceBefore = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns,
  });
  const sessionBefore = hydrateDiagnosticSession({
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
    derived: { intelligence: intelligenceBefore },
  });
  const before = replanDiagnosticActions({
    session: sessionBefore,
    wizardContext: { intelligence: intelligenceBefore, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence: intelligenceBefore,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns,
    },
  });

  procedureRuns = withBranches([
    { procedureId: 'fl-washer-scenario-harness', stepId: 'motor_command_step', branchId: 'motor_command_present' },
  ]);
  const intelligenceAfter = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns,
  });
  const sessionAfter = hydrateDiagnosticSession({
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
    derived: { intelligence: intelligenceAfter },
  });
  const after = replanDiagnosticActions({
    session: sessionAfter,
    wizardContext: { intelligence: intelligenceAfter, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence: intelligenceAfter,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns,
    },
  });

  assert.notDeepEqual(
    before.candidates.slice(0, 5).map(candidateKey),
    after.candidates.slice(0, 5).map(candidateKey),
    'top candidate ordering must change after knowledge-changing result',
  );
}

const tests: Array<[string, () => void]> = [
  ['initial pool contains door/drain/motor paths', testInitialPoolContainsDoorDrainMotorPaths],
  ['door lock verified good shifts ranking', testDoorLockVerifiedGoodShiftsRanking],
  ['drain verified good shifts toward motor path', testDrainVerifiedGoodShiftsTowardMotorPath],
  ['motor command present narrows without auto condemn', testMotorCommandPresentNarrowsToOutputPathWithoutAutoCondemn],
  ['replan loop changes next test', testReplanLoopChangesNextTest],
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
  console.log(`\n${tests.length} FL washer wont-spin tests passed`);
}
