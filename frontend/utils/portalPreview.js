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
