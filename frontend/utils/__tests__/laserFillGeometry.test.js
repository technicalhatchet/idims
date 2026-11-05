import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILL_HALF_GAP, FILL_SLANT, finPath, sliceBounds, sliceBox, slicePoly } from '../laserFillGeometry.js';

test('fin path scales to the measured width with fixed shoulders', () => {
  assert.equal(finPath(390, 98), 'M0 98 C12 98 16 22 40 22 Q195 8 350 22 C374 22 378 98 390 98 Z');
  assert.match(finPath(440, 82), /Q220 8 400 22 C424 22 428 82 440 82 Z$/);
});

test('dividers lean into a pedestal around the primary', () => {
  const { divs, bounds } = sliceBounds({ width: 390, dividers: [126 / 390, 264 / 390], primaryIndex: 1 });
  assert.deepEqual(divs[0], { t: 126 + FILL_SLANT, b: 126 - FILL_SLANT });
  assert.deepEqual(divs[1], { t: 264 - FILL_SLANT, b: 264 + FILL_SLANT });
  assert.equal(bounds.length, 3);
  assert.equal(bounds[1].L.t, divs[0].t + FILL_HALF_GAP);
  assert.equal(bounds[1].R.b, divs[1].b - FILL_HALF_GAP);
  assert.equal(bounds[0].L.t, -6);
  assert.equal(bounds[2].R.t, 396);
});

test('dividers right of the primary all lean the same way', () => {
  const { divs } = sliceBounds({ width: 400, dividers: [0.23, 0.665, 0.835], primaryIndex: 1 });
  assert.ok(divs[0].t > divs[0].b);
  assert.ok(divs[1].t < divs[1].b);
  assert.ok(divs[2].t < divs[2].b);
});

test('a single slice covers the whole fin', () => {
  const { divs, bounds } = sliceBounds({ width: 390, dividers: [], primaryIndex: -1 });
  assert.equal(divs.length, 0);
  assert.equal(slicePoly(bounds[0], 82), '-6,-2 396,-2 396,84 -6,84');
  assert.deepEqual(sliceBox(bounds[0], 0, 1, 390), { left: 14, width: 362 });
});

test('insets shrink the slice sideways', () => {
  const { bounds } = sliceBounds({ width: 390, dividers: [126 / 390, 264 / 390], primaryIndex: 1 });
  assert.equal(slicePoly(bounds[1], 98, 6), '141.5,-2 248.5,-2 262.5,100 127.5,100');
});
