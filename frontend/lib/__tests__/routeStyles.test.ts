import assert from 'node:assert/strict';
import { test } from 'node:test';

import { needsRouteScopedDiagnosticStyles } from '../routeStyles.js';

test('matches intended route roots', () => {
  assert.equal(needsRouteScopedDiagnosticStyles('/solomon'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/work_orders'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard/work-orders'), true);
});

test('matches nested and dynamic route patterns', () => {
  assert.equal(needsRouteScopedDiagnosticStyles('/solomon/diagnostics/foo'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/solomon/diagnostics/[id]'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard/work-orders/[id]'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard/work-orders/[id]/edit'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/work_orders/[id]'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/work_orders/new'), true);
});

test('allows trailing slash on roots and nested paths', () => {
  assert.equal(needsRouteScopedDiagnosticStyles('/solomon/'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/work_orders/'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard/work-orders/'), true);
  assert.equal(needsRouteScopedDiagnosticStyles('/work_orders/abc/'), true);
});

test('rejects false-positive prefixes', () => {
  assert.equal(needsRouteScopedDiagnosticStyles('/solomonwhatever'), false);
  assert.equal(needsRouteScopedDiagnosticStyles('/work_orders-test'), false);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard/work-orders-old'), false);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard/work-orders-old/abc'), false);
});

test('rejects unrelated marketing and app routes', () => {
  assert.equal(needsRouteScopedDiagnosticStyles('/'), false);
  assert.equal(needsRouteScopedDiagnosticStyles('/pricing'), false);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard'), false);
  assert.equal(needsRouteScopedDiagnosticStyles('/techboard/route'), false);
});

test('rejects empty pathname', () => {
  assert.equal(needsRouteScopedDiagnosticStyles(''), false);
});
