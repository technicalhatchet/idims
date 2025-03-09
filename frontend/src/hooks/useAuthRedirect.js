import { useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/router';

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
      const userRole = user['https://servicebusiness.com/roles']?.[0];
      
      if (!userRole || !allowedRoles.includes(userRole)) {
        router.push('/unauthorized');
      }
    }
  }, [user, isLoading, router, redirectTo, allowedRoles]);
  
  return { user, isLoading, error, isAuthorized: !!user };
}