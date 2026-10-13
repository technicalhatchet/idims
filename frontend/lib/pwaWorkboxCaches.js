/**
 * Workbox / next-pwa Cache Storage names for this app (see next.config.js runtimeCaching).
 * Used by Preview SW isolation — does not touch IndexedDB or localStorage (except callers).
 */

const WORKBOX_CACHE_NAME_PATTERN =
  /fallback-cache|workbox|precache|pages-cache|solomon-|logit-|next-static|next-image|google-fonts|static-images|app-icons|leaflet-cache|osm-tiles/i;

export function isWorkboxRelatedCacheName(name) {
  return WORKBOX_CACHE_NAME_PATTERN.test(name);
}

/** @returns {Promise<number>} count of caches deleted */
export async function deleteWorkboxRelatedCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return 0;
  }

  const names = await caches.keys();
  const targets = names.filter(isWorkboxRelatedCacheName);
  await Promise.all(
    targets.map((name) =>
      caches.delete(name).catch((err) => {
        console.warn('[PWA] Cache delete failed:', name, err);
        return false;
      })
    )
  );
  return targets.length;
}

export async function unregisterAllServiceWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return 0;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((reg) =>
      reg.unregister().catch((err) => {
        console.warn('[PWA] Service worker unregister failed:', err);
        return false;
      })
    )
  );
  return registrations.length;
}
