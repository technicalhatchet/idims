import '../styles/globals.css';
import { inter } from '../lib/siteFonts';
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isPublicPath, isTechPath } from '../lib/routeAccess';
import { isTechDeckPrefetchRoute, isSolomonPrefetchRoute } from '../lib/offlineCache';
import {
  deleteWorkboxRelatedCaches,
  unregisterAllServiceWorkers,
} from '../lib/pwaWorkboxCaches';
import SolomonDiyEnrollment from '../components/solomon/SolomonDiyEnrollment';
import SolomonThemeScope from '../components/solomon/SolomonThemeScope';
import AppRouteStyles from '../components/AppRouteStyles';
import FullAppProviders from '../components/app/FullAppProviders';

const SyncBanner = dynamic(() => import('../components/ui/SyncBanner'), {
  ssr: false,
});

/**
 * Preview: code-split Auth0 / React Query / global contexts off the homepage `_app` chunk.
 * Build-time flag — set NEXT_PUBLIC_HOMEPAGE_SPLIT_PROVIDERS=1 on Preview only.
 */
const HOMEPAGE_SPLIT_PROVIDERS_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SPLIT_PROVIDERS === '1';

/**
 * Preview: skip mounting providers on `/` only (imports still bundled when split flag is off).
 * Orthogonal to SPLIT_PROVIDERS — lite mount-skip without bundle split.
 */
const HOMEPAGE_LITE_SHELL_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_LITE_SHELL === '1';

/**
 * Preview: strip existing SW control on `/` only (pairs with NEXT_PUBLIC_PWA_OFF on build).
 * Build-time flag — set NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW=1 on Preview only.
 */
const HOMEPAGE_UNREGISTER_SW_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_UNREGISTER_SW === '1';

/**
 * Preview: minimal `/` for iOS Safari paint isolation (pairs with HomepageSafariPaintTest).
 * Build-time flag — set NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST=1 on Preview only.
 */
const HOMEPAGE_SAFARI_PAINT_TEST_ENABLED =
  process.env.NEXT_PUBLIC_HOMEPAGE_SAFARI_PAINT_TEST === '1';

const HOMEPAGE_SW_UNREGISTER_SESSION_KEY = 'idims_homepage_sw_unregister_done';

const FullAppProvidersDynamic = HOMEPAGE_SPLIT_PROVIDERS_ENABLED
  ? dynamic(() => import('../components/app/FullAppProviders'), {
      ssr: true,
      loading: () => <ProviderChunkLoading />,
    })
  : null;

function ProviderChunkLoading() {
  return (
    <div
      className={`${inter.variable} font-sans flex min-h-screen items-center justify-center bg-[#000208]`}
      aria-busy="true"
      aria-label="Loading application"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
    </div>
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
// After reload, next-pwa registers the fixed SW (static assets + app shell only).
const SW_MIGRATION_KEY = 'idims_pwa_v3_migrated';
const DEV_SW_CLEANED_KEY = 'idims_dev_sw_cleaned';

/** Production SW + CacheFirst on /_next/static breaks local HMR (hot-update 404 reload loop). */
function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

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

    async function migrate() {
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter((name) =>
                /fallback-cache|workbox|precache|pages-cache|solomon-/i.test(name)
              )
              .map((name) => caches.delete(name))
          );
        }

        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((reg) => reg.unregister()));
        }

        localStorage.setItem(SW_MIGRATION_KEY, '1');
        window.location.reload();
      } catch (err) {
        console.warn('[PWA] Migration failed:', err);
        localStorage.setItem(SW_MIGRATION_KEY, '1');
      }
    }

    migrate();
  }, []);

  return null;
}

/** Skip one-time PWA migration reload on public marketing/booking/auth entry routes. */
function MaybeServiceWorkerMigration() {
  const router = useRouter();

  if (isPublicPath(router.pathname)) {
    return null;
  }

  return <ServiceWorkerMigration />;
}

/**
 * Preview experiment: unregister SW + drop Workbox caches on homepage entry.
 * No reload — runs in useEffect after mount. First navigation may still be controlled
 * by a previously installed worker; compare second navigation after unregister completes
 * and navigator.serviceWorker.controller is null (see HomepageSafariPaintTest.js).
 */
function MaybeHomepageServiceWorkerUnregister() {
  const router = useRouter();

  useEffect(() => {
    if (!HOMEPAGE_UNREGISTER_SW_ENABLED) return;
    if (router.pathname !== '/') return;
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(HOMEPAGE_SW_UNREGISTER_SESSION_KEY)) return;

    let cancelled = false;

    async function cleanup() {
      try {
        await deleteWorkboxRelatedCaches();
        await unregisterAllServiceWorkers();
        if (!cancelled) {
          sessionStorage.setItem(HOMEPAGE_SW_UNREGISTER_SESSION_KEY, '1');
        }
      } catch (err) {
        console.warn('[PWA] Homepage SW unregister experiment failed:', err);
      }
    }

    cleanup();

    return () => {
      cancelled = true;
    };
  }, [router.pathname]);

  return null;
}

// Client-only — TechDeck offline prefetch (techboard + field WO routes)
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

    // Defer prefetch so page queries finish first; avoid flooding Railway on load
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

// Warm Solomon routes + _next/data while online so offline navigation works in the PWA
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
      if (!navigator.onLine) return;
      import('../lib/solomonPrefetch').then(({ prefetchSolomonShell }) => {
        prefetchSolomonShell();
      });
    };

    run();
    const t = setTimeout(run, 3000);
    return () => clearTimeout(t);
  }, [mounted, router.pathname]);

  return null;
}

function isSafariPaintTestHome(pathname) {
  return HOMEPAGE_SAFARI_PAINT_TEST_ENABLED && pathname === '/';
}

function AppChrome({ Component, pageProps }) {
  const router = useRouter();

  if (isSafariPaintTestHome(router.pathname)) {
    return (
      <>
        <MaybeHomepageServiceWorkerUnregister />
        <Component {...pageProps} />
      </>
    );
  }

  const page = Component.getLayout
    ? Component.getLayout(<Component {...pageProps} />)
    : <Component {...pageProps} />;

  return (
    <>
      <AppRouteStyles />
      <DevServiceWorkerCleanup />
      <MaybeHomepageServiceWorkerUnregister />
      <MaybeServiceWorkerMigration />
      <TechDeckSyncBanner />
      <ClientOnlyPrefetch />
      <ClientOnlySolomonPrefetch />
      <SolomonDiyEnrollment />
      <SolomonThemeScope>{page}</SolomonThemeScope>
      <Toaster position="top-right" />
    </>
  );
}

function AppFontShell({ children }) {
  return <div className={`${inter.variable} font-sans`}>{children}</div>;
}

/**
 * Whether the current route must render inside FullAppProviders before page content.
 * Homepage omits providers when split or lite flags apply (marketing has no context hooks).
 */
function routeNeedsFullProviders(pathname) {
  if (pathname !== '/') return true;
  if (HOMEPAGE_SPLIT_PROVIDERS_ENABLED) return false;
  if (HOMEPAGE_LITE_SHELL_ENABLED) return false;
  if (HOMEPAGE_SAFARI_PAINT_TEST_ENABLED) return false;
  return true;
}

function wrapWithProviders(children) {
  if (HOMEPAGE_SPLIT_PROVIDERS_ENABLED) {
    const Lazy = FullAppProvidersDynamic;
    return <Lazy>{children}</Lazy>;
  }
  return <FullAppProviders>{children}</FullAppProviders>;
}

/** Warm provider chunk when leaving `/` so client navigation feels snappier (not a substitute for loading gate). */
function usePrefetchFullAppProvidersOnLeaveHome() {
  const router = useRouter();

  useEffect(() => {
    if (!HOMEPAGE_SPLIT_PROVIDERS_ENABLED) return;

    function onRouteChangeStart(url) {
      const path = typeof url === 'string' ? url.split('?')[0] : '/';
      if (path === '/') return;
      import('../components/app/FullAppProviders');
    }

    router.events.on('routeChangeStart', onRouteChangeStart);
    return () => router.events.off('routeChangeStart', onRouteChangeStart);
  }, [router]);
}

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const needsProviders = routeNeedsFullProviders(router.pathname);
  const minimalSafariPaintHome = isSafariPaintTestHome(router.pathname);

  usePrefetchFullAppProvidersOnLeaveHome();

  const chrome = <AppChrome Component={Component} pageProps={pageProps} />;

  if (minimalSafariPaintHome) {
    return chrome;
  }

  if (!needsProviders) {
    return <AppFontShell>{chrome}</AppFontShell>;
  }

  return <AppFontShell>{wrapWithProviders(chrome)}</AppFontShell>;
}

export default MyApp;
