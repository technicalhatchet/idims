/**
 * Square pay-link + Tap to Pay client.
 *
 * Spec: Claude project doc "claude/square-payments-plan.md" (IDIMS uses Square, not Stripe).
 * Nothing here calls the network until the matching backend exists and the feature
 * flags below are switched on, so the Pay sheet can ship before the backend does.
 *
 *   NEXT_PUBLIC_SQUARE_PAY_LINKS_ENABLED=true   → QR, text link, copy link, email invoice (plan §4–5)
 *   NEXT_PUBLIC_SQUARE_TAP_TO_PAY_ENABLED=true  → Tap to Pay hand-off to the Square app (plan §6)
 *   NEXT_PUBLIC_SQUARE_EMAIL_INVOICE_ENABLED=true → "Email invoice" tile (PDF + pay link via Resend)
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
 * "Email invoice": invoice PDF + "Pay online" button to the job's pay link, via Resend.
 * Backend: POST work-orders/{id}/email-invoice → { email, pay_url, amount_due }
 */
export async function emailWorkOrderInvoice(workOrderId) {
  if (!SQUARE_PAY_FEATURES.emailInvoice) throw new Error('Email invoice is not turned on.');
  return apiClient(`work-orders/${workOrderId}/email-invoice`, { method: 'POST' });
}

/**
 * Log that a pay link went out ('text' | 'copy' | 'qr'; email logs itself on the backend).
 * Fire and forget: the send already happened, so a logging failure never surfaces.
 * Backend: POST work-orders/{id}/pay-link/sends { channel }
 */
export function logPayLinkSend(workOrderId, channel) {
  if (!workOrderId || !channel) return;
  apiClient(`work-orders/${workOrderId}/pay-link/sends`, {
    method: 'POST',
    body: JSON.stringify({ channel }),
  }).catch(() => {});
}

/** 'android' | 'ios' — which Square POS hand-off format this device needs. */
export function tapToPayPlatform() {
  if (typeof navigator === 'undefined') return 'ios';
  return /android/i.test(navigator.userAgent) ? 'android' : 'ios';
}

/**
 * Build the Square Point of Sale API (web) URL from the backend's start response.
 * Fields per Square's "Mobile Web technical reference": iOS URL scheme + JSON (version 1.3),
 * Android intent extras. The amount and signed `state` always come from the backend.
 */
export function buildPosUrl(start, platform = tapToPayPlatform()) {
  if (!start) return null;
  if (platform === 'android') {
    const enc = encodeURIComponent;
    const extras = [
      'action=com.squareup.pos.action.CHARGE',
      'package=com.squareup',
      `S.com.squareup.pos.WEB_CALLBACK_URI=${enc(start.callback_url)}`,
      `S.com.squareup.pos.CLIENT_ID=${enc(start.application_id)}`,
      'S.com.squareup.pos.API_VERSION=v2.0',
      `i.com.squareup.pos.TOTAL_AMOUNT=${start.amount_cents}`,
      `S.com.squareup.pos.CURRENCY_CODE=${enc(start.currency || 'USD')}`,
      'S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD',
      `S.com.squareup.pos.LOCATION_ID=${enc(start.location_id)}`,
      `S.com.squareup.pos.NOTE=${enc(start.note)}`,
      `S.com.squareup.pos.REQUEST_METADATA=${enc(start.state)}`,
      'l.com.squareup.pos.AUTO_RETURN_TIMEOUT_MS=3200',
    ];
    return `intent:#Intent;${extras.join(';')};end`;
  }
  const data = {
    amount_money: { amount: String(start.amount_cents), currency_code: start.currency || 'USD' },
    callback_url: start.callback_url,
    client_id: start.application_id,
    version: '1.3',
    location_id: start.location_id,
    notes: start.note,
    state: start.state,
    options: {
      supported_tender_types: ['CREDIT_CARD'],
      // IDIMS totals already include tax — don't let the Square app add its default fees.
      clear_default_fees: true,
      auto_return: true,
    },
  };
  return `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(data))}`;
}

/**
 * Tap to Pay: ask the backend for the job's balance + signed state, then open the Square app.
 * Expected backend: POST work-orders/{id}/tap-to-pay
 */
export async function startTapToPay(workOrderId) {
  if (!SQUARE_PAY_FEATURES.tapToPay) throw new Error('Tap to Pay is not turned on.');
  const start = await apiClient(`work-orders/${workOrderId}/tap-to-pay`, { method: 'POST' });
  const url = buildPosUrl(start);
  if (!url) throw new Error('Could not build the Square hand-off.');
  window.location.href = url;
  return start;
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
