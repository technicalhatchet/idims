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

test('tracker: barcode locks instantly; text needs repeat reads to lock', () => {
  const t = new PlateReadTracker();
  for (let i = 0; i < 3; i += 1) assert.deepEqual(t.addOcr('MODEL: 12AB34'), []);
  assert.equal(t.snapshot().model.value, '12AB34');
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

test('tracker: one frame never locks; a zoomed read plus a repeat does', () => {
  const t = new PlateReadTracker();
  const frame = 'MODEL NO. WFW5620HW0\nSERIAL NO. C34512045';
  assert.deepEqual(t.addOcr(frame), []);
  assert.deepEqual(t.addOcr('MODEL WFW5620HW0', { weight: 2 }), []);
  assert.deepEqual(t.addOcr(frame), ['model']);
  assert.equal(t.snapshot().serial.locked, false);
});

test('tracker: a one-off misread does not beat the value that keeps coming back', () => {
  const t = new PlateReadTracker();
  t.addOcr('MODEL NS-WMT41WA5');
  t.addOcr('MODEL NS-WMTA1WAS');
  t.addOcr('MODEL NS-WMT41WA5');
  assert.equal(t.snapshot().model.value, 'NS-WMT41WA5');
  assert.equal(t.snapshot().model.locked, false);
  t.addOcr('MODEL NS-WMT41WA5');
  assert.equal(t.snapshot().model.locked, false); // 3 votes
  t.addOcr('MODEL NS-WMT41WA5');
  assert.equal(t.snapshot().model.locked, true);
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

// ---- Real tags from the field (Nov 2026) ----

test('junk is never a model or serial: links, ratings, refrigerant, dates', async () => {
  const { isJunkCode } = await import('../plateParse.js');
  for (const j of ['HTTP://BIT.LY/SAMSUNGREFRIGERATOR', 'HTTP://GSCS-MANUAL.LGE.COM/DFZ/X', '115VAC', '120V~10A', '4.0A', 'R134A', 'R600A', '14.08.2024', '60HZ']) {
    assert.equal(isJunkCode(j), true, j);
  }
  for (const ok of ['WM4000HWA', 'DVE45B6300P', 'U80806495', '608TNEP2B268']) assert.equal(isJunkCode(ok), false, ok);
  assert.equal(parseOcrText('MODEL\n115 VAC 60 HZ').model, null);
});

test('Samsung fridge: serial barcode + bit.ly QR → serial only, link ignored', () => {
  const t = new PlateReadTracker();
  t.addBarcode('1H7Q43AL301843R');
  t.addBarcode('http://bit.ly/samsungrefrigerator');
  const s = t.snapshot();
  assert.equal(s.serial.value, '1H7Q43AL301843R');
  assert.equal(s.serial.source, 'barcode');
  assert.equal(s.model.value, '');
});

test('Samsung fridge text: MODEL CODE / S/N on one label', () => {
  const r = parseOcrText('REV. 09 S/N : 1H7Q43AL301843R\nMODEL CODE\nCODE DE MODELE : RF23BB8600QLAA');
  assert.equal(r.serial, '1H7Q43AL301843R');
  assert.equal(r.model, 'RF23BB8600QLAA');
});

test('LG washer: QR link and 20-digit plate barcode ignored, bilingual model label read', () => {
  const t = new PlateReadTracker();
  assert.deepEqual(t.addBarcode('HTTP://GSCS-MANUAL.LGE.COM/DFZ/ABC123'), []);
  assert.deepEqual(t.addBarcode('028286082B268A184746'), []);
  const r = parseOcrText('MODEL / MODELE : WM4000HWA / 03\nF3P2CYUBWP1.ABWEUUS\n120 V, 60 HZ, 10 A\n028286082B268A184746 S/NO. : 608TNEP2B268 6I2F0542');
  assert.equal(r.model, 'WM4000HWA');
  assert.equal(r.serial, '608TNEP2B268');
  assert.equal(classifyCode('608TNEP2B268').kind, 'serial');
});

test('Whirlpool freezer: real model, not "115VAC" or the UL model', () => {
  const text = 'MODEL/ MODELE: WZF79R20DW03 DATE:201802\nSERIAL/SERIE: U80806495 PLT: OT\nUL MODEL/MODELE 20UFA\n4.6 OZ 130.0 G R134A 115 VAC / 60 HZ /4.0 A';
  const r = parseOcrText(text);
  assert.equal(r.model, 'WZF79R20DW03');
  assert.equal(r.serial, 'U80806495');
  // Even with the real MODEL line missed, the UL listing and the voltage are not taken.
  assert.equal(parseOcrText('UL MODEL/MODELE 20UFA\n115 VAC / 60 HZ').model, null);
});

test('Samsung dryers: look-alike letters in the model digits, O leading a serial', () => {
  assert.equal(parseOcrText('MODEL : DVES0BG8300V').model, 'DVE50BG8300V');
  assert.equal(parseOcrText('MODEL : DVE45B6300P').model, 'DVE45B6300P');
  assert.equal(parseOcrText('MODEL NO. DVE45B6300P/A3 01 SERIAL NO. OBE75BBX802256A 14.08.2024').serial, '0BE75BBX802256A');
  assert.equal(classifyCode('0BNF5BBT804741L').kind, 'serial');
  // Real letters after a prefix are left alone.
  assert.equal(parseOcrText('MODEL LRFVS3006S').model, 'LRFVS3006S');
  assert.equal(parseOcrText('MODEL GTW485ASJ4WS').model, 'GTW485ASJ4WS');
});

test('GE fridge: label word misread → unlabeled guesses still find model and serial', () => {
  const r = parseOcrText('GE APPLIANCES\nAPPLIANCE PARK, LOUISVILLE, KY 40225\nMODET PFD87ESPV0RS\nSEPIAI DZ237098G\nE9527');
  assert.equal(r.model, null);
  assert.equal(r.guesses.model, 'PFD87ESPV0RS');
  assert.equal(r.guesses.serial, 'DZ237098G');
  assert.equal(classifyCode('MD511803').kind, 'serial');
  const t = new PlateReadTracker();
  for (let i = 0; i < 3; i += 1) t.addOcr('MODET PFD87ESPV0RS');
  assert.equal(t.snapshot().model.locked, false);
  t.addOcr('MODET PFD87ESPV0RS');
  assert.equal(t.snapshot().model.locked, true);
});

test('text that matches a barcode on the plate locks as that barcode', () => {
  const t = new PlateReadTracker();
  t.addBarcode('AB12CD3456'); // unclassifiable on its own
  assert.deepEqual(t.addOcr('MODEL AB12CD3456'), ['model']);
  assert.equal(t.snapshot().model.source, 'barcode');
});

test('findLabelWords: bilingual label words and S/No.', async () => {
  const { findLabelWords } = await import('../plateParse.js');
  const box = { x0: 0, y0: 0, x1: 10, y1: 12 };
  const r = findLabelWords([{ text: 'MODEL/MODELE:', bbox: box }, { text: 'SERIAL/SERIE:', bbox: box }, { text: 'S/No.', bbox: box }]);
  assert.equal(r.model.length, 1);
  assert.equal(r.serial.length, 2);
});

test('Insignia: letter date code inside the serial is kept', () => {
  const r = parseOcrText('MODEL: NS-WMT41WA5 REV.: A 120V~10A\nDATE CODE: 24L31B\nSERIAL NO. 24L31B03805');
  assert.equal(r.model, 'NS-WMT41WA5');
  assert.equal(r.serial, '24L31B03805');
  assert.equal(parseOcrText('SERIAL: AT12I456').serial, 'AT121456');
});
