/**
 * Build Auth0 /authorize params for handleLogin (Pages router).
 * Supports Google account chooser via OIDC prompt=select_account.
 *
 * Query params on GET /api/auth/login:
 * - prompt=select_account | login | consent (passed through when allowed)
 * - select_account=1  → same as prompt=select_account
 * - connection=google-oauth2  → skip Universal Login identity picker
 * - login_hint, screen_hint (existing)
 */

const ALLOWED_PROMPTS = new Set(['select_account', 'login', 'consent', 'none']);

export function loginAuthorizationParamsFromRequest(req) {
  const authorizationParams = {
    scope: 'openid profile email offline_access',
  };

  const audience =
    process.env.AUTH0_AUDIENCE || process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  if (audience) {
    authorizationParams.audience = audience;
  }

  let prompt = req.query?.prompt ? String(req.query.prompt).trim() : '';
  if (!prompt && (req.query?.select_account === '1' || req.query?.select_account === 'true')) {
    prompt = 'select_account';
  }
  if (prompt && ALLOWED_PROMPTS.has(prompt)) {
    authorizationParams.prompt = prompt;
  }

  if (req.query?.login_hint) {
    authorizationParams.login_hint = String(req.query.login_hint);
  }
  if (req.query?.screen_hint) {
    authorizationParams.screen_hint = String(req.query.screen_hint);
  }
  if (req.query?.connection) {
    authorizationParams.connection = String(req.query.connection);
  }

  return authorizationParams;
}
