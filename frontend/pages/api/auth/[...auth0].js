import { handleAuth, handleLogin, handleCallback, handleLogout } from '@auth0/nextjs-auth0';

console.log('Auth0 Environment Variables:');
console.log('AUTH0_BASE_URL:', process.env.AUTH0_BASE_URL);
console.log('AUTH0_ISSUER_BASE_URL:', process.env.AUTH0_ISSUER_BASE_URL);
console.log('AUTH0_CLIENT_ID exists:', !!process.env.AUTH0_CLIENT_ID);
console.log('NEXT_PUBLIC_AUTH0_CLIENT_ID exists:', !!process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID);
console.log('AUTH0_AUDIENCE exists:', !!process.env.AUTH0_AUDIENCE);

export default handleAuth({
  login: handleLogin({
    authorizationParams: {
      // Add offline_access to request refresh tokens
      scope: 'openid profile email offline_access'
    }
  }),
  callback: handleCallback({
    async onError(req, res, error) {
      console.error('Auth0 Callback Error:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        code: error.code,
        status: error.status,
        state: error.state,
      });
      
      // Instead of automatically redirecting to error page, render a helpful error message
      res.status(error.status || 500).send(`
        <html>
          <head>
            <title>Auth0 Error</title>
            <style>
              body { font-family: sans-serif; padding: 2rem; }
              pre { background: #f5f5f5; padding: 1rem; overflow: auto; }
              .error { color: red; }
              .container { max-width: 800px; margin: 0 auto; }
              .button { padding: 0.5rem 1rem; background: #0070f3; color: white; text-decoration: none; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">Auth0 Login Error</h1>
              <p>There was an error during the authentication process:</p>
              <pre>${error.message}</pre>
              ${error.cause ? `<p>Cause: <pre>${error.cause.message || 'Unknown'}</pre></p>` : ''}
              <p>Please check your Auth0 configuration and try again.</p>
              <div>
                <a href="/api/auth/login" class="button">Try Again</a>
                <a href="/" class="button" style="margin-left: 1rem">Go Home</a>
              </div>
            </div>
          </body>
        </html>
      `);
    }
  }),
  logout: handleLogout()
});