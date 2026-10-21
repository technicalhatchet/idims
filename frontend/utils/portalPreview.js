/**
 * Admin portal preview: impersonation + optional write unlock token.
 */

const IMPERSONATE_ID_KEY = 'portal_impersonate_client_id';
const IMPERSONATE_NAME_KEY = 'portal_impersonate_client_name';
const UNLOCK_TOKEN_KEY = 'portal_preview_unlock_token';
const UNLOCK_CLIENT_KEY = 'portal_preview_unlock_client_id';
const UNLOCK_EXPIRES_KEY = 'portal_preview_unlock_expires_at';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

export const PREVIEW_LOCKED_MESSAGE = 'Preview is locked';
export const PREVIEW_LOCKED_TOAST = 'Preview is locked — unlock to make changes.';

export function getPortalImpersonateClientId() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(IMPERSONATE_ID_KEY);
}

export function getPortalImpersonateClientName() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(IMPERSONATE_NAME_KEY) || '';
}

export function isPortalPreviewActive() {
  return Boolean(getPortalImpersonateClientId());
}

/** @deprecated use isPortalPreviewActive */
export function isPortalAdminPreview() {
  return isPortalPreviewActive();
}

/** Call after admin selects or clears a client preview so layout headers refresh. */
export function notifyPortalImpersonateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('portal-impersonate-changed'));
  }
}

export function clearPortalPreviewUnlock() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(UNLOCK_TOKEN_KEY);
  sessionStorage.removeItem(UNLOCK_CLIENT_KEY);
  sessionStorage.removeItem(UNLOCK_EXPIRES_KEY);
}

export function clearPortalPreviewSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(IMPERSONATE_ID_KEY);
  sessionStorage.removeItem(IMPERSONATE_NAME_KEY);
  clearPortalPreviewUnlock();
  notifyPortalImpersonateChanged();
}

export function isPortalPreviewUnlocked() {
  if (typeof window === 'undefined') return false;
  const clientId = getPortalImpersonateClientId();
  const token = sessionStorage.getItem(UNLOCK_TOKEN_KEY);
  const tokenClient = sessionStorage.getItem(UNLOCK_CLIENT_KEY);
  const expiresAt = Number(sessionStorage.getItem(UNLOCK_EXPIRES_KEY) || 0);
  if (!clientId || !token || tokenClient !== clientId) return false;
  if (expiresAt && Date.now() > expiresAt) {
    clearPortalPreviewUnlock();
    return false;
  }
  return true;
}

export function getPortalPreviewUnlockHeaders() {
  if (!isPortalPreviewUnlocked()) return {};
  const token = sessionStorage.getItem(UNLOCK_TOKEN_KEY);
  if (!token) return {};
  return { 'X-Portal-Preview-Unlock': token };
}

export async function requestPortalPreviewUnlock(accessToken, adminClientId) {
  const params = new URLSearchParams({ admin_client_id: adminClientId });
  const res = await fetch(`${BACKEND}/api/portal/admin/preview-unlock?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Unlock failed (${res.status})`);
  }
  const expiresMs = (data.expires_in_seconds || 900) * 1000;
  sessionStorage.setItem(UNLOCK_TOKEN_KEY, data.unlock_token);
  sessionStorage.setItem(UNLOCK_CLIENT_KEY, data.client_id);
  sessionStorage.setItem(UNLOCK_EXPIRES_KEY, String(Date.now() + expiresMs));
  return data;
}

export function buildPortalApiUrl(endpoint, impersonateClientId = null) {
  const impersonateId = impersonateClientId || getPortalImpersonateClientId();
  const sep = endpoint.includes('?') ? '&' : '?';
  const query = impersonateId
    ? `${sep}admin_client_id=${encodeURIComponent(impersonateId)}`
    : '';
  const path = `api/portal/${endpoint}${query}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/proxy/${path}`;
  }
  return `${BACKEND}/${path}`;
}

/** Binary / CSV / print exports (GET, blob or HTML). */
export function buildPortalExportUrl(relativePath, extraQuery = {}) {
  const impersonateId = getPortalImpersonateClientId();
  const params = new URLSearchParams();
  Object.entries(extraQuery).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  if (impersonateId) params.set('admin_client_id', impersonateId);
  const qs = params.toString();
  const endpoint = `appliances/${relativePath}${qs ? `?${qs}` : ''}`;
  return buildPortalApiUrl(endpoint);
}
