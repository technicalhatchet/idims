/**
 * Per-request Auth0 server instance (multi-domain Vercel).
 * Use instead of named getSession/getAccessToken when the browser host may differ from AUTH0_BASE_URL.
 */
import { _initAuth } from '@auth0/nextjs-auth0';
import { resolveAuth0BaseUrl } from './resolveAuth0BaseUrl';

export function auth0ForRequest(req) {
  const baseURL = resolveAuth0BaseUrl(req);

  return _initAuth({
    baseURL,
    authorizationParams: {
      audience: process.env.AUTH0_AUDIENCE || process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
      scope: process.env.AUTH0_SCOPE || 'openid profile email offline_access',
    },
  });
}

export async function getSessionForRequest(req, res) {
  return auth0ForRequest(req).getSession(req, res);
}

export async function getAccessTokenForRequest(req, res, options = {}) {
  return auth0ForRequest(req).getAccessToken(req, res, options);
}
