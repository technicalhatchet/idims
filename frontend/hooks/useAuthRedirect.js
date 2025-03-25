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
      // Get user role with multiple fallbacks - using the same pattern as DashboardLayout
      let userRole = null;
      
      // Check all possible places where roles might be stored
      if (user['https://idimsapi/roles']?.[0]) {
        userRole = user['https://idimsapi/roles'][0];
      }
      else if (user['https://idimsapi/app_metadata']?.roles?.[0]) {
        userRole = user['https://idimsapi/app_metadata'].roles[0];
      }
      else if (user.app_metadata?.roles?.[0]) {
        userRole = user.app_metadata.roles[0];
      }
      else if (user.roles?.[0]) {
        userRole = user.roles[0];
      }
      else if (user.role) {
        userRole = user.role;
      }
      
      // Standardize role to lowercase for consistency
      if (userRole) {
        userRole = userRole.toLowerCase();
      }
      
      // Debug the role detection
      console.log('useAuthRedirect - User role detected:', userRole);
      console.log('useAuthRedirect - Allowed roles:', allowedRoles);
      
      // Check if the user's role is in the allowed roles
      if (!userRole || !allowedRoles.includes(userRole)) {
        console.log('useAuthRedirect - Access denied, redirecting to unauthorized');
        router.push('/unauthorized');
      }
    }
  }, [user, isLoading, router, redirectTo, allowedRoles]);
  
  // Get userRole for the return value
  let detectedRole = null;
  if (user) {
    if (user['https://idimsapi/roles']?.[0]) {
      detectedRole = user['https://idimsapi/roles'][0];
    }
    else if (user['https://idimsapi/app_metadata']?.roles?.[0]) {
      detectedRole = user['https://idimsapi/app_metadata'].roles[0];
    }
    else if (user.app_metadata?.roles?.[0]) {
      detectedRole = user.app_metadata.roles[0];
    }
    else if (user.roles?.[0]) {
      detectedRole = user.roles[0];
    }
    else if (user.role) {
      detectedRole = user.role;
    }
    
    if (detectedRole) {
      detectedRole = detectedRole.toLowerCase();
    }
  }
  
  return { 
    user, 
    isLoading, 
    error, 
    isAuthorized: !!user && (!allowedRoles.length || 
      (detectedRole && allowedRoles.includes(detectedRole)))
  };
}