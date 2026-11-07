import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  appliedDiagnosticCreditAmount,
  computeWorkOrderDueToday,
  diagnosticCreditBase,
  showDiagnosticCreditRow,
} from '../workOrderBilling.js';

const line = (name, type, price, billing_status, sku_code = 'SKU') => ({
  name,
  price,
  billing_status,
  sku_code,
  service_definition: { service_type: type },
});

const estimate = [
  line('Diagnostic', 'diagnostic', 89, 'not_billable', 'DIAG'),
  line('Washer Repair', 'repair', 225, 'not_billable'),
];

test('estimate with nothing billable still shows the credit', () => {
  const wo = { diagnostic_discount_amount: null, diagnostic_credit_mode: 'half', tax_rate: 0.0775, parts: [] };
  assert.equal(diagnosticCreditBase(wo, estimate), 89);
  assert.equal(showDiagnosticCreditRow(wo, estimate), true);
  assert.equal(appliedDiagnosticCreditAmount(wo, estimate), 45);
});

test('trip charge and waived diagnostic never count', () => {
  const services = [
    line('Trip Charge', 'diagnostic', 35, 'billable', 'TRIP-CHARGE'),
    line('Diagnostic', 'diagnostic', 89, 'waived', 'DIAG'),
    line('Washer Repair', 'repair', 225, 'not_billable'),
  ];
  const wo = { diagnostic_credit_mode: 'half' };
  assert.equal(diagnosticCreditBase(wo, services), 0);
  assert.equal(showDiagnosticCreditRow(wo, services), false);
});

test('full diagnostic is due until the repair is completed', () => {
  const services = [
    line('Diagnostic', 'diagnostic', 89, 'billable', 'DIAG'),
    line('Washer Repair', 'repair', 225, 'not_billable'),
  ];
  const wo = { diagnostic_credit_mode: 'half', tax_rate: 0.0775, parts: [], appointments: [], amount_previously_paid: 0 };
  assert.equal(computeWorkOrderDueToday(wo, services).dueToday, 89);
});

test('stamped amount wins over line price', () => {
  const wo = { diagnostic_discount_amount: '79.00', diagnostic_credit_mode: 'full' };
  assert.equal(appliedDiagnosticCreditAmount(wo, estimate), 79);
});

test('diag paid, repair still an estimate: due later, not paid in full', async () => {
  const { showPaidInFullBillingRow, isWorkOrderPaidInFullForDocuments } = await import('../workOrderBilling.js');
  const services = [
    line('Diagnostic', 'diagnostic', 89, 'paid', 'DIAG'),
    line('Washer Repair', 'repair', 225, 'not_billable'),
  ];
  const wo = {
    status: 'in_progress',
    diagnostic_credit_mode: 'half',
    tax_rate: 0.0775,
    parts: [{ price: 100, status: 'needed' }],
    appointments: [],
    amount_previously_paid: 89,
  };
  const totals = computeWorkOrderDueToday(wo, services);
  assert.equal(totals.dueToday, 0);
  // 89 + 225 + 100 + 7.75 tax - 45 credit = 376.75 total; minus 89 paid = 287.75 later
  assert.equal(totals.projectedTotal, 376.75);
  assert.equal(totals.dueLater, 287.75);
  assert.equal(showPaidInFullBillingRow(totals.dueToday, [{ amount: 89 }], totals.dueLater), false);
  assert.equal(isWorkOrderPaidInFullForDocuments(wo, totals), false);
});

test('everything done and paid: paid in full', () => {
  const services = [
    line('Diagnostic', 'diagnostic', 89, 'paid', 'DIAG'),
    line('Washer Repair', 'repair', 225, 'paid'),
  ];
  const wo = {
    diagnostic_discount_amount: 89,
    diagnostic_credit_mode: 'half',
    tax_rate: 0.0775,
    parts: [],
    appointments: [],
    amount_previously_paid: 269,
  };
  const totals = computeWorkOrderDueToday(wo, services);
  assert.equal(totals.dueLater, 0);
  assert.equal(showDiagnosticCreditRow(wo, services), true);
});
