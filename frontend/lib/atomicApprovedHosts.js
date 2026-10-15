/**
 * Fixed Atomic Repair hostnames approved for Auth0 baseURL resolution.
 * Do not derive redirect targets from unlisted request hosts.
 */

export const ATOMIC_AUTH_HOST = {
  MARKETING_APEX: 'atomicrepair419.com',
  MARKETING_WWW: 'www.atomicrepair419.com',
  PORTAL: 'portal.atomicrepair419.com',
  IDIMS: 'idims.atomicrepair419.com',
};

/** @type {ReadonlySet<string>} */
export const ATOMIC_AUTH_HOST_SET = new Set(Object.values(ATOMIC_AUTH_HOST));

export function isAtomicAuthHost(hostname) {
  const h = String(hostname || '').toLowerCase().split(':')[0];
  return ATOMIC_AUTH_HOST_SET.has(h);
}
