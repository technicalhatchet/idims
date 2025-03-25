export const config = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000',
  auth0: {
    domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
    clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
    scope: process.env.NEXT_PUBLIC_AUTH0_SCOPE || 'openid profile email',
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    issuerBaseURL: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}`,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    secret: process.env.AUTH0_SECRET,
    routes: {
      callback: '/api/auth/callback',
      login: '/api/auth/login',
      logout: '/api/auth/logout'
    }
  }
}; 