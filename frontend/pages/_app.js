import '../styles/globals.css';
import '../styles/fullcalendar.css';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { UserRoleProvider } from '../context/UserRoleContext';
import { ThemeProvider } from '../context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SyncBanner from '../components/ui/SyncBanner';
import { prefetchAll, prefetchScheduleOnly } from '../lib/prefetch';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// One-time migration: drop the broken SW config that cached/intercepted Railway API.
// After reload, next-pwa registers the fixed SW (static assets + app shell only).
const SW_MIGRATION_KEY = 'idims_pwa_v2_migrated';

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
              .filter((name) => /fallback-cache|workbox-precache/i.test(name))
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

// Client-only — techboard offline prefetch only (not every page in the app)
function ClientOnlyPrefetch() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!router.pathname.startsWith('/techboard')) return;

    const startPrefetch = () => {
      if (navigator.onLine) {
        prefetchAll({ onProgress: (msg) => console.log('[Prefetch]', msg) });
      }
    };

    // Defer prefetch so page queries finish first; avoid flooding Railway on load
    const timeoutId = setTimeout(startPrefetch, 10000);

    const interval = setInterval(() => {
      if (navigator.onLine) prefetchScheduleOnly();
    }, 5 * 60 * 1000);

    function handleOnline() {
      console.log('[Prefetch] Back online — refreshing data...');
      prefetchAll({ force: true, onProgress: (msg) => console.log('[Prefetch]', msg) });
    }
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [mounted, router.pathname]);

  return null;
}

function MyApp({ Component, pageProps }) {
  const { user } = pageProps;

  return (
    <UserProvider>
      <UserRoleProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ServiceWorkerMigration />
          <SyncBanner />
          <ClientOnlyPrefetch />
          {Component.getLayout ? (
            Component.getLayout(<Component {...pageProps} />)
          ) : (
            <Component {...pageProps} />
          )}
          <Toaster position="top-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
      </UserRoleProvider>
    </UserProvider>
  );
}

export default MyApp;
