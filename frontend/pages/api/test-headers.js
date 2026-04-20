import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';

export default withApiAuthRequired(async function handler(req, res) {
  try {
    // Get token from Auth0
    const { accessToken } = await getAccessToken(req, res, {
      scopes: ['openid', 'profile', 'email']
    });
    
    // Call backend debug endpoint
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/work-orders-headers-debug`;
    console.log('Calling backend debug endpoint:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log('Response from backend debug endpoint:', data);
    
    // Return the debug info
    res.status(200).json({
      accessTokenPrefix: accessToken.substring(0, 10) + '...',
      backendResponse: data
    });
  } catch (error) {
    console.error('Test headers error:', error);
    res.status(500).json({
      error: error.message
    });
  }
}); 