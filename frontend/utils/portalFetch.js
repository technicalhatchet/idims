const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

export async function portalFetch(endpoint, token, options = {}) {
  const impersonateId = typeof window !== 'undefined'
    ? sessionStorage.getItem('portal_impersonate_client_id')
    : null;
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = impersonateId
    ? `${BACKEND}/api/portal/${endpoint}${sep}admin_client_id=${impersonateId}`
    : `${BACKEND}/api/portal/${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Portal API error: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getPortalSessionToken() {
  const sessionRes = await fetch('/api/auth/session');
  const session = await sessionRes.json();
  return session.accessToken;
}
