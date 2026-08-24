/**
 * Solomon auth — stay signed in offline after a successful login on this device.
 * Access is limited to DIY homeowners and staff (technician / manager / admin).
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import { apiClient } from '../utils/api-client';
import {
  hasSolomonDiySignupIntent,
  hasSolomonSession,
  markSolomonSession,
  clearSolomonDiySignupIntent,
  markSolomonDiyerSession,
} from '../utils/solomonAuthUrls';
import { completeDiySignup } from '../services/api/solomonAuthApi';

const SOLOMON_SESSION_KEY = 'solomon_authenticated';
const STAFF_ROLES = new Set(['admin', 'manager', 'technician']);

export function markSolomonSession() {
  try {
    sessionStorage.setItem(SOLOMON_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasSolomonSessionLocal() {
  return hasSolomonSession();
}

export function useSolomonAuth() {
  const router = useRouter();
  const { user, isLoading, error } = useUser();
  const [storedSession, setStoredSession] = useState(() => hasSolomonSession());
  const [dbRoles, setDbRoles] = useState(null);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [enrollmentState, setEnrollmentState] = useState('idle');
  const [enrollmentError, setEnrollmentError] = useState(null);

  useEffect(() => {
    if (user) {
      try {
        sessionStorage.setItem(SOLOMON_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      setStoredSession(true);
    }
  }, [user]);

  const refreshRoles = useCallback(() => {
    if (!user) {
      setDbRoles(null);
      return Promise.resolve(null);
    }
    setRolesLoading(true);
    return apiClient('auth/me')
      .then((profile) => {
        const roles = Array.isArray(profile?.roles) ? profile.roles : [];
        setDbRoles(roles);
        return roles;
      })
      .catch(() => {
        setDbRoles([]);
        return [];
      })
      .finally(() => setRolesLoading(false));
  }, [user?.sub]);

  useEffect(() => {
    refreshRoles();
  }, [refreshRoles]);

  const effectiveRoles = dbRoles ?? [];
  const rolesResolved = Boolean(user) && dbRoles !== null;
  const isDiyer = effectiveRoles.includes('diyer');
  const isStaff = effectiveRoles.some((r) => STAFF_ROLES.has(r));
  const canUseSolomon = isDiyer || isStaff;

  const wantsDiyEnrollment =
    router.query?.diy_enroll === '1'
    || hasSolomonDiySignupIntent();

  const needsDiyEnrollment =
    rolesResolved && !canUseSolomon && wantsDiyEnrollment;

  const runDiyEnrollment = useCallback(async () => {
    setEnrollmentState('running');
    setEnrollmentError(null);
    try {
      await completeDiySignup();
      clearSolomonDiySignupIntent();
      markSolomonDiyerSession();
      await refreshRoles();
      setEnrollmentState('done');
      return true;
    } catch (err) {
      setEnrollmentError(err.message || 'Enrollment failed');
      setEnrollmentState('failed');
      return false;
    }
  }, [refreshRoles]);

  useEffect(() => {
    if (!router.pathname.startsWith('/solomon')) return undefined;
    if (!user || rolesLoading || !needsDiyEnrollment) return undefined;
    if (enrollmentState === 'running' || enrollmentState === 'done') return undefined;

    let cancelled = false;
    (async () => {
      const ok = await runDiyEnrollment();
      if (cancelled || !ok) return;
      if (router.query.diy_enroll === '1') {
        router.replace('/solomon/start?welcome=1', undefined, { shallow: true });
      }
    })();

    return () => { cancelled = true; };
  }, [
    user,
    rolesLoading,
    needsDiyEnrollment,
    enrollmentState,
    router.pathname,
    router.query.diy_enroll,
    runDiyEnrollment,
    router,
  ]);

  const isAuthenticated = Boolean(user) || storedSession;
  const authLoading = isLoading && !storedSession;

  return {
    user,
    error,
    isLoading: authLoading,
    isAuthenticated,
    storedSession,
    rolesLoading,
    rolesResolved,
    role: effectiveRoles[0] || null,
    isDiyer,
    isStaff,
    canUseSolomon,
    needsDiyEnrollment,
    enrollmentState,
    enrollmentError,
    retryDiyEnrollment: runDiyEnrollment,
    refreshRoles,
  };
}
