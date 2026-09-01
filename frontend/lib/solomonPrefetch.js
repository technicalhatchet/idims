/**
 * Warm Workbox + browser cache for Solomon routes while online.
 * Next.js client navigation needs /_next/data/*.json — without it, offline nav fails.
 */

const SOLOMON_PATHS = [
  '/solomon',
  '/solomon/start',
  '/solomon/signup',
  '/solomon/diagnose',
  '/solomon/diagnostics',
  '/solomon/outcomes',
  '/solomon/knowledge',
  '/solomon/codes',
];

function nextDataUrl(path) {
  const buildId = typeof window !== 'undefined' ? window.__NEXT_DATA__?.buildId : null;
  if (!buildId) return null;
  if (path === '/solomon') return `/_next/data/${buildId}/solomon.json`;
  return `/_next/data/${buildId}${path}.json`;
}

export async function prefetchSolomonShell() {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  for (const path of SOLOMON_PATHS) {
    try {
      await fetch(path, { credentials: 'same-origin' });
      const dataUrl = nextDataUrl(path);
      if (dataUrl) {
        await fetch(dataUrl, { credentials: 'same-origin' });
      }
    } catch (err) {
      console.debug('[SolomonPrefetch] skipped', path, err?.message || err);
    }
  }
}
