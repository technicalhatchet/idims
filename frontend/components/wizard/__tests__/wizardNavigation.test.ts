import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveStepIndexForActiveId } from '../wizardStepSync';
import type { WizardStepDefinition } from '../types';

function step(id: string, stepKey?: string): WizardStepDefinition {
  return {
    id,
    title: id,
    component: () => null,
    meta: stepKey ? { stepKey } : undefined,
  };
}

test('A: active step id tracks backward navigation index', () => {
  const visible = [step('s1', 'complaint'), step('s2', 'visual'), step('s3', 'functional')];
  const atTwo = resolveStepIndexForActiveId(visible, 's2', 2);
  assert.equal(atTwo, 1);
});

test('B: back then forward keeps index aligned with active id', () => {
  const visible = [step('s1'), step('s2'), step('s3')];
  assert.equal(resolveStepIndexForActiveId(visible, 's2', 0), 1);
  assert.equal(resolveStepIndexForActiveId(visible, 's2', 2), 1);
});

test('C: does not jump to stale high index when active id is earlier', () => {
  const visible = [step('s1'), step('s2'), step('s3'), step('s4')];
  const index = resolveStepIndexForActiveId(visible, 's2', 3);
  assert.equal(index, 1);
});

test('E: OEM insert preserves active step by id', () => {
  const before = [step('s1'), step('s2'), step('s3')];
  const after = [step('oem'), step('s1'), step('s2'), step('s3')];
  const index = resolveStepIndexForActiveId(after, 's3', resolveStepIndexForActiveId(before, 's3', 2));
  assert.equal(index, 3);
});

test('F: missing active id clamps instead of jumping to end', () => {
  const visible = [step('s1'), step('s2')];
  const index = resolveStepIndexForActiveId(visible, 'removed', 5);
  assert.equal(index, 1);
});
