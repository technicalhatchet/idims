import { resolveAuth0BaseUrl } from './resolveAuth0BaseUrl';

/**
 * @param {import('http').IncomingMessage | undefined} req When provided, uses request host (production).
 */
export function getIdimsWebOrigin(req) {
  if (req) {
    return resolveAuth0BaseUrl(req);
  }
  return resolveAuth0BaseUrl({ headers: {} });
}
