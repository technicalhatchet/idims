/**
 * Routes that mount guided diagnostics / OEM UI (Solomon tokens + diagnostics Tailwind utilities).
 * Both route-only stylesheets load together — keep matchers in sync via this single policy.
 */
const ROUTE_STYLE_ROOTS = ['/solomon', '/techboard/work-orders', '/work_orders'];

/** @param {string} pathname */
function isExactRootOrDescendant(pathname, root) {
  if (pathname === root || pathname === `${root}/`) {
    return true;
  }
  return pathname.startsWith(`${root}/`);
}

/**
 * @param {string} pathname Next.js `router.pathname` (e.g. `/work_orders/[id]`) or URL path
 */
export function needsRouteScopedDiagnosticStyles(pathname) {
  if (!pathname) {
    return false;
  }
  return ROUTE_STYLE_ROOTS.some((root) => isExactRootOrDescendant(pathname, root));
}

/** @deprecated Use needsRouteScopedDiagnosticStyles — Solomon theme ships with diagnostics routes. */
export function needsSolomonThemeStyles(pathname) {
  return needsRouteScopedDiagnosticStyles(pathname);
}

/** @deprecated Use needsRouteScopedDiagnosticStyles */
export function needsDiagnosticsUtilityStyles(pathname) {
  return needsRouteScopedDiagnosticStyles(pathname);
}
