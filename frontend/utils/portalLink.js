/**
 * Client portal link-account helpers + diagnostics.
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

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

export async function postPortalLinkAccount(accessToken, { inviteToken, email } = {}) {
  const res = await fetch(`${BACKEND}/api/portal/link-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(inviteToken ? { invite_token: inviteToken } : {}),
      ...(email ? { email } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function logPortalLinkDiagnostics(label, payload) {
  console.group(`[Portal] ${label}`);
  console.log(payload);
  console.groupEnd();
}
