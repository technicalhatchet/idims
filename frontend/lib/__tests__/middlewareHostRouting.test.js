import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { NextRequest } from 'next/server';

import { middleware } from '../../middleware.js';
import {
  isPublicPath,
  isPortalPath,
  isSolomonStandaloneMode,
  isSolomonStandaloneAllowedPath,
  isTechPath,
} from '../routeAccess.js';

const ENV_KEYS = [
  'HOST_BASED_ROUTING',
  'SOLOMON_STANDALONE',
  'NEXT_PUBLIC_SOLOMON_STANDALONE',
  'VERCEL_GIT_COMMIT_REF',
];

function snapshotEnv() {
  return ENV_KEYS.reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {});
}

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

let envSnapshot;

beforeEach(() => {
  envSnapshot = snapshotEnv();
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

function clearAtomicRoutingEnv() {
  delete process.env.SOLOMON_STANDALONE;
  delete process.env.NEXT_PUBLIC_SOLOMON_STANDALONE;
  delete process.env.VERCEL_GIT_COMMIT_REF;
}

test('public booking and guided diagnostics route classifications unchanged', () => {
  assert.equal(isPublicPath('/book'), true);
  assert.equal(isTechPath('/work_orders'), true);
  assert.equal(isTechPath('/work_orders/abc-123'), true);
  assert.equal(isPublicPath('/api/public/booking'), true);
  assert.equal(isPortalPath('/cxdashboard/invoices'), true);
  assert.equal(isPortalPath('/cxdashboard/login'), false);
});

test('Solomon standalone still redirects / to /solomon when host routing flag is on', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';
  process.env.HOST_BASED_ROUTING = 'true';

  assert.equal(isSolomonStandaloneMode(), true);

  const req = new NextRequest('https://portal.atomicrepair419.com/');
  const res = middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'https://portal.atomicrepair419.com/solomon');

  restoreEnv(snap);
});

test('Solomon standalone still blocks /techboard before Atomic host routing', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://solodiag.com/techboard');
  const res = middleware(req);
  assert.equal(res.headers.get('location'), 'https://solodiag.com/solomon');

  restoreEnv(snap);
});

test('Solomon standalone allows hashed /styles route CSS without redirect', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';

  const stylePaths = [
    '/styles/solomon-theme.e8ce4861.css',
    '/styles/diagnostics-utilities.73144206.css',
    '/styles/solomon-theme.c64e30a1.css',
  ];

  for (const pathname of stylePaths) {
    assert.equal(isSolomonStandaloneAllowedPath(pathname), true);
    const res = middleware(new NextRequest(`https://solodiag.com${pathname}`));
    assert.equal(res.headers.get('location'), null);
  }

  restoreEnv(snap);
});

test('Solomon standalone still redirects non-allowed app routes to /solomon', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';

  const res = middleware(new NextRequest('https://solodiag.com/dashboard'));
  assert.equal(res.headers.get('location'), 'https://solodiag.com/solomon');

  restoreEnv(snap);
});

test('Solomon standalone still blocks /logit on solodiag.com', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';

  const res = middleware(new NextRequest('https://solodiag.com/logit'));
  assert.equal(res.headers.get('location'), 'https://solodiag.com/solomon');

  restoreEnv(snap);
});

test('Logit subdomain on standalone deploy: / redirects to /logit', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';

  const res = middleware(new NextRequest('https://logit.solodiag.com/'));
  assert.equal(res.headers.get('location'), 'https://logit.solodiag.com/logit');

  restoreEnv(snap);
});

test('Logit subdomain on standalone deploy: /logit and host manifest are allowed', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';

  const app = middleware(new NextRequest('https://logit.solodiag.com/logit'));
  assert.equal(app.headers.get('location'), null);

  const manifest = middleware(
    new NextRequest('https://logit.solodiag.com/manifest-logit-host.json'),
  );
  assert.equal(manifest.headers.get('location'), null);

  restoreEnv(snap);
});

test('Logit subdomain on standalone deploy: /solomon redirects to /logit', () => {
  const snap = snapshotEnv();
  process.env.SOLOMON_STANDALONE = 'true';

  const res = middleware(new NextRequest('https://logit.solodiag.com/solomon'));
  assert.equal(res.headers.get('location'), 'https://logit.solodiag.com/logit');

  restoreEnv(snap);
});

test('host routing off: portal / does not redirect via middleware', () => {
  clearAtomicRoutingEnv();
  delete process.env.HOST_BASED_ROUTING;

  const req = new NextRequest('https://portal.atomicrepair419.com/');
  const res = middleware(req);
  assert.equal(res.headers.get('location'), null);
});

test('host routing off: marketing /techboard is not sent to idims host', () => {
  clearAtomicRoutingEnv();
  delete process.env.HOST_BASED_ROUTING;

  const req = new NextRequest('https://atomicrepair419.com/techboard');
  const res = middleware(req);
  const loc = res.headers.get('location');
  assert.ok(!loc || !loc.includes('idims.atomicrepair419.com'));
  if (loc) {
    assert.ok(loc.startsWith('https://atomicrepair419.com/'));
  }
});

test('host routing on: portal / redirects before public-path handling', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://portal.atomicrepair419.com/?x=1');
  const res = middleware(req);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('location'), 'https://portal.atomicrepair419.com/cxdashboard?x=1');
});

test('host routing on: idims / redirects to techboard', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://idims.atomicrepair419.com/');
  const res = middleware(req);
  assert.equal(res.headers.get('location'), 'https://idims.atomicrepair419.com/techboard');
});

test('host routing on: marketing /cxdashboard cross-host to portal', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://www.atomicrepair419.com/cxdashboard?tab=home');
  const res = middleware(req);
  assert.equal(res.status, 307);
  assert.equal(
    res.headers.get('location'),
    'https://portal.atomicrepair419.com/cxdashboard?tab=home',
  );
});

test('host routing on: marketing /work_orders cross-host to idims (guided diagnostics WO path)', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://atomicrepair419.com/work_orders/wo-guid-1');
  const res = middleware(req);
  assert.equal(
    res.headers.get('location'),
    'https://idims.atomicrepair419.com/work_orders/wo-guid-1',
  );
});

test('host routing on: idims /cxdashboard cross-host to portal', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://idims.atomicrepair419.com/cxdashboard/repairs');
  const res = middleware(req);
  assert.equal(
    res.headers.get('location'),
    'https://portal.atomicrepair419.com/cxdashboard/repairs',
  );
});

test('host routing on: api auth callback is not cross-host redirected', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest(
    'https://atomicrepair419.com/api/auth/callback?code=abc',
  );
  const res = middleware(req);
  assert.equal(res.headers.get('location'), null);
});

test('host routing on: manifest and sw.js are not cross-host redirected', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const manifest = middleware(
    new NextRequest('https://idims.atomicrepair419.com/manifest.json'),
  );
  assert.equal(manifest.headers.get('location'), null);

  const sw = middleware(new NextRequest('https://portal.atomicrepair419.com/sw.js'));
  assert.equal(sw.headers.get('location'), null);
});

test('host routing on: marketing /book remains on marketing host', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://atomicrepair419.com/book/step-1');
  const res = middleware(req);
  assert.equal(res.headers.get('location'), null);
});

test('unknown host with flag on: no cross-host redirect for tech paths', () => {
  clearAtomicRoutingEnv();
  process.env.HOST_BASED_ROUTING = 'true';

  const req = new NextRequest('https://localhost:3000/techboard');
  const res = middleware(req);
  const loc = res.headers.get('location');
  assert.ok(!loc?.includes('idims.atomicrepair419.com'));
  assert.ok(!loc?.includes('portal.atomicrepair419.com'));
});
