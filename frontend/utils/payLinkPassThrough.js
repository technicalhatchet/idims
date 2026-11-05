import { publicBookingApiUrl } from './publicBookingApi';

/** Visitor IP for backend rate limits (Vercel sets x-forwarded-for; first hop is the visitor). */
function visitorIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

/** Server-side pass-through to /api/public/pay/... with private-page headers. */
export async function passThrough(req, res, { path, method, body, unreachableDetail }) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const headers = { 'Content-Type': 'application/json' };
  const ip = visitorIp(req);
  if (ip) headers['X-Forwarded-For'] = ip;

  try {
    const response = await fetch(publicBookingApiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    try {
      return res.status(response.status).json(JSON.parse(text));
    } catch {
      return res.status(response.status).json({ detail: text });
    }
  } catch {
    return res.status(502).json({ detail: unreachableDetail });
  }
}
