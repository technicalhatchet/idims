/**
 * Node-only helper (next.config / scripts). API routes use idimsWebOrigin.js.
 */
const { resolveAuth0BaseUrl } = require('./resolveAuth0BaseUrl.cjs');

const DEFAULT_ORIGIN = 'http://localhost:3001';

function getIdimsWebOrigin(req) {
  if (req) {
    return resolveAuth0BaseUrl(req);
  }
  return resolveAuth0BaseUrl({ headers: {} });
}

module.exports = { getIdimsWebOrigin, DEFAULT_ORIGIN };
