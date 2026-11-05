/**
 * Square pay-link client — SCAFFOLD ONLY.
 *
 * Spec: Claude project doc "claude/square-payments-plan.md" (IDIMS uses Square, not Stripe).
 * Nothing here calls the network until the matching backend exists and the feature
 * flags below are switched on, so the Pay sheet can ship before the backend does.
 *
 *   NEXT_PUBLIC_SQUARE_PAY_LINKS_ENABLED=true   → QR, text link, copy link, email invoice (plan §4–5)
 *   NEXT_PUBLIC_SQUARE_TAP_TO_PAY_ENABLED=true  → Tap to Pay hand-off to the Square app (plan §6)
 *   NEXT_PUBLIC_SQUARE_EMAIL_INVOICE_ENABLED=true → "Email invoice" tile (needs its backend first)
 */
import { apiClient } from '../../utils/api-client';

export const SQUARE_PAY_FEATURES = {
  payLinks: process.env.NEXT_PUBLIC_SQUARE_PAY_LINKS_ENABLED === 'true',
  tapToPay: process.env.NEXT_PUBLIC_SQUARE_TAP_TO_PAY_ENABLED === 'true',
  emailInvoice: process.env.NEXT_PUBLIC_SQUARE_EMAIL_INVOICE_ENABLED === 'true',
};

/**
 * The job's permanent pay link (`{NEXT_PUBLIC_PAY_BASE_URL}/{pay_token}`), which the backend
 * redirects to a current Square payment page. Never Square's own public_url (plan "Rules").
 *
 * Expected backend response (to be built in plan step 4):
 *   GET work-orders/{id}/pay-link → { pay_url, amount_due_cents, square_status }
 *
 * @returns {Promise<null | { payUrl: string, amountDueCents: number|null, squareStatus: string|null }>}
 */
export async function fetchWorkOrderPayLink(workOrderId) {
  if (!SQUARE_PAY_FEATURES.payLinks || !workOrderId) return null;
  try {
    const res = await apiClient(`work-orders/${workOrderId}/pay-link`);
    if (!res?.pay_url) return null;
    return {
      payUrl: res.pay_url,
      amountDueCents: Number.isFinite(res.amount_due_cents) ? res.amount_due_cents : null,
      squareStatus: res.square_status || null,
    };
  } catch {
    return null;
  }
}

/**
 * "Email invoice": create + publish the Square invoice that mirrors this job (plan §3–4).
 * Expected backend (plan step 2): POST work-orders/{id}/square/publish
 */
export async function publishWorkOrderSquareInvoice(workOrderId) {
  if (!SQUARE_PAY_FEATURES.payLinks) throw new Error('Square invoices are not set up yet.');
  return apiClient(`work-orders/${workOrderId}/square/publish`, { method: 'POST' });
}

/**
 * Tap to Pay hand-off URL for the Square Point of Sale app (plan §6).
 * Deliberately unimplemented: the exact POS API parameter names must be checked against
 * Square's current "Point of Sale API — Web" docs, then proven with a $1 test, before coding.
 * Returns null so the button stays disabled.
 */
// eslint-disable-next-line no-unused-vars
export function buildTapToPayUrl({ workOrderId, amountCents, platform }) {
  if (!SQUARE_PAY_FEATURES.tapToPay) return null;
  return null; // TODO(square plan step 5)
}

/** Pre-filled text to the customer from the tech's own Messages app (no Twilio). */
export function buildPayLinkSmsUrl({ phone, orderNumber, amountDue, payUrl }) {
  if (!phone || !payUrl) return null;
  const amount = Number.isFinite(Number(amountDue)) ? `$${Number(amountDue).toFixed(2)}` : '';
  const ref = orderNumber ? ` #${orderNumber}` : '';
  const body = `Atomic Repair invoice${ref}${amount ? ` — ${amount}` : ''}. Pay here: ${payUrl}`;
  // `?&body=` works on both iOS and Android.
  return `sms:${phone}?&body=${encodeURIComponent(body)}`;
}
