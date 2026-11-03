import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBarcodeBoxes } from '../../lib/plateBarcodeCore.js';

function blankImage(w, h) {
  return new Uint8ClampedArray(w * h).fill(230);
}

function drawBars(lum, w, { x, y, width, height }) {
  // Deterministic 1/2/3 px bars, like a dense Code 128 strip.
  const pattern = [1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 2];
  let cx = x;
  let dark = true;
  let i = 0;
  while (cx < x + width) {
    const bw = pattern[i % pattern.length] * 2;
    if (dark) for (let yy = y; yy < y + height; yy += 1) for (let xx = cx; xx < Math.min(cx + bw, x + width); xx += 1) lum[yy * w + xx] = 20;
    cx += bw;
    dark = !dark;
    i += 1;
  }
}

test('findBarcodeBoxes finds a dense barcode and pads it for a quiet zone', () => {
  const w = 640;
  const h = 200;
  const lum = blankImage(w, h);
  const bars = { x: 300, y: 60, width: 240, height: 40 };
  drawBars(lum, w, bars);
  const boxes = findBarcodeBoxes(lum, w, h);
  assert.equal(boxes.length, 1);
  const [b] = boxes;
  assert.ok(b.x <= bars.x - 8, 'left quiet zone');
  assert.ok(b.x + b.w >= bars.x + bars.width + 8, 'right quiet zone');
  assert.ok(b.y <= bars.y && b.y + b.h >= bars.y + bars.height, 'covers the bar height');
});

test('findBarcodeBoxes finds two stacked codes separately', () => {
  const w = 640;
  const h = 240;
  const lum = blankImage(w, h);
  drawBars(lum, w, { x: 280, y: 40, width: 260, height: 36 });
  drawBars(lum, w, { x: 280, y: 150, width: 220, height: 36 });
  assert.equal(findBarcodeBoxes(lum, w, h).length, 2);
});

test('findBarcodeBoxes ignores a plain or horizontally striped image', () => {
  const w = 320;
  const h = 160;
  const lum = blankImage(w, h);
  for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 1) lum[y * w + x] = 20; // horizontal lines
  assert.equal(findBarcodeBoxes(lum, w, h).length, 0);
});
