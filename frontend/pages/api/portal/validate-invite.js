/**
 * API route: /api/portal/validate-invite
 * Validates an invite token and returns the client info if valid.
 */

import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, process.env.PORTAL_INVITE_SECRET);

    // Token is valid — return client info (non-sensitive)
    return res.status(200).json({
      valid: true,
      client: {
        id: payload.client_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        company_name: payload.company_name || null,
        email: payload.email || null,
      }
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(200).json({ valid: false, message: 'This invite link has expired. Please contact Atomic Repair for a new one.' });
    }
    return res.status(200).json({ valid: false, message: 'This invite link is invalid.' });
  }
}
