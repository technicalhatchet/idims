import Head from 'next/head';
import { useRouter } from 'next/router';
import { needsRouteScopedDiagnosticStyles } from '../lib/routeStyles';
import { ROUTE_STYLESHEETS } from '../lib/routeStylesAssets';

/**
 * Route-scoped stylesheets that must not block the public marketing homepage.
 * Solomon tokens + diagnostics Tailwind utilities are omitted from globals.css.
 */
export default function AppRouteStyles() {
  const router = useRouter();
  const pathname = router.pathname;

  if (!needsRouteScopedDiagnosticStyles(pathname)) {
    return null;
  }

  return (
    <Head>
      <link rel="stylesheet" href={ROUTE_STYLESHEETS.solomonTheme} />
      <link rel="stylesheet" href={ROUTE_STYLESHEETS.diagnosticsUtilities} />
    </Head>
  );
}
