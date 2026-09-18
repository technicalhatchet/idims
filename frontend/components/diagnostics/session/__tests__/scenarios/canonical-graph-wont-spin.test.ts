import assert from 'node:assert/strict';
import {
  evaluateCanonicalGraphState,
  deriveCanonicalRoutingAdjustments,
} from '../../../knowledge/canonical/canonicalGraphRuntime';
import {
  breakdownOf,
  buildMotorVoltageMeasurementRun,
  candidateKey,
  evaluateScenario,
  mergeProcedureRuns,
  rankOf,
  scoreOf,
  withHarnessBranches,
} from '../fixtures/fl-washer/scenarioKit';
import { hydrateDiagnosticSession } from '../../hydrateDiagnosticSession';
import { getWizardDefinition } from '../../../registry/wizardRegistry';
import { evaluateDiagnosticIntelligence } from '../../../intelligence/diagnosticIntelligenceEngine';
import type { ProcedureRunState } from '../../../procedures/types';
import {
  VISITED_STEP_KEYS,
  WONT_SPIN_FIELDS,
} from '../fixtures/fl-washer/scenarioKit';

const DOOR = 'w8178558-door-lock';
const DRAIN = 'w8178558-drain-pump';
const MOTOR = 'w8178558-motor-circuit';

const DOOR_GOOD = { stepId: 'door_lock_step', branchId: 'door_lock_verified_good' };
const DRAIN_GOOD = { stepId: 'drain_step', branchId: 'drain_verified_good' };
const COMMAND_PRESENT = { stepId: 'motor_command_step', branchId: 'motor_command_present' };

function buildSession(procedureRuns: Record<string, ProcedureRunState> = {}) {
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
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    derived: { intelligence },
  });
}

function runCanonicalGraphTorture(): void {
  const initialSession = buildSession();
  const initialGraph = evaluateCanonicalGraphState(initialSession);
  assert.ok(initialGraph);
  assert.ok(initialGraph.activeGoals.includes('spin_authorization'));
  assert.ok(initialGraph.activeGoals.includes('drive_operation'));
  assert.equal(initialGraph.establishedFactIds.has('door_lock_authorized'), false);
  assert.equal(initialGraph.establishedFactIds.has('drain_completion'), false);

  const initialAdjustments = deriveCanonicalRoutingAdjustments(initialSession);
  const initialDoorFit = initialAdjustments.find((item) => item.testTargetId === 'door_lock_test')?.routingFit ?? 0;
  const initialMotorFit = initialAdjustments.find((item) => item.testTargetId === 'motor_output_test')?.routingFit ?? 0;
  assert.ok(initialDoorFit > initialMotorFit, 'upstream prerequisite should outrank blocked downstream initially');

  const initialScenario = evaluateScenario();
  const initialMotorRouting = breakdownOf(initialScenario.result.candidates, MOTOR)?.routingFit ?? 0;
  assert.ok(initialMotorRouting < initialDoorFit, 'merged motor routingFit should reflect graph block');

  const doorSession = buildSession(withHarnessBranches([DOOR_GOOD]));
  const doorGraph = evaluateCanonicalGraphState(doorSession);
  assert.ok(doorGraph?.establishedFactIds.has('door_lock_authorized'));

  const afterDoor = evaluateScenario(withHarnessBranches([DOOR_GOOD]));
  const doorMotorRouting = breakdownOf(afterDoor.result.candidates, MOTOR)?.routingFit ?? 0;
  assert.ok(
    doorMotorRouting > initialMotorRouting,
    'motor canonical routingFit should rise when door prerequisite established',
  );

  const drainSession = buildSession(withHarnessBranches([DOOR_GOOD, DRAIN_GOOD]));
  const drainGraph = evaluateCanonicalGraphState(drainSession);
  assert.ok(drainGraph?.establishedFactIds.has('drain_completion'));

  const afterDrain = evaluateScenario(withHarnessBranches([DOOR_GOOD, DRAIN_GOOD]));
  assert.ok(
    scoreOf(afterDrain.result.candidates, MOTOR) > scoreOf(afterDoor.result.candidates, MOTOR),
    'motor total score should rise as graph prerequisites accumulate',
  );
  assert.ok(
    (breakdownOf(afterDrain.result.candidates, MOTOR)?.routingFit ?? 0)
      > (breakdownOf(afterDoor.result.candidates, MOTOR)?.routingFit ?? 0),
    'motor routingFit should increase after drain established',
  );

  const commandRuns = withHarnessBranches([DOOR_GOOD, DRAIN_GOOD, COMMAND_PRESENT]);
  const commandSession = buildSession(commandRuns);
  const commandGraph = evaluateCanonicalGraphState(commandSession);
  assert.ok(commandGraph?.establishedFactIds.has('motor_command_present'));

  const afterCommand = evaluateScenario(commandRuns);
  const commandMotorRouting = breakdownOf(afterCommand.result.candidates, MOTOR)?.routingFit ?? 0;
  assert.ok(
    commandMotorRouting > (breakdownOf(afterDrain.result.candidates, MOTOR)?.routingFit ?? 0),
    'motor routingFit should peak when command path established',
  );

  const withMeasurement = mergeProcedureRuns(
    commandRuns,
    buildMotorVoltageMeasurementRun('37'),
  );
  const measureSession = buildSession(withMeasurement);
  const measureGraph = evaluateCanonicalGraphState(measureSession);
  assert.ok(measureGraph?.establishedFactIds.has('motor_output_abnormal'));

  const afterMeasurement = evaluateScenario(withMeasurement);
  const motorKey = candidateKey(afterMeasurement.result.candidates.find((c) => c.procedureId === MOTOR)!);
  assert.ok(motorKey);

  assert.ok(rankOf(afterMeasurement.result.candidates, MOTOR) >= 0);
  assert.ok(
    (breakdownOf(afterMeasurement.result.candidates, MOTOR)?.routingFit ?? 0) >= commandMotorRouting,
    'abnormal output should maintain or increase downstream investigation routingFit',
  );

  const doorRoutingAfter = breakdownOf(afterDrain.result.candidates, DOOR)?.routingFit ?? 0;
  const drainRoutingAfter = breakdownOf(afterDrain.result.candidates, DRAIN)?.routingFit ?? 0;
  assert.ok(doorRoutingAfter <= 0.06, 'door should lose canonical routingFit once established');
  assert.ok(drainRoutingAfter <= 0.06, 'drain should lose canonical routingFit once established');
}

runCanonicalGraphTorture();
console.log('canonical-graph-wont-spin: OK');
