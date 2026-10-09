/**
 * Edge middleware: detect Auth0 session cookies (including chunked appSession.N).
 */
export function hasAppSessionCookie(req) {
  const cookies = req.cookies;
  if (cookies.get('appSession') || cookies.get('appSession.0')) {
    return true;
  }
  if (typeof cookies.getAll === 'function') {
    return cookies.getAll().some(
      (c) => c.name === 'appSession' || c.name.startsWith('appSession.'),
    );
  }
  return false;
}
