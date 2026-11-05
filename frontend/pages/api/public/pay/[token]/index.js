import { passThrough } from '../../../../../utils/payLinkPassThrough';

/** Public pay page data (invoice + amount due). The token is the only credential. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  const token = String(req.query.token || '');
  return passThrough(req, res, {
    path: `public/pay/${encodeURIComponent(token)}`,
    method: 'GET',
    unreachableDetail: 'Could not reach the server. Please try again.',
  });
}
