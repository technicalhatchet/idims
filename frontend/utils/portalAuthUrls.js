/**
 * Auth0 entry URLs for the customer portal (/cxdashboard).
 */

const PORTAL_HOME = '/cxdashboard';

export function portalSignInUrl(returnTo = PORTAL_HOME) {
  const params = new URLSearchParams({ returnTo });
  return `/api/auth/login?${params.toString()}`;
}

export function portalSignUpUrl({ returnTo = PORTAL_HOME, email } = {}) {
  const params = new URLSearchParams({
    returnTo,
    screen_hint: 'signup',
  });
  if (email && String(email).trim()) {
    params.set('login_hint', String(email).trim());
  }
  return `/api/auth/login?${params.toString()}`;
}
