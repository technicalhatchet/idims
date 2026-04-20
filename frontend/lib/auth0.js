import { initAuth0 } from "@auth0/nextjs-auth0";

export const auth0 = initAuth0({
  secret: process.env.AUTH0_SECRET,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID || process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  routes: {
    callback: '/api/auth/callback',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    postLogoutRedirect: '/'
  },
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email',
    audience: process.env.AUTH0_AUDIENCE || process.env.NEXT_PUBLIC_AUTH0_AUDIENCE
  },
  session: {
    rollingDuration: 60 * 60, // 1 hour
    absoluteDuration: 24 * 60 * 60, // 24 hours
    cookie: {
      transient: false,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    }
  },
  idTokenSigningAlg: 'RS256',
  clockTolerance: 60
}); 