import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { SOLOMON_APPLIANCE_PICKER_GRID_CLASS } from '../solomonAppliancePickerLayout';

test('appliance picker uses compact two-column grid', () => {
  assert.match(SOLOMON_APPLIANCE_PICKER_GRID_CLASS, /grid-cols-2/);
});

test('appliance picker source does not render symptom hint subtitles', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'components/solomon/SolomonAppliancePicker.js'),
    'utf8',
  );
  assert.doesNotMatch(src, /item\.hint/);
});
