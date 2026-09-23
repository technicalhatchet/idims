import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import {
  getComponentVerificationLevel,
  isVerifiedFailedState,
  SOFT_CONFIRM_EVIDENCE_BOOST,
} from '../../intelligence/componentVerification';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import {
  shouldPrefillRootCauseFromProcedureComplete,
} from '../../procedures/procedureWizardRouting';
import {
  resolveProcedureRunDisposition,
} from '../../procedures/procedureRunPresentation';
import { submitProcedureStep, createProcedureRun } from '../../procedures/procedureRunner';
import {
  clearHarnessServiceProcedures,
  getServiceProcedure,
  registerHarnessServiceProcedure,
} from '../../procedures/procedureRegistry';
import type { ProcedureRunState, ServiceProcedure } from '../../procedures/types';
import { getNextDiagnosticActions, hydrateDiagnosticSession } from '../index';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

const SOFT_CONFIRM_PROCEDURE: ServiceProcedure = {
  id: 'fl-washer-soft-confirm-harness',
  version: '1.0.0',
  title: 'Soft confirm harness',
  platformId: 'whirlpool_duet_sport',
  componentIds: ['drive_motor'],
  source: {
    manualId: 'HARNESS',
    manualTitle: 'Harness',
    oemTestNumber: 'SC1',
    oemTestTitle: 'Motor path support',
    pages: [1],
  },
  entryStepId: 'motor_path_checkpoint',
  steps: [
    {
      id: 'motor_path_checkpoint',
      order: 1,
      type: 'visual_check',
      title: 'Motor path needs deeper investigation',
      requiresInput: true,
      branches: [
        {
          id: 'motor_path_needs_followup',
          label: 'Follow-up warranted',
          when: { kind: 'checkpoint_yes' },
          nextStepId: 'outcome_continue',
          diagnosticEffects: [
            {
              type: 'confirm',
              componentId: 'drive_motor',
              evidenceId: 'suspect_drive_motor_path',
            },
          ],
        },
      ],
    },
    {
      id: 'outcome_continue',
      order: 2,
      type: 'outcome',
      title: 'Continue downstream testing',
      oemOutcome: 'Motor path flagged for follow-up — continue OEM tests before condemning parts.',
      requiresInput: false,
    },
  ],
};

function findComponentState(
  intelligence: ReturnType<typeof evaluateDiagnosticIntelligence> | null,
  componentId: string,
) {
  if (!intelligence) return null;
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    const match = components.find((item) => item.id === componentId);
    if (match) return match;
  }
  return null;
}

function buildIntelligence(procedureRuns: Record<string, ProcedureRunState>) {
  const visitedStepKeys = ['complaint', 'visual', 'functional'];
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  return evaluateDiagnosticIntelligence('washer', {
    'customer_complaint.complaint_tags': ['wont_spin'],
  }, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns,
  });
}

function testN_softConfirmDoesNotVerifyFailed() {
  registerHarnessServiceProcedure(SOFT_CONFIRM_PROCEDURE);
  const run = createProcedureRun(SOFT_CONFIRM_PROCEDURE);
  const result = submitProcedureStep(SOFT_CONFIRM_PROCEDURE, run, {
    kind: 'checkpoint',
    value: 'yes',
  });

  assert.equal(result.matchedBranch?.id, 'motor_path_needs_followup');
  assert.equal(
    shouldPrefillRootCauseFromProcedureComplete(SOFT_CONFIRM_PROCEDURE.id, result.runState),
    false,
  );
  assert.equal(
    resolveProcedureRunDisposition(result.runState, SOFT_CONFIRM_PROCEDURE),
    'success',
  );

  const intelligence = buildIntelligence({ [SOFT_CONFIRM_PROCEDURE.id]: result.runState });
  const motor = findComponentState(intelligence, 'drive_motor');
  assert.ok(motor);
  assert.equal(motor.state, 'unlikely');
  assert.equal(getComponentVerificationLevel(motor.state), 'supported');
  assert.equal(isVerifiedFailedState(motor.state), false);
  assert.ok(motor.evidence >= SOFT_CONFIRM_EVIDENCE_BOOST);
}

function testExplicitFailureMeasurementConfirmVerifiesFailed() {
  const procedure = getServiceProcedure('w8178558-door-lock');
  assert.ok(procedure);

  let run = createProcedureRun(procedure);
  run = {
    ...run,
    currentStepId: 'lock_solenoid_ohms',
    completedStepIds: ['safety_power_off', 'disconnect_dl3'],
  };

  const measurement = submitProcedureStep(procedure, run, {
    kind: 'measurement',
    value: 'OL',
  });
  assert.equal(measurement.matchedBranch?.id, 'lock_sol_open');
  assert.ok(
    measurement.runState.appliedDiagnosticEffects?.some(
      (entry) => entry.effects.some((effect) => effect.type === 'confirm'),
    ),
  );

  assert.equal(
    shouldPrefillRootCauseFromProcedureComplete('w8178558-door-lock', measurement.runState),
    true,
  );
  assert.equal(
    resolveProcedureRunDisposition(measurement.runState, procedure),
    'action_required',
  );

  const intelligence = buildIntelligence({ 'w8178558-door-lock': measurement.runState });
  const doorLock = findComponentState(intelligence, 'door_lock');
  assert.ok(doorLock);
  assert.equal(doorLock.state, 'confirmed');
  assert.equal(getComponentVerificationLevel(doorLock.state), 'verified_failed');
}

function testSoftConfirmInfluencesRankingWithoutFailureDiagnosis() {
  registerHarnessServiceProcedure(SOFT_CONFIRM_PROCEDURE);
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const softRun = submitProcedureStep(
    SOFT_CONFIRM_PROCEDURE,
    createProcedureRun(SOFT_CONFIRM_PROCEDURE),
    { kind: 'checkpoint', value: 'yes' },
  ).runState;

  const visitedStepKeys = ['complaint', 'visual', 'functional'];
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const beforeIntelligence = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns: {},
  });
  const afterIntelligence = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns: { [SOFT_CONFIRM_PROCEDURE.id]: softRun },
  });

  const motorBefore = findComponentState(beforeIntelligence, 'drive_motor');
  const motorAfter = findComponentState(afterIntelligence, 'drive_motor');
  assert.equal(motorBefore?.state || 'unknown', 'unknown');
  assert.equal(motorAfter?.state, 'unlikely');
  assert.equal(isVerifiedFailedState(motorAfter?.state || 'unknown'), false);

  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields,
      visitedStepKeys,
      currentStepKey: 'functional',
      procedureRuns: { [SOFT_CONFIRM_PROCEDURE.id]: softRun },
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    derived: { intelligence: afterIntelligence },
  });

  const motorProcedureBefore = getNextDiagnosticActions({
    session: hydrateDiagnosticSession({
      payload: {
        templateId: 'washer',
        fields,
        visitedStepKeys,
        currentStepKey: 'functional',
        procedureRuns: {},
        activeProcedureId: null,
        timeline: [],
        evidenceSnapshot: null,
      },
      derived: { intelligence: beforeIntelligence },
    }),
    wizardContext: { intelligence: beforeIntelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence: beforeIntelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns: {},
    },
  }).candidates.find((item) => item.procedureId === 'w8178558-motor-circuit');

  const motorProcedureAfter = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence: afterIntelligence, wizardDefinition, defaultStepOrder },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence: afterIntelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns: { [SOFT_CONFIRM_PROCEDURE.id]: softRun },
    },
  }).candidates.find((item) => item.procedureId === 'w8178558-motor-circuit');

  assert.ok(motorProcedureBefore);
  assert.ok(motorProcedureAfter);
  assert.ok(
    (motorProcedureAfter.scoreBreakdown.existingSystemBoost
      || motorProcedureAfter.score)
    >= (motorProcedureBefore.scoreBreakdown.existingSystemBoost || motorProcedureBefore.score),
    'soft confirm should increase motor procedure priority without verified_failed',
  );
}

const tests: Array<[string, () => void]> = [
  ['N soft confirm does not verify_failed', testN_softConfirmDoesNotVerifyFailed],
  ['explicit failure measurement confirm verifies_failed', testExplicitFailureMeasurementConfirmVerifiesFailed],
  ['soft confirm influences ranking without failure diagnosis', testSoftConfirmInfluencesRankingWithoutFailureDiagnosis],
];

registerHarnessServiceProcedure(SOFT_CONFIRM_PROCEDURE);

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

clearHarnessServiceProcedures();

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} confirm softening tests passed`);
}
