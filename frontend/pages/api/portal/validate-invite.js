/**
 * API route: /api/portal/validate-invite
 * Validates claim tokens (API) or legacy JWT invite tokens.
 */

import jwt from 'jsonwebtoken';

function backendApiRoot() {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_BACKEND_API_URL
    || 'http://localhost:8000/'
  ).replace(/\/$/, '');
  return raw.replace(/\/api$/i, '');
}

async function validateClaimToken(token) {
  const base = backendApiRoot();
  const res = await fetch(
    `${base}/api/portal/validate-claim?token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  if (data?.valid) {
    return data;
  }
  return { valid: false, message: data?.message || 'This invite link is invalid.' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'No token provided' });
  }

  const tokenStr = String(token);

  // DB-backed claim (no JWT dots) — validate via FastAPI
  if (tokenStr.split('.').length !== 3) {
    try {
      const claimResult = await validateClaimToken(tokenStr);
      if (claimResult) {
        return res.status(200).json(claimResult);
      }
    } catch (err) {
      console.error('validate-claim proxy failed', err);
    }
  }

  try {
    const secret = process.env.PORTAL_INVITE_SECRET || process.env.SECRET_KEY;
    if (!secret) {
      console.error('PORTAL_INVITE_SECRET is not configured');
      return res.status(500).json({ valid: false, message: 'Invite validation is not configured on the server.' });
    }

    const payload = jwt.verify(tokenStr, secret);

    return res.status(200).json({
      valid: true,
      token_type: 'jwt',
      client: {
        id: payload.client_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        company_name: payload.company_name || null,
        email: payload.email || null,
      },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(200).json({ valid: false, message: 'This invite link has expired. Please contact Atomic Repair for a new one.' });
    }
    return res.status(200).json({ valid: false, message: 'This invite link is invalid.' });
  }
}
