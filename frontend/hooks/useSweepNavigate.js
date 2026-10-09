import { useCallback } from 'react';
import { useRouter } from 'next/router';

/** One pending sweep-nav app-wide — last tap wins across rail, stat cards, etc. */
let globalSweepTimer = null;

function clearGlobalSweepTimer() {
  if (globalSweepTimer) {
    clearTimeout(globalSweepTimer);
    globalSweepTimer = null;
  }
}

/**
 * Navigate after a sweep animation. New clicks cancel any pending navigation
 * so rapid taps only land on the last destination.
 */
export function useSweepNavigate(delayMs = 400) {
  const router = useRouter();

  const push = useCallback(
    (href, { onSweepStart, onBeforeNavigate, prefetch } = {}) => {
      if (!href) return;
      clearGlobalSweepTimer();
      onSweepStart?.();
      if (prefetch) router.prefetch(href);
      globalSweepTimer = setTimeout(() => {
        globalSweepTimer = null;
        onBeforeNavigate?.();
        router.push(href);
      }, delayMs);
    },
    [router, delayMs],
  );

  const cancel = useCallback(() => {
    clearGlobalSweepTimer();
  }, []);

  return { push, cancel };
}
