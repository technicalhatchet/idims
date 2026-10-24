import '../styles/globals.css';
import '../styles/atomic-icons.css';
import { inter } from '../lib/siteFonts';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { UserRoleProvider } from '../context/UserRoleContext';
import { ThemeProvider } from '../context/ThemeContext';
import { UIPreferencesProvider } from '../context/UIPreferencesContext';
import { FeatureFlagsProvider } from '../context/FeatureFlagsContext';
import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { getAppQueryClient } from '../lib/queryClient';

const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
);
import AppToaster from '../components/ui/AppToaster';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isTechPath } from '../lib/routeAccess';
import { isTechDeckPrefetchRoute, isSolomonPrefetchRoute } from '../lib/offlineCache';
import { prefetchSolomonShell } from '../lib/solomonPrefetch';
import AppRouteStyles from '../components/AppRouteStyles';

const SyncBanner = dynamic(() => import('../components/ui/SyncBanner'), {
  ssr: false,
});

const SolomonDiyEnrollment = dynamic(
  () => import('../components/solomon/SolomonDiyEnrollment'),
  { ssr: false }
);

const SolomonThemeScope = dynamic(
  () => import('../components/solomon/SolomonThemeScope'),
  { ssr: false }
);

function RouteScopedSolomonShell({ children }) {
  const router = useRouter();
  const onSolomon = router.pathname.startsWith('/solomon');
  if (!onSolomon) {
    return children;
  }
  return (
    <>
      <SolomonDiyEnrollment />
      <SolomonThemeScope>{children}</SolomonThemeScope>
    </>
  );
}

function TechDeckSyncBanner() {
  const router = useRouter();

  if (!isTechPath(router.pathname)) {
    return null;
  }

  return <SyncBanner />;
}

// One-time migration: drop SW configs that cached/intercepted Railway API.
const SW_MIGRATION_KEY = 'idims_pwa_v3_migrated';
const SW_MIGRATION_LOCK_KEY = 'idims_pwa_v3_migrating';
const DEV_SW_CLEANED_KEY = 'idims_dev_sw_cleaned';
const DEV_SW_CLEANUP_LOCK_KEY = 'idims_dev_sw_cleaning';

function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    if (sessionStorage.getItem(DEV_SW_CLEANED_KEY) || sessionStorage.getItem(DEV_SW_CLEANUP_LOCK_KEY)) {
      return;
    }
    sessionStorage.setItem(DEV_SW_CLEANUP_LOCK_KEY, '1');

    async function cleanup() {
      let hadStaleCaching = false;
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          hadStaleCaching = registrations.length > 0;
          await Promise.all(registrations.map((reg) => reg.unregister()));
        }

        if ('caches' in window) {
          const names = await caches.keys();
          hadStaleCaching = hadStaleCaching || names.length > 0;
          await Promise.all(names.map((name) => caches.delete(name)));
        }
      } catch (err) {
        console.warn('[Dev] Service worker cleanup failed:', err);
      } finally {
        sessionStorage.removeItem(DEV_SW_CLEANUP_LOCK_KEY);
      }

      if (hadStaleCaching && !sessionStorage.getItem(DEV_SW_CLEANED_KEY)) {
        sessionStorage.setItem(DEV_SW_CLEANED_KEY, '1');
        window.location.reload();
      }
    }

    cleanup();
  }, []);

  return null;
}

function ServiceWorkerMigration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(SW_MIGRATION_KEY)) return;
    if (sessionStorage.getItem(SW_MIGRATION_LOCK_KEY)) return;
    sessionStorage.setItem(SW_MIGRATION_LOCK_KEY, '1');

    async function migrate() {
      let didChange = false;
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          const stale = names.filter((name) =>
            /fallback-cache|workbox|precache|pages-cache|solomon-/i.test(name)
          );
          if (stale.length > 0) {
            didChange = true;
            await Promise.all(stale.map((name) => caches.delete(name)));
          }
        }

        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            didChange = true;
            await Promise.all(registrations.map((reg) => reg.unregister()));
          }
        }

        localStorage.setItem(SW_MIGRATION_KEY, '1');
        if (didChange) {
          window.location.reload();
        }
      } catch (err) {
        console.warn('[PWA] Migration failed:', err);
        localStorage.setItem(SW_MIGRATION_KEY, '1');
      } finally {
        sessionStorage.removeItem(SW_MIGRATION_LOCK_KEY);
      }
    }

    migrate();
  }, []);

  return null;
}

function ClientOnlyPrefetch() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isTechDeckPrefetchRoute(router.pathname)) return;

    let disposed = false;
    const loadPrefetch = () => import('../lib/prefetch');

    const startPrefetch = () => {
      if (!navigator.onLine) return;
      loadPrefetch().then(({ prefetchAll }) => {
        if (disposed) return;
        prefetchAll({ onProgress: (msg) => console.log('[Prefetch]', msg) });
      });
    };

    const timeoutId = setTimeout(startPrefetch, 10000);

    const interval = setInterval(() => {
      if (!navigator.onLine) return;
      loadPrefetch().then(({ prefetchScheduleOnly }) => {
        if (disposed) return;
        prefetchScheduleOnly();
      });
    }, 5 * 60 * 1000);

    function handleOnline() {
      console.log('[Prefetch] Back online — refreshing data...');
      loadPrefetch().then(({ prefetchAll }) => {
        if (disposed) return;
        prefetchAll({ force: true, onProgress: (msg) => console.log('[Prefetch]', msg) });
      });
    }
    window.addEventListener('online', handleOnline);

    return () => {
      disposed = true;
      clearTimeout(timeoutId);
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [mounted, router.pathname]);

  return null;
}

function ClientOnlySolomonPrefetch() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isSolomonPrefetchRoute(router.pathname)) return;

    const run = () => {
      if (navigator.onLine) prefetchSolomonShell();
    };

    run();
    const t = setTimeout(run, 3000);
    return () => clearTimeout(t);
  }, [mounted, router.pathname]);

  return null;
}

function MyApp({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-inter: ${inter.style.fontFamily};
        }
        html,
        body {
          font-family: ${inter.style.fontFamily};
        }
      `}</style>
      <div className={`${inter.variable} font-sans`}>
        <UserProvider>
          <UserRoleProvider>
            <QueryClientProvider client={getAppQueryClient()}>
              <FeatureFlagsProvider>
                <ThemeProvider>
                  <UIPreferencesProvider>
                    <AppRouteStyles />
                    <DevServiceWorkerCleanup />
                    <ServiceWorkerMigration />
                    <TechDeckSyncBanner />
                    <ClientOnlyPrefetch />
                    <ClientOnlySolomonPrefetch />
                    <RouteScopedSolomonShell>
                      {Component.getLayout ? (
                        Component.getLayout(<Component {...pageProps} />)
                      ) : (
                        <Component {...pageProps} />
                      )}
                    </RouteScopedSolomonShell>
                    <AppToaster />
                    {process.env.NODE_ENV === 'development' && (
                      <ReactQueryDevtools initialIsOpen={false} />
                    )}
                  </UIPreferencesProvider>
                </ThemeProvider>
              </FeatureFlagsProvider>
            </QueryClientProvider>
          </UserRoleProvider>
        </UserProvider>
      </div>
    </>
  );
}

export default MyApp;
