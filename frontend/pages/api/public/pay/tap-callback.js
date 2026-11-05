import { passThrough } from '../../../../utils/payLinkPassThrough';

/** Square POS hand-back → backend verifies with Square and records. Body: { state, transaction_id }. */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  const { state, transaction_id: transactionId } = req.body || {};
  return passThrough(req, res, {
    path: 'public/pay/tap-callback',
    method: 'POST',
    body: { state, transaction_id: transactionId },
    unreachableDetail: 'Could not reach IDIMS. The card may have been charged — check Square before trying again.',
  });
}
