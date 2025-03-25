// Mock token endpoint for development
export default async function handler(req, res) {
  try {
    // Check if the user is authenticated based on the cookie
    const authCookie = req.cookies['auth0.is.authenticated'];
    
    if (!authCookie || authCookie !== 'true') {
      res.status(401).json({ 
        error: 'Not authenticated',
        message: 'No session found'
      });
      return;
    }

    // Return mock access token and session information
    res.json({
      accessToken: 'mock-access-token-for-development',
      expiresAt: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
      user: {
        email: 'dev@example.com',
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Token endpoint error:', error);
    res.status(error.status || 500).json({
      error: 'Internal server error',
      message: error.message,
      code: error.code
    });
  }
} 