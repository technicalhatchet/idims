import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  diagnosticStatusEyebrow,
  resolveWizardProgressTitle,
  shouldSuppressGenericNextTestPreview,
} from '../diagnosticJourneyPresentation';

test('wizard progress uses OEM diagnostic title during manufacturer path', () => {
  assert.equal(
    resolveWizardProgressTitle({ stepKey: 'oem_test', stepTitle: 'OEM Component Test' }),
    'OEM diagnostic',
  );
  assert.equal(
    resolveWizardProgressTitle({
      stepKey: 'oem_test',
      oemDiagnosticTreeExhausted: true,
    }),
    'Manufacturer path complete',
  );
});

test('commonly missed step uses before repair checks after OEM fault', () => {
  assert.equal(
    resolveWizardProgressTitle({
      stepKey: 'commonly_missed',
      stepTitle: 'Repair Verification',
      repairVerificationPhaseActive: false,
    }),
    'Initial checks',
  );
  assert.equal(
    resolveWizardProgressTitle({
      stepKey: 'commonly_missed',
      stepTitle: 'Repair Verification',
      oemBeforeRepairChecksPhase: true,
    }),
    'Before repair checks',
  );
});

test('generic next test preview suppressed after OEM exhaustion', () => {
  assert.equal(
    shouldSuppressGenericNextTestPreview({
      oemDiagnosticPathExhausted: true,
      foregroundMode: 'oem_path_complete',
      nextStepKey: 'functional',
      currentStepKey: 'oem_test',
    }),
    true,
  );
  assert.equal(
    shouldSuppressGenericNextTestPreview({
      oemDiagnosticPathExhausted: false,
      foregroundMode: 'continuing_tests',
      nextStepKey: 'functional',
    }),
    false,
  );
});

test('status eyebrows stay concise for mobile', () => {
  const label = diagnosticStatusEyebrow('oem_path_complete');
  assert.ok(label.length <= 32);
  assert.match(label, /manufacturer path complete/i);
});
