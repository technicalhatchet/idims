import { UserProvider } from '@auth0/nextjs-auth0/client';
import { UserRoleProvider } from '../../context/UserRoleContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { UIPreferencesProvider } from '../../context/UIPreferencesContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const ReactQueryDevtools = dynamic(
  () =>
    import('@tanstack/react-query-devtools').then((mod) => mod.ReactQueryDevtools),
  { ssr: false },
);

/** Single app-wide client — must not be recreated per render or navigation. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function FullAppProviders({ children }) {
  return (
    <UserProvider>
      <UserRoleProvider>
        <ThemeProvider>
          <UIPreferencesProvider>
            <QueryClientProvider client={queryClient}>
              {children}
              {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} />
              )}
            </QueryClientProvider>
          </UIPreferencesProvider>
        </ThemeProvider>
      </UserRoleProvider>
    </UserProvider>
  );
}
