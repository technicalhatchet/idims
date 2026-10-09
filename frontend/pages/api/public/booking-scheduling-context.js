import { publicBookingApiUrl } from '../../../utils/publicBookingApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      publicBookingApiUrl('public/booking/scheduling-context'),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch {
      return res.status(response.status).json({ detail: text });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
