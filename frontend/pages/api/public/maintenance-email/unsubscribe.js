import { publicBookingApiUrl } from '../../../../utils/publicBookingApi';

export default async function handler(req, res) {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ detail: 'Missing token' });
  }
  const url = `${publicBookingApiUrl('public/maintenance-email/unsubscribe')}?token=${encodeURIComponent(token)}`;

  try {
    if (req.method === 'GET') {
      const response = await fetch(url, { method: 'GET' });
      const text = await response.text();
      try {
        return res.status(response.status).json(JSON.parse(text));
      } catch {
        return res.status(response.status).json({ detail: text });
      }
    }
    if (req.method === 'POST') {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {}),
      });
      const text = await response.text();
      try {
        return res.status(response.status).json(JSON.parse(text));
      } catch {
        return res.status(response.status).json({ detail: text });
      }
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
