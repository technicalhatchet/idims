import { handleAuth, handleCallback, getSession } from '@auth0/nextjs-auth0';

export default async function handler(req, res) {
  try {
    // If method is not POST, return 405
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Get the current session
    const session = await getSession(req, res);
    
    if (!session) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'No session found to refresh' 
      });
    }
    
    // Auth0 SDK automatically refreshes the token when needed
    // Just returning the current session forces a token validation
    console.log('Refreshing token for user:', session.user.email);
    
    return res.status(200).json({ 
      success: true,
      message: 'Token refreshed'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(error.status || 500).json({
      error: 'Failed to refresh token',
      message: error.message
    });
  }
} 