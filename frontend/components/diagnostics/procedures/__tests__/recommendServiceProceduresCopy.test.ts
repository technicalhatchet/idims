import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getServiceProcedure } from '../procedureRegistry';
import { recommendServiceProcedures } from '../recommendServiceProcedures';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';

test('user-facing recommendation reason avoids canonical routing jargon', () => {
  const measurementContext = buildMeasurementContext({
    templateId: 'washer',
    equipmentMake: 'Whirlpool',
    equipmentModel: 'WFW8300',
  });
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const intelligence = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys: ['complaint'],
    defaultStepOrder: ['complaint', 'visual', 'functional'],
    procedureRuns: {},
  });
  const recommendations = recommendServiceProcedures({
    templateId: 'washer',
    measurementContext,
    intelligence,
    complaintChipIds: ['wont_spin'],
    errorCodes: [],
    procedureRuns: {},
  });
  const doorLock = recommendations.find((item) => item.procedureId === 'w8178558-door-lock');
  assert.ok(doorLock?.reason);
  assert.ok(!/canonical routing/i.test(doorLock.reason));
  assert.ok(!/canonical id/i.test(doorLock.reason));
  const procedure = getServiceProcedure('w8178558-door-lock');
  assert.ok(procedure);
});
