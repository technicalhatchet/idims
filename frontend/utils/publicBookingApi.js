/**
 * Backend base for public booking routes (server-side Next API handlers).
 * Accepts NEXT_PUBLIC_API_URL with or without trailing /api (see AUTH0_SETUP.md).
 */
export function publicBookingApiUrl(path) {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_BACKEND_API_URL
    || 'http://localhost:8000/api'
  ).replace(/\/$/, '');
  const base = /\/api$/i.test(raw) ? raw : `${raw}/api`;
  const segment = String(path || '').replace(/^\//, '');
  return `${base}/${segment}`;
}
