/**
 * Client portal link-account helpers + diagnostics.
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

export function getSessionRoles(session) {
  const user = session?.user;
  if (!user) return [];
  return (
    user['https://idimsapi/app_metadata']?.roles
    || user.app_metadata?.roles
    || user['https://idimsapi/roles']
    || user.roles
    || []
  );
}

export function getSessionEmail(session) {
  const user = session?.user;
  if (!user) return null;
  return (
    user.email
    || user['https://idimsapi/email']
    || user['https://idimsapi/app_metadata']?.email
    || null
  );
}

export async function fetchPortalLinkDebug(accessToken) {
  const res = await fetch(`${BACKEND}/api/portal/link-debug`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `link-debug failed (${res.status})`);
  }
  return data;
}

export async function postPortalLinkAccount(accessToken, { inviteToken, claimToken } = {}) {
  const token = claimToken || inviteToken;
  const body = {};
  if (token) {
    if (token.split('.').length === 3) {
      body.invite_token = token;
    } else {
      body.claim_token = token;
    }
  }
  const res = await fetch(`${BACKEND}/api/portal/link-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function logPortalLinkDiagnostics(label, payload) {
  console.group(`[Portal] ${label}`);
  console.log(payload);
  console.groupEnd();
}

/** Auth0 session exists but no clients row is linked to this login. */
export function isPortalAwaitingFirstService(linkDebug) {
  if (!linkDebug) return false;
  return !linkDebug.client_linked_by_auth0_id && !linkDebug.client_linked_by_email;
}

export function isPortalNoClientApiError(message) {
  if (!message || typeof message !== 'string') return false;
  const m = message.toLowerCase();
  return (
    m.includes('no client record found')
    || m.includes('client portal access required')
  );
}

const TOKEN_REFRESH_KEY = 'portal_token_refresh_attempted';

/** One-time re-login after role is newly assigned so JWT picks up client role. */
export function shouldRefreshPortalToken(linkResult, hasClientRoleInToken) {
  if (hasClientRoleInToken) return false;
  if (!linkResult?.ok || !linkResult.data?.role_assigned) return false;
  return Boolean(
    linkResult.data.role_newly_assigned
    || (!linkResult.data.already_linked && linkResult.data.link_method),
  );
}

export function markPortalTokenRefreshAttempted() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(TOKEN_REFRESH_KEY, String(Date.now()));
  }
}

export function hasPortalTokenRefreshBeenAttempted() {
  if (typeof window === 'undefined') return false;
  return Boolean(sessionStorage.getItem(TOKEN_REFRESH_KEY));
}

export function clearPortalTokenRefreshAttempt() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_REFRESH_KEY);
  }
}

export function redirectToRefreshPortalToken() {
  markPortalTokenRefreshAttempted();
  window.location.href = '/api/auth/login?returnTo=/cxdashboard';
}
