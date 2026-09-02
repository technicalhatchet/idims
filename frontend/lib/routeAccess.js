/**
 * Shared route classification for middleware and client-side guards.
 * Keep marketing + auth entry paths public so anonymous visitors are never sent to Auth0.
 */

export const TECH_ROUTE_PREFIXES = [
  '/techboard',
  '/techdashboard',
  '/work_orders',
  '/clients',
  '/appointments',
  '/payments',
  '/invoices',
  '/quotes',
  '/reports',
  '/settings',
  '/dashboard',
  '/schedule',
  '/route',
  '/technicians',
  '/debug-user',
];

export const PORTAL_ROUTE_PREFIXES = ['/cxdashboard'];

/** Paths that never require authentication */
export const PUBLIC_ROUTE_PREFIXES = [
  '/cxdashboard/login',
  '/cxdashboard/register',
  '/book',
  '/book-test',
  '/api/public',
  '/api/auth',
  '/api/portal',
  '/about',
  '/contact',
  '/pricing',
  '/services',
  '/service-area',
  '/auth-router',
  '/unauthorized',
  '/login',
];

export function isPublicPath(pathname) {
  if (!pathname) return false;
  if (pathname === '/') return true;
  return PUBLIC_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isPortalPath(pathname) {
  if (!pathname) return false;
  if (pathname.startsWith('/cxdashboard/login') || pathname.startsWith('/cxdashboard/register')) {
    return false;
  }
  return PORTAL_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isTechPath(pathname) {
  if (!pathname) return false;
  return TECH_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isProtectedPath(pathname) {
  return !isPublicPath(pathname) && (isTechPath(pathname) || isPortalPath(pathname));
}

/** Solomon-only deploy — env flag or feature/solomon-standalone Vercel branch. */
export const SOLOMON_STANDALONE_BRANCH = 'feature/solomon-standalone';

export const SOLOMON_STANDALONE_ALLOW_PREFIXES = [
  '/solomon',
  '/api/auth',
  '/api/proxy',
  '/api/public',
];

export const SOLOMON_STANDALONE_ALLOW_EXACT = [
  '/manifest.json',
  '/manifest-solomon.json',
  '/sw.js',
  '/robots.txt',
];

export function isSolomonStandaloneMode() {
  if (
    process.env.SOLOMON_STANDALONE === 'true'
    || process.env.NEXT_PUBLIC_SOLOMON_STANDALONE === 'true'
  ) {
    return true;
  }

  const branch = process.env.VERCEL_GIT_COMMIT_REF || '';
  return branch === SOLOMON_STANDALONE_BRANCH;
}

export function isSolomonStandaloneAllowedPath(pathname) {
  if (!pathname) return false;

  if (SOLOMON_STANDALONE_ALLOW_EXACT.includes(pathname)) {
    return true;
  }

  if (pathname.startsWith('/worker-')) {
    return true;
  }

  return SOLOMON_STANDALONE_ALLOW_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
