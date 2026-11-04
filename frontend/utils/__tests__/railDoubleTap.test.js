import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDoubleTapDetector } from '../railDoubleTap.js';

function clock() {
  let t = 1000;
  return { now: () => t, tick: (ms) => { t += ms; } };
}

function tap(d, c, x, y, { hold = 60, moveTo = null } = {}) {
  d.start(x, y);
  if (moveTo) d.move(moveTo[0], moveTo[1]);
  c.tick(hold);
  return d.end();
}

test('two quick taps in the same spot = double tap', () => {
  const c = clock();
  const d = createDoubleTapDetector({ now: c.now });
  assert.equal(tap(d, c, 100, 100), false);
  c.tick(150);
  assert.equal(tap(d, c, 104, 102), true);
});

test('two quick swipes (like flicking the tab row) are never a double tap', () => {
  const c = clock();
  const d = createDoubleTapDetector({ now: c.now });
  assert.equal(tap(d, c, 300, 200, { moveTo: [180, 202] }), false);
  c.tick(120);
  assert.equal(tap(d, c, 300, 200, { moveTo: [170, 201] }), false);
});

test('a swipe between taps resets; slow or far taps do not count; held touch is not a tap', () => {
  const c = clock();
  const d = createDoubleTapDetector({ now: c.now });
  tap(d, c, 100, 100);
  c.tick(100);
  tap(d, c, 100, 100, { moveTo: [40, 100] });
  c.tick(100);
  assert.equal(tap(d, c, 100, 100), false);
  c.tick(500);
  assert.equal(tap(d, c, 100, 100), false); // too slow after the previous tap
  c.tick(100);
  assert.equal(tap(d, c, 220, 100), false); // too far
  c.tick(100);
  assert.equal(tap(d, c, 220, 100, { hold: 500 }), false); // held
});

test('touches on controls are skipped', () => {
  const c = clock();
  const d = createDoubleTapDetector({ now: c.now });
  d.start(100, 100, true); c.tick(50); assert.equal(d.end(), false);
  c.tick(100);
  d.start(100, 100, true); c.tick(50); assert.equal(d.end(), false);
});
