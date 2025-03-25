import { handleAuth, handleLogin, handleCallback, handleLogout } from '@auth0/nextjs-auth0';

export default handleAuth({
  login: handleLogin(),
  callback: handleCallback(),
  logout: handleLogout()
});