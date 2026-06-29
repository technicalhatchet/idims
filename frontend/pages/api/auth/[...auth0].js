import { handleAuth, handleLogin, handleCallback, handleLogout } from '@auth0/nextjs-auth0';

const DOMAIN = process.env.AUTH0_ISSUER_BASE_URL;
const MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID;
const MGMT_CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET;
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

const ROLE_IDS = {
  client: 'rol_okGmH3pkFUu0YXWi',
  technician: 'rol_KIVgWHYL1p8smVsc',
};

/**
 * Get a Management API access token
 */
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

/**
 * Assign a role to a user via Management API
 */
async function assignRole(userId, roleId, mgmtToken) {
  await fetch(`${DOMAIN}/api/v2/users/${userId}/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mgmtToken}`,
    },
    body: JSON.stringify({ roles: [roleId] }),
  });
}

/**
 * Auto-assign roles based on email matching backend records
 * Called on every login — only assigns if user has no roles yet
 */
async function autoAssignRole(user, accessToken) {
  const existingRoles = user['https://idimsapi/app_metadata']?.roles || [];
  
  // Already has a role — skip
  if (existingRoles.length > 0) {
    console.log(`[Auth] User ${user.email} already has roles: ${existingRoles.join(', ')}`);
    return;
  }

  console.log(`[Auth] New user ${user.email} — checking for matching records...`);

  try {
    // Check backend for matching client or technician
    const res = await fetch(`${BACKEND}/api/auth/identify-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email: user.email, auth0_user_id: user.sub }),
    });

    if (!res.ok) {
      console.log(`[Auth] identify-user returned ${res.status} — no role assigned`);
      return;
    }

    const data = await res.json();
    console.log(`[Auth] identify-user result:`, data);

    if (data.role && ROLE_IDS[data.role]) {
      const mgmtToken = await getMgmtToken();
      await assignRole(user.sub, ROLE_IDS[data.role], mgmtToken);
      console.log(`[Auth] Assigned role '${data.role}' to ${user.email}`);
    }
  } catch (err) {
    console.error('[Auth] autoAssignRole error:', err.message);
    // Non-fatal — user can still log in, just won't have a role
  }
}

export default handleAuth({
  login: handleLogin((req) => {
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
      returnTo: req.query.returnTo || '/auth-router',
    };
  }),

  callback: handleCallback({
    async onError(req, res, error) {
      console.error('Auth0 Callback Error:', {
        message: error.message,
        code: error.code,
        status: error.status,
      });
      res.status(error.status || 500).send(`
        <html>
          <head><title>Auth0 Error</title>
          <style>body{font-family:sans-serif;padding:2rem;}.error{color:red;}.button{padding:0.5rem 1rem;background:#0070f3;color:white;text-decoration:none;border-radius:4px;}</style>
          </head>
          <body>
            <h1 class="error">Login Error</h1>
            <p>${error.message}</p>
            <a href="/api/auth/login" class="button">Try Again</a>
          </body>
        </html>
      `);
    },
  }),

  logout: handleLogout(),
});