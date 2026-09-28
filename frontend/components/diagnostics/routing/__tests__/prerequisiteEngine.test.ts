import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getWizardDefinition } from '../../registry/wizardRegistry';
import { missingPrerequisiteStepKeys } from '../prerequisiteEngine';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../../shared/createWizardDefinitionFromTemplate';

test('visitedStepKeys satisfy prerequisites when wizard step ids were not recorded', () => {
  const definition = getWizardDefinition('washer');
  assert.ok(definition);
  const reviewStepId = definition.reviewStep?.id || DIAGNOSTIC_REVIEW_STEP_ID;
  const visitedStepIds = new Set<string>(['__oem_test__', 'commonly_missed']);

  const missing = missingPrerequisiteStepKeys(
    ['complaint'],
    definition,
    reviewStepId,
    visitedStepIds,
    { visitedStepKeys: ['complaint', 'oem_test', 'commonly_missed'] },
  );
  assert.deepEqual(missing, []);
});

test('complaint chips satisfy complaint prerequisite without visiting complaint step', () => {
  const definition = getWizardDefinition('washer');
  assert.ok(definition);
  const reviewStepId = definition.reviewStep?.id || DIAGNOSTIC_REVIEW_STEP_ID;
  const visitedStepIds = new Set<string>();

  const missing = missingPrerequisiteStepKeys(
    ['complaint'],
    definition,
    reviewStepId,
    visitedStepIds,
    { complaintChipIds: ['wont_spin'] },
  );
  assert.deepEqual(missing, []);
});
