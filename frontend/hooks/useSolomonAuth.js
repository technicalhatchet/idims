/**
 * Solomon auth — keep session usable offline after user has signed in once.
 */

import { useEffect, useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

const SOLOMON_SESSION_KEY = 'solomon_authenticated';

export function useSolomonAuth() {
  const { user, isLoading, error } = useUser();
  const [offlineSession, setOfflineSession] = useState(false);

  useEffect(() => {
    if (user) {
      try {
        sessionStorage.setItem(SOLOMON_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }, [user]);

  useEffect(() => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOfflineSession(sessionStorage.getItem(SOLOMON_SESSION_KEY) === '1');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const isAuthenticated = Boolean(user) || offlineSession;
  const authLoading = isLoading && !offlineSession;

  return {
    user,
    error,
    isLoading: authLoading,
    isAuthenticated,
    offlineSession,
  };
}
