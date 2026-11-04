import assert from 'node:assert/strict';
import { test } from 'node:test';

import { notificationLook } from '../notificationLook.js';

const look = (title, related_type) => notificationLook({ title, related_type });

test('real TechDeck notification titles get the right icon and tone', () => {
  assert.deepEqual(look('New Job Assignment', 'work_order'), { icon: 'job', tone: 'cyan' });
  assert.deepEqual(look('New Work Order Created', 'work_order'), { icon: 'job', tone: 'cyan' });
  assert.deepEqual(look('New pending work order'), { icon: 'job', tone: 'cyan' });
  assert.deepEqual(look('Scheduling approval needed', 'work_order'), { icon: 'calendar', tone: 'cyan' });
  assert.deepEqual(look('Portal booking confirmed', 'work_order'), { icon: 'calendar', tone: 'cyan' });
  assert.deepEqual(look("Today's schedule"), { icon: 'calendar', tone: 'cyan' });
  assert.deepEqual(look('Estimate decision', 'work_order'), { icon: 'doc', tone: 'orange' });
  assert.deepEqual(look('Estimate auto-approved'), { icon: 'doc', tone: 'orange' });
  assert.deepEqual(look('New Invoice #2231', 'invoice'), { icon: 'card', tone: 'orange' });
  assert.deepEqual(look('Customer media', 'work_order'), { icon: 'photo', tone: 'cyan' });
  assert.deepEqual(look('Portal update request', 'work_order'), { icon: 'chat', tone: 'cyan' });
  assert.deepEqual(look('How did we do?'), { icon: 'star', tone: 'cyan' });
  assert.deepEqual(look('Something else'), { icon: 'bell', tone: 'cyan' });
  assert.deepEqual(notificationLook(null), { icon: 'bell', tone: 'cyan' });
});
