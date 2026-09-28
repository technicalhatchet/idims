import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  commitModelSuggestion,
  isDiagnosticEquipmentCommitted,
  normalizeMakeDraft,
  normalizeModelDraft,
  shouldApplyEquipmentLookupResult,
} from '../solomonEquipmentInput';

test('normalizeMakeDraft capitalizes first character only', () => {
  assert.equal(normalizeMakeDraft('whirlpool'), 'Whirlpool');
  assert.equal(normalizeMakeDraft('w'), 'W');
  assert.equal(normalizeMakeDraft('WHIRLPOOL'), 'WHIRLPOOL');
});

test('normalizeModelDraft uppercases without rewriting partial input', () => {
  assert.equal(normalizeModelDraft('wfw830'), 'WFW830');
  assert.equal(normalizeModelDraft('wf'), 'WF');
});

test('partial model does not satisfy diagnostic commit gate', () => {
  assert.equal(
    isDiagnosticEquipmentCommitted(
      { equipment_make: 'Whirlpool', equipment_model: 'WFW' },
      'washer',
    ),
    false,
  );
});

test('full model can commit diagnostic identity', () => {
  assert.equal(
    isDiagnosticEquipmentCommitted(
      { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
      'washer',
    ),
    true,
  );
});

test('commitModelSuggestion sets uppercase model from selection', () => {
  const next = commitModelSuggestion(
    { equipment_make: 'Whirlpool', equipment_model: 'WFW' },
    'wfw8300aw',
  );
  assert.equal(next.equipment_model, 'WFW8300AW');
});

test('stale lookup cannot overwrite newer draft model', () => {
  assert.equal(shouldApplyEquipmentLookupResult('WFW830', 'WFW8300'), false);
  assert.equal(shouldApplyEquipmentLookupResult('WFW8300', 'WFW8300'), true);
});
