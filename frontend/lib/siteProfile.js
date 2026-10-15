/**
 * Pure hostname → Atomic site profile (marketing / portal / idims / default).
 * Solomon standalone uses separate deployment gating; solodiag hosts map to default here.
 */

import { ATOMIC_AUTH_HOST } from './atomicApprovedHosts';

export const SITE_PROFILE = {
  MARKETING: 'marketing',
  PORTAL: 'portal',
  IDIMS: 'idims',
  DEFAULT: 'default',
};

const MARKETING_HOSTS = new Set([
  ATOMIC_AUTH_HOST.MARKETING_APEX,
  ATOMIC_AUTH_HOST.MARKETING_WWW,
]);

const PORTAL_HOSTS = new Set([ATOMIC_AUTH_HOST.PORTAL]);

const IDIMS_HOSTS = new Set([ATOMIC_AUTH_HOST.IDIMS]);

/** Fixed redirect targets — never derived from request Host. */
export const CANONICAL_ATOMIC_HOSTS = {
  PORTAL: ATOMIC_AUTH_HOST.PORTAL,
  IDIMS: ATOMIC_AUTH_HOST.IDIMS,
  MARKETING_APEX: ATOMIC_AUTH_HOST.MARKETING_APEX,
};

/**
 * @param {string | null | undefined} rawHost
 * @returns {string} hostname without port, lowercased, or empty string
 */
export function normalizeHostname(rawHost) {
  if (rawHost == null) return '';
  const trimmed = String(rawHost).trim();
  if (!trimmed) return '';

  const first = trimmed.split(',')[0].trim();
  const withoutPort = first.includes(':') ? first.slice(0, first.indexOf(':')) : first;
  return withoutPort.toLowerCase();
}

/**
 * @param {string | null | undefined} rawHost
 * @returns {'marketing' | 'portal' | 'idims' | 'default'}
 */
export function getSiteProfile(rawHost) {
  const hostname = normalizeHostname(rawHost);
  if (!hostname) return SITE_PROFILE.DEFAULT;
  if (MARKETING_HOSTS.has(hostname)) return SITE_PROFILE.MARKETING;
  if (PORTAL_HOSTS.has(hostname)) return SITE_PROFILE.PORTAL;
  if (IDIMS_HOSTS.has(hostname)) return SITE_PROFILE.IDIMS;
  return SITE_PROFILE.DEFAULT;
}
