import assert from 'node:assert/strict';
import {
  assertRankingFlip,
  auditNoPrematureVerifiedFailed,
  breakdownOf,
  buildCompletedDoorLockRun,
  buildMotorVoltageMeasurementRun,
  candidateKey,
  evaluateScenario,
  findComponentState,
  mergeProcedureRuns,
  printEvolutionTable,
  rankOf,
  scoreOf,
  serializeAndRehydrateScenario,
  setupHarnessProcedures,
  summarizeComponentStates,
  teardownHarnessProcedures,
  topCandidateLabels,
  withHarnessBranches,
} from '../fixtures/fl-washer/scenarioKit';

const DOOR = 'w8178558-door-lock';
const DRAIN = 'w8178558-drain-pump';
const MOTOR = 'w8178558-motor-circuit';

const DOOR_GOOD = { stepId: 'door_lock_step', branchId: 'door_lock_verified_good' };
const DRAIN_GOOD = { stepId: 'drain_step', branchId: 'drain_verified_good' };
const COMMAND_PRESENT = { stepId: 'motor_command_step', branchId: 'motor_command_present' };
const CONTROL_ANOMALY = { stepId: 'control_anomaly_step', branchId: 'control_communication_anomaly' };
const NOOP_BRANCH = { stepId: 'noop_branch_step', branchId: 'noop_no_eligible_targets' };

function baseDoorDrainCommandRuns() {
  return withHarnessBranches([DOOR_GOOD, DRAIN_GOOD, COMMAND_PRESENT]);
}

function runFullTortureScenario(): void {
  const evolution: Array<{ stage: string; top: string[]; evidence: string }> = [];

  // --- Initial ---
  const initial = evaluateScenario();
  evolution.push({
    stage: 'Initial',
    top: topCandidateLabels(initial.result),
    evidence: 'Unknown door/drain/motor',
  });
  auditNoPrematureVerifiedFailed(initial.intelligence, 'Initial');

  assert.ok(rankOf(initial.result.candidates, DOOR) >= 0);
  assert.ok(rankOf(initial.result.candidates, DRAIN) >= 0);
  assert.ok(rankOf(initial.result.candidates, MOTOR) >= 0);

  // --- Stage A: Door lock verified good ---
  const doorGoodRuns = withHarnessBranches([DOOR_GOOD]);
  const afterDoor = evaluateScenario(doorGoodRuns);
  evolution.push({
    stage: 'Door good',
    top: topCandidateLabels(afterDoor.result),
    evidence: 'Door interlock deprioritized',
  });
  auditNoPrematureVerifiedFailed(afterDoor.intelligence, 'Door good');

  if (
    rankOf(initial.result.candidates, DOOR) >= 0
    && rankOf(initial.result.candidates, MOTOR) >= 0
    && rankOf(initial.result.candidates, DOOR) < rankOf(initial.result.candidates, MOTOR)
  ) {
    assertRankingFlip(
      initial.result.candidates,
      afterDoor.result.candidates,
      DOOR,
      MOTOR,
      'Stage A door vs motor',
    );
  }
  assert.ok(
    scoreOf(afterDoor.result.candidates, MOTOR) > scoreOf(initial.result.candidates, MOTOR),
    'motor score should rise after door verified good',
  );
  assert.ok(
    scoreOf(afterDoor.result.candidates, DOOR) < scoreOf(initial.result.candidates, DOOR)
    || afterDoor.result.blockedCandidates.some((item) => item.procedureId === DOOR),
    'door should fall or leave eligible pool after verified good',
  );

  // --- Stage B: Drain verified good ---
  const afterDrain = evaluateScenario(withHarnessBranches([DOOR_GOOD, DRAIN_GOOD]));
  evolution.push({
    stage: 'Drain good',
    top: topCandidateLabels(afterDrain.result),
    evidence: 'Drain deprioritized; door stays down',
  });
  auditNoPrematureVerifiedFailed(afterDrain.intelligence, 'Drain good');

  assert.ok(
    scoreOf(afterDrain.result.candidates, DRAIN) < scoreOf(afterDoor.result.candidates, DRAIN),
    'drain score should fall after drain verified good',
  );
  assert.ok(
    scoreOf(afterDrain.result.candidates, MOTOR) > scoreOf(afterDoor.result.candidates, MOTOR),
    'motor score should rise after drain verified good',
  );
  assert.ok(
    scoreOf(afterDrain.result.candidates, DOOR) <= scoreOf(afterDoor.result.candidates, DOOR),
    'door should remain deprioritized after drain good',
  );

  // --- Stage C: Motor command present ---
  const afterCommand = evaluateScenario(baseDoorDrainCommandRuns());
  evolution.push({
    stage: 'Command present',
    top: topCandidateLabels(afterCommand.result),
    evidence: 'Downstream output/mechanical rises',
  });
  auditNoPrematureVerifiedFailed(afterCommand.intelligence, 'Command present');

  assert.ok(
    scoreOf(afterCommand.result.candidates, MOTOR)
      > scoreOf(afterDrain.result.candidates, MOTOR),
    'motor output should rise when command present',
  );
  const motorBreakdown = breakdownOf(afterCommand.result.candidates, MOTOR);
  assert.ok(motorBreakdown);
  assert.ok(
    (motorBreakdown.branchBoost || 0) > 0,
    'motor rise should be visible in branchBoost breakdown',
  );
  assert.equal(findComponentState(afterCommand.intelligence, 'drive_motor')?.state, 'unknown');

  // --- Stage D: 37 VAC abnormal output ---
  const withMeasurement = mergeProcedureRuns(
    baseDoorDrainCommandRuns(),
    buildMotorVoltageMeasurementRun('37'),
  );
  const afterMeasurement = evaluateScenario(withMeasurement);
  evolution.push({
    stage: '37 VAC',
    top: topCandidateLabels(afterMeasurement.result),
    evidence: 'Output abnormal; wiring/output investigation',
  });
  auditNoPrematureVerifiedFailed(afterMeasurement.intelligence, '37 VAC');

  const measurementRun = withMeasurement['fl-washer-measurement-harness'];
  assert.ok(measurementRun?.stepEvaluations?.motor_voltage_step);
  assert.equal(measurementRun.stepEvaluations.motor_voltage_step.evaluation.status, 'critical');
  assert.equal(measurementRun.stepEvaluations.motor_voltage_step.parsedValue, 37);

  const motorAfterVac = breakdownOf(afterMeasurement.result.candidates, MOTOR);
  assert.ok(motorAfterVac);
  assert.ok(
    (motorAfterVac.measurementBoost || 0) > 0,
    '37 VAC should contribute measurementBoost in score breakdown',
  );
  assert.ok(
    scoreOf(afterMeasurement.result.candidates, MOTOR)
      >= scoreOf(afterCommand.result.candidates, MOTOR),
    'motor/wiring path should remain prominent after abnormal output',
  );

  // --- Stage E: Contradictory evidence ---
  const withContradiction = mergeProcedureRuns(
    withMeasurement,
    withHarnessBranches([CONTROL_ANOMALY]),
  );
  const afterContradiction = evaluateScenario(withContradiction);
  evolution.push({
    stage: 'Contradiction',
    top: topCandidateLabels(afterContradiction.result),
    evidence: 'Output abnormal + control anomaly; conflict unresolved',
  });
  auditNoPrematureVerifiedFailed(afterContradiction.intelligence, 'Contradiction');

  const doorAfterConflict = findComponentState(afterContradiction.intelligence, 'door_lock');
  assert.ok(
    doorAfterConflict?.state === 'eliminated' || doorAfterConflict?.state === 'unknown',
    'earlier door evidence must not be erased',
  );
  assert.ok(measurementRun.stepEvaluations?.motor_voltage_step.evaluation.status === 'critical');
  assert.ok(afterContradiction.result.candidates.length >= 3, 'competing candidates coexist');
  const contradictionKeys = afterContradiction.result.candidates.map(candidateKey);
  assert.ok(contradictionKeys.includes(MOTOR), 'motor output path remains in pool');
  assert.ok(
    contradictionKeys.includes('electrical')
    || contradictionKeys.includes('diagnosis')
    || contradictionKeys.includes('mechanical'),
    'discriminating wizard steps remain available to resolve conflict',
  );

  // --- Stage F: Completed test suppression ---
  const withCompletedDoor = mergeProcedureRuns(
    withContradiction,
    buildCompletedDoorLockRun(),
  );
  const afterCompleted = evaluateScenario(withCompletedDoor);
  const completedDoor = afterCompleted.result.candidates.find(
    (item) => item.procedureId === DOOR,
  );
  const blockedDoor = afterCompleted.result.blockedCandidates.find(
    (item) => item.procedureId === DOOR,
  );
  assert.ok(
    !completedDoor || blockedDoor,
    'completed door-lock procedure should not re-enter eligible recommendations',
  );
  assert.ok(
    measurementRun.stepEvaluations?.motor_voltage_step.parsedValue === 37,
    'historical measurement snapshot remains intact',
  );

  // --- Stage G: Branch with no useful candidate ---
  const withNoop = mergeProcedureRuns(
    withContradiction,
    withHarnessBranches([NOOP_BRANCH]),
  );
  const afterNoop = evaluateScenario(withNoop);
  assert.ok(afterNoop.result.candidates.length > 0, 'noop branch must not empty candidate pool');
  assert.ok(
    afterNoop.result.candidates.some((item) => item.procedureId === MOTOR),
    'valid candidates remain after noop branch',
  );

  // --- Persistence / replay ---
  const replayed = serializeAndRehydrateScenario(withContradiction);
  const beforeKeys = afterContradiction.result.candidates.slice(0, 5).map(candidateKey);
  const afterKeys = replayed.candidates.slice(0, 5).map(candidateKey);
  assert.deepEqual(afterKeys, beforeKeys, 'top candidates must survive serialize/rehydrate');

  const replayMotorBreakdown = breakdownOf(replayed.candidates, MOTOR);
  assert.ok((replayMotorBreakdown?.measurementBoost || 0) > 0);
  assert.ok((replayMotorBreakdown?.branchBoost || 0) > 0);

  // --- Order independence: door→drain vs drain→door ---
  const doorThenDrain = evaluateScenario(withHarnessBranches([DOOR_GOOD, DRAIN_GOOD]));
  const drainThenDoor = evaluateScenario(withHarnessBranches([DRAIN_GOOD, DOOR_GOOD]));
  assert.deepEqual(
    doorThenDrain.result.candidates.slice(0, 5).map(candidateKey),
    drainThenDoor.result.candidates.slice(0, 5).map(candidateKey),
    'independent door/drain facts should rank equivalently regardless of order',
  );

  // --- Final diagnostic posture ---
  evolution.push({
    stage: 'Final',
    top: topCandidateLabels(afterContradiction.result),
    evidence: summarizeComponentStates(afterContradiction.intelligence),
  });
  printEvolutionTable(evolution);

  const top = afterContradiction.result.candidates[0];
  assert.ok(
    top.procedureId === MOTOR
    || top.wizardStepKey === 'electrical'
    || top.wizardStepKey === 'mechanical'
    || top.wizardStepKey === 'diagnosis',
    'next action should discriminate remaining plausible causes',
  );
  assert.notEqual(top.procedureId, DOOR, 'door investigation should not lead at end state');
  assert.notEqual(top.procedureId, DRAIN, 'drain investigation should not lead at end state');
}

function testFlWasherTortureHarness() {
  setupHarnessProcedures();
  try {
    runFullTortureScenario();
  } finally {
    teardownHarnessProcedures();
  }
}

const tests: Array<[string, () => void]> = [
  ['DS-7 FL washer torture harness', testFlWasherTortureHarness],
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
  console.log(`\n${tests.length} DS-7 torture test(s) passed`);
}
