import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getWizardDefinition } from '../../registry/wizardRegistry';
import {
  resolveBeforeRepairChecksStepKey,
  resolveDiagnosisSummaryStepKey,
  resolveDiagnosticSaveStepKey,
} from '../resolveOemJourneyStepKeys';
import { resolveOemJourneyNextAction } from '../oemConfirmedFaultJourney';
import type { ProcedureRunState } from '../types';

const actionRequiredRun: ProcedureRunState = {
  procedureId: 'w8178558-motor-circuit',
  version: '1.0.0',
  startedAt: '2026-03-12T10:00:00.000Z',
  currentStepId: 'replace_motor',
  completedStepIds: ['replace_motor'],
  stepInputs: {},
  status: 'completed',
  oemOutcome: 'Replace drive motor',
};

test('washer template resolves before-repair checklist step key', () => {
  const definition = getWizardDefinition('washer');
  assert.ok(definition);
  assert.equal(resolveBeforeRepairChecksStepKey(definition), 'commonly_missed');
  assert.equal(resolveDiagnosisSummaryStepKey(definition), 'diagnosis');
  assert.equal(resolveDiagnosticSaveStepKey(definition), 'review');
});

test('OEM fault journey targets checklist then diagnosis then save', () => {
  const definition = getWizardDefinition('washer');
  const stepKeys = {
    oemTest: 'oem_test',
    beforeRepairChecks: resolveBeforeRepairChecksStepKey(definition),
    diagnosisSummary: resolveDiagnosisSummaryStepKey(definition),
    diagnosticSave: resolveDiagnosticSaveStepKey(definition),
  };
  const beforeRepairKey = stepKeys.beforeRepairChecks;
  const diagnosisKey = stepKeys.diagnosisSummary;
  const saveKey = stepKeys.diagnosticSave;

  const pending = {
    oemRepairDecisionPending: 'w8178558-motor-circuit',
    procedureRuns: { 'w8178558-motor-circuit': actionRequiredRun },
    currentStepKey: 'oem_test',
  };
  assert.equal(
    resolveOemJourneyNextAction(pending, stepKeys, 'oem_test')?.type,
    'before_repair_checks',
  );

  const onChecklist = {
    oemConfirmedRepairPathActive: 'w8178558-motor-circuit',
    procedureRuns: { 'w8178558-motor-circuit': actionRequiredRun },
    currentStepKey: beforeRepairKey,
  };
  assert.equal(
    resolveOemJourneyNextAction(onChecklist, stepKeys, beforeRepairKey)?.type,
    'diagnosis_summary',
  );

  const onDiagnosis = {
    ...onChecklist,
    currentStepKey: diagnosisKey,
  };
  assert.equal(
    resolveOemJourneyNextAction(onDiagnosis, stepKeys, diagnosisKey)?.type,
    'diagnostic_save',
  );
  assert.equal(saveKey, 'review');
});
