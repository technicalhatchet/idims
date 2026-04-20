// frontend/pages/api/protected-route.js
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';

// Mock protected API route for development
export default withApiAuthRequired(async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    
    // Your API logic here
    res.status(200).json({
      message: 'This is a protected API route',
      user: session.user
    });
  } catch (error) {
    console.error('Protected route error:', error);
    res.status(error.status || 500).json({
      error: error.message,
      code: error.code
    });
  }
});