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
