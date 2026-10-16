export function getPortalImpersonateClientId() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('portal_impersonate_client_id');
}

export function getPortalImpersonateClientName() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('portal_impersonate_client_name');
}

export function isPortalAdminPreview() {
  return Boolean(getPortalImpersonateClientId());
}

/** Call after admin selects or clears a client preview so layout headers refresh. */
export function notifyPortalImpersonateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('portal-impersonate-changed'));
  }
}
