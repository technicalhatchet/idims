import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  groupWorkOrderStatusOptions,
  WORK_ORDER_STATUS_OPTIONS,
  workOrderStatusOptionsForUser,
} from '../workOrderStatusOptions.js';

const values = (opts) => opts.map((o) => o.value);

test('completed, closed and recall are never offered for manual change', () => {
  for (const user of [{ role: 'admin', isManager: true }, { role: 'technician', isManager: false }]) {
    const v = values(workOrderStatusOptionsForUser(user));
    for (const gone of ['completed', 'closed', 'recall']) assert.ok(!v.includes(gone), `${gone} for ${user.role}`);
  }
});

test('redo stays available to everyone', () => {
  assert.ok(values(workOrderStatusOptionsForUser({ role: 'technician', isManager: false })).includes('redo'));
  assert.ok(values(workOrderStatusOptionsForUser({ role: 'admin', isManager: true })).includes('redo'));
});

test('managers get 15 statuses in four sections, every option placed once', () => {
  const groups = groupWorkOrderStatusOptions(WORK_ORDER_STATUS_OPTIONS);
  assert.equal(WORK_ORDER_STATUS_OPTIONS.length, 15);
  assert.deepEqual(groups.map((g) => g.label), ['ON THE JOB', 'PARTS', 'FOLLOW-UP', 'CLOSE OUT']);
  const placed = groups.flatMap((g) => values(g.items));
  assert.equal(placed.length, 15);
  assert.equal(new Set(placed).size, 15);
  assert.deepEqual(values(groups[3].items), ['completed_pending_payment', 'refunded', 'canceled']);
});

test('field techs: close out only offers Canceled', () => {
  const groups = groupWorkOrderStatusOptions(workOrderStatusOptionsForUser({ role: 'technician', isManager: false }));
  assert.deepEqual(values(groups.find((g) => g.key === 'close_out').items), ['canceled']);
});

test('an unknown status still shows up (in the last section)', () => {
  const groups = groupWorkOrderStatusOptions([...WORK_ORDER_STATUS_OPTIONS, { value: 'brand_new', label: 'Brand New' }]);
  assert.ok(values(groups[groups.length - 1].items).includes('brand_new'));
});

test('workOrderStatusLabel names every status, old ones included', async () => {
  const { workOrderStatusLabel } = await import('../workOrderStatusOptions.js');
  assert.equal(workOrderStatusLabel('in_progress'), 'In Progress');
  assert.equal(workOrderStatusLabel('completed'), 'Completed');
  assert.equal(workOrderStatusLabel('closed'), 'Closed');
  assert.equal(workOrderStatusLabel('recall'), 'Redo');
  assert.equal(workOrderStatusLabel('some_new_status'), 'Some New Status');
  assert.equal(workOrderStatusLabel(''), '');
});
