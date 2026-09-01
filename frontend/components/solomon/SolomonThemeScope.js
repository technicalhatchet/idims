import { useRouter } from 'next/router';
import { SolomonThemeProvider } from '../../context/SolomonThemeContext';
import SolomonThemeColorSync from './SolomonThemeColorSync';

/**
 * Activates Solomon theme tokens only on /solomon routes.
 * Non-Solomon pages are unaffected (no data attribute, no provider side effects).
 */
export default function SolomonThemeScope({ children }) {
  const router = useRouter();
  const isSolomonRoute = router.pathname.startsWith('/solomon');

  if (!isSolomonRoute) {
    return children;
  }

  return (
    <SolomonThemeProvider>
      <SolomonThemeColorSync />
      {children}
    </SolomonThemeProvider>
  );
}
