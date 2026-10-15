const assert = require('assert');
const {
  resolveAuth0BaseUrl,
  resolveAuth0CallbackUrl,
  resolveAuth0LogoutUrl,
  resolveAuth0LoginUrl,
  AUTH0_ALLOWED_HOSTS,
} = require('./resolveAuth0BaseUrl.cjs');
const { ATOMIC_AUTH_HOST } = require('./atomicApprovedHosts.cjs');

const prevBase = process.env.AUTH0_BASE_URL;
process.env.AUTH0_BASE_URL = 'https://v0-idims.vercel.app';

function req(host, proto = 'https') {
  return {
    headers: {
      'x-forwarded-host': host,
      'x-forwarded-proto': proto,
    },
  };
}

try {
  const atomicHosts = [
    ATOMIC_AUTH_HOST.MARKETING_APEX,
    ATOMIC_AUTH_HOST.MARKETING_WWW,
    ATOMIC_AUTH_HOST.PORTAL,
    ATOMIC_AUTH_HOST.IDIMS,
  ];

  for (const host of atomicHosts) {
    assert.equal(resolveAuth0BaseUrl(req(host)), `https://${host}`);
    assert.equal(
      resolveAuth0CallbackUrl(req(host)),
      `https://${host}/api/auth/callback`,
    );
    assert.equal(
      resolveAuth0LogoutUrl(req(host)),
      `https://${host}/api/auth/logout`,
    );
    assert.equal(
      resolveAuth0LoginUrl(req(host)),
      `https://${host}/api/auth/login`,
    );
    assert.ok(AUTH0_ALLOWED_HOSTS.has(host));
  }

  assert.equal(
    resolveAuth0BaseUrl(req('v0-idims.vercel.app')),
    'https://v0-idims.vercel.app',
  );

  assert.equal(
    resolveAuth0BaseUrl(req('solodiag.com')),
    'https://solodiag.com',
  );

  assert.equal(
    resolveAuth0BaseUrl({
      headers: {
        host: 'localhost:3001',
        'x-forwarded-proto': 'http',
      },
    }),
    'http://localhost:3001',
  );

  assert.equal(
    resolveAuth0BaseUrl(req('evil.example.com')),
    'https://v0-idims.vercel.app',
  );

  assert.equal(
    resolveAuth0BaseUrl(req('atomicrepair419.com.evil.com')),
    'https://v0-idims.vercel.app',
  );

  assert.equal(resolveAuth0BaseUrl({ headers: {} }), 'https://v0-idims.vercel.app');

  console.log('resolveAuth0BaseUrl.test.cjs: ok');
} finally {
  if (prevBase === undefined) {
    delete process.env.AUTH0_BASE_URL;
  } else {
    process.env.AUTH0_BASE_URL = prevBase;
  }
}
