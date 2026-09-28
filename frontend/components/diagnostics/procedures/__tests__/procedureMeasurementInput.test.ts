import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  hasNumericMeasurementDraft,
  resolveMeasurementCtaMode,
  supportsOpenCircuitMeasurementSubmit,
} from '../procedureMeasurementInput';

const OHMS_KNOWLEDGE = {
  id: 'testOhms',
  name: 'Test ohms',
  inputKind: 'resistance',
  unit: 'Ω',
  openCircuitCritical: true,
  ranges: { normal: { min: 10, max: 15 } },
};

const VOLT_KNOWLEDGE = {
  id: 'testVolts',
  name: 'Test volts',
  inputKind: 'voltage',
  unit: 'V',
  ranges: { normal: { min: 110, max: 125 } },
};

test('empty resistance field uses OL CTA mode', () => {
  assert.equal(resolveMeasurementCtaMode('', OHMS_KNOWLEDGE), 'ol');
  assert.equal(resolveMeasurementCtaMode('   ', OHMS_KNOWLEDGE), 'ol');
});

test('numeric resistance input uses Submit CTA mode', () => {
  assert.equal(resolveMeasurementCtaMode('12.3', OHMS_KNOWLEDGE), 'submit');
  assert.equal(hasNumericMeasurementDraft('52'), true);
});

test('cleared numeric field returns to OL mode', () => {
  assert.equal(resolveMeasurementCtaMode('12', OHMS_KNOWLEDGE), 'submit');
  assert.equal(resolveMeasurementCtaMode('', OHMS_KNOWLEDGE), 'ol');
});

test('typed OL in field stays OL mode (not numeric)', () => {
  assert.equal(hasNumericMeasurementDraft('OL'), false);
  assert.equal(resolveMeasurementCtaMode('ol', OHMS_KNOWLEDGE), 'ol');
});

test('non-resistance measurements always use Submit mode', () => {
  assert.equal(supportsOpenCircuitMeasurementSubmit(VOLT_KNOWLEDGE), false);
  assert.equal(resolveMeasurementCtaMode('', VOLT_KNOWLEDGE), 'submit');
});
