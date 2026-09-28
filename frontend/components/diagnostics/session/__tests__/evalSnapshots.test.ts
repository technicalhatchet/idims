import assert from 'node:assert/strict';
import {
  parseDiagnosticNotePayload,
  serializeDiagnosticNotePayload,
} from '../../../../constants/diagnosticTemplates.js';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { buildProcedureRunReview } from '../../procedures/buildProcedureRunReview';
import { submitProcedureStep, createProcedureRun } from '../../procedures/procedureRunner';
import type { ProcedureRunState, ServiceProcedure } from '../../procedures/types';
import {
  deriveMeasurementCandidateAdjustments,
  getNextDiagnosticActions,
  hydrateDiagnosticSession,
  replanDiagnosticActions,
} from '../index';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

const HARNESS_PROCEDURE: ServiceProcedure = {
  id: 'fl-washer-measurement-harness',
  version: '1.0.0',
  title: 'FL washer measurement harness',
  platformId: 'whirlpool_duet_sport',
  componentIds: ['drive_motor'],
  source: {
    manualId: 'HARNESS',
    manualTitle: 'Harness',
    oemTestNumber: 'M1',
    oemTestTitle: 'Motor load voltage',
    pages: [1],
  },
  entryStepId: 'motor_voltage_step',
  steps: [
    {
      id: 'motor_voltage_step',
      order: 1,
      type: 'measurement',
      title: 'Motor load voltage',
      measurementKnowledgeId: 'flWasherHarnessMotorLoadVoltage120',
      requiresInput: true,
      branches: [
        {
          id: 'motor_voltage_normal',
          label: 'Within range',
          when: { kind: 'measurement_normal' },
          nextStepId: 'outcome_ok',
        },
        {
          id: 'motor_voltage_abnormal',
          label: 'Abnormal output — investigate path',
          when: { kind: 'measurement_critical' },
          nextStepId: 'outcome_investigate',
        },
      ],
    },
    {
      id: 'outcome_ok',
      order: 2,
      type: 'outcome',
      title: 'Output verified',
      oemOutcome: 'Motor load voltage within spec.',
    },
    {
      id: 'outcome_investigate',
      order: 3,
      type: 'outcome',
      title: 'Investigate output path',
      oemOutcome: 'Abnormal motor output — trace wiring, switching, and load before condemning control.',
    },
  ],
};

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
  return {
    session,
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns,
    },
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
  };
}

function submitHarnessMotorVoltage(
  rawValue: string,
  context?: Record<string, unknown>,
): ProcedureRunState {
  const run = createProcedureRun(HARNESS_PROCEDURE);
  const result = submitProcedureStep(HARNESS_PROCEDURE, run, {
    kind: 'measurement',
    value: rawValue,
    context,
  });
  return result.runState;
}

function testK_evaluationSnapshotSurvivesReload() {
  const runState = submitHarnessMotorVoltage('37', {
    motorRequested: true,
    doorLocked: true,
  });
  const snapshot = runState.stepEvaluations?.motor_voltage_step;
  assert.ok(snapshot, 'snapshot written on submit');
  assert.equal(snapshot.rawInput, '37');
  assert.equal(snapshot.parsedValue, 37);
  assert.equal(snapshot.unit, 'VAC');
  assert.equal(snapshot.evaluation.status, 'critical');
  assert.ok(snapshot.evaluation.expected);
  assert.equal(snapshot.evaluation.expected?.min, 110);
  assert.equal(snapshot.evaluation.expected?.max, 130);
  assert.deepEqual(snapshot.context, { motorRequested: true, doorLocked: true });
  assert.ok(snapshot.evaluatedAt);

  const payload = {
    templateId: 'washer',
    fields: { 'customer_complaint.complaint_tags': ['wont_spin'] },
    visitedStepKeys: ['complaint'],
    currentStepKey: 'complaint',
    procedureRuns: { [HARNESS_PROCEDURE.id]: runState },
    activeProcedureId: HARNESS_PROCEDURE.id,
    timeline: [],
    evidenceSnapshot: null,
  };
  const json = serializeDiagnosticNotePayload(payload);
  const parsed = parseDiagnosticNotePayload(json) as typeof payload;
  const reloaded = parsed.procedureRuns?.[HARNESS_PROCEDURE.id]?.stepEvaluations?.motor_voltage_step;

  assert.ok(reloaded);
  assert.equal(reloaded.evaluation.status, 'critical');
  assert.equal(reloaded.evaluation.message, snapshot.evaluation.message);
  assert.equal(reloaded.evaluation.expected?.min, 110);
  assert.equal(reloaded.evaluation.expected?.max, 130);

  const review = buildProcedureRunReview(HARNESS_PROCEDURE, parsed.procedureRuns![HARNESS_PROCEDURE.id]);
  const reviewStep = review.steps.find((step) => step.stepId === 'motor_voltage_step');
  assert.equal(reviewStep?.evaluationStatus, 'critical');
  assert.match(reviewStep?.evaluationMessage || '', /Outside critical limits/i);
}

function testL_rawInputPreservedAlongsideSnapshot() {
  const runState = submitHarnessMotorVoltage('37');
  assert.equal(runState.stepInputs.motor_voltage_step.value, '37');
  assert.equal(runState.stepEvaluations?.motor_voltage_step.rawInput, '37');
}

function testM_abnormalMotorVoltageReranksWithoutCondemningControl() {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const before = buildRankContext(fields);
  const beforeRank = getNextDiagnosticActions(before);

  const runState = submitHarnessMotorVoltage('37', { motorRequested: true, doorLocked: true });
  assert.equal(runState.stepEvaluations?.motor_voltage_step.evaluation.status, 'critical');
  const hasControlBoardConfirm = (runState.appliedDiagnosticEffects || []).some(
    (entry) => entry.effects.some(
      (effect) => effect.type === 'confirm' && effect.componentId === 'control_board',
    ),
  );
  assert.equal(
    hasControlBoardConfirm,
    false,
    'abnormal measurement must not auto-confirm control board',
  );

  const after = buildRankContext(fields, { [HARNESS_PROCEDURE.id]: runState });
  const afterRank = replanDiagnosticActions(after);

  const motorBefore = beforeRank.candidates.findIndex(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  const motorAfter = afterRank.candidates.findIndex(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  assert.ok(motorBefore >= 0);
  assert.ok(motorAfter >= 0);
  assert.ok(motorAfter < motorBefore, 'motor output path should rank higher after abnormal voltage');

  const motorCandidate = afterRank.candidates.find(
    (item) => item.procedureId === 'w8178558-motor-circuit',
  );
  assert.ok((motorCandidate?.scoreBreakdown.measurementBoost || 0) > 0);

  const adjustments = deriveMeasurementCandidateAdjustments(after.session);
  assert.equal(adjustments.evaluationCount, 1);
  assert.ok(adjustments.boosts.size > 0);
  assert.ok(adjustments.penalties.size > 0);
}

const tests: Array<[string, () => void]> = [
  ['K evaluation snapshot survives reload', testK_evaluationSnapshotSurvivesReload],
  ['L raw input preserved alongside snapshot', testL_rawInputPreservedAlongsideSnapshot],
  ['M abnormal 37 VAC reranks without condemning control', testM_abnormalMotorVoltageReranksWithoutCondemningControl],
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
  console.log(`\n${tests.length} eval snapshot tests passed`);
}
