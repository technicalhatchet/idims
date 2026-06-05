/**
 * Auth0 compatibility layer
 * 
 * This file provides a consistent API for Auth0 functions across different
 * Auth0 SDK versions.
 */

import { useUser } from '@auth0/nextjs-auth0/client';
import { withPageAuthRequired as withPageAuth } from '@auth0/nextjs-auth0';
import { Auth0Provider } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

// Re-export Auth0 functions for direct use
export const originalWithPageAuthRequired = withPageAuth;

/**
 * Helper function to get a user's role from Auth0 data
 * Checks various locations where role might be stored
 */
export const getUserRole = (user) => {
  if (!user) return null;
  
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
  else if (user.app_metadata?.role) {
    userRole = user.app_metadata.role;
  }
  
  // Check namespaced claims as a last resort
  if (!userRole) {
    const rolesClaim = Object.keys(user).find(key => 
      key.includes('/roles') || 
      key.includes('/role') || 
      key === 'roles' ||
      key === 'role'
    );
    
    if (rolesClaim && user[rolesClaim]) {
      const roles = user[rolesClaim];
      // Handle both string and array formats
      userRole = Array.isArray(roles) ? roles[0] : roles;
    }
  }
  
  // Standardize role to lowercase for consistency
  if (userRole) {
    userRole = userRole.toLowerCase();
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn('No role found for user, using default "client" role');
    userRole = 'client';
  } else {
    userRole = 'client';
  }

  return userRole;
};

/**
 * Server-side helper function to get a user's role from session data
 * This is used in getServerSideProps functions where hooks can't be used
 */
export const getUserRoleFromSession = (user) => {
  if (!user) return null;
  
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
  else if (user.app_metadata?.role) {
    userRole = user.app_metadata.role;
  }
  
  // Check namespaced claims as a last resort
  if (!userRole) {
    const rolesClaim = Object.keys(user).find(key => 
      key.includes('/roles') || 
      key.includes('/role') || 
      key === 'roles' ||
      key === 'role'
    );
    
    if (rolesClaim && user[rolesClaim]) {
      const roles = user[rolesClaim];
      // Handle both string and array formats
      userRole = Array.isArray(roles) ? roles[0] : roles;
    }
  }
  
  // Check for hard-coded user ID for admin access
  if (!userRole && user.sub === 'google-oauth2|110674600011943435167') {
    userRole = 'admin';
  }
  
  // Standardize role to lowercase for consistency
  if (userRole) {
    userRole = userRole.toLowerCase();
  } else {
    userRole = 'client';
  }

  return userRole;
};

/**
 * Custom withAuth HOC that works in both client and server environments
 * This prevents server-side rendering errors by only checking auth on the client
 */
export const withPageAuthRequired = (Component, options = {}) => {
  const WithAuth = (props) => {
    const [isClient, setIsClient] = useState(false);
    const { user, isLoading, error } = useUser();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    
    // Only check authentication on the client side
    useEffect(() => {
      setIsClient(true);
      
      // If not authenticated, redirect to login
      if (!isLoading && !user && isClient) {
        router.push('/api/auth/login');
        return;
      }
      
      // Check role-based access if roles are specified
      if (!isLoading && user && options.requiredRole) {
        const userRole = getUserRole(user);
        const roleHierarchy = {
          'client': ['client'],
          'technician': ['technician', 'client'],
          'manager': ['manager', 'technician', 'client'],
          'admin': ['admin', 'manager', 'technician', 'client']
        };
        
        const hasAccess = roleHierarchy[userRole]?.includes(options.requiredRole);
        
        if (!hasAccess) {
          console.warn(`Access denied: User role "${userRole}" does not have access to "${options.requiredRole}" resources`);
          router.push('/unauthorized');
          return;
        }
      }
      
      // User is authenticated and authorized
      if (user) {
        setAuthorized(true);
      }
    }, [user, isLoading, router, isClient]);
    
    // During SSR or static generation, render a placeholder or loading state
    if (!isClient || isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 w-full max-w-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error.message || 'An error occurred'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // If we're on the client and there's no user after loading, return null (redirect will happen)
    if (!user || !authorized) {
      return null;
    }
    
    // Otherwise, render the protected component with its props
    return <Component {...props} />;
  };
  
  // Copy static and getInitialProps from the original component
  if (Component.getInitialProps) {
    WithAuth.getInitialProps = Component.getInitialProps;
  }

  // Preserve layout function
  if (Component.getLayout) {
    WithAuth.getLayout = Component.getLayout;
  }
  
  WithAuth.displayName = `WithPageAuthRequired(${Component.displayName || Component.name || 'Component'})`;
  return WithAuth;
};

/**
 * Helper for authenticated pages that need to work with static generation
 * This prevents build errors when Next.js tries to statically generate auth pages
 */
export const getStaticPropsWithFallback = () => {
  // During static build, return empty props
  return {
    props: {}
  };
};

// Export the hooks and components
export { useUser, Auth0Provider };
export { useUserRole } from '../context/UserRoleContext'; 