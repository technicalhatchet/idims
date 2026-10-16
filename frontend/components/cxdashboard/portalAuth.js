export function portalSignOutUrl() {
  const returnTo = `${window.location.origin}/cxdashboard/login`;
  return `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
}

export function portalSignOut() {
  window.location.href = portalSignOutUrl();
}
