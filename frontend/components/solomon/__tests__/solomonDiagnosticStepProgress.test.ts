import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OEM_WIZARD_STEP_KEY } from '../../diagnostics/procedures/procedureWizardLead';
import {
  buildPersistedJourneyStepKeys,
  resolvePersistedJourneyStepNumber,
} from '../buildPersistedJourneyStepKeys';

const WASHER_LIKE_STEPS = [
  { meta: { stepKey: 'complaint' } },
  { meta: { stepKey: 'visual' } },
  { meta: { stepKey: 'functional' } },
  { meta: { stepKey: 'mechanical' } },
  { meta: { stepKey: 'electrical' } },
  { meta: { stepKey: 'commonly_missed' } },
  { meta: { stepKey: 'diagnosis' } },
  { meta: { stepKey: 'review' } },
];

function washerPayload(overrides: Record<string, unknown> = {}) {
  return {
    templateId: 'washer',
    currentStepKey: 'complaint',
    visitedStepKeys: ['complaint'],
    procedureRuns: {},
    ...overrides,
  };
}

test('persisted journey includes oem_test when OEM path was used', () => {
  const keys = buildPersistedJourneyStepKeys(WASHER_LIKE_STEPS, washerPayload({
    visitedStepKeys: ['complaint', 'oem_test'],
    currentStepKey: 'oem_test',
    procedureRuns: { 'w8178558-motor-circuit': { status: 'completed' } },
  }));
  assert.ok(keys.includes(OEM_WIZARD_STEP_KEY));
  assert.ok(keys.indexOf(OEM_WIZARD_STEP_KEY) > keys.indexOf('complaint'));
});

test('oem_test mid-journey is not step 1 of 1', () => {
  const keys = buildPersistedJourneyStepKeys(WASHER_LIKE_STEPS, washerPayload({
    currentStepKey: OEM_WIZARD_STEP_KEY,
    visitedStepKeys: ['complaint', 'visual', 'functional', OEM_WIZARD_STEP_KEY],
    procedureRuns: { 'w8178558-motor-circuit': { status: 'completed' } },
  }));
  const { stepNumber, totalSteps } = resolvePersistedJourneyStepNumber(
    keys,
    OEM_WIZARD_STEP_KEY,
    keys,
  );
  assert.ok(stepNumber > 1);
  assert.ok(totalSteps > 1);
});

test('review resolves to last position in journey keys', () => {
  const keys = buildPersistedJourneyStepKeys(WASHER_LIKE_STEPS, washerPayload({
    currentStepKey: 'review',
    visitedStepKeys: ['complaint', 'visual', 'diagnosis', 'review'],
  }));
  const { stepNumber, totalSteps } = resolvePersistedJourneyStepNumber(keys, 'review', keys);
  assert.equal(stepNumber, totalSteps);
});

test('before_repair_checks and diagnosis use persisted key order', () => {
  const keys = buildPersistedJourneyStepKeys(WASHER_LIKE_STEPS, washerPayload({
    visitedStepKeys: ['complaint', OEM_WIZARD_STEP_KEY, 'commonly_missed'],
    currentStepKey: 'commonly_missed',
  }));
  const beforeRepair = resolvePersistedJourneyStepNumber(keys, 'commonly_missed', keys);
  const diagnosis = resolvePersistedJourneyStepNumber(keys, 'diagnosis', keys);
  assert.ok(beforeRepair.stepNumber > 1);
  assert.ok(diagnosis.stepNumber > beforeRepair.stepNumber);
});
