import assert from 'node:assert/strict';
import test from 'node:test';

test('buildPortalDirectApiUrl always targets backend (no /api/proxy)', async () => {
  const prev = process.env.NEXT_PUBLIC_BACKEND_API_URL;
  process.env.NEXT_PUBLIC_BACKEND_API_URL = 'https://api.example.com/';
  const { buildPortalDirectApiUrl } = await import('../portalPreview.js');

  const direct = buildPortalDirectApiUrl('work-orders/wo-1/photos');
  assert.equal(direct, 'https://api.example.com/api/portal/work-orders/wo-1/photos');
  assert.ok(!direct.includes('/api/proxy'));

  process.env.NEXT_PUBLIC_BACKEND_API_URL = prev;
});

test('buildPortalApiUrl uses proxy in browser for JSON', async () => {
  const prevBackend = process.env.NEXT_PUBLIC_BACKEND_API_URL;
  const prevWindow = global.window;
  const prevSession = global.sessionStorage;
  process.env.NEXT_PUBLIC_BACKEND_API_URL = 'https://api.example.com';
  global.sessionStorage = { getItem: () => null };
  global.window = { location: { origin: 'https://portal.example.com' } };

  const { buildPortalApiUrl } = await import('../portalPreview.js');
  const proxied = buildPortalApiUrl('me');
  assert.equal(
    proxied,
    'https://portal.example.com/api/proxy/api/portal/me',
  );

  global.window = prevWindow;
  global.sessionStorage = prevSession;
  process.env.NEXT_PUBLIC_BACKEND_API_URL = prevBackend;
});
