/**
 * Phase 2.5 — auth / routing compatibility regressions for host-based routing.
 */
import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { NextRequest } from 'next/server';

import { middleware } from '../../middleware.js';
import {
  getHostBasedCrossHostRedirectUrl,
  getHostBasedSiteRedirectUrl,
  isHostRoutingExemptPath,
} from '../hostBasedRouting.js';
import { resolveAuth0BaseUrl } from '../resolveAuth0BaseUrl.js';

const ENV_KEYS = ['HOST_BASED_ROUTING', 'SOLOMON_STANDALONE', 'AUTH0_BASE_URL'];

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

test('flag off: site redirect helper is always null for cross-host candidates', () => {
  delete process.env.HOST_BASED_ROUTING;
  const cases = [
    'https://atomicrepair419.com/techboard',
    'https://atomicrepair419.com/cxdashboard',
    'https://portal.atomicrepair419.com/techboard',
    'https://idims.atomicrepair419.com/cxdashboard',
  ];
  for (const url of cases) {
    assert.equal(getHostBasedSiteRedirectUrl(new NextRequest(url)), null);
  }
});

test('auth entry and logout paths are never cross-host redirected', () => {
  process.env.HOST_BASED_ROUTING = 'true';
  const authPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/callback',
    '/api/auth/session',
  ];
  for (const path of authPaths) {
    assert.equal(isHostRoutingExemptPath(path), true);
    const req = new NextRequest(`https://atomicrepair419.com${path}?returnTo=%2Ftechboard`);
    assert.equal(getHostBasedCrossHostRedirectUrl(req), null);
    const res = middleware(req);
    assert.equal(res.headers.get('location'), null);
  }
});

test('cross-host redirect targets are fixed allowlist hosts only', () => {
  process.env.HOST_BASED_ROUTING = 'true';
  const req = new NextRequest('https://evil.example.com/techboard', {
    headers: { host: 'atomicrepair419.com' },
  });
  const target = getHostBasedCrossHostRedirectUrl(req);
  assert.ok(target);
  assert.equal(target.hostname, 'idims.atomicrepair419.com');
  assert.equal(target.protocol, 'https:');
});

test('portal host /solomon redirects to idims before any page render', () => {
  process.env.HOST_BASED_ROUTING = 'true';
  delete process.env.SOLOMON_STANDALONE;
  const req = new NextRequest('https://portal.atomicrepair419.com/solomon/diagnose');
  const res = middleware(req);
  assert.equal(
    res.headers.get('location'),
    'https://idims.atomicrepair419.com/solomon/diagnose',
  );
});

test('resolveAuth0BaseUrl: portal and idims use request host (not apex fallback)', () => {
  process.env.AUTH0_BASE_URL = 'https://atomicrepair419.com';
  const idims = resolveAuth0BaseUrl({
    headers: {
      'x-forwarded-host': 'idims.atomicrepair419.com',
      'x-forwarded-proto': 'https',
    },
  });
  const portal = resolveAuth0BaseUrl({
    headers: {
      'x-forwarded-host': 'portal.atomicrepair419.com',
      'x-forwarded-proto': 'https',
    },
  });
  assert.equal(idims, 'https://idims.atomicrepair419.com');
  assert.equal(portal, 'https://portal.atomicrepair419.com');
});

test('middleware: marketing /book unchanged with flag on (no accidental cross-host)', () => {
  process.env.HOST_BASED_ROUTING = 'true';
  delete process.env.SOLOMON_STANDALONE;
  const res = middleware(new NextRequest('https://www.atomicrepair419.com/book'));
  assert.equal(res.headers.get('location'), null);
});
