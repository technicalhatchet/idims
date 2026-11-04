import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  criticalMassApplianceLabel,
  criticalMassPhone,
  daysOverdue,
  isCriticalMass,
  overdueTag,
  sortCriticalMass,
} from '../criticalMass.js';

const NOW = new Date('2026-11-04T15:00:00Z');
const wo = (id, start, status = 'scheduled', extra = {}) => ({ id, scheduled_start: start, status, ...extra });

test('overdue = missed visit: still scheduled / pending / en route, visit day before today', () => {
  assert.equal(isCriticalMass(wo(1, '2026-11-03T18:00:00'), NOW), true);
  assert.equal(isCriticalMass(wo(6, '2026-11-01T18:00:00', 'pending'), NOW), true);
  assert.equal(isCriticalMass(wo(7, '2026-11-01T18:00:00', 'en_route'), NOW), true);
  for (const st of ['waiting_on_parts', 'canceled', 'closed', 'refunded', 'in_progress', 'need_to_contact']) {
    assert.equal(isCriticalMass(wo(8, '2026-11-01T18:00:00', st), NOW), false, st);
  }
  assert.equal(isCriticalMass(wo(2, '2026-11-04T09:00:00Z'), NOW), false); // today
  assert.equal(isCriticalMass(wo(3, '2026-10-01T10:00:00', 'completed'), NOW), false);
  assert.equal(isCriticalMass(wo(4, null), NOW), false);
  assert.equal(daysOverdue(wo(5, '2026-10-21T12:00:00Z'), NOW), 14);
});

test('sorted most overdue first, oldest visit first on ties', () => {
  const rows = sortCriticalMass([
    wo('a', '2026-11-01T12:00:00Z'),
    wo('b', '2026-10-21T12:00:00Z'),
    wo('c', '2026-11-01T09:00:00Z'),
    wo('d', '2026-11-05T09:00:00Z'),
    wo('e', '2026-10-25T09:00:00Z', 'completed'),
  ], NOW);
  assert.deepEqual(rows.map((r) => r.id), ['b', 'c', 'a']);
});

test('tag, appliance and phone helpers', () => {
  assert.equal(overdueTag(3, 6), '04 // OVERDUE 6d');
  assert.equal(overdueTag(11, 21), '12 // OVERDUE 21d');
  assert.equal(criticalMassApplianceLabel({ equipment_make: 'Whirlpool', equipment_type: 'washer' }), 'Whirlpool washer');
  assert.equal(criticalMassApplianceLabel({}), 'Appliance');
  assert.equal(criticalMassPhone({ client: { phone: '419-555-0100', mobile: '419-555-0199' } }), '419-555-0199');
  assert.equal(criticalMassPhone({ property: { tenant_phone: '419-555-0123' } }), '419-555-0123');
  assert.equal(criticalMassPhone({}), '');
});
