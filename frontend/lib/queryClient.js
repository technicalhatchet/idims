import { QueryClient } from '@tanstack/react-query';

let appQueryClient;

export function getAppQueryClient() {
  if (!appQueryClient) {
    appQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
  }
  return appQueryClient;
}
