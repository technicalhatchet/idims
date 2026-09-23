import assert from 'node:assert/strict';
import {
  evaluateCanonicalGraphState,
  deriveCanonicalRoutingAdjustments,
} from '../../../knowledge/canonical/canonicalGraphRuntime';
import { resolveDiagnosticGraph } from '../../../knowledge/canonical/resolveDiagnosticGraph';
import { hydrateDiagnosticSession } from '../../hydrateDiagnosticSession';
import { getWizardDefinition } from '../../../registry/wizardRegistry';
import { evaluateDiagnosticIntelligence } from '../../../intelligence/diagnosticIntelligenceEngine';
import type { ProcedureRunState } from '../../../procedures/types';
import {
  auditNoPrematureVerifiedFailed,
  breakdownOf,
  buildTlMotorOhmsMeasurementRun,
  candidateKey,
  evaluateTlScenario,
  findComponentState,
  mergeProcedureRuns,
  printEvolutionTable,
  rankOf,
  scoreOf,
  serializeAndRehydrateTlScenario,
  topCandidateLabels,
  VISITED_STEP_KEYS,
  withTlHarnessBranches,
  WONT_SPIN_FIELDS,
  setupTlHarnessProcedures,
  teardownTlHarnessProcedures,
} from '../fixtures/tl-washer/scenarioKit';

const LID = 'w10864849-test-08-lid-lock';
const DRAIN = 'w10864849-test-07-drain-recirc-pump';
const SHIFTER = 'w10864849-test-03a-shifter';
const MOTOR = 'w10864849-test-03b-motor';

const LID_GOOD = { stepId: 'lid_lock_step', branchId: 'lid_lock_verified_good' };
const DRAIN_GOOD = { stepId: 'drain_step', branchId: 'drain_verified_good' };
const COMMAND_PRESENT = { stepId: 'motor_command_step', branchId: 'motor_command_present' };
const SHIFTER_GOOD = { stepId: 'shifter_step', branchId: 'shifter_verified_good' };

function buildTlSession(procedureRuns: Record<string, ProcedureRunState> = {}) {
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence(
    'washer',
    WONT_SPIN_FIELDS,
    undefined,
    {
      visitedStepKeys: VISITED_STEP_KEYS,
      defaultStepOrder,
      procedureRuns,
    },
  );
  return hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields: WONT_SPIN_FIELDS,
      visitedStepKeys: VISITED_STEP_KEYS,
      currentStepKey: 'functional',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WTW9500' },
    derived: { intelligence },
  });
}

function runTlWasherTortureScenario(): void {
  const tlResolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WTW9500',
    platformId: 'whirlpool_tl_dd',
  });
  assert.ok(tlResolved);
  assert.equal(tlResolved.resolution.canonicalOntologyId, 'top_load_washer');
  assert.equal(tlResolved.oemTermAliases['TEST #6: Water Level'], 'pressure_sensor');
  assert.equal(tlResolved.oemTermAliases['TEST #8: Lid Lock'], 'lid_lock');

  const driveDependency = tlResolved.functionalDependencies.find(
    (item) => item.id === 'drive_operation',
  );
  assert.ok(driveDependency?.requires?.includes('mode_shifter'), 'TL drive path requires mode shifter');

  const evolution: Array<{ stage: string; top: string[]; evidence: string }> = [];

  const initialSession = buildTlSession();
  const initialGraph = evaluateCanonicalGraphState(initialSession);
  assert.ok(initialGraph);
  assert.equal(initialGraph.establishedFactIds.has('lid_lock_authorized'), false);

  const initialAdjustments = deriveCanonicalRoutingAdjustments(initialSession);
  const initialLidFit = initialAdjustments.find((item) => item.testTargetId === 'lid_lock_test')?.routingFit ?? 0;
  const initialMotorFit = initialAdjustments.find((item) => item.testTargetId === 'motor_output_test')?.routingFit ?? 0;
  assert.ok(initialLidFit > initialMotorFit, 'lid lock prerequisite should outrank motor initially');

  const initial = evaluateTlScenario();
  evolution.push({
    stage: 'Initial',
    top: topCandidateLabels(initial.result),
    evidence: 'TL graph — lid/shifter/motor unknown',
  });
  auditNoPrematureVerifiedFailed(initial.intelligence, 'Initial');

  assert.ok(rankOf(initial.result.candidates, LID) >= 0);
  assert.ok(rankOf(initial.result.candidates, MOTOR) >= 0 || rankOf(initial.result.candidates, SHIFTER) >= 0);

  const afterLid = evaluateTlScenario(withTlHarnessBranches([LID_GOOD]));
  const lidGraph = evaluateCanonicalGraphState(buildTlSession(withTlHarnessBranches([LID_GOOD])));
  assert.ok(lidGraph?.establishedFactIds.has('lid_lock_authorized'));
  evolution.push({
    stage: 'Lid good',
    top: topCandidateLabels(afterLid.result),
    evidence: 'lid_lock_authorized established',
  });
  auditNoPrematureVerifiedFailed(afterLid.intelligence, 'Lid good');

  assert.ok(
    scoreOf(afterLid.result.candidates, MOTOR) > scoreOf(initial.result.candidates, MOTOR)
      || scoreOf(afterLid.result.candidates, SHIFTER) > scoreOf(initial.result.candidates, SHIFTER),
    'drive path should rise after lid authorization',
  );
  assert.equal(findComponentState(afterLid.intelligence, 'drive_motor')?.state, 'unknown');

  const afterDrain = evaluateTlScenario(withTlHarnessBranches([LID_GOOD, DRAIN_GOOD]));
  evolution.push({
    stage: 'Drain good',
    top: topCandidateLabels(afterDrain.result),
    evidence: 'drain_completion established',
  });
  auditNoPrematureVerifiedFailed(afterDrain.intelligence, 'Drain good');

  const commandRuns = withTlHarnessBranches([LID_GOOD, DRAIN_GOOD, COMMAND_PRESENT]);
  const afterCommand = evaluateTlScenario(commandRuns);
  const commandGraph = evaluateCanonicalGraphState(buildTlSession(commandRuns));
  assert.ok(commandGraph?.establishedFactIds.has('motor_command_present'));
  evolution.push({
    stage: 'Command present',
    top: topCandidateLabels(afterCommand.result),
    evidence: 'motor_command_present — shifter/motor path',
  });
  auditNoPrematureVerifiedFailed(afterCommand.intelligence, 'Command present');

  assert.ok(
    scoreOf(afterCommand.result.candidates, MOTOR) > scoreOf(afterDrain.result.candidates, MOTOR),
    'motor should rise when command established',
  );

  const withShifter = evaluateTlScenario(
    withTlHarnessBranches([LID_GOOD, DRAIN_GOOD, COMMAND_PRESENT, SHIFTER_GOOD]),
  );
  evolution.push({
    stage: 'Shifter good',
    top: topCandidateLabels(withShifter.result),
    evidence: 'mode shifter path verified before motor condemnation',
  });
  auditNoPrematureVerifiedFailed(withShifter.intelligence, 'Shifter good');
  const shifterState = findComponentState(withShifter.intelligence, 'mode_shifter')?.state;
  assert.ok(
    !shifterState || shifterState === 'unknown',
    'mode_shifter must not be prematurely condemned after shifter harness branch',
  );

  const withMeasurement = mergeProcedureRuns(
    commandRuns,
    buildTlMotorOhmsMeasurementRun('999'),
  );
  const afterMeasurement = evaluateTlScenario(withMeasurement);
  const measureGraph = evaluateCanonicalGraphState(buildTlSession(withMeasurement));
  assert.ok(measureGraph?.establishedFactIds.has('motor_output_abnormal'));
  evolution.push({
    stage: 'Motor ohms open',
    top: topCandidateLabels(afterMeasurement.result),
    evidence: 'motor_output_abnormal — investigate, do not auto-condemn',
  });
  auditNoPrematureVerifiedFailed(afterMeasurement.intelligence, 'Motor ohms open');

  const measurementRun = withMeasurement['tl-washer-motor-ohms-harness'];
  assert.ok(measurementRun?.stepEvaluations?.motor_ohms_step);
  assert.equal(measurementRun.stepEvaluations.motor_ohms_step.evaluation.status, 'critical');

  assert.ok(
    scoreOf(afterMeasurement.result.candidates, MOTOR)
      >= scoreOf(afterCommand.result.candidates, MOTOR),
    'abnormal BPM ohms should keep motor investigation prominent without verified_failed',
  );
  assert.notEqual(findComponentState(afterMeasurement.intelligence, 'drive_motor')?.state, 'confirmed');

  const replayed = serializeAndRehydrateTlScenario(withMeasurement);
  const beforeKeys = afterMeasurement.result.candidates.slice(0, 5).map(candidateKey);
  const afterKeys = replayed.candidates.slice(0, 5).map(candidateKey);
  assert.deepEqual(afterKeys, beforeKeys, 'TL scenario ordering survives serialize/rehydrate');

  const motorBreakdown = breakdownOf(afterMeasurement.result.candidates, MOTOR);
  assert.ok(motorBreakdown);
  assert.ok(
    (motorBreakdown.measurementBoost || 0) > 0 || (motorBreakdown.routingFit || 0) > 0,
    'abnormal measurement should influence ranking via boost or routingFit',
  );

  evolution.push({
    stage: 'Final',
    top: topCandidateLabels(afterMeasurement.result),
    evidence: 'No premature component condemnation',
  });
  printEvolutionTable(evolution);
}

function testTlWasherTortureHarness(): void {
  setupTlHarnessProcedures();
  try {
    runTlWasherTortureScenario();
  } finally {
    teardownTlHarnessProcedures();
  }
}

const tests: Array<[string, () => void]> = [
  ['DS-7 TL washer torture harness', testTlWasherTortureHarness],
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
  console.log(`\n${tests.length} DS-7 TL torture test(s) passed`);
}
