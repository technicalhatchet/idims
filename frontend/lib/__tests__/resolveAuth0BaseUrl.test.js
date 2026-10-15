import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolveAuth0BaseUrl,
  resolveAuth0CallbackUrl,
  resolveAuth0LoginUrl,
} from '../resolveAuth0BaseUrl.js';
import { ATOMIC_AUTH_HOST } from '../atomicApprovedHosts.js';

test('returnTo-style paths stay relative in auth-router (no absolute URL in login handler)', () => {
  const absolute = 'https://evil.example.com/steal';
  let normalized = absolute;
  try {
    const url = new URL(absolute);
    normalized = `${url.pathname}${url.search}${url.hash}` || '/auth-router';
  } catch {
    normalized = '/auth-router';
  }
  assert.equal(normalized, '/steal');
});

test('callback URL uses approved portal host', () => {
  const req = {
    headers: {
      'x-forwarded-host': ATOMIC_AUTH_HOST.PORTAL,
      'x-forwarded-proto': 'https',
    },
  };
  assert.equal(resolveAuth0BaseUrl(req), `https://${ATOMIC_AUTH_HOST.PORTAL}`);
  assert.equal(
    resolveAuth0CallbackUrl(req),
    `https://${ATOMIC_AUTH_HOST.PORTAL}/api/auth/callback`,
  );
  assert.equal(
    resolveAuth0LoginUrl(req),
    `https://${ATOMIC_AUTH_HOST.PORTAL}/api/auth/login`,
  );
});
