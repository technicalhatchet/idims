/**
 * Same-origin BFF proxy to the Railway API.
 * Used when the frontend is hosted on a different origin (e.g. dma-eight.vercel.app)
 * so browser CORS / service-worker quirks do not block auth or DMA calls.
 */
import { getAccessToken } from '@auth0/nextjs-auth0';

function backendBaseUrl() {
  const raw = (
    process.env.BACKEND_API_URL
    || process.env.NEXT_PUBLIC_BACKEND_API_URL
    || process.env.NEXT_PUBLIC_API_URL
    || 'http://localhost:8000'
  ).replace(/\/$/, '');
  return raw.replace(/\/api$/i, '');
}

export default async function handler(req, res) {
  const segments = req.query.path;
  if (!segments || (Array.isArray(segments) && segments.length === 0)) {
    return res.status(400).json({ detail: 'Missing proxy path' });
  }

  const path = Array.isArray(segments) ? segments.join('/') : String(segments);
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const target = `${backendBaseUrl()}/${path}${requestUrl.search}`;

  const headers = {};
  const contentType = req.headers['content-type'];
  if (contentType) headers['Content-Type'] = contentType;
  const accept = req.headers.accept;
  if (accept) headers.Accept = accept;

  const clientAuth = req.headers.authorization;
  if (clientAuth) {
    headers.Authorization = clientAuth;
  } else {
    try {
      const { accessToken } = await getAccessToken(req, res, { refresh: false });
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch {
      /* no session — forward unauthenticated */
    }
  }

  const init = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body
      ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
      : undefined;
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.arrayBuffer();

    res.status(upstream.status);
    const upstreamType = upstream.headers.get('content-type');
    if (upstreamType) res.setHeader('Content-Type', upstreamType);

    const expose = upstream.headers.get('access-control-expose-headers');
    if (expose) res.setHeader('Access-Control-Expose-Headers', expose);

    res.send(Buffer.from(body));
  } catch (error) {
    console.error('[api/proxy] upstream failed:', target, error);
    res.status(502).json({
      detail: 'Backend request failed',
      target,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};
