import toast from 'react-hot-toast';
import {
  PREVIEW_LOCKED_MESSAGE,
  PREVIEW_LOCKED_TOAST,
  buildPortalApiUrl,
  getPortalPreviewUnlockHeaders,
} from './portalPreview';

const PREVIEW_PAYMENT_FORBIDDEN = 'Payments are not available in admin preview';

export async function portalFetch(endpoint, token, options = {}, impersonateClientId = null) {
  const url = buildPortalApiUrl(endpoint, impersonateClientId);
  const isWrite = options.method && options.method !== 'GET' && options.method !== 'HEAD';

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(isWrite ? getPortalPreviewUnlockHeaders() : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail || `Portal API error: ${res.status}`;
    if (res.status === 403 && detail === PREVIEW_LOCKED_MESSAGE) {
      toast.error(PREVIEW_LOCKED_TOAST);
    }
    if (res.status === 403 && detail === PREVIEW_PAYMENT_FORBIDDEN) {
      toast.error(detail);
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getPortalSessionToken() {
  const sessionRes = await fetch('/api/auth/session');
  const session = await sessionRes.json();
  return session.accessToken;
}
