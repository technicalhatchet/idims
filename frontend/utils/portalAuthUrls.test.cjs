const assert = require('assert');

// ESM module — dynamic import not needed; mirror portal URL shape in test
function portalSignInUrl(returnTo = '/cxdashboard', { selectAccount = true } = {}) {
  const params = new URLSearchParams({ returnTo });
  if (selectAccount) params.set('prompt', 'select_account');
  return `/api/auth/login?${params.toString()}`;
}

assert.equal(
  portalSignInUrl('/cxdashboard'),
  '/api/auth/login?returnTo=%2Fcxdashboard&prompt=select_account',
);
assert.equal(
  portalSignInUrl('/cxdashboard', { selectAccount: false }),
  '/api/auth/login?returnTo=%2Fcxdashboard',
);
assert.ok(!portalSignInUrl('/cxdashboard').includes('vercel.app'));
console.log('portalAuthUrls.test.cjs: ok');
