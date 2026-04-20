import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';

export default async function handler(req, res) {
  try {
    // For POST requests, attempt to refresh the session
    if (req.method === 'POST' && req.query.refresh === 'true') {
      // We can't actually force a refresh with the SDK, but we can
      // get a fresh token which might be renewed if needed
      const { accessToken } = await getAccessToken(req, res, {
        refresh: true,
        scopes: ['openid', 'profile', 'email']
      });
      
      return res.status(200).json({ accessToken });
    }
    
    // For GET requests, just return the current token
    const { accessToken } = await getAccessToken(req, res, {
      scopes: ['openid', 'profile', 'email']
    });
    
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error('Error in token endpoint:', error);
    return res.status(error.status || 500).json({
      error: error.message,
    });
  }
}