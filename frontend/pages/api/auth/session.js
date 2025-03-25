import { getSession } from '@auth0/nextjs-auth0';

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    
    if (!session) {
      console.log('No session found');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Debug session information - don't log the full token for security
    console.log('Session found', {
      hasAccessToken: !!session.accessToken,
      tokenStart: session.accessToken ? session.accessToken.substring(0, 10) + '...' : null,
      tokenLength: session.accessToken ? session.accessToken.length : 0,
      userId: session.user?.sub,
      expiresIn: session.expiresIn
    });
    
    // Create user object with token embedded (for compatibility with different clients)
    const userWithToken = {
      ...session.user,
      accessToken: session.accessToken
    };
    
    // Return session data with access token included in multiple places for compatibility
    return res.json({
      user: userWithToken,
      accessToken: session.accessToken,
      idToken: session.idToken, 
      expiresAt: session.expiresAt,
      token: session.accessToken // Add an extra token field for easier access
    });
  } catch (error) {
    console.error('Session API error:', error);
    return res.status(error.status || 500).json({
      error: error.message
    });
  }
} 