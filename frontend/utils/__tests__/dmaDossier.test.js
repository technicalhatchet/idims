import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dossierRows, dossierStamp, dossierTag } from '../dmaDossier.js';

test('folder tab shows the first error code, or NO CODE', () => {
  assert.equal(dossierTag({ error_code_text: 'f21' }), 'DMA // F21');
  assert.equal(dossierTag({ error_code_text: ' F21, F9E1 ' }), 'DMA // F21');
  assert.equal(dossierTag({ error_code_text: '' }), 'DMA // NO CODE');
  assert.equal(dossierTag({}), 'DMA // NO CODE');
});

test('stamp reflects the outcome', () => {
  assert.deepEqual(dossierStamp({ repair_successful: true }), { label: 'CONFIRMED', tone: 'green' });
  assert.deepEqual(dossierStamp({ repair_successful: true, callback_required: true }), { label: 'CALLBACK', tone: 'orange' });
  assert.deepEqual(dossierStamp({ repair_successful: false }), { label: 'UNSUCCESSFUL', tone: 'orange' });
});

test('rows: readable labels, order kept, empty sections dropped', () => {
  const rows = dossierRows({
    customer_complaint: 'Stops mid-cycle, F21.',
    problem_code: 'not_draining',
    resolution_code: 'mechanical_part_replaced',
    replaced_parts: 'Drain pump',
    technician_summary: '',
    equipment_model: 'WTW5000DW1',
    performed_on: '2026-10-12',
    repair_successful: true,
  }, {
    problemOptions: { not_draining: 'Not draining' },
    resolutionOptions: { mechanical_part_replaced: 'Mechanical part replaced' },
  });
  assert.deepEqual(rows.map((r) => r.key), ['symptom', 'path', 'parts', 'model', 'performed', 'outcome']);
  assert.equal(rows[1].value, 'Not draining → Mechanical part replaced');
  assert.equal(rows[4].value, 'Oct 12, 2026');
  assert.equal(rows[5].tone, 'green');
});

test('work order outcomes fall back to the job description for the symptom', () => {
  const rows = dossierRows({ work_order_description: 'Leaking from door', repair_successful: false, callback_required: true });
  assert.equal(rows[0].value, 'Leaking from door');
  assert.equal(rows.at(-1).value, 'Unsuccessful · Callback required');
  assert.equal(rows.at(-1).tone, 'orange');
});
