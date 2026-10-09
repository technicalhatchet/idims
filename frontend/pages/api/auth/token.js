import { getAccessTokenForRequest, getSessionForRequest } from '../../../lib/requestAuth0';

export default async function handler(req, res) {
  try {
    const session = await getSessionForRequest(req, res);
    if (!session?.user) {
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      });
    }

    const shouldRefresh = req.query.refresh === 'true' || req.method === 'POST';

    const { accessToken } = await getAccessTokenForRequest(req, res, {
      refresh: shouldRefresh,
      scopes: ['openid', 'profile', 'email'],
    });

    res.status(200).json({ accessToken });
  } catch (error) {
    console.error('Error getting access token:', error);
    res.status(error.status || 500).json({
      error: error.message,
    });
  }
}
