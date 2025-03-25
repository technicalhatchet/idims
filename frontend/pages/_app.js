import '../styles/globals.css';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { ThemeProvider } from '../context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function MyApp({ Component, pageProps }) {
  const { user } = pageProps;
  
  return (
    <UserProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          {/* Layout is provided by Component.getLayout if defined or falls back to default */}
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