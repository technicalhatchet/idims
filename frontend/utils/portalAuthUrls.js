/**
 * Auth0 entry URLs for the customer portal (/cxdashboard).
 */

const PORTAL_HOME = '/cxdashboard';

/**
 * @param {string} [returnTo]
 * @param {{ selectAccount?: boolean }} [options] — default true for portal (Google account chooser)
 */
export function portalSignInUrl(returnTo = PORTAL_HOME, { selectAccount = true } = {}) {
  const params = new URLSearchParams({ returnTo });
  if (selectAccount) {
    params.set('prompt', 'select_account');
  }
  return `/api/auth/login?${params.toString()}`;
}

/** Force Google (or other) connection + account picker — use after wrong-account login loops. */
export function portalSignInDifferentAccountUrl(returnTo = PORTAL_HOME) {
  const params = new URLSearchParams({
    returnTo,
    prompt: 'select_account',
    connection: 'google-oauth2',
  });
  return `/api/auth/login?${params.toString()}`;
}

export function portalSignUpUrl({ returnTo = PORTAL_HOME, email, selectAccount = true } = {}) {
  const params = new URLSearchParams({
    returnTo,
    screen_hint: 'signup',
  });
  if (selectAccount) {
    params.set('prompt', 'select_account');
  }
  if (email && String(email).trim()) {
    params.set('login_hint', String(email).trim());
  }
  return `/api/auth/login?${params.toString()}`;
}
