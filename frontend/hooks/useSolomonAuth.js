/**
 * Solomon auth — stay signed in offline after a successful login on this device.
 * Auth0 /api/auth/me fails offline; sessionStorage flag keeps Solomon usable.
 */

import { useEffect, useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

const SOLOMON_SESSION_KEY = 'solomon_authenticated';

export function markSolomonSession() {
  try {
    sessionStorage.setItem(SOLOMON_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasSolomonSession() {
  try {
    return sessionStorage.getItem(SOLOMON_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function useSolomonAuth() {
  const { user, isLoading, error } = useUser();
  const [storedSession, setStoredSession] = useState(() => hasSolomonSession());

  useEffect(() => {
    if (user) {
      markSolomonSession();
      setStoredSession(true);
    }
  }, [user]);

  const isAuthenticated = Boolean(user) || storedSession;
  const authLoading = isLoading && !storedSession;

  return {
    user,
    error,
    isLoading: authLoading,
    isAuthenticated,
    storedSession,
  };
}
