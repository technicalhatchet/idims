import { useEffect } from 'react';
import { LOGIT_PWA_VERSION } from './logitPwaIcons';

/**
 * Register LoGiT's scoped service worker so Add to Home Screen creates a distinct app
 * (Settings → LoGiT on iOS) instead of a Safari bookmark.
 */
export default function LogitPwaBootstrap() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return undefined;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          `/logit-sw.js?v=${LOGIT_PWA_VERSION}`,
          { scope: '/logit' },
        );
        if (!cancelled) {
          console.info('[LoGiT PWA] Registered', registration.scope);
        }
      } catch (err) {
        console.warn('[LoGiT PWA] Service worker registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
