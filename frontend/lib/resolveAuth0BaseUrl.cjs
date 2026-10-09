/**
 * CJS mirror of resolveAuth0BaseUrl.js for node tests and next.config.
 */
const DEFAULT_DEV_ORIGIN = 'http://localhost:3001';

const AUTH0_ALLOWED_HOST_SUFFIXES = ['.vercel.app'];

const AUTH0_ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'atomicrepair419.com',
  'www.atomicrepair419.com',
  'v0-idims.vercel.app',
  'solodiag.com',
  'www.solodiag.com',
  'dma-eight.vercel.app',
]);

function normalizeConfiguredOrigin(raw) {
  if (!raw || !String(raw).trim()) return '';
  let value = String(raw).trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  return value;
}

function configuredFallbackOrigin() {
  const raw =
    process.env.AUTH0_BASE_URL
    || process.env.NEXT_PUBLIC_AUTH0_BASE_URL
    || process.env.NEXT_PUBLIC_BASE_URL
    || '';
  return normalizeConfiguredOrigin(raw) || DEFAULT_DEV_ORIGIN;
}

function isAllowedHost(host) {
  const h = String(host || '').toLowerCase().split(':')[0];
  if (!h) return false;
  if (AUTH0_ALLOWED_HOSTS.has(h)) return true;
  return AUTH0_ALLOWED_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

function resolveAuth0BaseUrl(req) {
  const headers = (req && req.headers) || {};
  const forwardedHost = headers['x-forwarded-host'] || headers.host;
  const hostRaw = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  if (!hostRaw) {
    return configuredFallbackOrigin();
  }

  const hostWithPort = String(hostRaw).split(',')[0].trim();
  const hostname = hostWithPort.split(':')[0].toLowerCase();

  if (!isAllowedHost(hostname)) {
    return configuredFallbackOrigin();
  }

  const forwardedProto = headers['x-forwarded-proto'];
  const protoRaw = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const proto =
    protoRaw && String(protoRaw).split(',')[0].trim() === 'http' ? 'http' : 'https';

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${proto}://${hostWithPort}`;
  }

  return `${proto}://${hostname}`;
}

module.exports = {
  resolveAuth0BaseUrl,
  AUTH0_ALLOWED_HOSTS,
  AUTH0_ALLOWED_HOST_SUFFIXES,
};
