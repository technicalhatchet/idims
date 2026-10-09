import { getIdimsWebOrigin } from '../../../lib/idimsWebOrigin.js';

/** Dev sanity check: which origin IDIMS Auth0 will use (no secrets). */
export default function handler(req, res) {
  const origin = getIdimsWebOrigin(req);
  res.status(200).json({
    idimsWebOrigin: origin,
    expectedCallback: `${origin}/api/auth/callback`,
    requestHost: req.headers['x-forwarded-host'] || req.headers.host || null,
  });
}
