import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';

export default withApiAuthRequired(async function handler(req, res) {
  try {
    // Check if this is a request to refresh the token
    const shouldRefresh = req.query.refresh === 'true' || req.method === 'POST';
    
    // Get the token, potentially refreshing it
    const { accessToken } = await getAccessToken(req, res, {
      refresh: shouldRefresh, // Only force refresh when explicitly requested
      scopes: ['openid', 'profile', 'email']
    });
    
    res.status(200).json({ accessToken });
  } catch (error) {
    console.error('Error getting access token:', error);
    res.status(error.status || 500).json({
      error: error.message,
    });
  }
}); 