export function portalSignOutUrl({ federated = false } = {}) {
  const returnTo = `${window.location.origin}/cxdashboard/login`;
  const params = new URLSearchParams({ returnTo });
  if (federated) {
    params.set('federated', '1');
  }
  return `/api/auth/logout?${params.toString()}`;
}

export function portalSignOut() {
  window.location.href = portalSignOutUrl();
}
