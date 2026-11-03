import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyCode, parseOcrText, PlateReadTracker, stripLabel } from '../plateParse.js';

test('labels on barcodes are respected', () => {
  assert.deepEqual(stripLabel('S/N: CS1234567'), { label: 'serial', value: 'CS1234567' });
  assert.deepEqual(stripLabel('MODEL NO. WFW5620HW0'), { label: 'model', value: 'WFW5620HW0' });
  assert.deepEqual(stripLabel('912KWZD12345'), { label: null, value: '912KWZD12345' });
});

test('unlabeled codes classify by brand-style patterns', () => {
  for (const m of ['WFW5620HW0', 'GTW485ASJ4WS', 'DV42H5000EW/A3', 'WM3400CW', 'FFTR1835VW', '110.20222011']) {
    assert.equal(classifyCode(m).kind, 'model', m);
  }
  for (const s of ['CS1234567', 'AT123456', '912KWZD12345', 'XC12345678', '0B3K5ABN600123X']) {
    assert.equal(classifyCode(s, { make: 'samsung' }).kind, 'serial', s);
  }
});

test('OCR text: labeled values on the same or next line, with slips fixed', () => {
  const text = `WHIRLPOOL CORPORATION\nMODEL NO. WFW5620HW0\nSERIAL NO.\nC3 4512O45\n120V 60HZ`;
  const r = parseOcrText(text);
  assert.equal(r.model, 'WFW5620HW0');
  assert.equal(r.serial, 'C34512045');
  const r2 = parseOcrText('M0DEL: GTW485ASJ4WS   SER1AL: AT12O456');
  assert.equal(r2.model, 'GTW485ASJ4WS');
  assert.equal(r2.serial, 'AT120456');
});

test('tracker: barcode locks instantly; unsure OCR needs two matching reads', () => {
  const t = new PlateReadTracker();
  // "12AB34" under a MODEL label doesn't clearly look like a model → wait for a 2nd read
  assert.deepEqual(t.addOcr('MODEL: 12AB34'), []);
  assert.equal(t.snapshot().model.locked, false);
  assert.deepEqual(t.addOcr('MODEL: 12AB34'), ['model']);
  assert.deepEqual(t.addBarcode('CS1234567'), ['serial']);
  const s = t.snapshot();
  assert.equal(s.done, true);
  assert.equal(s.serial.source, 'barcode');
});

test('tracker: OCR never overrides a barcode lock', () => {
  const t = new PlateReadTracker();
  t.addBarcode('SN CS1234567');
  t.addOcr('SERIAL: CS1234561');
  t.addOcr('SERIAL: CS1234561');
  assert.equal(t.snapshot().serial.value, 'CS1234567');
});

test('tracker: two ambiguous barcodes are split model vs serial', () => {
  const t = new PlateReadTracker();
  t.addBarcode('A1B2C3D4E5');
  const locked = t.addBarcode('ZZ9876543');
  assert.ok(locked.includes('serial'));
  assert.equal(t.snapshot().serial.value, 'ZZ9876543');
});

test('swap fixes a wrong guess', () => {
  const t = new PlateReadTracker();
  t.addBarcode('MODEL WFW5620HW0');
  t.addBarcode('SN CS1234567');
  t.swap();
  assert.equal(t.snapshot().model.value, 'CS1234567');
});

test('values are not glued to neighbouring text', () => {
  assert.equal(parseOcrText('MODEL NO. WFW5620HW0 120V 60HZ').model, 'WFW5620HW0');
});

test('tracker: a labeled OCR read that fits the pattern locks on the first pass', () => {
  const t = new PlateReadTracker();
  assert.deepEqual(t.addOcr('MODEL NO. WFW5620HW0\nSERIAL NO. C34512045').sort(), ['model', 'serial']);
});
