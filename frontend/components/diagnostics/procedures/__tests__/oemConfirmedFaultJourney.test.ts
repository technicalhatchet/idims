import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  expandVisitedKeysForConfirmedFaultJourney,
  isOemConfirmedRepairPathActive,
  OEM_BEFORE_REPAIR_CHECKS_STEP_KEY,
  OEM_FAULT_DIAGNOSIS_SUMMARY_STEP_KEY,
  resolveOemJourneyNextAction,
  resolveOemJourneyPrimaryButtonLabel,
  shouldSuppressGenericWizardRecommendation,
} from '../oemConfirmedFaultJourney';
import type { ProcedureRunState } from '../types';

const defaultStepKeys = {
  oemTest: 'oem_test',
  beforeRepairChecks: OEM_BEFORE_REPAIR_CHECKS_STEP_KEY,
  diagnosisSummary: OEM_FAULT_DIAGNOSIS_SUMMARY_STEP_KEY,
  diagnosticSave: 'review',
};

const actionRequiredRun: ProcedureRunState = {
  procedureId: 'w8178558-door-lock',
  version: '1.0.0',
  startedAt: '2026-03-12T10:00:00.000Z',
  currentStepId: 'replace_door_lock',
  completedStepIds: ['replace_door_lock'],
  stepInputs: {},
  status: 'completed',
  oemOutcome: 'Replace door lock assembly',
};

test('OEM fault → before repair checks next action on oem_test', () => {
  const payload = {
    oemRepairDecisionPending: 'w8178558-door-lock',
    procedureRuns: { 'w8178558-door-lock': actionRequiredRun },
    currentStepKey: 'oem_test',
  };
  assert.equal(
    resolveOemJourneyNextAction(payload, defaultStepKeys, 'oem_test')?.type,
    'before_repair_checks',
  );
  assert.equal(shouldSuppressGenericWizardRecommendation(payload, 'oem_test'), true);
});

test('confirmed repair path → before repair, diagnosis, then save only', () => {
  const payload = {
    oemConfirmedRepairPathActive: 'w8178558-door-lock',
    procedureRuns: { 'w8178558-door-lock': actionRequiredRun },
    currentStepKey: OEM_BEFORE_REPAIR_CHECKS_STEP_KEY,
  };
  assert.equal(isOemConfirmedRepairPathActive(payload), true);
  assert.equal(
    resolveOemJourneyNextAction(payload, defaultStepKeys, OEM_BEFORE_REPAIR_CHECKS_STEP_KEY)?.type,
    'diagnosis_summary',
  );
  const onDiagnosis = {
    ...payload,
    currentStepKey: OEM_FAULT_DIAGNOSIS_SUMMARY_STEP_KEY,
  };
  assert.equal(
    resolveOemJourneyNextAction(onDiagnosis, defaultStepKeys, OEM_FAULT_DIAGNOSIS_SUMMARY_STEP_KEY)?.type,
    'diagnostic_save',
  );
});

test('journey primary button labels follow phase', () => {
  assert.equal(resolveOemJourneyPrimaryButtonLabel('fault_identified'), 'Before repair checks');
  assert.equal(resolveOemJourneyPrimaryButtonLabel('before_repair_checks'), 'Diagnosis summary');
  assert.equal(resolveOemJourneyPrimaryButtonLabel('diagnosis_summary'), 'Review & save');
});

test('expand visited keys for confirmed-fault jumps includes prerequisites', () => {
  const visited = expandVisitedKeysForConfirmedFaultJourney(
    ['complaint'],
    'review',
    defaultStepKeys,
  );
  assert.ok(visited.includes('oem_test'));
  assert.ok(visited.includes(OEM_BEFORE_REPAIR_CHECKS_STEP_KEY));
  assert.ok(visited.includes(OEM_FAULT_DIAGNOSIS_SUMMARY_STEP_KEY));
  assert.ok(visited.includes('review'));
});

test('OEM exhausted on oem_test holds conclusion instead of generic wizard', () => {
  const payload = {
    oemDiagnosticTreeExhausted: true,
    currentStepKey: 'oem_test',
    procedureRuns: {},
  };
  assert.equal(
    resolveOemJourneyNextAction(payload, defaultStepKeys, 'oem_test')?.type,
    'hold_oem_conclusion',
  );
  assert.equal(shouldSuppressGenericWizardRecommendation(payload, 'oem_test'), true);
});
