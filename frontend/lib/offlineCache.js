/**
 * Shared freshness windows for IndexedDB cache + prefetch (avoid duplicate API calls).
 */
import { MetaStore } from './db';

export const SCHEDULE_CACHE_FRESH_MS = 2 * 60 * 1000;
export const WORK_ORDERS_CACHE_FRESH_MS = 2 * 60 * 1000;

export async function isMetaFresh(key, maxAgeMs) {
  const last = await MetaStore.get(key);
  return Boolean(last && Date.now() - last < maxAgeMs);
}

export function isTechDeckPrefetchRoute(pathname) {
  if (!pathname) return false;
  if (pathname.startsWith('/techboard')) return true;
  if (pathname.startsWith('/work_orders/test')) return true;
  if (pathname.startsWith('/work_orders/schedule-test')) return true;
  return /^\/work_orders\/[^/]+\/mobile$/.test(pathname);
}
