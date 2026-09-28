import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeMeasurementReading } from '../../knowledge/parseMeasurementValue';

test('open circuit submit uses normalized OL string not numeric field', () => {
  const value = normalizeMeasurementReading('OL');
  assert.equal(value, 'OL');
  assert.notEqual(value, '');
});
