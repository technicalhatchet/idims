import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ageLabel,
  ageTone,
  awaitingSummary,
  filterByAge,
  formatMoney,
  formatMoneyShort,
  lastSendLabel,
  payLinkSmsUrl,
  sortAwaiting,
} from '../awaitingPayment.js';

const now = new Date(2026, 10, 9, 12, 0);

test('send line reads like a person wrote it', () => {
  assert.equal(lastSendLabel(null, now), 'Link not sent yet');
  assert.equal(lastSendLabel({ channel: 'text', sent_at: new Date(2026, 10, 9, 8).toISOString() }, now), 'Texted today');
  assert.equal(lastSendLabel({ channel: 'email', sent_at: new Date(2026, 10, 8, 20).toISOString() }, now), 'Emailed yesterday');
  assert.equal(lastSendLabel({ channel: 'copy', sent_at: new Date(2026, 10, 6, 9).toISOString() }, now), 'Link copied 3d ago');
});

test('age colors switch at 7 and 30 days', () => {
  assert.equal(ageTone(0).color, '#22D3EE');
  assert.equal(ageTone(7).color, '#FB923C');
  assert.equal(ageTone(30).hot, true);
  assert.equal(ageLabel(0), 'TODAY');
  assert.equal(ageLabel(12), '12D OPEN');
});

test('money and tile summary', () => {
  assert.equal(formatMoney(1025.58), '$1,025.58');
  assert.equal(formatMoneyShort(1025.58), '$1,026');
  assert.equal(awaitingSummary({ count: 1, over_30: 0 }), '1 job');
  assert.equal(awaitingSummary({ count: 5, over_30: 1 }), '5 jobs');
});

test('filter and sort', () => {
  const items = [
    { id: 'a', days_open: 2, balance_due: 500 },
    { id: 'b', days_open: 34, balance_due: 89 },
    { id: 'c', days_open: 9, balance_due: 312 },
  ];
  assert.deepEqual(filterByAge(items, '7').map((i) => i.id), ['b', 'c']);
  assert.deepEqual(filterByAge(items, '30').map((i) => i.id), ['b']);
  assert.deepEqual(sortAwaiting(items, 'oldest').map((i) => i.id), ['b', 'c', 'a']);
  assert.deepEqual(sortAwaiting(items, 'largest').map((i) => i.id), ['a', 'c', 'b']);
});

test('text link matches the pay sheet wording', () => {
  const url = payLinkSmsUrl({ phone: '4195550142', order_number: 'CT-001040', balance_due: 89, pay_url: 'https://x/pay/t' });
  assert.ok(url.startsWith('sms:4195550142?&body='));
  assert.equal(decodeURIComponent(url.split('body=')[1]), 'Atomic Repair invoice #CT-001040 — $89.00. Pay here: https://x/pay/t');
  assert.equal(payLinkSmsUrl({ phone: '', pay_url: 'x' }), null);
});
