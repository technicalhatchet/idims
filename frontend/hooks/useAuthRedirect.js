import { useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';
import { getUserRole } from '../utils/auth0-helpers';

/**
 * Hook to handle authentication redirection
 * @param {Object} options - Options for the hook
 * @param {string} options.redirectTo - Path to redirect to when not authenticated
 * @param {string[]} options.allowedRoles - Roles allowed to access the page
 * @returns {Object} Auth status information
 */
export function useAuthRedirect({ 
  redirectTo = '/api/auth/login', 
  allowedRoles = [] 
} = {}) {
  const { user, isLoading, error } = useUser();
  const router = useRouter();
  
  useEffect(() => {
    // Don't redirect while still loading
    if (isLoading) return;
    
    // If not authenticated, redirect to login
    if (!user) {
      router.push(redirectTo);
      return;
    }
    
    // If roles are specified, check role-based access
    if (allowedRoles.length > 0) {
      // Use the shared getUserRole function from auth0-helpers.js
      const userRole = getUserRole(user);
      
      // Debug the role detection
      console.log('useAuthRedirect - User role detected:', userRole);
      console.log('useAuthRedirect - Allowed roles:', allowedRoles);
      
      // Check if the user's role is in the allowed roles
      // Always allow 'admin' role regardless of what's in allowedRoles
      const isAdmin = userRole === 'admin';
      const isAllowed = allowedRoles.includes(userRole) || isAdmin;
      
      if (!isAllowed) {
        console.log('useAuthRedirect - Access denied, redirecting to unauthorized');
        router.push('/unauthorized');
      }
    }
  }, [user, isLoading, router, redirectTo, allowedRoles]);
  
  // Get userRole using the shared function
  const userRole = user ? getUserRole(user) : null;
  
  // Admin is allowed everywhere
  const isAdmin = userRole === 'admin';
  
  return { 
    user, 
    isLoading, 
    error, 
    isAuthorized: !!user && (!allowedRoles.length || 
      isAdmin || (userRole && allowedRoles.includes(userRole)))
  };
}