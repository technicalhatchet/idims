export const auth0Config = {
  baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  issuerBaseURL: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}`,
  clientID: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  routes: {
    callback: '/api/auth/callback',
    login: '/api/auth/login',
    logout: '/api/auth/logout'
  },
  session: {
    absoluteDuration: 24 * 60 * 60, // 24 hours
    rolling: true,
    rollingDuration: 1 * 60 * 60 // 1 hour
  },
  authorizationParams: {
    scope: 'openid profile email',
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE
  },
  errorPath: '/api/auth/error',
  loginPath: '/api/auth/login',
  callbackPath: '/api/auth/callback',
  logoutPath: '/api/auth/logout'
}; 