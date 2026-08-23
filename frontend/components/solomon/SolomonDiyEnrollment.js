import { useEffect, useRef } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';
import { completeDiySignup } from '../../services/api/solomonAuthApi';
import {
  clearSolomonDiySignupIntent,
  hasSolomonDiySignupIntent,
  markSolomonDiyerSession,
} from '../../utils/solomonAuthUrls';

/**
 * After DIY signup login, assign diyer role once via backend + refresh session.
 */
export default function SolomonDiyEnrollment() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!router.pathname.startsWith('/solomon')) return;
    if (isLoading || !user || runningRef.current) return;
    if (!hasSolomonDiySignupIntent()) return;

    runningRef.current = true;
    clearSolomonDiySignupIntent();

    completeDiySignup()
      .then(() => {
        markSolomonDiyerSession();
        window.location.href = '/solomon/start?welcome=1';
      })
      .catch((err) => {
        console.error('[Solomon] DIY enrollment failed:', err);
      })
      .finally(() => {
        runningRef.current = false;
      });
  }, [user, isLoading, router.pathname]);

  return null;
}
