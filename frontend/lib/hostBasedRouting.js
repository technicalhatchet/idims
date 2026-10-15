import { getSiteProfile, normalizeHostname, SITE_PROFILE, CANONICAL_ATOMIC_HOSTS } from './siteProfile';
import { isTechPath } from './routeAccess';

/**
 * HOST_BASED_ROUTING must be the literal string "true" to enable.
 * Unset, empty, and "false" all keep legacy behavior.
 */
export function isHostBasedRoutingEnabled() {
  return process.env.HOST_BASED_ROUTING === 'true';
}

/**
 * Resolve hostname from Next.js middleware request headers (first forwarded host).
 * @param {import('next/server').NextRequest} req
 */
export function getRequestHostname(req) {
  const forwarded = req.headers.get('x-forwarded-host');
  const host = forwarded || req.headers.get('host') || '';
  const fromHeader = normalizeHostname(host);
  if (fromHeader) {
    return fromHeader;
  }
  return normalizeHostname(req.nextUrl?.hostname || '');
}

/** Paths that must not be cross-host redirected (auth, proxy, PWA, public APIs). */
export const HOST_ROUTING_EXEMPT_EXACT = [
  '/manifest.json',
  '/manifest-solomon.json',
  '/manifest-logit.json',
  '/manifest-book.json',
  '/sw.js',
  '/robots.txt',
];

export const HOST_ROUTING_EXEMPT_PREFIXES = [
  '/api/auth',
  '/api/public',
  '/api/portal',
  '/api/proxy',
];

export function isHostRoutingExemptPath(pathname) {
  if (!pathname) return false;
  if (HOST_ROUTING_EXEMPT_EXACT.includes(pathname)) {
    return true;
  }
  if (pathname.startsWith('/worker-')) {
    return true;
  }
  return HOST_ROUTING_EXEMPT_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Customer portal app routes (includes login/register).
 * @param {string} pathname
 */
export function isCustomerPortalFamilyPath(pathname) {
  if (!pathname) return false;
  return pathname === '/cxdashboard' || pathname.startsWith('/cxdashboard/');
}

/**
 * Technician / admin app routes for host routing.
 * Uses routeAccess tech prefixes; /solomon is technician tooling on Atomic (not isTechPath in middleware auth).
 * @param {string} pathname
 */
export function isTechnicianFamilyPath(pathname) {
  if (!pathname) return false;
  if (isTechPath(pathname)) return true;
  return pathname === '/solomon' || pathname.startsWith('/solomon/');
}

/**
 * @param {string} canonicalHost
 * @param {string} pathname
 * @param {string} search
 */
function buildCanonicalRedirectUrl(canonicalHost, pathname, search) {
  return new URL(`${pathname}${search}`, `https://${canonicalHost}`);
}

/**
 * Cross-host redirect for mismatched site profile vs route family.
 * @param {import('next/server').NextRequest} req
 * @returns {URL | null}
 */
export function getHostBasedCrossHostRedirectUrl(req) {
  if (!isHostBasedRoutingEnabled()) {
    return null;
  }

  const { pathname, search } = req.nextUrl;
  if (pathname === '/') {
    return null;
  }
  if (isHostRoutingExemptPath(pathname)) {
    return null;
  }

  const profile = getSiteProfile(getRequestHostname(req));
  if (profile === SITE_PROFILE.DEFAULT) {
    return null;
  }

  const { PORTAL, IDIMS } = CANONICAL_ATOMIC_HOSTS;

  if (profile === SITE_PROFILE.MARKETING) {
    if (isCustomerPortalFamilyPath(pathname)) {
      return buildCanonicalRedirectUrl(PORTAL, pathname, search);
    }
    if (isTechnicianFamilyPath(pathname)) {
      return buildCanonicalRedirectUrl(IDIMS, pathname, search);
    }
    return null;
  }

  if (profile === SITE_PROFILE.PORTAL) {
    if (isTechnicianFamilyPath(pathname)) {
      return buildCanonicalRedirectUrl(IDIMS, pathname, search);
    }
    return null;
  }

  if (profile === SITE_PROFILE.IDIMS) {
    if (isCustomerPortalFamilyPath(pathname)) {
      return buildCanonicalRedirectUrl(PORTAL, pathname, search);
    }
    return null;
  }

  return null;
}

/**
 * Root-path redirect for portal/idims hosts when host routing is enabled.
 * @param {import('next/server').NextRequest} req
 * @returns {URL | null} same-origin redirect target, or null to continue middleware chain
 */
export function getHostBasedRootRedirectUrl(req) {
  if (!isHostBasedRoutingEnabled()) {
    return null;
  }

  const { pathname, search } = req.nextUrl;
  if (pathname !== '/') {
    return null;
  }

  const hostname = getRequestHostname(req);
  const profile = getSiteProfile(hostname);

  if (profile === SITE_PROFILE.PORTAL) {
    return new URL(`/cxdashboard${search}`, req.url);
  }

  if (profile === SITE_PROFILE.IDIMS) {
    return new URL(`/techboard${search}`, req.url);
  }

  return null;
}

/**
 * Phase 1 root redirects + Phase 2 cross-host enforcement.
 * @param {import('next/server').NextRequest} req
 * @returns {URL | null}
 */
export function getHostBasedSiteRedirectUrl(req) {
  return getHostBasedRootRedirectUrl(req) || getHostBasedCrossHostRedirectUrl(req);
}
