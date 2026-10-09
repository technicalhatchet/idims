import { resolveAuth0BaseUrl } from '../../../lib/resolveAuth0BaseUrl';
import { auth0ForRequest } from '../../../lib/requestAuth0';

const DOMAIN = process.env.AUTH0_ISSUER_BASE_URL;
const MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID;
const MGMT_CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET;

function backendRoot() {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_BACKEND_API_URL
    || 'http://localhost:8000/'
  ).replace(/\/$/, '');
  return raw.replace(/\/api$/i, '');
}

function backendAuthUrl(routePath) {
  const pathPart = String(routePath).replace(/^\//, '');
  const suffix = pathPart.startsWith('auth/') ? pathPart : `auth/${pathPart}`;
  return `${backendRoot()}/api/auth/${suffix}`;
}

const ROLE_IDS = {
  client: 'rol_okGmH3pkFUu0YXWi',
  technician: 'rol_KIVgWHYL1p8smVsc',
  diyer: 'rol_efrbzOWFRtk0sJYy',
};

async function getMgmtToken() {
  const res = await fetch(`${DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: MGMT_CLIENT_ID,
      client_secret: MGMT_CLIENT_SECRET,
      audience: `${DOMAIN}/api/v2/`,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function assignRole(userId, roleId, mgmtToken) {
  await fetch(`${DOMAIN}/api/v2/users/${userId}/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mgmtToken}`,
    },
    body: JSON.stringify({ roles: [roleId] }),
  });
}

async function autoAssignRole(user, accessToken) {
  const existingRoles = user['https://idimsapi/app_metadata']?.roles || [];
  if (existingRoles.length > 0) return;

  try {
    const res = await fetch(backendAuthUrl('auth/identify-user'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email: user.email, auth0_user_id: user.sub }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.role && ROLE_IDS[data.role]) {
      const mgmtToken = await getMgmtToken();
      await assignRole(user.sub, ROLE_IDS[data.role], mgmtToken);
    }
  } catch (err) {
    console.error('[Auth] autoAssignRole error:', err.message);
  }
}

async function completeDiySignupOnCallback(accessToken) {
  const res = await fetch(backendAuthUrl('auth/complete-diy-signup'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[Auth] complete-diy-signup failed: ${res.status} ${body}`);
    return false;
  }
  return true;
}

function normalizeReturnTo(returnTo) {
  const raw = String(returnTo || '').trim();
  if (!raw) return '/auth-router';
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw);
    if (url.pathname) {
      return `${url.pathname}${url.search}${url.hash}` || '/auth-router';
    }
  } catch {
    /* ignore */
  }
  return '/auth-router';
}

function authHandlersFor(auth0) {
  return {
    login: auth0.handleLogin((req) => {
      const authorizationParams = {
        scope: 'openid profile email offline_access',
      };
      if (req.query.login_hint) {
        authorizationParams.login_hint = String(req.query.login_hint);
      }
      if (req.query.screen_hint) {
        authorizationParams.screen_hint = String(req.query.screen_hint);
      }
      return {
        authorizationParams,
        returnTo: normalizeReturnTo(req.query.returnTo || '/auth-router'),
      };
    }),

    callback: auth0.handleCallback({
      async afterCallback(req, res, session, state) {
        const returnTo = String(state?.returnTo || '');
        if (returnTo.includes('diy_enroll=1') && session?.accessToken) {
          await completeDiySignupOnCallback(session.accessToken);
        }
        return session;
      },
      async onError(req, res, error) {
        const baseURL = resolveAuth0BaseUrl(req);
        console.error('Auth0 Callback Error:', {
          message: error.message,
          code: error.code,
          status: error.status,
          baseURL,
          host: req.headers['x-forwarded-host'] || req.headers.host,
        });
        const safeMessage = String(error.message || 'Unknown error').replace(/</g, '&lt;');
        res.status(error.status || 500).send(`
        <html>
          <head><title>Auth0 Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>body{font-family:sans-serif;padding:1.25rem;max-width:40rem;margin:0 auto;}
          .error{color:#b91c1c;} .button{display:inline-block;margin-top:1rem;padding:0.5rem 1rem;background:#0070f3;color:white;text-decoration:none;border-radius:4px;}</style>
          </head>
          <body>
            <h1 class="error">Login error</h1>
            <p>${safeMessage}</p>
            <p><small>Code: ${error.code || 'n/a'}</small></p>
            <a href="/api/auth/login?returnTo=/cxdashboard" class="button">Try again</a>
          </body>
        </html>
      `);
      },
    }),

    logout: auth0.handleLogout(),
  };
}

export default async function handler(req, res) {
  const auth0 = auth0ForRequest(req);
  return auth0.handleAuth(authHandlersFor(auth0))(req, res);
}
