/**
 * BFF proxy handler — mocked Auth0 token + upstream fetch (no live services).
 * Run: node --experimental-test-module-mocks --test lib/__tests__/apiProxyHandler.test.js
 */
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mock, test, beforeEach, afterEach } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));

await register(
  pathToFileURL(join(__dirname, 'support/esmExtensionResolve.mjs')).href,
);

const HANDLER_URL = pathToFileURL(
  join(__dirname, '../../pages/api/proxy/[...path].js'),
).href;

const REQUEST_AUTH0_MODULE = pathToFileURL(
  join(__dirname, '../requestAuth0.js'),
).href;

const ENV_KEYS = [
  'BACKEND_API_URL',
  'NEXT_PUBLIC_BACKEND_API_URL',
  'NEXT_PUBLIC_API_URL',
];

const BACKEND_ORIGIN = 'http://proxy-test-backend.example';

let envSnapshot;
let originalFetch;
let upstreamBehavior;
let handlerImportCounter = 0;

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

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    jsonBody: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
    send(buffer) {
      this.body = buffer;
      return this;
    },
  };
}

function createReq(overrides = {}) {
  return {
    method: 'GET',
    query: { path: ['api', 'users', 'me'] },
    headers: { host: 'localhost:3001' },
    url: '/api/proxy/api/users/me',
    ...overrides,
  };
}

function mockUpstreamResponse({ status = 200, body = '{"ok":true}', contentType = 'application/json' }) {
  const bytes = new TextEncoder().encode(body);
  return {
    status,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-type') return contentType;
        return null;
      },
    },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

async function loadHandler(getAccessTokenForRequestImpl) {
  const tokenMock = mock.fn(getAccessTokenForRequestImpl);
  await mock.module(REQUEST_AUTH0_MODULE, {
    namedExports: {
      getAccessTokenForRequest: tokenMock,
    },
  });

  handlerImportCounter += 1;
  const imported = await import(`${HANDLER_URL}?mock=${handlerImportCounter}`);
  return { handler: imported.default, tokenMock };
}

beforeEach(() => {
  envSnapshot = snapshotEnv();
  process.env.BACKEND_API_URL = BACKEND_ORIGIN;
  delete process.env.NEXT_PUBLIC_BACKEND_API_URL;
  delete process.env.NEXT_PUBLIC_API_URL;

  upstreamBehavior = () => mockUpstreamResponse({ status: 200, body: '{"ok":true}' });
  originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fn(async (url, init) => upstreamBehavior(url, init));
});

afterEach(() => {
  restoreEnv(envSnapshot);
  globalThis.fetch = originalFetch;
  mock.reset();
});

test('rejects or empty token: upstream fetch has no Authorization header', async () => {
  const cases = [
    async () => {
      throw new Error('no session');
    },
    async () => ({}),
    async () => ({ accessToken: null }),
    async () => ({ accessToken: '' }),
  ];

  for (const impl of cases) {
    mock.reset();
    globalThis.fetch = mock.fn(async (url, init) => upstreamBehavior(url, init));
    const { handler } = await loadHandler(impl);
    const res = createMockRes();
    await handler(createReq(), res);

    assert.equal(globalThis.fetch.mock.callCount(), 1);
    const [url, init] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(url, `${BACKEND_ORIGIN}/api/users/me`);
    assert.equal(init.headers.Authorization, undefined);
  }
});

test('valid access token: adds Authorization Bearer header', async () => {
  const { handler, tokenMock } = await loadHandler(async () => ({
    accessToken: 'test-token',
  }));
  const res = createMockRes();

  await handler(createReq(), res);

  assert.equal(tokenMock.mock.callCount(), 1);
  assert.deepEqual(tokenMock.mock.calls[0].arguments[2], { refresh: false });

  const [url, init] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, `${BACKEND_ORIGIN}/api/users/me`);
  assert.equal(init.headers.Authorization, 'Bearer test-token');
});

test('caller-supplied Authorization: forwarded as-is; token helper not used', async () => {
  const { handler, tokenMock } = await loadHandler(async () => ({
    accessToken: 'should-not-be-used',
  }));
  const res = createMockRes();

  await handler(
    createReq({
      headers: {
        host: 'localhost:3001',
        authorization: 'Bearer client-supplied',
      },
    }),
    res,
  );

  assert.equal(tokenMock.mock.callCount(), 0);
  const [, init] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(init.headers.Authorization, 'Bearer client-supplied');
});

test('upstream 401: status and body pass through', async () => {
  upstreamBehavior = () =>
    mockUpstreamResponse({
      status: 401,
      body: '{"detail":"Not authenticated"}',
      contentType: 'application/json',
    });

  const { handler } = await loadHandler(async () => ({}));
  const res = createMockRes();

  await handler(createReq(), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['Content-Type'], 'application/json');
  assert.equal(Buffer.from(res.body).toString('utf8'), '{"detail":"Not authenticated"}');
});

test('upstream network error: responds 502 with target in JSON body', async () => {
  globalThis.fetch = mock.fn(async () => {
    throw new Error('ECONNREFUSED');
  });

  const { handler } = await loadHandler(async () => ({}));
  const res = createMockRes();

  await handler(createReq(), res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.jsonBody.detail, 'Backend request failed');
  assert.equal(res.jsonBody.target, `${BACKEND_ORIGIN}/api/users/me`);
});

test('preserves query string on upstream URL', async () => {
  const { handler } = await loadHandler(async () => ({}));
  const res = createMockRes();

  await handler(
    createReq({
      query: { path: ['api', 'work-orders'] },
      url: '/api/proxy/api/work-orders?page=2&limit=5',
    }),
    res,
  );

  const [url] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, `${BACKEND_ORIGIN}/api/work-orders?page=2&limit=5`);
});
