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

test('fridge tag: S/N value on the line after a blank line', () => {
  const r = parseOcrText('MODEL GX2FHDXVB03\n\nS/N\n\nKY5191257\n');
  assert.equal(r.model, 'GX2FHDXVB03');
  assert.equal(r.serial, 'KY5191257');
});

test('"SERVICE" and fine-print "SERIAL NO" do not hide the real S/N (read as SIN)', () => {
  const text = 'FOR PARTS AND\n\nSERVICE GIVE\n\nMODEL NO AND\n\nSERIAL NO\n\nWWW WHIRLPOOL COM\n\nMODEL GX2FHDXVB03\n\nSIN\n\nKY5191257\n\nUSE ICE MAKER ACCESSORY KIT IC13B';
  const r = parseOcrText(text);
  assert.equal(r.model, 'GX2FHDXVB03');
  assert.equal(r.serial, 'KY5191257');
});

test('labels need a word break: SERIALNO still works, MODERN / SINK are not labels', () => {
  assert.equal(parseOcrText('SERIALNO C34512045').serial, 'C34512045');
  assert.equal(parseOcrText('MODERN KITCHEN SINK 12345').model, null);
  assert.equal(parseOcrText('MODERN KITCHEN SINK 12345').serial, null);
  assert.equal(parseOcrText('S/N\nMODEL ABC12345').serial, null); // never steal the next label's value
});

test('findLabelWords picks MODEL / S/N labels, biggest first', async () => {
  const { findLabelWords } = await import('../plateParse.js');
  const box = (h) => ({ x0: 0, y0: 0, x1: 10, y1: h });
  const words = [
    { text: 'SERIAL', bbox: box(11) }, // fine print
    { text: 'MODEL', bbox: box(11) },
    { text: 'MODEL', bbox: box(19) },
    { text: 'GX2FHDXVB03', bbox: box(19) },
    { text: 'S/N', bbox: box(18) },
    { text: 'SIN:', bbox: box(17) },
    { text: 'SERVICE', bbox: box(11) },
    { text: 'SINK', bbox: box(20) },
  ];
  const r = findLabelWords(words);
  assert.deepEqual(r.model.map((w) => w.bbox.y1), [19, 11]);
  assert.deepEqual(r.serial.map((w) => w.text), ['S/N', 'SIN:', 'SERIAL']);
});

test('O before the trailing revision digits is a zero; other letter Os are kept', () => {
  assert.equal(parseOcrText('MODEL GX2FHDXVBO3').model, 'GX2FHDXVB03');
  assert.equal(parseOcrText('MODEL WOS51EC0HS').model, 'WOS51EC0HS');
  assert.equal(parseOcrText('MODEL WFW5620HWO').model, 'WFW5620HWO'); // trailing O with no digit after: unchanged
});
