import { LOGIT_PWA_VERSION } from './logitPwaIcons';

function isRootScope(scope) {
  try {
    const origin = window.location.origin;
    return scope === `${origin}/` || scope === origin;
  } catch {
    return false;
  }
}

function isLogitWorker(registration) {
  const worker = registration.active || registration.installing || registration.waiting;
  const scriptUrl = worker?.scriptURL || '';
  return scriptUrl.includes('logit-sw.js');
}

/**
 * Register LoGiT's scoped service worker and release control from the site-wide SW.
 * Required for iOS to treat the home-screen install as "LoGiT" in Settings.
 */
export async function ensureLogitPwaServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => isRootScope(registration.scope) && !isLogitWorker(registration))
      .map((registration) => registration.unregister()),
  );

  const registration = await navigator.serviceWorker.register(
    `/logit-sw.js?v=${LOGIT_PWA_VERSION}`,
    { scope: '/logit', updateViaCache: 'none' },
  );

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  await navigator.serviceWorker.ready;
  return registration;
}

export default function LogitPwaBootstrap() {
  if (typeof window === 'undefined') return null;

  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  void ensureLogitPwaServiceWorker().catch((err) => {
    console.warn('[LoGiT PWA] Service worker setup failed:', err);
  });

  return null;
}
