/**
 * Authentication utilities for Auth0 integration
 */
import { useUser } from '@auth0/nextjs-auth0/client';

/**
 * Get the current user session from Auth0
 * @returns {Promise<Object|null>} Session object or null if not authenticated
 */
export async function getSession() {
  // This is for server-side or non-hook contexts
  try {
    // In a browser context, try to get from the client-side
    if (typeof window !== 'undefined') {
      const storedSession = localStorage.getItem('auth0_session');
      if (storedSession) {
        return JSON.parse(storedSession);
      }
      
      // Try to fetch the session from the API endpoint
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const session = await response.json();
        // Cache the session temporarily
        if (session.user) {
          localStorage.setItem('auth0_session', JSON.stringify(session));
        }
        return session;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting Auth0 session:', error);
    return null;
  }
}

/**
 * Hook to use Auth0 user and authentication status
 * @returns {Object} Auth0 user information and status
 */
export function useAuth() {
  const { user, error, isLoading } = useUser();
  
  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error
  };
}

/**
 * Navigate to Auth0 login page
 * @param {string} returnTo - URL to return to after login
 */
export function login(returnTo = window.location.pathname) {
  window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Logout from Auth0
 * @param {string} returnTo - URL to return to after logout
 */
export function logout(returnTo = window.location.origin) {
  localStorage.removeItem('auth0_session');
  window.location.href = `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Get Auth0 token for API requests
 * @returns {Promise<string|null>} The access token or null
 */
export async function getAccessToken() {
  try {
    const response = await fetch('/api/auth/token');
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.accessToken || null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

export default {
  getSession,
  useAuth,
  login,
  logout,
  getAccessToken
}; 