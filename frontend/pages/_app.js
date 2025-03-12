// frontend/pages/_app.js
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from '../context/ThemeContext';
import { NotificationProvider } from '../context/NotificationContext';
import { SidebarProvider } from '../context/SidebarContext';
import ErrorBoundary from '../context/ErrorBoundary';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});

export default function App({ Component, pageProps }) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout || ((page) => page);

  return (
    <ErrorBoundary>
      <UserProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SidebarProvider>
              <NotificationProvider>
                {getLayout(<Component {...pageProps} />)}
              </NotificationProvider>
            </SidebarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}