import { normalizeHostname } from './siteProfile';

/** LoGiT standalone PWA hostname (Solomon Vercel project alias). */
export const LOGIT_SUBDOMAIN_HOST = 'logit.solodiag.com';

/**
 * @param {string | null | undefined} rawHost
 */
export function isLogitSubdomainHost(rawHost) {
  return normalizeHostname(rawHost) === LOGIT_SUBDOMAIN_HOST;
}
