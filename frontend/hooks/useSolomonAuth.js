/**
 * Solomon auth — stay signed in offline after a successful login on this device.
 * Auth0 /api/auth/me fails offline; sessionStorage flag keeps Solomon usable.
 */

import { useEffect, useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserRole } from '../utils/auth0-helpers';
import { apiClient } from '../utils/api-client';
import { hasSolomonDiyerSession } from '../utils/solomonAuthUrls';

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
  const [dbRoles, setDbRoles] = useState(null);

  useEffect(() => {
    if (user) {
      markSolomonSession();
      setStoredSession(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setDbRoles(null);
      return undefined;
    }
    let cancelled = false;
    apiClient('auth/me')
      .then((profile) => {
        if (!cancelled && Array.isArray(profile?.roles)) {
          setDbRoles(profile.roles);
        }
      })
      .catch(() => {
        if (!cancelled) setDbRoles(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.sub]);

  const isAuthenticated = Boolean(user) || storedSession;
  const authLoading = isLoading && !storedSession;
  const role = user ? getUserRole(user) : null;
  const isDiyer =
    role === 'diyer'
    || (dbRoles && dbRoles.includes('diyer'))
    || hasSolomonDiyerSession();
  const isStaff =
    role === 'admin' || role === 'manager' || role === 'technician';

  return {
    user,
    error,
    isLoading: authLoading,
    isAuthenticated,
    storedSession,
    role,
    isDiyer,
    isStaff,
  };
}
