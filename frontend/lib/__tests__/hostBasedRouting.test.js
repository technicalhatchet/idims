import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { NextRequest } from 'next/server';

import {
  getHostBasedCrossHostRedirectUrl,
  getHostBasedRootRedirectUrl,
  getHostBasedSiteRedirectUrl,
  isCustomerPortalFamilyPath,
  isHostBasedRoutingEnabled,
  isHostRoutingExemptPath,
  isTechnicianFamilyPath,
} from '../hostBasedRouting.js';

const ENV_KEYS = ['HOST_BASED_ROUTING'];

function restoreEnv(snapshot) {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

function snapshotEnv() {
  return ENV_KEYS.reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {});
}

let envSnapshot;

beforeEach(() => {
  envSnapshot = snapshotEnv();
});

afterEach(() => {
  restoreEnv(envSnapshot);
});

test('isHostBasedRoutingEnabled is false when unset, empty, or "false"', () => {
  const snap = snapshotEnv();
  delete process.env.HOST_BASED_ROUTING;
  assert.equal(isHostBasedRoutingEnabled(), false);
  process.env.HOST_BASED_ROUTING = '';
  assert.equal(isHostBasedRoutingEnabled(), false);
  process.env.HOST_BASED_ROUTING = 'false';
  assert.equal(isHostBasedRoutingEnabled(), false);
  process.env.HOST_BASED_ROUTING = 'TRUE';
  assert.equal(isHostBasedRoutingEnabled(), false);
  restoreEnv(snap);
});

test('isHostBasedRoutingEnabled is true only for literal "true"', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  assert.equal(isHostBasedRoutingEnabled(), true);
  restoreEnv(snap);
});

test('route family helpers align with routeAccess tech and cxdashboard', () => {
  assert.equal(isCustomerPortalFamilyPath('/cxdashboard'), true);
  assert.equal(isCustomerPortalFamilyPath('/cxdashboard/login'), true);
  assert.equal(isCustomerPortalFamilyPath('/cxdashboard/invoices'), true);
  assert.equal(isTechnicianFamilyPath('/work_orders/wo-1'), true);
  assert.equal(isTechnicianFamilyPath('/techboard'), true);
  assert.equal(isTechnicianFamilyPath('/solomon/diagnostics/abc'), true);
  assert.equal(isTechnicianFamilyPath('/book'), false);
});

test('host routing exempt paths include auth, proxy, and PWA assets', () => {
  assert.equal(isHostRoutingExemptPath('/api/auth/callback'), true);
  assert.equal(isHostRoutingExemptPath('/api/auth/login'), true);
  assert.equal(isHostRoutingExemptPath('/api/public/booking'), true);
  assert.equal(isHostRoutingExemptPath('/api/portal/validate-invite'), true);
  assert.equal(isHostRoutingExemptPath('/api/proxy/work_orders'), true);
  assert.equal(isHostRoutingExemptPath('/manifest.json'), true);
  assert.equal(isHostRoutingExemptPath('/sw.js'), true);
  assert.equal(isHostRoutingExemptPath('/worker-abc.js'), true);
  assert.equal(isHostRoutingExemptPath('/api/dashboard/stats'), false);
});

test('flag off: no root or cross-host redirects', () => {
  const snap = snapshotEnv();
  delete process.env.HOST_BASED_ROUTING;
  const portalReq = new NextRequest('https://portal.atomicrepair419.com/?q=1');
  assert.equal(getHostBasedRootRedirectUrl(portalReq), null);
  assert.equal(
    getHostBasedCrossHostRedirectUrl(
      new NextRequest('https://atomicrepair419.com/cxdashboard'),
    ),
    null,
  );
  assert.equal(
    getHostBasedCrossHostRedirectUrl(
      new NextRequest('https://atomicrepair419.com/techboard'),
    ),
    null,
  );
  restoreEnv(snap);
});

test('flag on: portal root redirects to /cxdashboard with query', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  const req = new NextRequest('https://portal.atomicrepair419.com/?foo=bar&baz=1');
  const target = getHostBasedRootRedirectUrl(req);
  assert.ok(target);
  assert.equal(target.pathname, '/cxdashboard');
  assert.equal(target.search, '?foo=bar&baz=1');
  assert.equal(target.host, 'portal.atomicrepair419.com');
  restoreEnv(snap);
});

test('flag on: idims root redirects to /techboard with query', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  const req = new NextRequest('https://idims.atomicrepair419.com/?tab=ops');
  const target = getHostBasedRootRedirectUrl(req);
  assert.ok(target);
  assert.equal(target.pathname, '/techboard');
  assert.equal(target.search, '?tab=ops');
  restoreEnv(snap);
});

test('flag on: marketing and default hosts keep root unchanged', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  assert.equal(
    getHostBasedRootRedirectUrl(new NextRequest('https://atomicrepair419.com/')),
    null,
  );
  assert.equal(
    getHostBasedRootRedirectUrl(new NextRequest('https://www.atomicrepair419.com/')),
    null,
  );
  assert.equal(
    getHostBasedRootRedirectUrl(new NextRequest('https://solodiag.com/')),
    null,
  );
  assert.equal(
    getHostBasedRootRedirectUrl(new NextRequest('https://localhost:3001/')),
    null,
  );
  restoreEnv(snap);
});

test('flag on: marketing apex sends portal paths to portal host with query', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  const req = new NextRequest('https://www.atomicrepair419.com/cxdashboard/invoices?paid=1');
  const target = getHostBasedCrossHostRedirectUrl(req);
  assert.ok(target);
  assert.equal(target.host, 'portal.atomicrepair419.com');
  assert.equal(target.pathname, '/cxdashboard/invoices');
  assert.equal(target.search, '?paid=1');
  restoreEnv(snap);
});

test('flag on: marketing apex sends tech paths to idims host', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  const req = new NextRequest('https://atomicrepair419.com/work_orders/abc-123');
  const target = getHostBasedCrossHostRedirectUrl(req);
  assert.ok(target);
  assert.equal(target.host, 'idims.atomicrepair419.com');
  assert.equal(target.pathname, '/work_orders/abc-123');
  restoreEnv(snap);
});

test('flag on: marketing sends /solomon to idims (host routing only, not middleware auth)', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  const req = new NextRequest('https://atomicrepair419.com/solomon/diagnostics/x');
  const target = getHostBasedCrossHostRedirectUrl(req);
  assert.ok(target);
  assert.equal(target.host, 'idims.atomicrepair419.com');
  restoreEnv(snap);
});

test('flag on: marketing keeps /book and /api/dashboard unchanged', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  assert.equal(
    getHostBasedCrossHostRedirectUrl(new NextRequest('https://atomicrepair419.com/book')),
    null,
  );
  assert.equal(
    getHostBasedCrossHostRedirectUrl(
      new NextRequest('https://atomicrepair419.com/api/dashboard/stats'),
    ),
    null,
  );
  restoreEnv(snap);
});

test('flag on: portal host keeps portal paths, redirects tech to idims', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  assert.equal(
    getHostBasedCrossHostRedirectUrl(
      new NextRequest('https://portal.atomicrepair419.com/cxdashboard/messages'),
    ),
    null,
  );
  const tech = getHostBasedCrossHostRedirectUrl(
    new NextRequest('https://portal.atomicrepair419.com/techboard?x=1'),
  );
  assert.ok(tech);
  assert.equal(tech.host, 'idims.atomicrepair419.com');
  assert.equal(tech.search, '?x=1');
  restoreEnv(snap);
});

test('flag on: idims host keeps tech and work orders, redirects portal to portal host', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  assert.equal(
    getHostBasedCrossHostRedirectUrl(
      new NextRequest('https://idims.atomicrepair419.com/schedule'),
    ),
    null,
  );
  const portal = getHostBasedCrossHostRedirectUrl(
    new NextRequest('https://idims.atomicrepair419.com/cxdashboard/login?returnTo=%2F'),
  );
  assert.ok(portal);
  assert.equal(portal.host, 'portal.atomicrepair419.com');
  assert.equal(portal.pathname, '/cxdashboard/login');
  restoreEnv(snap);
});

test('flag on: localhost default profile has no cross-host redirects', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  assert.equal(
    getHostBasedCrossHostRedirectUrl(new NextRequest('https://localhost:3000/techboard')),
    null,
  );
  restoreEnv(snap);
});

test('getHostBasedSiteRedirectUrl prefers root redirect over cross-host on portal /', () => {
  const snap = snapshotEnv();
  process.env.HOST_BASED_ROUTING = 'true';
  const req = new NextRequest('https://portal.atomicrepair419.com/');
  const target = getHostBasedSiteRedirectUrl(req);
  assert.ok(target);
  assert.equal(target.host, 'portal.atomicrepair419.com');
  assert.equal(target.pathname, '/cxdashboard');
  restoreEnv(snap);
});
