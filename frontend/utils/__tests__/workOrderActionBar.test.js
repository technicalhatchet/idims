import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  hasDiagnosticForVisit,
  pickDriverVisit,
  resolveWorkOrderActionBar,
} from '../workOrderActionBar.js';

const NOW = new Date(2026, 10, 3, 10, 0, 0); // Nov 3 2026, 10:00 local
const at = (h, dayOffset = 0) => new Date(2026, 10, 3 + dayOffset, h, 0, 0).toISOString();
const appt = (id, status, start) => ({ id, status, scheduled_start: start });
const bar = (workOrder, extra = {}) =>
  resolveWorkOrderActionBar({ workOrder, now: NOW, notes: [], ...extra });

test('in-progress visit beats a scheduled one; past/future visits are ignored', () => {
  const list = [appt('a', 'scheduled', at(14)), appt('b', 'in_progress', at(9)), appt('c', 'scheduled', at(9, 1))];
  assert.equal(pickDriverVisit(list, NOW).id, 'b');
  assert.equal(pickDriverVisit([appt('x', 'scheduled', at(9, 1))], NOW), null);
});

test('a visit left en route yesterday still drives the bar', () => {
  assert.equal(pickDriverVisit([appt('y', 'en_route', at(16, -1))], NOW).id, 'y');
});

test('visit flow: scheduled → en route → on site steps', () => {
  const wo = (status, extra = {}) => ({ status: 'scheduled', appointments: [appt('v', status, at(11))], ...extra });
  assert.equal(bar(wo('scheduled')).primary.id, 'start_route');
  assert.equal(bar(wo('scheduled')).reads, 'visit');
  assert.equal(bar(wo('en_route')).primary.id, 'arrived');
  assert.equal(bar(wo('in_progress')).primary.id, 'scan_plate');
  const captured = { equipment_model: 'WFW5620HW', equipment_serial: 'C12345678' };
  assert.equal(bar(wo('in_progress', captured)).primary.id, 'diagnose');
  const diag = [{ note: '[Diagnostic Results]\nsummary', appointment_id: 'v' }];
  assert.equal(bar(wo('in_progress', captured), { notes: diag }).primary.id, 'wrap_up');
});

test('unknown notes (still loading) skip straight to wrap up instead of nagging', () => {
  const wo = { status: 'in_progress', equipment_model: 'M', equipment_serial: 'S', appointments: [appt('v', 'in_progress', at(9))] };
  assert.equal(resolveWorkOrderActionBar({ workOrder: wo, now: NOW, notes: null }).primary.id, 'wrap_up');
});

test('phone pay: prepay while a balance is due, then start work', () => {
  const wo = { status: 'in_progress', appointments: [appt('v', 'phone_payment', at(9))] };
  assert.equal(bar(wo, { dueToday: 89 }).primary.label, 'Prepay');
  assert.equal(bar(wo, { dueToday: 0 }).primary.id, 'start_work');
});

test('job-driven states when there is no active visit', () => {
  assert.equal(bar({ status: 'waiting_on_parts', parts: [{ status: 'needed' }] }).primary.id, 'order_parts');
  assert.equal(bar({ status: 'waiting_on_parts', parts: [{ status: 'ordered' }] }).primary.id, 'parts_in');
  assert.equal(bar({ status: 'parts_received' }).primary.label, 'Book Return');
  assert.equal(bar({ status: 'completed_pending_payment' }).primary.label, 'Payment');
  assert.equal(bar({ status: 'pending_estimate_approval' }).primary.label, 'Estimate');
  assert.equal(bar({ status: 'reschedule' }).primary.label, 'Book Visit');
  assert.equal(bar({ status: 'reschedule' }).reads, 'job');
});

test('close job is red and only offered when allowed', () => {
  const allowed = bar({ status: 'completed' }, { canClose: true }).primary;
  assert.equal(allowed.id, 'close');
  assert.equal(allowed.tone, 'red');
  assert.notEqual(bar({ status: 'completed' }, { canClose: false }).primary.id, 'close');
});

test('read-only jobs get a disabled primary', () => {
  assert.equal(bar({ status: 'closed' }, { readOnly: true }).primary.tone, 'off');
});

test('diagnostic note matching falls back to same-day when not tied to a visit', () => {
  const notes = [{ note: '[Diagnostic Results]\nx', created_at: at(8) }];
  assert.equal(hasDiagnosticForVisit(notes, { id: 'v' }, NOW), true);
  assert.equal(hasDiagnosticForVisit([{ note: '[Diagnostic Results]\nx', created_at: at(8, -1) }], { id: 'v' }, NOW), false);
});

test('zone-less API times are read as shop-local wall time', () => {
  // The API stores visit times as naive Eastern wall time (see utils/schedule-time).
  assert.equal(pickDriverVisit([appt('z', 'scheduled', '2026-11-03T23:30:00')], NOW).id, 'z');
  assert.equal(pickDriverVisit([appt('z', 'scheduled', '2026-11-04T00:30:00')], NOW), null);
});
