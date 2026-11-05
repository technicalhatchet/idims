import { passThrough } from '../../../../../utils/payLinkPassThrough';

/** Charge the pay-link balance. Body: { amount, square_source_id, payment_idempotency_key }. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  const token = String(req.query.token || '');
  const { amount, square_source_id: sourceId, payment_idempotency_key: idempotencyKey } = req.body || {};
  return passThrough(req, res, {
    path: `public/pay/${encodeURIComponent(token)}/charge`,
    method: 'POST',
    body: {
      amount,
      square_source_id: sourceId,
      payment_idempotency_key: idempotencyKey,
    },
    unreachableDetail: 'Could not reach the server. Refresh this page to check your balance before trying again.',
  });
}
