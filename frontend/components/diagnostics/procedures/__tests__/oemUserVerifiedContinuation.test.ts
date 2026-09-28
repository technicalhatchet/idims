import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  recordOemWizardLeadDecision,
  resolveOemWizardDisplayedProcedureId,
} from '../oemWizardDecisions';
import { buildUserVerifiedProcedureRunState } from '../oemUserVerifiedProcedureRun';
import { resolveOfferableOemLeadRecommendation } from '../procedureWizardLead';
import { recommendServiceProcedures } from '../recommendServiceProcedures';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { evaluateRouting } from '../../routing/routingEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { buildMeasurementStatusMap } from '../../knowledge/measurementContext';
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
    },
  };
}

test('buildUserVerifiedProcedureRunState completes with verified outcome disposition', () => {
  const run = buildUserVerifiedProcedureRunState('w8178558-door-lock');
  assert.ok(run);
  assert.equal(run?.status, 'completed');
  assert.match(run?.currentStepId || '', /verified/i);
});

test('user_verified decision with completed run continues to next_oem', () => {
  const verifiedRun = buildUserVerifiedProcedureRunState('w8178558-door-lock');
  assert.ok(verifiedRun);
  const runs = { 'w8178558-door-lock': verifiedRun };
  const input = buildWontSpinContinuationInput(runs);
  input.payload = {
    ...input.payload,
    oemWizardLeadDecisions: recordOemWizardLeadDecision(
      undefined,
      'w8178558-door-lock',
      'user_verified',
    ),
  };
  const plan = planContinuationAfterProcedureComplete(input);
  assert.equal(plan.type, 'next_oem');
  if (plan.type === 'next_oem') {
    assert.notEqual(plan.procedureId, 'w8178558-door-lock');
  }
});

test('resolveOfferableOemLeadRecommendation skips user_verified procedure', () => {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const intelligence = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys: ['complaint'],
    defaultStepOrder: ['complaint', 'visual', 'functional'],
    procedureRuns: {},
  });
  const recommendations = recommendServiceProcedures({
    templateId: 'washer',
    measurementContext: MEASUREMENT_CONTEXT,
    intelligence,
    complaintChipIds: ['wont_spin'],
    errorCodes: [],
    procedureRuns: {},
  });
  const decisions = recordOemWizardLeadDecision(
    undefined,
    'w8178558-door-lock',
    'user_verified',
  );
  const offerable = resolveOfferableOemLeadRecommendation(
    recommendations,
    'w8178558-door-lock',
    decisions,
  );
  assert.ok(offerable);
  assert.notEqual(offerable?.procedureId, 'w8178558-door-lock');
});

test('user_verified on displayed active A leaves offer B decision untouched and continues', () => {
  const doorLock = 'w8178558-door-lock';
  const drainPump = 'w8178558-drain-pump';
  const target = resolveOemWizardDisplayedProcedureId({
    activeProcedureId: doorLock,
    offeredProcedureId: drainPump,
  });
  assert.equal(target, doorLock);

  const verifiedRun = buildUserVerifiedProcedureRunState(doorLock);
  assert.ok(verifiedRun);
  const runs = { [doorLock]: verifiedRun };
  const input = buildWontSpinContinuationInput(runs);
  input.completedProcedureId = doorLock;
  input.completedRunState = verifiedRun;
  input.payload = {
    ...input.payload,
    activeProcedureId: doorLock,
    oemWizardLeadDecisions: recordOemWizardLeadDecision(
      undefined,
      doorLock,
      'user_verified',
    ),
  };
  assert.equal(input.payload.oemWizardLeadDecisions?.[drainPump], undefined);
  const plan = planContinuationAfterProcedureComplete(input);
  assert.equal(plan.type, 'next_oem');
  if (plan.type === 'next_oem') {
    assert.notEqual(plan.procedureId, doorLock);
  }
});

test('user_verified orchestration stays on oem_test and starts next procedure', () => {
  const verifiedRun = buildUserVerifiedProcedureRunState('w8178558-door-lock');
  assert.ok(verifiedRun);
  const runs = { 'w8178558-door-lock': verifiedRun };
  const input = buildWontSpinContinuationInput(runs);
  input.payload = {
    ...input.payload,
    oemWizardLeadDecisions: recordOemWizardLeadDecision(
      undefined,
      'w8178558-door-lock',
      'user_verified',
    ),
  };
  const plan = planContinuationAfterProcedureComplete(input);
  const jumps: string[] = [];
  const starts: string[] = [];
  executeProcedureContinuationPlan(plan, {
    jumpToStepKey: (key) => jumps.push(key),
    startOemProcedure: (id) => starts.push(id),
  });
  assert.equal(plan.type, 'next_oem');
  assert.deepEqual(jumps, ['oem_test']);
  assert.equal(starts.length, 1);
  assert.notEqual(starts[0], 'w8178558-door-lock');
});
