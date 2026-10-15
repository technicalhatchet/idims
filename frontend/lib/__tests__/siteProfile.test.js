import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getSiteProfile,
  normalizeHostname,
  SITE_PROFILE,
} from '../siteProfile.js';

test('normalizeHostname lowercases, trims, strips port, uses first forwarded host', () => {
  assert.equal(normalizeHostname('  ATOMICREPAIR419.COM  '), 'atomicrepair419.com');
  assert.equal(normalizeHostname('portal.atomicrepair419.com:443'), 'portal.atomicrepair419.com');
  assert.equal(normalizeHostname('idims.atomicrepair419.com, evil.test'), 'idims.atomicrepair419.com');
  assert.equal(normalizeHostname(''), '');
  assert.equal(normalizeHostname(null), '');
});

test('marketing hostnames', () => {
  assert.equal(getSiteProfile('atomicrepair419.com'), SITE_PROFILE.MARKETING);
  assert.equal(getSiteProfile('www.atomicrepair419.com'), SITE_PROFILE.MARKETING);
  assert.equal(getSiteProfile('WWW.ATOMICREPAIR419.COM:443'), SITE_PROFILE.MARKETING);
});

test('portal and idims hostnames', () => {
  assert.equal(getSiteProfile('portal.atomicrepair419.com'), SITE_PROFILE.PORTAL);
  assert.equal(getSiteProfile('idims.atomicrepair419.com'), SITE_PROFILE.IDIMS);
});

test('solodiag, dma-eight, localhost, and unknown → default', () => {
  assert.equal(getSiteProfile('solodiag.com'), SITE_PROFILE.DEFAULT);
  assert.equal(getSiteProfile('www.solodiag.com'), SITE_PROFILE.DEFAULT);
  assert.equal(getSiteProfile('dma-eight.vercel.app'), SITE_PROFILE.DEFAULT);
  assert.equal(getSiteProfile('localhost'), SITE_PROFILE.DEFAULT);
  assert.equal(getSiteProfile('localhost:3001'), SITE_PROFILE.DEFAULT);
  assert.equal(getSiteProfile('v0-idims.vercel.app'), SITE_PROFILE.DEFAULT);
  assert.equal(getSiteProfile('not-a-real-host.example'), SITE_PROFILE.DEFAULT);
});
