const assert = require('assert');
const {
  resolveAuth0BaseUrl,
  AUTH0_ALLOWED_HOSTS,
} = require('./resolveAuth0BaseUrl.cjs');

const prevBase = process.env.AUTH0_BASE_URL;
process.env.AUTH0_BASE_URL = 'https://v0-idims.vercel.app';

try {
  assert.equal(
    resolveAuth0BaseUrl({
      headers: {
        'x-forwarded-host': 'atomicrepair419.com',
        'x-forwarded-proto': 'https',
      },
    }),
    'https://atomicrepair419.com',
  );

  assert.equal(
    resolveAuth0BaseUrl({
      headers: {
        host: 'v0-idims.vercel.app',
        'x-forwarded-proto': 'https',
      },
    }),
    'https://v0-idims.vercel.app',
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
    resolveAuth0BaseUrl({
      headers: {
        'x-forwarded-host': 'evil.example.com',
        'x-forwarded-proto': 'https',
      },
    }),
    'https://v0-idims.vercel.app',
  );

  assert.ok(AUTH0_ALLOWED_HOSTS.has('atomicrepair419.com'));
  console.log('resolveAuth0BaseUrl.test.cjs: ok');
} finally {
  if (prevBase === undefined) {
    delete process.env.AUTH0_BASE_URL;
  } else {
    process.env.AUTH0_BASE_URL = prevBase;
  }
}
