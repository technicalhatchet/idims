import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildProcedureRecommendationForOffer,
  resolveOemContinuationOfferProcedureId,
  resolveOemNextTestOfferTitle,
} from '../resolveOemNextTestOffer';

test('continuation offer id prefers payload over bridge and hides when target completed', () => {
  const payload = {
    oemContinuationOfferProcedureId: 'w8178558-drain-pump',
    procedureRuns: {
      'w8178558-motor-circuit': { status: 'completed' },
    },
  };
  assert.equal(
    resolveOemContinuationOfferProcedureId(payload, 'w8178558-drain-pump'),
    'w8178558-drain-pump',
  );

  const afterDrainComplete = {
    ...payload,
    procedureRuns: {
      ...payload.procedureRuns,
      'w8178558-drain-pump': { status: 'completed' },
    },
  };
  assert.equal(resolveOemContinuationOfferProcedureId(afterDrainComplete, null), null);
});

test('after motor complete, next test title resolves to drain pump immediately', () => {
  const rec = buildProcedureRecommendationForOffer('w8178558-drain-pump');
  assert.ok(rec);
  assert.match(rec!.procedure.title, /Drain Pump/i);
  assert.equal(
    resolveOemNextTestOfferTitle('w8178558-drain-pump', {
      procedureId: 'w8178558-motor-circuit',
      procedure: { id: 'w8178558-motor-circuit', title: '§5-8: Drive Motor Circuit' } as never,
      reason: 'stale',
      priority: 100,
    }),
    rec!.procedure.title,
  );
});
