import '../styles/globals.css';
import '../styles/fullcalendar.css';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { ThemeProvider } from '../context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import OfflineBanner from '../components/ui/OfflineBanner';
import { prefetchAll, prefetchScheduleOnly } from '../lib/prefetch';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PrefetchManager() {
  const { isOnline, wasOffline } = useOnlineStatus();

  // Full prefetch on app open
  useEffect(() => {
    if (isOnline) {
      prefetchAll({
        onProgress: (msg) => console.log('[Prefetch]', msg),
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-prefetch when coming back online after being offline
  useEffect(() => {
    if (wasOffline) {
      console.log('[Prefetch] Back online — refreshing data...');
      prefetchAll({ force: true, onProgress: (msg) => console.log('[Prefetch]', msg) });
    }
  }, [wasOffline]);

  // Light schedule refresh every 5 minutes while online
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      prefetchScheduleOnly();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline]);

  return null;
}

function MyApp({ Component, pageProps }) {
  const { user } = pageProps;

  return (
    <UserProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <OfflineBanner />
          <PrefetchManager />
          {Component.getLayout ? (
            Component.getLayout(<Component {...pageProps} />)
          ) : (
            <Component {...pageProps} />
          )}
          <Toaster position="top-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ThemeProvider>
    </UserProvider>
  );
}

export default MyApp;
